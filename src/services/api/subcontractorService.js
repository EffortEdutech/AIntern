/**
 * WorkLedger - Subcontractor Service
 *
 * Manages subcontractor_relationships between main contractor orgs
 * and subcontractor orgs, scoped per project.
 *
 * Architecture:
 *   subcontractor_relationships:
 *     main_contractor_org_id → MTSB
 *     subcontractor_org_id   → FEST ENT
 *     project_id             → Project X
 *
 *   FEST ENT remains a fully independent org.
 *   The relationship is per-project, not permanent hierarchy.
 *   RLS on work_entries allows MTSB to read FEST ENT entries
 *   for shared projects (after Migration_028).
 *
 * @module services/api/subcontractorService
 * @created February 24, 2026 — Session 15
 */

import { supabase } from '../supabase/client';

class SubcontractorService {

  // ─────────────────────────────────────────────────────────────
  // READ
  // ─────────────────────────────────────────────────────────────

  /**
   * Get all subcontractor relationships where this org is the main contractor.
   * Returns relationships enriched with org names and project names.
   *
   * @param {string} mainOrgId - The main contractor's org ID (MTSB)
   * @returns {Promise<Array>} Array of relationship objects
   */
  async getSubcontractorRelationships(mainOrgId) {
    try {
      console.log('🏗️ Loading subcontractor relationships for:', mainOrgId);

      const { data, error } = await supabase
        .from('subcontractor_relationships')
        .select(`
          id,
          main_contractor_org_id,
          subcontractor_org_id,
          project_id,
          status,
          invited_by,
          invited_at,
          accepted_at,
          notes,
          created_at,
          updated_at
        `)
        .eq('main_contractor_org_id', mainOrgId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }
      if (!data || data.length === 0) {
        console.log('✅ No subcontractor relationships found');
        return [];
      }

      // ── Enrich with org + project names (two-step, cross-schema safe) ──
      const subOrgIds  = [...new Set(data.map(r => r.subcontractor_org_id))];
      const projectIds = [...new Set(data.map(r => r.project_id))];

      const [orgsResult, projectsResult] = await Promise.all([
        supabase
          .from('organizations')
          .select('id, name, slug, org_type')
          .in('id', subOrgIds),
        supabase
          .from('projects')
          .select('id, project_name, project_code, status')
          .in('id', projectIds)
      ]);

      const orgMap     = {};
      const projectMap = {};
      (orgsResult.data     || []).forEach(o => {
        orgMap[o.id]     = o; 
      });
      (projectsResult.data || []).forEach(p => {
        projectMap[p.id] = p; 
      });

      const enriched = data.map(r => ({
        ...r,
        subcontractor_org: orgMap[r.subcontractor_org_id]         || null,
        project:           projectMap[r.project_id]               || null
      }));

      console.log('✅ Loaded relationships:', enriched.length);
      return enriched;
    } catch (error) {
      console.error('❌ Exception in getSubcontractorRelationships:', error);
      return [];
    }
  }

  /**
   * Get all subcontractor relationships for a specific project.
   * Used by the Work Entries page to show the source filter.
   *
   * @param {string} projectId
   * @returns {Promise<Array>}
   */
  async getSubcontractorsByProject(projectId) {
    try {
      const { data, error } = await supabase
        .from('subcontractor_relationships')
        .select('id, subcontractor_org_id, status')
        .eq('project_id', projectId)
        .eq('status', 'active');

      if (error) {
        throw error;
      }
      return data || [];
    } catch (error) {
      console.error('❌ Exception in getSubcontractorsByProject:', error);
      return [];
    }
  }

  /**
   * Get the list of org IDs that are active subcontractors under mainOrgId.
   * Used by WorkEntryListPage to identify which entries are "subcontractor" source.
   *
   * @param {string} mainOrgId
   * @returns {Promise<string[]>} Array of subcontractor org IDs
   */
  async getSubcontractorOrgIds(mainOrgId) {
    try {
      const { data, error } = await supabase
        .from('subcontractor_relationships')
        .select('subcontractor_org_id')
        .eq('main_contractor_org_id', mainOrgId)
        .eq('status', 'active');

      if (error) {
        throw error;
      }
      return [...new Set((data || []).map(r => r.subcontractor_org_id))];
    } catch (error) {
      console.error('❌ Exception in getSubcontractorOrgIds:', error);
      return [];
    }
  }

  /**
   * Check if a relationship already exists between main and subcontractor
   * for a given project.
   *
   * @param {string} mainOrgId
   * @param {string} subOrgId
   * @param {string} projectId
   * @returns {Promise<Object|null>} Existing relationship or null
   */
  async checkExistingRelationship(mainOrgId, subOrgId, projectId) {
    try {
      const { data, error } = await supabase
        .from('subcontractor_relationships')
        .select('id, status')
        .eq('main_contractor_org_id', mainOrgId)
        .eq('subcontractor_org_id', subOrgId)
        .eq('project_id', projectId)
        .maybeSingle();

      if (error) {
        throw error;
      }
      return data;
    } catch (error) {
      console.error('❌ Exception in checkExistingRelationship:', error);
      return null;
    }
  }

  /**
   * Search organizations by name to find a subcontractor to link.
   * Excludes the main contractor org itself.
   *
   * @param {string} query      - Search text
   * @param {string} excludeId  - The main contractor's own org ID (exclude it)
   * @returns {Promise<Array>}
   */
  async searchOrganizations(query, excludeId) {
    try {
      if (!query || query.trim().length < 2) {
        return [];
      }

      const { data, error } = await supabase
        .from('organizations')
        .select('id, name, slug, org_type')
        .ilike('name', `%${query.trim()}%`)
        .neq('id', excludeId)
        .is('deleted_at', null)
        .order('name')
        .limit(10);

      if (error) {
        throw error;
      }
      return data || [];
    } catch (error) {
      console.error('❌ Exception in searchOrganizations:', error);
      return [];
    }
  }

  // ─────────────────────────────────────────────────────────────
  // WRITE
  // ─────────────────────────────────────────────────────────────

  /**
   * Create a new subcontractor relationship.
   * Guards against duplicate relationships.
   *
   * @param {string} mainOrgId  - MTSB's org ID
   * @param {string} subOrgId   - FEST ENT's org ID
   * @param {string} projectId  - Project they share
   * @param {string} [notes]    - Optional admin note
   * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
   */
  async addSubcontractor(mainOrgId, subOrgId, projectId, notes = '') {
    try {
      console.log('➕ Adding subcontractor relationship:', { mainOrgId, subOrgId, projectId });

      // Guard: can't link org to itself
      if (mainOrgId === subOrgId) {
        return { success: false, error: 'An organization cannot be its own subcontractor.' };
      }

      // Guard: check for existing relationship (including terminated ones)
      const existing = await this.checkExistingRelationship(mainOrgId, subOrgId, projectId);
      if (existing) {
        if (existing.status === 'active') {
          return { success: false, error: 'This subcontractor relationship already exists for this project.' };
        }
        // Reactivate terminated relationship
        return await this.updateRelationshipStatus(existing.id, 'active');
      }

      const currentUser = await supabase.auth.getUser();
      const userId      = currentUser.data?.user?.id;

      const { data, error } = await supabase
        .from('subcontractor_relationships')
        .insert({
          main_contractor_org_id: mainOrgId,
          subcontractor_org_id:   subOrgId,
          project_id:             projectId,
          status:                 'active',
          invited_by:             userId,
          invited_at:             new Date().toISOString(),
          notes:                  notes || null
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      console.log('✅ Subcontractor relationship created:', data.id);
      return { success: true, data };
    } catch (error) {
      console.error('❌ Exception in addSubcontractor:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update the status of a subcontractor relationship.
   *
   * @param {string} relationshipId
   * @param {'active'|'completed'|'terminated'} newStatus
   * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
   */
  async updateRelationshipStatus(relationshipId, newStatus) {
    try {
      console.log('🔄 Updating relationship status:', { relationshipId, newStatus });

      const { data, error } = await supabase
        .from('subcontractor_relationships')
        .update({ status: newStatus })
        .eq('id', relationshipId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      console.log('✅ Relationship status updated:', newStatus);
      return { success: true, data };
    } catch (error) {
      console.error('❌ Exception in updateRelationshipStatus:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Remove a subcontractor relationship (sets status to 'terminated').
   * Soft delete — does NOT delete the row.
   *
   * @param {string} relationshipId
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async removeSubcontractor(relationshipId) {
    return await this.updateRelationshipStatus(relationshipId, 'terminated');
  }
}

export const subcontractorService = new SubcontractorService();
