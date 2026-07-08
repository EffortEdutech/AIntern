/**
 * WorkLedger — Sync Service
 *
 * SESSION 20 UPDATE — offline photo sync (_pushAttachment):
 *   After each work entry sync, push any pending db.attachments for that
 *   entry (photos captured offline via OfflineEditDraft). Also runs a
 *   catch-all _pushPendingAttachments() pass on every sync cycle.
 *
 * SESSION 19 FIX — created_by null guard in _pushWorkEntry:
 *   When entries are created offline, workEntryService calls getUser() which
 *   makes a live network request. This request fails offline (ERR_NAME_NOT_RESOLVED)
 *   → user = null → created_by = null stored in IndexedDB.
 *   On sync, Supabase rejects the null (NOT NULL constraint).
 *
 *   Fix: before pushing, if created_by is null, resolve it from getSession()
 *   which reads the JWT from localStorage — no network needed.
 *
 *   The permanent fix is in workEntryService.js (getUser→getSession). This
 *   guard handles entries already stored with created_by=null.
 *
 * @module services/offline/syncService
 * File destination: src/services/offline/syncService.js
 */

import { db, SYNC_STATUS } from './db';
import { supabase } from '../supabase/client';
import { storageService } from '../supabase/storageService';

const ENTRY_WINDOW = 30;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUUID = (str) => typeof str === 'string' && UUID_REGEX.test(str);

// ── Helper: get current user ID from local session (no network) ───────────────
async function getSessionUserId() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id ?? null;
  } catch {
    return null;
  }
}

export const syncService = {

  async sync() {
    console.log('🔄 Sync starting...');
    try {
      await this.pushPendingEntries();
      await this.pullFromSupabase();
      await this.pruneOldData();
      console.log('✅ Sync complete');
    } catch (error) {
      console.error('❌ Sync cycle failed:', error);
      throw error;
    }
  },

  // Ground truth: entries with no remoteId haven't reached Supabase
  async getPendingCount() {
    try {
      return await db.workEntries.filter(e => !e.remoteId && !e.deleted_at).count();
    } catch {
      return 0; 
    }
  },

  // ── PUSH ─────────────────────────────────────────────────────────────────

  async pushPendingEntries() {
    try {
      await this._requeueOrphanedEntries();

      const pending = await db.syncQueue
        .where('sync_status').equals(SYNC_STATUS.PENDING)
        .toArray();

      if (!pending.length) {
        console.log('📭 Nothing to push'); return; 
      }
      console.log(`📤 Pushing ${pending.length} item(s)...`);
      for (const item of pending) {
        await this._pushSingleItem(item);
      }

      // SESSION 20: Push pending offline attachments (photos captured offline)
      await this._pushPendingAttachments();
    } catch (e) {
      console.error('❌ pushPendingEntries failed:', e); 
    }
  },

  async _requeueOrphanedEntries() {
    try {
      const unsynced = await db.workEntries.filter(e => !e.remoteId && !e.deleted_at).toArray();
      for (const entry of unsynced) {
        const live = await db.syncQueue.filter(q =>
          q.entity_type === 'work_entry' &&
          q.entity_local_id === entry.localId &&
          q.sync_status !== 'done'
        ).first();

        if (!live) {
          await db.syncQueue.add({
            entity_type: 'work_entry', entity_local_id: entry.localId,
            action: 'create', sync_status: SYNC_STATUS.PENDING,
            retry_count: 0, created_at: new Date().toISOString()
          });
          await db.workEntries.update(entry.localId, { sync_status: SYNC_STATUS.PENDING });
          console.log(`🔁 Re-queued orphaned entry (localId: ${entry.localId})`);
        }
      }
    } catch (e) {
      console.warn('⚠️ _requeueOrphanedEntries failed:', e.message); 
    }
  },

  async _pushSingleItem(queueItem) {
    // Hard cap: after 10 retries, mark as permanently failed so it stops looping.
    // The user will need to delete the stuck entry and re-create it.
    const MAX_RETRIES = 10;
    if ((queueItem.retry_count || 0) >= MAX_RETRIES) {
      console.warn(`⛔ Queue item ${queueItem.id} hit retry cap (${MAX_RETRIES}) — marking failed`);
      await db.syncQueue.update(queueItem.id, { sync_status: SYNC_STATUS.FAILED });
      if (queueItem.entity_type === 'work_entry') {
        await db.workEntries.update(queueItem.entity_local_id, {
          sync_error: 'Max retries exceeded — please delete and re-create this entry.'
        }).catch(() => {});
      }
      return;
    }

    try {
      await db.syncQueue.update(queueItem.id, { sync_status: SYNC_STATUS.SYNCING });
      if (queueItem.entity_type === 'work_entry') {
        await this._pushWorkEntry(queueItem);
      }
    } catch (e) {
      console.error(`❌ Push failed (queue ${queueItem.id}):`, e.message);
      const retries = (queueItem.retry_count || 0) + 1;
      await db.syncQueue.update(queueItem.id, {
        sync_status: SYNC_STATUS.PENDING,
        retry_count: retries,
        last_error: e.message
      });
      if (queueItem.entity_type === 'work_entry') {
        await db.workEntries.update(queueItem.entity_local_id, { sync_error: e.message }).catch(() => {});
      }
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // _pushWorkEntry
  //
  // Strip Dexie-local fields and send everything else to Supabase — mirrors
  // the online createWorkEntry path exactly.
  //
  // Guards:
  //   1. created_by null — resolve from local session (no network).
  //      Entries created offline had getUser() fail (network call, offline
  //      = ERR_NAME_NOT_RESOLVED) → created_by was stored as null.
  //      getSession() reads the JWT from localStorage — always works offline.
  //
  //   2. template_id not UUID — resolve text slug to UUID via IndexedDB scan.
  //      Text slugs fail Supabase FK constraint.
  // ─────────────────────────────────────────────────────────────────────────
  async _pushWorkEntry(queueItem) {
    const local = await db.workEntries.get(queueItem.entity_local_id);

    if (!local) {
      await db.syncQueue.delete(queueItem.id);
      return;
    }

    if (local.remoteId) {
      await db.syncQueue.update(queueItem.id, { sync_status: 'done' });
      console.log(`⏭️ Already synced (remoteId: ${local.remoteId})`);
      return;
    }

    // Strip Dexie-local fields — send everything else
    const { localId, remoteId: _remoteId, sync_status: _sync_status, sync_error: _sync_error, ...supabasePayload } = local;

    // ── GUARD 1: created_by must not be null ─────────────────────────────
    if (!supabasePayload.created_by) {
      console.warn('⚠️ created_by is null — resolving from local session...');
      const userId = await getSessionUserId();

      if (!userId) {
        throw new Error(
          'created_by is null and no session available. ' +
          'Log in to WorkLedger while online so the session is cached, then retry.'
        );
      }

      supabasePayload.created_by = userId;

      // Fix permanently in IndexedDB so future syncs don't hit this again
      await db.workEntries.update(localId, { created_by: userId });
      console.log(`✅ Resolved created_by from session: ${userId}`);
    }

    // ── GUARD 2: template_id must be a UUID ──────────────────────────────
    if (!isUUID(supabasePayload.template_id)) {
      console.warn(`⚠️ template_id "${supabasePayload.template_id}" is not a UUID — resolving...`);

      const tpl = await db.templates.get(supabasePayload.template_id)
        ?? await db.templates.filter(t => t.template_id === supabasePayload.template_id).first()
        ?? await db.contractTemplates.filter(r =>
          r.template?.template_id === supabasePayload.template_id && r.template?.id
        ).first().then(r => r?.template);

      if (tpl?.id && isUUID(tpl.id)) {
        supabasePayload.template_id = tpl.id;
        await db.workEntries.update(localId, { template_id: tpl.id });
        console.log(`✅ Resolved template_id → ${tpl.id}`);
      } else {
        throw new Error(
          `template_id "${local.template_id}" is not a UUID and could not be resolved. ` +
          'Connect to the internet, open WorkLedger to refresh template cache, then retry.'
        );
      }
    }

    // ── GUARD 3: organization_id must not be null ────────────────────────
    // Entries created before the SESSION 21 fix may have organization_id = null.
    // Resolve it from the cached contract in IndexedDB.
    if (!supabasePayload.organization_id) {
      console.warn('⚠️ organization_id is null — resolving from cached contract...');
      const cachedContract = await db.contracts.get(supabasePayload.contract_id)
        ?? await db.contracts.filter(c => c.id === supabasePayload.contract_id).first();
      const resolvedOrgId = cachedContract?.organization_id ?? null;
      if (resolvedOrgId) {
        supabasePayload.organization_id = resolvedOrgId;
        await db.workEntries.update(localId, { organization_id: resolvedOrgId });
        console.log(`✅ Resolved organization_id from cached contract: ${resolvedOrgId}`);
      } else {
        console.warn('⚠️ Could not resolve organization_id — DB trigger will handle it server-side');
      }
    }

    console.log(`📤 Pushing entry (localId: ${localId}, date: ${supabasePayload.entry_date}, status: ${supabasePayload.status}, created_by: ${supabasePayload.created_by})`);

    const { data, error } = await supabase
      .from('work_entries')
      .insert(supabasePayload)
      .select('id')
      .single();

    if (error) {
      console.error('❌ Supabase insert failed:', {
        code: error.code, message: error.message,
        details: error.details, hint: error.hint,
        created_by: supabasePayload.created_by,
        template_id: supabasePayload.template_id
      });
      throw new Error(`${error.message}${error.hint ? ' — ' + error.hint : ''}`);
    }

    await db.workEntries.update(localId, {
      remoteId: data.id,
      sync_status: SYNC_STATUS.SYNCED,
      sync_error: null
    });
    await db.syncQueue.update(queueItem.id, { sync_status: 'done' });
    console.log(`✅ Entry pushed → remoteId: ${data.id}`);

    // SESSION 20: Immediately push any offline photos captured for this entry
    try {
      await this._pushAttachmentsForEntry(localId, data.id);
    } catch (attErr) {
      console.warn('⚠️ Attachment sync after entry push failed:', attErr.message);
    }
  },

  // ── ATTACHMENT PUSH (Session 20) ─────────────────────────────────────────

  /**
   * Push all pending offline attachments on every sync cycle.
   * Catches attachments whose parent entry was already synced in a prior cycle.
   */
  async _pushPendingAttachments() {
    try {
      const pending = await db.attachments
        .filter((a) => !a.remoteId && a.sync_status === 'pending')
        .toArray();

      if (!pending.length) {
        return;
      }

      console.log(`📎 Pushing ${pending.length} pending offline attachment(s)...`);

      for (const att of pending) {
        try {
          await this._pushAttachment(att);
        } catch (e) {
          const isDeferral = e.message?.startsWith('Parent work entry not yet synced');
          if (!isDeferral) {
            console.warn(`⚠️ Attachment push failed (localId: ${att.localId}):`, e.message);
            await db.attachments.update(att.localId, { last_error: e.message }).catch(() => {});
          }
        }
      }
    } catch (e) {
      console.warn('⚠️ _pushPendingAttachments failed:', e.message);
    }
  },

  /**
   * Push all pending attachments that belong to a specific entry local ID.
   * Called immediately after _pushWorkEntry succeeds.
   *
   * @param {number} entryLocalId  - Dexie localId of the parent work entry
   * @param {string} entryRemoteId - Supabase UUID just assigned to the entry
   */
  async _pushAttachmentsForEntry(entryLocalId, entryRemoteId) {
    const pending = await db.attachments
      .where('entry_local_id').equals(entryLocalId)
      .filter((a) => !a.remoteId)
      .toArray();

    if (!pending.length) {
      return;
    }

    console.log(`📎 Pushing ${pending.length} attachment(s) for entry ${entryRemoteId}...`);

    for (const att of pending) {
      try {
        // Stamp entry_remote_id so _pushAttachment can skip the lookup
        await db.attachments.update(att.localId, { entry_remote_id: entryRemoteId });
        await this._pushAttachment({ ...att, entry_remote_id: entryRemoteId });
      } catch (e) {
        console.warn(`⚠️ Attachment push failed (localId: ${att.localId}):`, e.message);
        await db.attachments.update(att.localId, { last_error: e.message }).catch(() => {});
      }
    }
  },

  /**
   * Upload one offline attachment to Supabase Storage, insert a DB record,
   * and mark the Dexie row as synced.
   *
   * Flow:
   *   1. Resolve parent work entry's Supabase remoteId (defer if not synced yet)
   *   2. Resolve organization_id from cached contract (or live Supabase fetch)
   *   3. Decode base64 data URL → Blob
   *   4. Upload Blob to Supabase Storage via storageService
   *   5. Insert row into `attachments` table
   *   6. Update Dexie record: remoteId, entry_remote_id, sync_status = 'synced'
   *
   * @param {Object} attachment - Dexie db.attachments row
   */
  async _pushAttachment(attachment) {
    // ── Step 1: Resolve entry_remote_id ─────────────────────────────────────
    let entryRemoteId = attachment.entry_remote_id;

    if (!entryRemoteId) {
      const parentEntry = await db.workEntries.get(attachment.entry_local_id);

      if (!parentEntry || !parentEntry.remoteId) {
        // Parent not synced yet — will be retried on next cycle
        throw new Error('Parent work entry not yet synced — deferring attachment');
      }

      entryRemoteId = parentEntry.remoteId;
      await db.attachments.update(attachment.localId, { entry_remote_id: entryRemoteId });
    }

    // ── Step 2: Resolve organization_id ─────────────────────────────────────
    // Try the parent entry from Dexie first (it has contract_id).
    const parentEntry = attachment.entry_local_id
      ? await db.workEntries.get(attachment.entry_local_id)
      : await db.workEntries.where('remoteId').equals(entryRemoteId).first();

    const contractId = parentEntry?.contract_id;

    let organizationId = contractId
      ? (await db.contracts.get(contractId))?.organization_id
      : null;

    if (!organizationId) {
      // Fall back to a live Supabase fetch — the entry is online at this point
      const { data: remoteEntry } = await supabase
        .from('work_entries')
        .select('organization_id, contract_id')
        .eq('id', entryRemoteId)
        .single();

      organizationId = remoteEntry?.organization_id;
    }

    if (!organizationId) {
      throw new Error(`Cannot determine organization_id for attachment localId ${attachment.localId}`);
    }

    // ── Step 3: Decode base64 data URL → Blob ────────────────────────────────
    const base64Data = attachment.data || '';
    const commaIdx   = base64Data.indexOf(',');
    const header     = commaIdx > -1 ? base64Data.slice(0, commaIdx) : '';
    const b64        = commaIdx > -1 ? base64Data.slice(commaIdx + 1) : base64Data;
    const mimeMatch  = header.match(/:(.*?);/);
    const mime       = mimeMatch ? mimeMatch[1] : (attachment.mime_type || 'image/jpeg');

    const binaryStr = atob(b64);
    const bytes     = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mime });

    // ── Step 4: Upload Blob to Supabase Storage ──────────────────────────────
    const ext       = (attachment.file_name || 'photo.jpg').split('.').pop() || 'jpg';
    const fileName  = storageService.generateFileName(attachment.attachment_type || 'photo', ext);
    const storagePath = storageService.generatePath(organizationId, contractId || 'unknown', entryRemoteId, fileName);

    const uploadResult = await storageService.uploadFile('workledger-attachments', storagePath, blob);

    if (!uploadResult.success) {
      throw new Error(`Storage upload failed: ${uploadResult.error}`);
    }

    // ── Step 5: Insert row in attachments table ───────────────────────────────
    const userId = await getSessionUserId();
    const now    = new Date().toISOString();

    const { data: dbRow, error: dbErr } = await supabase
      .from('attachments')
      .insert({
        work_entry_id:  entryRemoteId,
        file_name:      fileName,
        file_type:      attachment.attachment_type || 'photo',
        file_size:      blob.size,
        mime_type:      mime,
        storage_bucket: 'workledger-attachments',
        storage_path:   storagePath,
        storage_url:    uploadResult.data.publicUrl,
        field_id:       attachment.field_id || null,
        sync_status:    'uploaded',
        synced_at:      now,
        created_by:     userId,
        created_at:     attachment.created_at || now
      })
      .select('id')
      .single();

    if (dbErr) {
      throw new Error(`attachments insert failed: ${dbErr.message}`);
    }

    // ── Step 6: Update Dexie row ─────────────────────────────────────────────
    await db.attachments.update(attachment.localId, {
      remoteId:        dbRow.id,
      entry_remote_id: entryRemoteId,
      sync_status:     'synced',
      last_error:      null
    });

    console.log(`✅ Attachment synced → remoteId: ${dbRow.id} (entry: ${entryRemoteId})`);
  },

  // ── PULL ──────────────────────────────────────────────────────────────────

  async pullFromSupabase() {
    try {
      // Use getSession() — no network call, reads local JWT
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        return;
      }

      const { orgId, mode } = await this._resolveUserContext(user.id);
      if (!orgId) {
        console.warn('⚠️ Cannot pull — no orgId resolved'); return; 
      }

      console.log(`📥 Pulling for org ${orgId} (mode: ${mode})`);
      const contracts = await this._pullContracts(orgId);
      if (contracts.length > 0) {
        await this._pullContractTemplates(contracts.map(c => c.id));
      }
      await this._pullWorkEntries(user.id, orgId, mode);
    } catch (e) {
      console.error('❌ pullFromSupabase failed:', e); 
    }
  },

  async _resolveUserContext(userId) {
    try {
      const { data: profile } = await supabase
        .from('user_profiles').select('global_role').eq('id', userId).single();
      const isStaff = ['super_admin', 'bina_jaya_staff'].includes(profile?.global_role);
      if (isStaff) {
        const activeOrgId = localStorage.getItem('wl_active_org_id');
        return { orgId: activeOrgId || null, mode: 'staff' };
      }
      const orgId = await this._pullOrgMembership(userId);
      return { orgId, mode: 'member' };
    } catch (e) {
      return { orgId: null, mode: 'member' }; 
    }
  },

  async _pullOrgMembership(userId) {
    try {
      const { data, error } = await supabase
        .from('org_members').select('organization_id').eq('user_id', userId).eq('is_active', true).limit(1).single();
      if (error || !data) {
        return null;
      }
      const { data: org } = await supabase
        .from('organizations').select('id, name, slug, settings').eq('id', data.organization_id).single();
      if (org) {
        await db.organizations.put(org);
      }
      return data.organization_id;
    } catch (e) {
      return null; 
    }
  },

  async _pullContracts(orgId) {
    try {
      const COLS = 'id, project_id, contract_number, contract_name, contract_type, contract_category, reporting_frequency, requires_approval, status, organization_id, performing_org_id, contract_role, valid_from, valid_until, created_by, created_at, updated_at, deleted_at';
      const base = (q) => q.eq('status', 'active').is('deleted_at', null);
      const [rO, rP] = await Promise.all([
        base(supabase.from('contracts').select(COLS).eq('organization_id', orgId)),
        base(supabase.from('contracts').select(COLS).eq('performing_org_id', orgId))
      ]);
      const seen = new Set(); const merged = [];
      for (const c of [...(rO.data || []), ...(rP.data || [])]) {
        if (!seen.has(c.id)) {
          seen.add(c.id); merged.push(c); 
        }
      }
      if (!merged.length) {
        return [];
      }
      await db.contracts.bulkPut(merged);
      console.log(`📥 ${merged.length} contracts cached`);
      return merged;
    } catch (e) {
      console.warn('⚠️ _pullContracts failed:', e.message); return []; 
    }
  },

  async _pullContractTemplates(contractIds) {
    try {
      if (!contractIds.length) {
        return;
      }
      const { data, error } = await supabase
        .from('contract_templates')
        .select(`id, contract_id, template_id, label, sort_order, is_default, assigned_at,
          template:templates (id, template_id, template_name, industry, contract_category, report_type,
            fields_schema, validation_rules, pdf_layout, version, is_locked, is_public, organization_id, created_at, updated_at)`)
        .in('contract_id', contractIds)
        .order('sort_order', { ascending: true });
      if (error || !data?.length) {
        return;
      }

      await db.contractTemplates.where('contract_id').anyOf(contractIds).delete();
      await db.contractTemplates.bulkAdd(data.map(row => ({
        contract_id: row.contract_id, template_id: row.template_id, label: row.label,
        sort_order: row.sort_order, is_default: row.is_default, assigned_at: row.assigned_at,
        template: row.template
      })));
      const unique = [...new Map(data.map(r => r.template).filter(Boolean).map(t => [t.template_id, t])).values()];
      if (unique.length) {
        await db.templates.bulkPut(unique);
      }
      console.log(`📥 ${data.length} junction rows + ${unique.length} templates cached`);
    } catch (e) {
      console.warn('⚠️ _pullContractTemplates failed:', e.message); 
    }
  },

  async _pullWorkEntries(userId, orgId, mode = 'member') {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - ENTRY_WINDOW);
      const cutoffStr = cutoff.toISOString().split('T')[0];

      let q = supabase
        .from('work_entries')
        .select('id, contract_id, template_id, entry_date, shift, data, status, organization_id, created_by, created_at, updated_at, submitted_at, submitted_by, approved_at, approved_by, approval_remarks, rejected_at, rejected_by, rejection_reason')
        .gte('entry_date', cutoffStr).is('deleted_at', null).order('entry_date', { ascending: false });
      q = mode === 'member' ? q.eq('created_by', userId) : q.eq('organization_id', orgId);

      const { data, error } = await q;
      if (error) {
        console.warn('⚠️ _pullWorkEntries error:', error.message); return; 
      }
      if (!data?.length) {
        return;
      }

      for (const entry of data) {
        const existing = await db.workEntries.where('remoteId').equals(entry.id).first();
        if (existing?.sync_status === SYNC_STATUS.PENDING) {
          continue;
        }
        const record = { ...entry, remoteId: entry.id, sync_status: SYNC_STATUS.SYNCED };
        if (existing) {
          await db.workEntries.update(existing.localId, record);
        } else          {
          await db.workEntries.add(record);
        }
      }
      console.log(`📥 ${data.length} work entries synced`);

      // SESSION 20 FIX: Reconcile orphaned Dexie entries.
      // If createWorkEntry pushed to Supabase but failed to save the remoteId
      // locally (network drop after insert, app backgrounded, etc.), the Dexie
      // entry has no remoteId and keeps retrying → duplicate UI rows + sync errors.
      //
      // After each pull, scan Dexie for entries without remoteId and match them
      // against the entries we just pulled by (contract_id, entry_date, created_by).
      // When a match is found, stamp the remoteId so the entry is correctly synced.
      await this._reconcileOrphanedEntries(data).catch((e) =>
        console.warn('⚠️ _reconcileOrphanedEntries failed:', e.message)
      );
    } catch (e) {
      console.warn('⚠️ _pullWorkEntries failed:', e.message); 
    }
  },

  /**
   * Match Dexie entries that have no remoteId against a set of freshly-pulled
   * Supabase entries. When (contract_id, entry_date, created_by) matches,
   * stamp the localId with the remoteId so the entry stops appearing as unsynced.
   *
   * This recovers from the scenario:
   *   1. createWorkEntry → Supabase insert succeeds, response arrives
   *   2. db.workEntries.update(remoteId) fails or is interrupted
   *   3. Dexie entry persists without remoteId indefinitely
   *
   * @param {Array} pulledEntries - Entries returned from _pullWorkEntries
   */
  async _reconcileOrphanedEntries(pulledEntries) {
    if (!pulledEntries?.length) {
      return;
    }

    // Find all local entries with no remoteId (potentially stuck)
    const orphans = await db.workEntries
      .filter((e) => !e.remoteId && !e.deleted_at)
      .toArray();

    if (!orphans.length) {
      return;
    }

    let reconciled = 0;

    for (const orphan of orphans) {
      // Find a pulled entry that shares the same authoring fingerprint.
      // We intentionally do NOT match on shift — the constraint that required
      // (contract_id, entry_date, shift, created_by) uniqueness has been dropped.
      // Instead we look for entries created on the same date for the same contract
      // by the same person that are not yet claimed by another local record.
      const match = pulledEntries.find((remote) =>
        remote.contract_id === orphan.contract_id &&
        remote.entry_date  === orphan.entry_date  &&
        remote.created_by  === orphan.created_by  &&
        // Ensure this remoteId isn't already claimed by another Dexie row
        !orphans.some((o) => o.remoteId === remote.id)
      );

      if (match) {
        await db.workEntries.update(orphan.localId, {
          remoteId:    match.id,
          status:      match.status,
          sync_status: SYNC_STATUS.SYNCED,
          sync_error:  null
        });

        // Clean up the stale syncQueue item for this entry if present
        await db.syncQueue
          .filter((q) =>
            q.entity_type === 'work_entry' &&
            q.entity_local_id === orphan.localId &&
            q.sync_status !== 'done'
          )
          .modify({ sync_status: 'done' });

        console.log(`🔗 Reconciled orphan localId ${orphan.localId} → remoteId ${match.id}`);
        reconciled++;
      }
    }

    if (reconciled > 0) {
      console.log(`✅ Reconciled ${reconciled} orphaned entry/entries`);
    }
  },

  async pruneOldData() {
    try {
      const c30 = new Date(); c30.setDate(c30.getDate() - 30); const cut30 = c30.toISOString().split('T')[0];
      const c7  = new Date(); c7.setDate(c7.getDate() - 7);    const cut7  = c7.toISOString().split('T')[0];

      const toDelete = await db.workEntries.filter(e => {
        if (!e.remoteId) {
          return false;
        }
        if (e.status === 'approved' && e.entry_date < cut7)  {
          return true;
        }
        if (e.entry_date < cut30) {
          return true;
        }
        return false;
      }).primaryKeys();
      if (toDelete.length) {
        await db.workEntries.bulkDelete(toDelete); console.log(`🧹 Pruned ${toDelete.length} old entries`); 
      }

      await db.syncQueue.where('sync_status').equals('done').delete();

      // SESSION 20: Free IndexedDB space — synced attachments are in Supabase Storage
      const syncedAttKeys = await db.attachments.filter((a) => !!a.remoteId).primaryKeys();
      if (syncedAttKeys.length) {
        await db.attachments.bulkDelete(syncedAttKeys);
        console.log(`🧹 Pruned ${syncedAttKeys.length} synced attachment records from IndexedDB`);
      }

      const failed = await db.syncQueue.where('sync_status').equals(SYNC_STATUS.FAILED).toArray();
      for (const item of failed) {
        if (item.entity_type === 'work_entry') {
          const entry = await db.workEntries.get(item.entity_local_id);
          if (entry && !entry.remoteId) {
            await db.syncQueue.update(item.id, { sync_status: SYNC_STATUS.PENDING, retry_count: 0 });
          } else {
            await db.syncQueue.delete(item.id);
          }
        } else {
          await db.syncQueue.delete(item.id);
        }
      }
    } catch (e) {
      console.warn('⚠️ pruneOldData failed:', e.message); 
    }
  }
};

export default syncService;
