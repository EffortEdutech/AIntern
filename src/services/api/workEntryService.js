/**
 * WorkLedger - Work Entry Service
 *
 * Handles all work entry operations (CRUD, status transitions, filtering).
 * Integrates with template system for dynamic form data storage.
 *
 * SESSION 10 UPDATE: getUserWorkEntries and getWorkEntriesCount now accept
 * optional `orgId` from OrganizationContext. When passed, queries filter
 * directly by organization_id (column added in Session 9 migration 023).
 *
 * SESSION 18 UPDATE: Offline-first writes via IndexedDB (Dexie).
 *   - createWorkEntry: saves to IndexedDB first, pushes to Supabase if online,
 *     otherwise queues in syncQueue for later sync.
 *   - updateWorkEntry: online-first with IndexedDB cache update; falls back to
 *     offline queue if Supabase is unreachable.
 *   - getUserWorkEntries: caches results to IndexedDB after each fetch; falls
 *     back to IndexedDB when offline.
 *
 * SESSION 19 FIX: All supabase.auth.getUser() calls replaced with getSession().
 *   getUser() makes a live HTTPS request to Supabase — fails offline with
 *   ERR_NAME_NOT_RESOLVED → user = null → created_by = null stored in
 *   IndexedDB → NOT NULL constraint violation on sync push.
 *   getSession() reads the JWT from localStorage — no network, always works.
 *
 * @module services/api/workEntryService
 * @created February 1, 2026 - Session 13
 * @updated February 20, 2026 - Session 10: orgId param for org switching
 * @updated March 4, 2026     - Session 18: offline-first IndexedDB integration
 * @updated April 5, 2026     - Session 19: getUser → getSession (offline fix)
 * @updated May 16, 2026      - Session 20: getPendingApprovals includes subcontractor orgs
 */

import { supabase } from '../supabase/client';
import { db, SYNC_STATUS } from '../offline/db';

class WorkEntryService {
  // ─────────────────────────────────────────────
  // READ — LIST
  // ─────────────────────────────────────────────

  /**
   * Get work entries visible to current user.
   *
   * For regular users: RLS limits results to their own entries + manager-visible entries.
   * For BJ staff viewing a specific org: filters by organization_id directly.
   *
   * SESSION 18: Results are cached to IndexedDB after each successful fetch.
   * When offline (or Supabase unreachable), falls back to IndexedDB.
   *
   * @param {Object} filters - Optional filters (contractId, status, startDate, endDate, sortBy, sortOrder)
   * @param {string|null} orgId - From OrganizationContext. Pass null for own-org behaviour.
   * @returns {Promise<{success: boolean, data: Array, error: string|null, isOffline?: boolean}>}
   */
  async getUserWorkEntries(filters = {}, orgId = null) {
    try {
      console.log('📋 Fetching work entries...', orgId ? `(org: ${orgId})` : '(user scope)');

      // SESSION 19 FIX: getSession() reads local JWT — no network call, works offline
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        throw new Error('User not authenticated');
      }

      let query = supabase
        .from('work_entries')
        .select(`
          id,
          contract_id,
          template_id,
          entry_date,
          shift,
          data,
          status,
          organization_id,
          created_by,
          created_at,
          updated_at,
          submitted_at,
          submitted_by,
          approved_at,
          approved_by,
          approval_remarks,
          rejected_at,
          rejected_by,
          rejection_reason,
          deleted_at,
          contract:contracts (
            id,
            contract_number,
            contract_name,
            contract_category,
            project:projects (
              id,
              project_name,
              client_name
            )
          ),
          template:templates (
            id,
            template_name,
            contract_category
          )
        `)
        .is('deleted_at', null);

      // ── Org filter ──────────────────────────────────────────────────
      // SESSION 15 FIX: When orgId is supplied (main contractor like MTSB),
      // we must ALSO include entries from linked subcontractor orgs.
      //
      // SESSION 21 FIX: Always include entries where created_by = current user,
      // even if organization_id is null or wrong. This covers entries that were
      // pushed to Supabase before the trigger was in place (organization_id = null).
      // RLS already restricts rows to what the user is allowed to see, so adding
      // created_by as an OR condition is safe and never leaks other users' data.
      if (orgId) {
        const { data: subconRels } = await supabase
          .from('subcontractor_relationships')
          .select('subcontractor_org_id')
          .eq('main_contractor_org_id', orgId)
          .eq('status', 'active');

        const subconOrgIds = (subconRels || []).map((r) => r.subcontractor_org_id);
        const allOrgIds    = subconOrgIds.length > 0 ? [orgId, ...subconOrgIds] : [orgId];

        if (subconOrgIds.length > 0) {
          console.log(`🔗 Including subcontractor entries from ${subconOrgIds.length} orgs`);
        }

        // Include org entries AND any entry created by this user (catches null-org entries)
        query = query.or(
          `organization_id.in.(${allOrgIds.join(',')}),created_by.eq.${user.id}`
        );
      }
      // If orgId null → RLS handles visibility (user sees their own entries)

      // ── Additional filters ──
      if (filters.contractId) {
        query = query.eq('contract_id', filters.contractId);
      }
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.startDate) {
        query = query.gte('entry_date', filters.startDate);
      }
      if (filters.endDate) {
        query = query.lte('entry_date', filters.endDate);
      }

      // ── Sorting ──
      const sortBy = filters.sortBy || 'entry_date';
      const sortOrder = filters.sortOrder || 'desc';
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });

      const { data, error } = await query;

      if (error) {
        console.error('❌ Failed to fetch work entries:', error);
        throw error;
      }

      console.log(`✅ Fetched ${data.length} work entries`);

      // SESSION 18: Cache to IndexedDB for offline use (fire-and-forget)
      this._cacheWorkEntriesToLocal(data).catch((e) =>
        console.warn('⚠️ Work entry cache failed:', e.message)
      );

      return { success: true, data: data || [] };
    } catch (error) {
      console.error('❌ Error in getUserWorkEntries:', error);

      // SESSION 18: Offline fallback — serve from IndexedDB
      if (!navigator.onLine || error.message?.includes('Failed to fetch')) {
        return await this._getWorkEntriesFromLocal(filters, orgId);
      }

      return { success: false, data: [], error: error.message };
    }
  }

  /**
   * Get work entries count for dashboard stats.
   * @param {string|null} orgId - From OrganizationContext.
   */
  async getWorkEntriesCount(orgId = null) {
    try {
      let query = supabase
        .from('work_entries')
        .select('*', { count: 'exact', head: true })
        .is('deleted_at', null);

      if (orgId) {
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;

        const { data: subconRels } = await supabase
          .from('subcontractor_relationships')
          .select('subcontractor_org_id')
          .eq('main_contractor_org_id', orgId)
          .eq('status', 'active');

        const subconOrgIds = (subconRels || []).map((r) => r.subcontractor_org_id);
        const allOrgIds    = subconOrgIds.length > 0 ? [orgId, ...subconOrgIds] : [orgId];

        // Mirror the same OR logic as getUserWorkEntries — include user's own entries
        if (userId) {
          query = query.or(`organization_id.in.(${allOrgIds.join(',')}),created_by.eq.${userId}`);
        } else {
          query = query.in('organization_id', allOrgIds);
        }
      }

      const { count, error } = await query;

      if (error) {
        console.error('❌ Error getting work entries count:', error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error('❌ Exception getting work entries count:', error);
      return 0;
    }
  }

  // ─────────────────────────────────────────────
  // READ — SINGLE
  // ─────────────────────────────────────────────

  /**
   * Get single work entry by ID.
   * @param {string} id - Work entry ID
   * @returns {Promise<{success: boolean, data: Object|null, error: string|null}>}
   */
  async getWorkEntry(id) {
    try {
      console.log('📄 Fetching work entry:', id);

      const { data, error } = await supabase
        .from('work_entries')
        .select(`
          id,
          contract_id,
          template_id,
          entry_date,
          shift,
          data,
          status,
          organization_id,
          created_by,
          created_at,
          updated_at,
          submitted_at,
          submitted_by,
          approved_at,
          approved_by,
          approval_remarks,
          rejected_at,
          rejected_by,
          rejection_reason,
          deleted_at,
          contract:contracts (
            id,
            contract_number,
            contract_name,
            contract_category,
            contract_type,
            reporting_frequency,
            project:projects (
              id,
              project_name,
              client_name,
              organization:organizations (id, name)
            )
          ),
          template:templates (
            id,
            template_id,
            template_name,
            contract_category,
            fields_schema
          )
        `)
        .eq('id', id)
        .is('deleted_at', null)
        .single();

      if (error) {
        console.error('❌ Failed to fetch work entry:', error);
        throw error;
      }

      if (!data) {
        throw new Error('Work entry not found');
      }

      console.log('✅ Fetched work entry:', data.id);
      return { success: true, data };
    } catch (error) {
      console.error('❌ Error in getWorkEntry:', error);
      return { success: false, data: null, error: error.message };
    }
  }

  // ─────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────

  /**
   * Create a new work entry.
   *
   * SESSION 18 — Offline-first pattern:
   *   1. Save to IndexedDB immediately (always succeeds instantly)
   *   2. If online → push to Supabase, update local record with remoteId
   *   3. If offline → add to syncQueue for later push
   *
   * Accepts EITHER a flat object OR three separate arguments (backward-compat).
   *
   *   Flat object (NewWorkEntry.jsx pattern):
   *     createWorkEntry({ contract_id, template_id, entry_date, shift, data, status })
   *
   *   Three args (legacy pattern):
   *     createWorkEntry(contractId, templateId, { entry_date, shift, data })
   *
   * SESSION 19 FIX: getSession() instead of getUser() — works offline.
   */
  async createWorkEntry(contractIdOrFlat, templateId, entryData) {
    try {
      // ── Normalise to flat object ──────────────────────────────────
      let flat;
      if (contractIdOrFlat !== null && typeof contractIdOrFlat === 'object') {
        flat = contractIdOrFlat;
      } else {
        flat = {
          contract_id: contractIdOrFlat,
          template_id: templateId,
          entry_date: entryData?.entry_date,
          shift: entryData?.shift,
          data: entryData?.data,
          status: entryData?.status || 'draft'
        };
      }

      console.log('📝 Creating work entry for contract:', flat.contract_id);

      // SESSION 19 FIX: getSession() reads local JWT — no network call, works offline
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        throw new Error('User not authenticated');
      }

      const payload = {
        contract_id: flat.contract_id,
        template_id: flat.template_id || null,
        entry_date: flat.entry_date || new Date().toISOString().split('T')[0],
        shift: flat.shift || null,
        data: flat.data || {},
        status: flat.status || 'draft',
        submitted_at: flat.submitted_at || null,
        created_by: user.id,
        // SESSION 21 FIX: Pass organization_id explicitly from the form (currentOrg?.id).
        // The DB trigger intended to auto-set this from contracts.organization_id was never
        // applied, so new entries landed with organization_id = null. getUserWorkEntries
        // filters by organization_id = orgId, which silently excluded all new entries.
        organization_id: flat.organization_id ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // ── STEP 1: Save to IndexedDB first (always, instant) ────────────
      let localId;
      try {
        localId = await db.workEntries.add({
          ...payload,
          remoteId: null,
          sync_status: SYNC_STATUS.PENDING
        });
        console.log('💾 Saved to IndexedDB locally (localId:', localId, ')');
      } catch (dbError) {
        console.warn('⚠️ IndexedDB save failed (continuing):', dbError.message);
      }

      // ── STEP 2: Push to Supabase if online ───────────────────────────
      if (navigator.onLine) {
        try {
          const { data, error } = await supabase
            .from('work_entries')
            .insert(payload)
            .select()
            .single();

          if (!error && data) {
            // Update the local IndexedDB record with the Supabase UUID
            if (localId) {
              await db.workEntries.update(localId, {
                remoteId: data.id,
                sync_status: SYNC_STATUS.SYNCED
              });
            }

            // ── Audit log (non-blocking) ────────────────────────────
            supabase.from('activity_logs').insert({
              action:        'CREATE_WORK_ENTRY',
              entity_type:   'work_entry',
              entity_id:     data.id,
              actor_user_id: user.id,
              actor_org_id:  data.organization_id ?? null,
              metadata: {
                entry_date:  data.entry_date,
                status:      data.status,
                contract_id: data.contract_id,
              },
              created_at: new Date().toISOString(),
            }).then(({ error: logErr }) => {
              if (logErr) console.warn('⚠️ activity_log (create) failed:', logErr.message);
            });

            console.log('✅ Work entry created (online):', data.id);
            return { success: true, data };
          }

          if (error) {
            console.warn('⚠️ Supabase error, entry saved offline:', error.message);
          }
        } catch (networkError) {
          console.log('📡 Network unavailable, entry saved offline:', networkError.message);
        }
      }

      // ── STEP 3: Offline (or Supabase unreachable) — queue for sync ───
      if (localId) {
        try {
          await db.syncQueue.add({
            entity_type: 'work_entry',
            entity_local_id: localId,
            action: 'create',
            payload: JSON.stringify(payload),
            sync_status: SYNC_STATUS.PENDING,
            retry_count: 0,
            created_at: new Date().toISOString()
          });
          console.log('📋 Entry queued for sync when online');
        } catch (queueError) {
          console.warn('⚠️ Could not add to sync queue:', queueError.message);
        }
      }

      console.log('📱 Work entry saved offline (localId:', localId, ')');
      return {
        success: true,
        isOffline: true,
        data: {
          ...payload,
          id: null,
          _localId: localId
        }
      };
    } catch (error) {
      console.error('❌ Exception creating work entry:', error);
      return { success: false, error: error.message };
    }
  }

  // ─────────────────────────────────────────────
  // UPDATE
  // ─────────────────────────────────────────────

  /**
   * Update work entry data (draft only).
   *
   * SESSION 18 — Offline-aware pattern:
   *   - If online: push to Supabase (primary path), then update IndexedDB cache.
   *   - If offline: update IndexedDB and add to syncQueue.
   *
   * @param {string} id - Work entry remote ID (Supabase UUID)
   * @param {Object} updates - Fields to update
   */
  async updateWorkEntry(id, updates) {
    try {
      console.log('📝 Updating work entry:', id);

      const updateData = {
        ...updates,
        updated_at: new Date().toISOString()
      };

      // Protect immutable fields
      delete updateData.id;
      delete updateData.contract_id;
      delete updateData.created_by;
      delete updateData.created_at;
      delete updateData.organization_id;

      // ── If online: push to Supabase (primary path) ────────────────────
      if (navigator.onLine) {
        try {
          const { data, error } = await supabase
            .from('work_entries')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

          if (!error && data) {
            // Also update in IndexedDB (keep local cache in sync)
            try {
              const localEntry = await db.workEntries.where('remoteId').equals(id).first();
              if (localEntry) {
                await db.workEntries.update(localEntry.localId, {
                  ...updateData,
                  sync_status: SYNC_STATUS.SYNCED
                });
              }
            } catch (dbError) {
              console.warn('⚠️ IndexedDB cache update failed:', dbError.message);
            }

            console.log('✅ Work entry updated (online):', id);
            return { success: true, data };
          }

          if (error) {
            console.warn('⚠️ Supabase error, queuing update:', error.message);
          }
        } catch (networkError) {
          console.log('📡 Network unavailable, queuing update:', networkError.message);
        }
      }

      // ── Offline: update IndexedDB + queue for sync ────────────────────
      try {
        const localEntry = await db.workEntries.where('remoteId').equals(id).first();

        if (localEntry) {
          await db.workEntries.update(localEntry.localId, {
            ...updateData,
            sync_status: SYNC_STATUS.PENDING
          });

          await db.syncQueue.add({
            entity_type: 'work_entry',
            entity_local_id: localEntry.localId,
            action: 'update',
            payload: JSON.stringify({ id, ...updateData }),
            sync_status: SYNC_STATUS.PENDING,
            retry_count: 0,
            created_at: new Date().toISOString()
          });

          console.log('📱 Work entry updated offline (localId:', localEntry.localId, ')');
          return {
            success: true,
            isOffline: true,
            data: { ...localEntry, ...updateData }
          };
        }
      } catch (dbError) {
        console.warn('⚠️ IndexedDB update failed:', dbError.message);
      }

      return { success: false, error: 'Could not update entry. Please try again when online.' };
    } catch (error) {
      console.error('❌ Exception updating work entry:', error);
      return { success: false, error: error.message };
    }
  }

  // ─────────────────────────────────────────────
  // STATUS TRANSITIONS
  // ─────────────────────────────────────────────

  /**
   * Submit work entry for approval.
   * @param {string} id - Work entry ID
   */
  async submitWorkEntry(id) {
    try {
      console.log('📤 Submitting work entry:', id);

      // SESSION 19 FIX: getSession() reads local JWT — no network call
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      const { data, error } = await supabase
        .from('work_entries')
        .update({
          status: 'submitted',
          submitted_at: new Date().toISOString(),
          submitted_by: user.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('status', 'draft')
        .select()
        .single();

      if (error) {
        console.error('❌ Error submitting work entry:', error);
        return { success: false, error: error.message };
      }

      // ── Audit log (non-blocking) ──────────────────────────────────
      supabase.from('activity_logs').insert({
        action:        'SUBMIT_WORK_ENTRY',
        entity_type:   'work_entry',
        entity_id:     id,
        actor_user_id: user.id,
        actor_org_id:  data?.organization_id ?? null,
        metadata: {
          entry_date:  data?.entry_date,
          contract_id: data?.contract_id,
        },
        created_at: new Date().toISOString(),
      }).then(({ error: logErr }) => {
        if (logErr) console.warn('⚠️ activity_log (submit) failed:', logErr.message);
      });

      console.log('✅ Work entry submitted:', id);
      return { success: true, data };
    } catch (error) {
      console.error('❌ Exception submitting work entry:', error);
      return { success: false, error: error.message };
    }
  }

  // ─────────────────────────────────────────────
  // DELETE
  // ─────────────────────────────────────────────

  /**
   * Soft-delete a work entry.
   *
   * SESSION 15 — Ownership guard + audit log:
   *   1. Fetch entry to confirm caller's org OWNS it
   *   2. Refuse if organization_id ≠ caller's org (subcon protection)
   *   3. Soft-delete (set deleted_at)
   *   4. Write to activity_logs table for audit trail
   *
   * @param {string} id - Work entry ID
   * @param {string} callerOrgId - Caller's current org ID (from OrganizationContext)
   */
  async deleteWorkEntry(id, callerOrgId = null) {
    try {
      console.log('🗑️ Deleting work entry:', id);

      // SESSION 19 FIX: getSession() reads local JWT — no network call
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        throw new Error('User not authenticated');
      }

      // ── Ownership guard ───────────────────────────────────────────
      const { data: entry, error: fetchError } = await supabase
        .from('work_entries')
        .select('id, organization_id, contract_id, entry_date, status, created_by')
        .eq('id', id)
        .single();

      if (fetchError || !entry) {
        return { success: false, error: 'Work entry not found.' };
      }

      if (callerOrgId && entry.organization_id !== callerOrgId) {
        console.warn('⛔ Delete blocked — entry belongs to org:', entry.organization_id, 'caller org:', callerOrgId);
        return {
          success: false,
          error: "You cannot delete a subcontractor's work entry. Only the performing organisation can delete their own entries."
        };
      }

      // ── Soft delete ───────────────────────────────────────────────
      const now = new Date().toISOString();

      const { error: deleteError } = await supabase
        .from('work_entries')
        .update({ deleted_at: now, updated_at: now })
        .eq('id', id);

      if (deleteError) {
        console.error('❌ Error deleting work entry:', deleteError);
        return { success: false, error: deleteError.message };
      }

      // ── Audit log (non-blocking) ──────────────────────────────────
      try {
        await supabase.from('activity_logs').insert({
          action: 'DELETE_WORK_ENTRY',
          entity_type: 'work_entry',
          entity_id: id,
          actor_user_id: user.id,
          actor_org_id: callerOrgId,
          target_org_id: entry.organization_id,
          metadata: {
            entry_date: entry.entry_date,
            entry_status: entry.status,
            contract_id: entry.contract_id,
            created_by: entry.created_by
          },
          created_at: now
        });
        console.log('📋 Audit log written for delete:', id);
      } catch (auditErr) {
        console.warn('⚠️ Could not write audit log:', auditErr.message);
      }

      console.log('✅ Work entry deleted (soft):', id);
      return { success: true };
    } catch (error) {
      console.error('❌ Exception deleting work entry:', error);
      return { success: false, error: error.message };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // APPROVAL WORKFLOW — Session 16
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get all submitted work entries awaiting approval for an org.
   *
   * Two modes:
   *   countOnly = false (default) → full entry list for ApprovalsPage
   *   countOnly = true            → count only for Sidebar badge (cheap query)
   *
   * SESSION 20 FIX: Cross-org approvals.
   * Also includes submitted entries from active subcontractor orgs so that a main
   * contractor (e.g. MTSB) can approve work submitted by subcontractor field workers.
   * The org scope is resolved once via subcontractor_relationships before branching
   * into the countOnly vs full-query paths.
   *
   * @param {string}  orgId     - Organization ID from OrganizationContext
   * @param {boolean} countOnly - If true, returns count only
   * @returns {Promise<{success: boolean, data?: Array, count?: number, error?: string}>}
   */
  async getPendingApprovals(orgId, countOnly = false) {
    try {
      if (!orgId) {
        return countOnly ? { success: true, count: 0 } : { success: true, data: [] };
      }

      console.log('⏳ Fetching pending approvals for org:', orgId, countOnly ? '(count only)' : '');

      // SESSION 20 FIX: Cross-org approvals.
      // Main contractors must be able to approve entries submitted by subcontractor
      // orgs under contracts they awarded. Fetch all active subcontractor org IDs
      // first — same pattern as getUserWorkEntries (Session 15).
      const { data: subconRels } = await supabase
        .from('subcontractor_relationships')
        .select('subcontractor_org_id')
        .eq('main_contractor_org_id', orgId)
        .eq('status', 'active');

      const subconOrgIds = (subconRels || []).map((r) => r.subcontractor_org_id);
      const orgScope = subconOrgIds.length > 0 ? [orgId, ...subconOrgIds] : null;

      if (subconOrgIds.length > 0) {
        console.log(`🔗 Approvals scope: own org + ${subconOrgIds.length} subcontractor org(s)`);
      }

      if (countOnly) {
        let query = supabase
          .from('work_entries')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'submitted')
          .is('deleted_at', null);

        query = orgScope ? query.in('organization_id', orgScope) : query.eq('organization_id', orgId);

        const { count, error } = await query;

        if (error) {
          throw error;
        }

        console.log(`✅ Pending approvals count: ${count || 0}`);
        return { success: true, count: count || 0 };
      } else {
        let query = supabase
          .from('work_entries')
          .select(`
            id,
            entry_date,
            shift,
            status,
            organization_id,
            submitted_at,
            submitted_by,
            created_by,
            contract:contracts (
              id,
              contract_number,
              contract_name,
              contract_category
            ),
            template:templates (
              id,
              template_name
            )
          `)
          .eq('status', 'submitted')
          .is('deleted_at', null)
          .order('submitted_at', { ascending: true });

        query = orgScope ? query.in('organization_id', orgScope) : query.eq('organization_id', orgId);

        const { data, error } = await query;

        if (error) {
          throw error;
        }

        console.log(`✅ Fetched ${data?.length || 0} pending approvals`);
        return { success: true, data: data || [] };
      }
    } catch (error) {
      console.error('❌ getPendingApprovals failed:', error);
      return countOnly
        ? { success: false, count: 0, error: error.message }
        : { success: false, data: [], error: error.message };
    }
  }

  /**
   * Approve a submitted work entry.
   *
   * @param {string} entryId  - work_entries.id
   * @param {string} remarks  - Optional approval remarks from manager
   * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
   */
  async approveWorkEntry(entryId, remarks = '') {
    try {
      console.log('✅ Approving work entry:', entryId);

      // SESSION 19 FIX: getSession() reads local JWT — no network call
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        throw new Error('Not authenticated');
      }

      // SESSION 20: Resolve approver name for email notification
      let profile = null;
      try {
        const { data: profileData } = await supabase
          .from('user_profiles').select('full_name').eq('id', user.id).single();
        profile = profileData;
      } catch { /* non-fatal — will use email as fallback */ }

      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from('work_entries')
        .update({
          status: 'approved',
          approved_by: user.id,
          approved_at: now,
          approval_remarks: remarks?.trim() || null,
          updated_at: now
        })
        .eq('id', entryId)
        .eq('status', 'submitted')
        .select('id, status, organization_id, contract_id, entry_date, created_by, contract:contracts(contract_number)')
        .single();

      if (error) {
        console.error('❌ Supabase approve error:', error);
        throw error;
      }
      if (!data) {
        throw new Error('Entry not found, already approved, or insufficient permissions');
      }

      try {
        await supabase.from('activity_logs').insert({
          action: 'APPROVE_WORK_ENTRY',
          entity_type: 'work_entry',
          entity_id: entryId,
          actor_user_id: user.id,
          actor_org_id: data.organization_id,
          metadata: {
            approval_remarks: remarks?.trim() || null,
            entry_date: data.entry_date,
            contract_id: data.contract_id,
            technician_id: data.created_by
          },
          created_at: now
        });
      } catch (logError) {
        console.warn('⚠️ Failed to write approval audit log:', logError.message);
      }

      console.log('✅ Work entry approved:', entryId);

      // SESSION 20: Fire-and-forget email to the technician
      this._notifyTechnician('approved', data, profile?.full_name || user.email).catch(() => {});

      return { success: true, data };
    } catch (error) {
      console.error('❌ approveWorkEntry failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Reject a submitted work entry.
   *
   * @param {string} entryId - work_entries.id
   * @param {string} reason  - REQUIRED rejection reason
   * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
   */
  async rejectWorkEntry(entryId, reason) {
    try {
      if (!reason?.trim()) {
        return {
          success: false,
          error: 'Rejection reason is required. Please explain what needs to be corrected.'
        };
      }

      console.log('❌ Rejecting work entry:', entryId);

      // SESSION 19 FIX: getSession() reads local JWT — no network call
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        throw new Error('Not authenticated');
      }

      // SESSION 20: Resolve approver name for email notification
      let profile = null;
      try {
        const { data: profileData } = await supabase
          .from('user_profiles').select('full_name').eq('id', user.id).single();
        profile = profileData;
      } catch { /* non-fatal — will use email as fallback */ }

      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from('work_entries')
        .update({
          status: 'rejected',
          rejected_by: user.id,
          rejected_at: now,
          rejection_reason: reason.trim(),
          updated_at: now
        })
        .eq('id', entryId)
        .eq('status', 'submitted')
        .select('id, status, organization_id, contract_id, template_id, entry_date, created_by, data')
        .single();

      if (error) {
        console.error('❌ Supabase reject error:', error);
        throw error;
      }
      if (!data) {
        throw new Error('Entry not found, already processed, or insufficient permissions');
      }

      try {
        const { count: prevCount } = await supabase
          .from('reject_entry_history')
          .select('id', { count: 'exact', head: true })
          .eq('work_entry_id', entryId);

        const rejectionCount = (prevCount || 0) + 1;

        await supabase.from('reject_entry_history').insert({
          work_entry_id: entryId,
          organization_id: data.organization_id,
          contract_id: data.contract_id,
          template_id: data.template_id,
          entry_date: data.entry_date,
          entry_created_by: data.created_by,
          rejected_by: user.id,
          rejected_at: now,
          rejection_reason: reason.trim(),
          rejection_count: rejectionCount,
          entry_data_snapshot: typeof data.data === 'string' ? JSON.parse(data.data) : (data.data || {}),
          created_at: now
        });

        console.log(`📋 Rejection #${rejectionCount} logged to reject_entry_history`);
      } catch (histError) {
        console.warn('⚠️ Failed to write to reject_entry_history:', histError.message);
      }

      try {
        await supabase.from('activity_logs').insert({
          action: 'REJECT_WORK_ENTRY',
          entity_type: 'work_entry',
          entity_id: entryId,
          actor_user_id: user.id,
          actor_org_id: data.organization_id,
          metadata: {
            rejection_reason: reason.trim(),
            entry_date: data.entry_date,
            contract_id: data.contract_id,
            technician_id: data.created_by
          },
          created_at: now
        });
      } catch (logError) {
        console.warn('⚠️ Failed to write rejection audit log:', logError.message);
      }

      console.log('✅ Work entry rejected:', entryId);

      // SESSION 20: Fire-and-forget email to the technician
      this._notifyTechnician('rejected', data, profile?.full_name || user.email, reason.trim()).catch(() => {});

      return { success: true, data };
    } catch (error) {
      console.error('❌ rejectWorkEntry failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Resubmit a rejected work entry after corrections.
   *
   * @param {string} entryId - work_entries.id
   * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
   */
  async resubmitWorkEntry(entryId) {
    try {
      console.log('🔄 Resubmitting work entry:', entryId);

      // SESSION 19 FIX: getSession() reads local JWT — no network call
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        throw new Error('Not authenticated');
      }

      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from('work_entries')
        .update({
          status: 'submitted',
          submitted_at: now,
          submitted_by: user.id,
          updated_at: now
          // Intentionally NOT clearing rejected_by / rejected_at / rejection_reason
          // so ApprovalHistory can display the full audit trail.
        })
        .eq('id', entryId)
        .eq('status', 'rejected')
        .select('id, status')
        .single();

      if (error) {
        console.error('❌ Supabase resubmit error:', error);
        throw error;
      }
      if (!data) {
        throw new Error('Entry not found or not in rejected status');
      }

      console.log('✅ Work entry resubmitted:', entryId);
      return { success: true, data };
    } catch (error) {
      console.error('❌ resubmitWorkEntry failed:', error);
      return { success: false, error: error.message };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SESSION 18 — IndexedDB HELPERS (private)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Cache Supabase work entries into IndexedDB for offline use.
   * Called after every successful getUserWorkEntries() fetch.
   * Non-blocking — never throws to caller.
   *
   * @param {Array} entries - Supabase work entry rows
   */
  async _cacheWorkEntriesToLocal(entries) {
    for (const entry of entries) {
      try {
        const existing = await db.workEntries.where('remoteId').equals(entry.id).first();
        const mapped = { ...entry, remoteId: entry.id, sync_status: SYNC_STATUS.SYNCED };

        if (existing) {
          const serverIsNewer =
            !existing.updated_at || (entry.updated_at && entry.updated_at > existing.updated_at);
          if (serverIsNewer) {
            await db.workEntries.update(existing.localId, mapped);
          }
        } else {
          await db.workEntries.add(mapped);
        }
      } catch {
        // Per-entry failure is non-fatal
      }
    }
  }

  /**
   * Fallback: load work entries from IndexedDB when Supabase is unreachable.
   * Applies basic filters and optional org scoping.
   *
   * @param {Object} filters - Same filter shape as getUserWorkEntries
   * @param {string|null} orgId - Active org ID for scoped offline fallback
   * @returns {Promise<{success: boolean, data: Array, isOffline: boolean, error?: string}>}
   */
  async _getWorkEntriesFromLocal(filters = {}, orgId = null) {
    try {
      let entries = await db.workEntries
        .orderBy('entry_date')
        .reverse()
        .toArray();

      if (orgId) {
        // Same OR logic as the online path: include org entries + user's own entries
        // (handles entries where organization_id was never set correctly)
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        entries = entries.filter((e) =>
          e.organization_id === orgId || (userId && e.created_by === userId)
        );
      }

      if (filters.contractId) {
        entries = entries.filter((e) => e.contract_id === filters.contractId);
      }
      if (filters.status) {
        entries = entries.filter((e) => e.status === filters.status);
      }
      if (filters.startDate) {
        entries = entries.filter((e) => e.entry_date >= filters.startDate);
      }
      if (filters.endDate) {
        entries = entries.filter((e) => e.entry_date <= filters.endDate);
      }

      console.log(
        `📱 Loaded ${entries.length} work entries from IndexedDB (offline${orgId ? `, org: ${orgId}` : ''})`
      );

      return { success: true, data: entries, isOffline: true };
    } catch (error) {
      console.error('❌ IndexedDB fallback failed:', error);
      return { success: false, data: [], error: 'Could not load offline data.' };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // END OF SESSION 18 ADDITIONS
  // ─────────────────────────────────────────────────────────────────────────

  // ─────────────────────────────────────────────────────────────────────────
  // EMAIL NOTIFICATIONS — Session 20

  /**
   * Fire-and-forget email to the technician who submitted the entry.
   * Calls Supabase Edge Function `notify-approval` (non-blocking).
   * A failed email NEVER blocks the approval/rejection from completing.
   *
   * @param {'approved'|'rejected'} type
   * @param {Object} entry  - work_entries row (must include contract.contract_number)
   * @param {string} approverName - full name of the manager taking action
   * @param {string} [reason]     - rejection reason (rejected only)
   */
  async _notifyTechnician(type, entry, approverName, reason) {
    try {
      const { data: techProfile, error: profileError } = await supabase
        .from('user_profiles')
        .select('full_name, email')
        .eq('id', entry.created_by)
        .single();

      if (profileError || !techProfile?.email) {
        console.warn('\u26a0\ufe0f _notifyTechnician: could not resolve recipient email', profileError?.message);
        return;
      }

      const payload = {
        type,
        entryId:        entry.id,
        recipientEmail: techProfile.email,
        recipientName:  techProfile.full_name || 'Team Member',
        approverName:   approverName          || 'Your Manager',
        contractNumber: entry.contract?.contract_number || entry.contract_id || '\u2014',
        entryDate:      entry.entry_date      || '\u2014',
        reason:         reason                || '',
      };

      // Fire-and-forget \u2014 result is intentionally ignored
      supabase.functions
        .invoke('notify-approval', { body: payload })
        .then(({ error: fnErr }) => {
          if (fnErr) console.warn('\ud83d\udce7 Email notification failed (non-blocking):', fnErr.message);
          else console.log('\ud83d\udce7 Email sent (' + type + ') \u2192 ' + techProfile.email);
        })
        .catch((err) => console.warn('\ud83d\udce7 Email notification failed (non-blocking):', err.message));

    } catch (err) {
      console.warn('\ud83d\udce7 _notifyTechnician error (non-blocking):', err.message);
    }
  }

}

export const workEntryService = new WorkEntryService();
export default workEntryService;
