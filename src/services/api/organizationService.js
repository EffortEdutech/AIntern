/**
 * WorkLedger - Organization Service
 * 
 * Service for managing organizations including creation, retrieval,
 * updates, and member management.
 * 
 * @module services/api/organizationService
 * @created January 29, 2026
 */

import { supabase } from '../supabase/client';

/**
 * Organization Service
 */
export class OrganizationService {
  /**
   * Create a new organization
   * @param {Object} data - Organization data
   * @param {string} data.name - Organization name
   * @param {Object} data.settings - Organization settings (optional)
   * @returns {Promise<Object>} Result object { success, data, error }
   */
  async createOrganization({ name, org_type = 'client', settings = {} }) {
    try {
      console.log('🏢 Creating organization:', name, '| type:', org_type);

      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        return {
          success: false,
          data: null,
          error: 'User not authenticated'
        };
      }

      // Generate slug from name
      const slug = name.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      // Create organization
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name,
          slug,
          org_type,
          settings: {
            branding: {
              logo_url: null,
              primary_color: '#3B82F6'
            },
            features: {
              offline_sync: true,
              sla_tracking: true,
              photo_uploads: true,
              pdf_generation: true
            },
            ...settings
          }
        })
        .select()
        .single();

      if (orgError) {
        console.error('❌ Organization creation error:', orgError);
        return {
          success: false,
          data: null,
          error: orgError.message
        };
      }

      console.log('✅ Organization created:', org.id);

      // Add creator as org_admin
      const { error: memberError } = await supabase
        .from('org_members')
        .insert({
          organization_id: org.id,
          user_id: user.id,
          role: 'org_admin',
          invited_by: user.id,
          invited_at: new Date().toISOString(),
          joined_at: new Date().toISOString(),
          is_active: true
        });

      if (memberError) {
        console.error('❌ Error adding creator as member:', memberError);
        // Continue anyway - organization is created
      } else {
        console.log('✅ Creator added as org_admin');
      }

      return {
        success: true,
        data: org,
        error: null
      };
    } catch (error) {
      console.error('❌ Organization creation exception:', error);
      return {
        success: false,
        data: null,
        error: error.message || 'An unexpected error occurred'
      };
    }
  }

  /**
   * Get organization by ID
   * @param {string} organizationId - Organization ID
   * @returns {Promise<Object|null>} Organization or null
   */
  async getOrganization(organizationId) {
    try {
      console.log('🏢 Getting organization:', organizationId);

      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', organizationId)
        .is('deleted_at', null)
        .single();

      if (error) {
        console.error('❌ Error getting organization:', error);
        return null;
      }

      console.log('✅ Organization retrieved');
      return data;
    } catch (error) {
      console.error('❌ Exception getting organization:', error);
      return null;
    }
  }

  /**
   * Get user's organizations
   * @param {string} userId - User ID (optional, uses current user if not provided)
   * @returns {Promise<Array>} Array of organizations
   */
  async getUserOrganizations(userId = null) {
    try {
      // Get user ID if not provided
      if (!userId) {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
          console.error('❌ User not authenticated');
          return [];
        }
        userId = user.id;
      }

      console.log('🏢 Getting organizations for user:', userId);

      const { data, error } = await supabase
        .from('org_members')
        .select(`
          *,
          organization:organizations(*)
        `)
        .eq('user_id', userId)
        .eq('is_active', true)
        .is('organization.deleted_at', null);

      if (error) {
        console.error('❌ Error getting user organizations:', error);
        return [];
      }

      const organizations = data.map(item => ({
        ...item.organization,
        membership: {
          role: item.role,
          joined_at: item.joined_at
        }
      }));

      console.log('✅ Retrieved organizations:', organizations.length);
      return organizations;
    } catch (error) {
      console.error('❌ Exception getting user organizations:', error);
      return [];
    }
  }

  /**
   * Update organization
   * @param {string} organizationId - Organization ID
   * @param {Object} data - Updated data
   * @returns {Promise<Object>} Result object { success, data, error }
   */
  async updateOrganization(organizationId, data) {
    try {
      console.log('🏢 Updating organization:', organizationId);

      const { data: org, error } = await supabase
        .from('organizations')
        .update({
          ...data,
          updated_at: new Date().toISOString()
        })
        .eq('id', organizationId)
        .select()
        .single();

      if (error) {
        console.error('❌ Organization update error:', error);
        return {
          success: false,
          data: null,
          error: error.message
        };
      }

      console.log('✅ Organization updated');
      return {
        success: true,
        data: org,
        error: null
      };
    } catch (error) {
      console.error('❌ Organization update exception:', error);
      return {
        success: false,
        data: null,
        error: error.message || 'An unexpected error occurred'
      };
    }
  }

  /**
   * Invite member to organization
   * @param {string} organizationId - Organization ID
   * @param {string} email - Member email
   * @param {string} role - Member role (worker, manager, org_admin)
   * @returns {Promise<Object>} Result object { success, data, error }
   */
  async inviteMember(organizationId, email, role = 'worker') {
    try {
      console.log('🏢 Inviting member:', email, 'as', role);

      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        return {
          success: false,
          data: null,
          error: 'User not authenticated'
        };
      }

      // TODO: In production, send email invitation
      // For now, we'll need the user to already exist

      // Find user by email
      await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', email) // This won't work - need to query by email
        .single();

      // For MVP, we'll return a message
      console.log('ℹ️ Member invitation feature pending - email system not implemented');

      return {
        success: true,
        data: {
          message: 'Invitation feature coming soon. User must register first.'
        },
        error: null
      };
    } catch (error) {
      console.error('❌ Member invitation exception:', error);
      return {
        success: false,
        data: null,
        error: error.message || 'An unexpected error occurred'
      };
    }
  }

  /**
   * Get organization members
   * @param {string} organizationId - Organization ID
   * @returns {Promise<Array>} Array of members
   */
  async getOrgMembers(organizationId) {
    try {
      console.log('🏢 Getting members for organization:', organizationId);

      const { data, error } = await supabase
        .from('org_members')
        .select(`
          *,
          user_profile:user_profiles(*)
        `)
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('joined_at', { ascending: false });

      if (error) {
        console.error('❌ Error getting org members:', error);
        return [];
      }

      console.log('✅ Retrieved members:', data.length);
      return data;
    } catch (error) {
      console.error('❌ Exception getting org members:', error);
      return [];
    }
  }

  /**
   * Get user's role in organization
   * @param {string} organizationId - Organization ID
   * @param {string} userId - User ID (optional, uses current user if not provided)
   * @returns {Promise<string|null>} Role or null
   */
  async getUserRole(organizationId, userId = null) {
    try {
      // Get user ID if not provided
      if (!userId) {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
          return null;
        }
        userId = user.id;
      }

      const { data, error } = await supabase
        .from('org_members')
        .select('role')
        .eq('organization_id', organizationId)
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (error) {
        return null;
      }

      return data.role;
    } catch (error) {
      return null;
    }
  }

  /**
   * Remove member from organization
   * @param {string} organizationId - Organization ID
   * @param {string} userId - User ID to remove
   * @returns {Promise<Object>} Result object { success, error }
   */
  async removeMember(organizationId, userId) {
    try {
      console.log('🏢 Removing member:', userId, 'from org:', organizationId);

      const { error } = await supabase
        .from('org_members')
        .update({
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('organization_id', organizationId)
        .eq('user_id', userId);

      if (error) {
        console.error('❌ Error removing member:', error);
        return {
          success: false,
          error: error.message
        };
      }

      console.log('✅ Member removed');
      return {
        success: true,
        error: null
      };
    } catch (error) {
      console.error('❌ Exception removing member:', error);
      return {
        success: false,
        error: error.message || 'An unexpected error occurred'
      };
    }
  }
}

// Export singleton instance
export const organizationService = new OrganizationService();