/**
 * WorkLedger - Project Service
 *
 * Complete project service with full CRUD operations.
 *
 * SESSION 10 UPDATE: All list/count methods now accept an optional `orgId`
 * parameter. When passed (from OrganizationContext), queries filter directly
 * by that org — enabling Bina Jaya staff to switch between client orgs.
 * When orgId is null, falls back to the original org_members JOIN (safe for
 * regular users who don't use the org switcher).
 *
 * @module services/api/projectService
 * @created January 29, 2026
 * @updated January 30, 2026 - Session 9: Added full CRUD operations
 * @updated February 20, 2026 - Session 10: orgId param for org switching
 */

import { supabase } from '../supabase/client';
import { organizationService } from './organizationService';

export class ProjectService {

  // ─────────────────────────────────────────────
  // INTERNAL HELPER: resolve org IDs to query with
  // ─────────────────────────────────────────────

  /**
   * Get org IDs to filter by.
   * - If orgId provided → single org (org switcher active)
   * - If null → user's own orgs via org_members (original behaviour)
   *
   * SESSION 15 UPDATE:
   *   Also returns the organization_id of any project where user's org
   *   is an active subcontractor. This lets FEST ENT users see MTSB's
   *   project (which is owned by MTSB, not FEST ENT) when they navigate
   *   to /projects and when projectService is used for indirect lookups.
   *
   *   NOTE: For the ContractListPage and WorkEntryForm, the more direct
   *   fix is in contractService._resolveProjectIds() which now includes
   *   subcontractor project IDs explicitly. This projectService fix is
   *   a complementary improvement so /projects also shows shared projects.
   */
  async _resolveOrgIds(orgId = null) {
    if (orgId) {
      return [orgId];
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return [];
    }

    const { data: memberships } = await supabase
      .from('org_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('is_active', true);

    const ownOrgIds = (memberships || []).map(m => m.organization_id);
    if (ownOrgIds.length === 0) {
      return [];
    }

    // ── Subcontractor access: find main contractor org IDs ────
    // If FEST ENT is subcontractor to MTSB, we need MTSB's org_id
    // so getUserProjects() can also return MTSB's projects that
    // FEST ENT is linked to.
    //
    // Strategy: find all project_ids for subcon relationships,
    // then get those projects' organization_ids (the main contractors)
    const { data: subconRels } = await supabase
      .from('subcontractor_relationships')
      .select('project_id')
      .in('subcontractor_org_id', ownOrgIds)
      .eq('status', 'active');

    const subconProjectIds = (subconRels || [])
      .map(r => r.project_id)
      .filter(Boolean);

    if (subconProjectIds.length > 0) {
      // Get org_ids that own those projects (i.e. main contractor org IDs)
      const { data: linkedProjects } = await supabase
        .from('projects')
        .select('organization_id')
        .in('id', subconProjectIds)
        .is('deleted_at', null);

      const mainContractorOrgIds = (linkedProjects || [])
        .map(p => p.organization_id)
        .filter(Boolean);

      if (mainContractorOrgIds.length > 0) {
        console.log('🔗 Subcontractor main contractor org IDs added to project query:', mainContractorOrgIds.length);
        return [...new Set([...ownOrgIds, ...mainContractorOrgIds])];
      }
    }

    return ownOrgIds;
  }

  // ─────────────────────────────────────────────
  // READ
  // ─────────────────────────────────────────────

  /**
   * Get total projects count.
   * @param {string|null} orgId - From OrganizationContext. Pass null for own orgs.
   */
  async getProjectsCount(orgId = null) {
    try {
      console.log('📊 Getting projects count...', orgId ? `(org: ${orgId})` : '(all user orgs)');

      const orgIds = await this._resolveOrgIds(orgId);
      if (orgIds.length === 0) {
        return 0;
      }

      const { count, error } = await supabase
        .from('projects')
        .select('*', { count: 'exact', head: true })
        .in('organization_id', orgIds)
        .is('deleted_at', null);

      if (error) {
        console.error('❌ Error getting projects count:', error);
        return 0;
      }

      console.log('✅ Projects count:', count);
      return count || 0;
    } catch (error) {
      console.error('❌ Exception getting projects count:', error);
      return 0;
    }
  }

  /**
   * Get projects list.
   * @param {string|null} orgId - From OrganizationContext.
   */
  async getUserProjects(orgId = null) {
    try {
      console.log('📊 Getting projects...', orgId ? `(org: ${orgId})` : '(all user orgs)');

      const orgIds = await this._resolveOrgIds(orgId);
      if (orgIds.length === 0) {
        return [];
      }

      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          organizations(id, name, slug)
        `)
        .in('organization_id', orgIds)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error getting projects:', error);
        return [];
      }

      console.log('✅ Retrieved projects:', data?.length || 0);
      return data || [];
    } catch (error) {
      console.error('❌ Exception getting projects:', error);
      return [];
    }
  }

  /**
   * Get single project by ID.
   * @param {string} id - Project ID
   */
  async getProject(id) {
    try {
      console.log('📊 Getting project:', id);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return null;
      }

      const { data: project, error } = await supabase
        .from('projects')
        .select(`
          *,
          organizations(id, name, slug)
        `)
        .eq('id', id)
        .is('deleted_at', null)
        .single();

      if (error) {
        console.error('❌ Error fetching project:', error);
        return null;
      }

      // Verify access (RLS handles BJ staff automatically)
      const role = await organizationService.getUserRole(project.organization_id, user.id);
      if (!role) {
        // BJ staff won't have org_members row — check global_role instead
        const { data: profileData } = await supabase
          .from('user_profiles')
          .select('global_role')
          .eq('id', user.id)
          .single();

        if (!profileData?.global_role) {
          console.error('❌ User does not have access to this project');
          return null;
        }
      }

      console.log('✅ Project retrieved:', project.project_name);
      return project;
    } catch (error) {
      console.error('❌ Exception getting project:', error);
      return null;
    }
  }

  // ─────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────

  /**
   * Create a new project.
   * @param {string} organizationId - Target org
   * @param {Object} data - Project data
   */
  async createProject(organizationId, data) {
    try {
      console.log('📊 Creating project in org:', organizationId);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      const projectData = {
        organization_id: organizationId,
        project_name: data.project_name,
        client_name: data.client_name || null,
        client_contact: data.client_contact || null,
        project_address: data.project_address || null,
        status: data.status || 'active',
        start_date: data.start_date || null,
        end_date: data.end_date || null,
        description: data.description || null,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data: project, error } = await supabase
        .from('projects')
        .insert(projectData)
        .select('*, organizations(id, name, slug)')
        .single();

      if (error) {
        console.error('❌ Error creating project:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ Project created:', project.id);
      return { success: true, data: project };
    } catch (error) {
      console.error('❌ Exception creating project:', error);
      return { success: false, error: error.message };
    }
  }

  // ─────────────────────────────────────────────
  // UPDATE
  // ─────────────────────────────────────────────

  /**
   * Update project.
   * @param {string} id - Project ID
   * @param {Object} data - Fields to update
   */
  async updateProject(id, data) {
    try {
      console.log('📊 Updating project:', id);

      const updateData = {
        ...data,
        updated_at: new Date().toISOString()
      };

      // Remove fields that shouldn't be updated
      delete updateData.id;
      delete updateData.organization_id;
      delete updateData.created_by;
      delete updateData.created_at;

      const { data: project, error } = await supabase
        .from('projects')
        .update(updateData)
        .eq('id', id)
        .select('*, organizations(id, name, slug)')
        .single();

      if (error) {
        console.error('❌ Error updating project:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ Project updated:', id);
      return { success: true, data: project };
    } catch (error) {
      console.error('❌ Exception updating project:', error);
      return { success: false, error: error.message };
    }
  }

  // ─────────────────────────────────────────────
  // DELETE
  // ─────────────────────────────────────────────

  /**
   * Soft delete project.
   * @param {string} id - Project ID
   */
  async deleteProject(id) {
    try {
      console.log('📊 Deleting project:', id);

      const { error } = await supabase
        .from('projects')
        .update({
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) {
        console.error('❌ Error deleting project:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ Project deleted (soft):', id);
      return { success: true };
    } catch (error) {
      console.error('❌ Exception deleting project:', error);
      return { success: false, error: error.message };
    }
  }
}

export const projectService = new ProjectService();
export default projectService;
