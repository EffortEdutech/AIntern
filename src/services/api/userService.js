/**
 * WorkLedger - User Service
 *
 * Manages org members: listing, role changes, activate/deactivate, invite.
 *
 * SESSION 19 UPDATE — getAllPlatformUsers():
 *   New method for super_admin only. Returns every user in the system
 *   (from user_profiles) with their org memberships attached. This lets
 *   super_admin see users who have registered but haven't been assigned
 *   to any org yet, and invite them directly from the Users page.
 *
 *   RLS enforcement: user_profiles is readable by authenticated users
 *   (own row) and by super_admin (all rows via policy). The existing RLS
 *   policy on user_profiles must allow super_admin to SELECT all rows.
 *   If not already in place, add this policy in Supabase:
 *
 *   CREATE POLICY "super_admin can view all profiles"
 *   ON user_profiles FOR SELECT
 *   TO authenticated
 *   USING (
 *     EXISTS (
 *       SELECT 1 FROM user_profiles up
 *       WHERE up.id = auth.uid()
 *       AND up.global_role = 'super_admin'
 *     )
 *   );
 *
 * @module services/api/userService
 * @created February 23, 2026 - Session 12
 * @updated April 7, 2026    - Session 19: getAllPlatformUsers()
 */

import { supabase } from '../supabase/client';
import { ASSIGNABLE_ORG_ROLES } from '../../constants/permissions';

export { ASSIGNABLE_ORG_ROLES } from '../../constants/permissions';

class UserService {
  // ─────────────────────────────────────────────
  // READ — ORG-SCOPED
  // ─────────────────────────────────────────────

  /**
   * Get all members of an organization.
   * Joins user_profiles so we get name + global_role.
   *
   * @param {string} orgId
   * @returns {Promise<Array>}
   */
  async getOrgMembers(orgId) {
    try {
      console.log('👥 Loading org members for:', orgId);

      const { data: members, error: membersError } = await supabase
        .from('org_members')
        .select('id, user_id, organization_id, role, is_active, joined_at, created_at')
        .eq('organization_id', orgId)
        .order('joined_at', { ascending: true });

      if (membersError) {
        throw membersError;
      }
      if (!members || members.length === 0) {
        console.log('✅ Loaded members: 0');
        return [];
      }

      const userIds = members.map(m => m.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, full_name, phone_number, global_role, avatar_url')
        .in('id', userIds);

      if (profilesError) {
        console.warn('⚠️ Could not load user profiles:', profilesError.message);
      }

      const profileMap = {};
      (profiles || []).forEach(p => {
        profileMap[p.id] = p; 
      });

      const merged = members.map(m => ({
        ...m,
        user: profileMap[m.user_id] || null
      }));

      // Exclude platform staff — they use the org switcher, not org_members
      const filtered = merged.filter(m => {
        const g = m.user?.global_role;
        return g !== 'super_admin' && g !== 'bina_jaya_staff';
      });

      console.log(`✅ Loaded members: ${filtered.length}`);
      return filtered;
    } catch (error) {
      console.error('❌ Exception in getOrgMembers:', error);
      return [];
    }
  }

  // ─────────────────────────────────────────────
  // READ — PLATFORM-WIDE (super_admin only)
  // ─────────────────────────────────────────────

  /**
   * Get ALL users across the entire platform, with their org memberships.
   *
   * FOR SUPER_ADMIN ONLY. The caller must verify globalRole before calling.
   * RLS also enforces this at the database level (see header comment).
   *
   * Returns an array of platform user objects:
   * {
   *   id,           — user_profiles.id (= auth.users.id)
   *   full_name,
   *   phone_number,
   *   global_role,  — 'super_admin' | 'bina_jaya_staff' | null
   *   avatar_url,
   *   created_at,   — user_profiles.created_at (registration date)
   *   orgs: [       — all active org memberships for this user
   *     { orgId, orgName, role }
   *   ],
   *   hasOrg,       — convenience boolean: orgs.length > 0
   * }
   *
   * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
   */
  async getAllPlatformUsers() {
    try {
      console.log('👥 Loading ALL platform users (super_admin)...');

      // ── Step 1: All user profiles ────────────────────────────────────────
      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, full_name, phone_number, global_role, avatar_url, created_at')
        .order('created_at', { ascending: false });

      if (profilesError) {
        throw profilesError;
      }
      if (!profiles || profiles.length === 0) {
        return { success: true, data: [] };
      }

      // ── Step 2: All active org memberships with org names ─────────────────
      // PostgREST supports one-level of foreign key traversal for SELECT.
      // org_members.organization_id → organizations.name is a valid FK join.
      const { data: memberships, error: membershipsError } = await supabase
        .from('org_members')
        .select('user_id, organization_id, role, is_active, organizations(id, name)')
        .eq('is_active', true);

      if (membershipsError) {
        // Non-fatal — return users without org data rather than failing
        console.warn('⚠️ Could not load org memberships:', membershipsError.message);
      }

      // ── Step 3: Build userId → orgs map ──────────────────────────────────
      const orgMap = {};
      (memberships || []).forEach(m => {
        if (!orgMap[m.user_id]) {
          orgMap[m.user_id] = [];
        }
        orgMap[m.user_id].push({
          orgId:   m.organization_id,
          orgName: m.organizations?.name ?? 'Unknown org',
          role:    m.role
        });
      });

      // ── Step 4: Merge ─────────────────────────────────────────────────────
      const data = profiles.map(p => ({
        ...p,
        orgs:   orgMap[p.id] ?? [],
        hasOrg: (orgMap[p.id] ?? []).length > 0
      }));

      console.log(`✅ Loaded platform users: ${data.length} (${data.filter(u => !u.hasOrg).length} without org)`);
      return { success: true, data };
    } catch (error) {
      console.error('❌ Exception in getAllPlatformUsers:', error);
      return { success: false, error: error.message };
    }
  }

  // ─────────────────────────────────────────────
  // COUNTS
  // ─────────────────────────────────────────────

  async getActiveMemberCount(orgId) {
    try {
      const { count, error } = await supabase
        .from('org_members')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('is_active', true);
      if (error) {
        throw error;
      }
      return count || 0;
    } catch (error) {
      console.error('❌ Exception in getActiveMemberCount:', error);
      return 0;
    }
  }

  async getOwnerCount(orgId) {
    try {
      const { count, error } = await supabase
        .from('org_members')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('role', 'org_owner')
        .eq('is_active', true);
      if (error) {
        throw error;
      }
      return count || 0;
    } catch (error) {
      console.error('❌ Exception in getOwnerCount:', error);
      return 0;
    }
  }

  // ─────────────────────────────────────────────
  // ROLE MANAGEMENT
  // ─────────────────────────────────────────────

  async updateMemberRole(orgId, memberId, newRole) {
    try {
      console.log('🔄 Updating member role:', { memberId, newRole });

      if (!ASSIGNABLE_ORG_ROLES.includes(newRole)) {
        return { success: false, error: `Invalid role: ${newRole}` };
      }

      const { data: member, error: fetchError } = await supabase
        .from('org_members')
        .select('role, is_active')
        .eq('id', memberId)
        .eq('organization_id', orgId)
        .single();

      if (fetchError || !member) {
        return { success: false, error: 'Member not found' };
      }

      if (member.role === 'org_owner' && newRole !== 'org_owner') {
        const ownerCount = await this.getOwnerCount(orgId);
        if (ownerCount <= 1) {
          return {
            success: false,
            error: 'Cannot change role — this is the last Owner. Assign another Owner first.'
          };
        }
      }

      const { error } = await supabase
        .from('org_members')
        .update({ role: newRole, updated_at: new Date().toISOString() })
        .eq('id', memberId)
        .eq('organization_id', orgId);

      if (error) {
        throw error;
      }
      console.log('✅ Role updated to:', newRole);
      return { success: true };
    } catch (error) {
      console.error('❌ Exception in updateMemberRole:', error);
      return { success: false, error: error.message };
    }
  }

  // ─────────────────────────────────────────────
  // ACTIVATE / DEACTIVATE
  // ─────────────────────────────────────────────

  async deactivateMember(orgId, memberId) {
    try {
      console.log('🚫 Deactivating member:', memberId);

      const { data: member } = await supabase
        .from('org_members')
        .select('role')
        .eq('id', memberId)
        .eq('organization_id', orgId)
        .single();

      if (member?.role === 'org_owner') {
        const ownerCount = await this.getOwnerCount(orgId);
        if (ownerCount <= 1) {
          return {
            success: false,
            error: 'Cannot deactivate the last Owner. Assign another Owner first.'
          };
        }
      }

      const { error } = await supabase
        .from('org_members')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', memberId)
        .eq('organization_id', orgId);

      if (error) {
        throw error;
      }
      console.log('✅ Member deactivated');
      return { success: true };
    } catch (error) {
      console.error('❌ Exception in deactivateMember:', error);
      return { success: false, error: error.message };
    }
  }

  async reactivateMember(orgId, memberId) {
    try {
      console.log('✅ Reactivating member:', memberId);
      const { error } = await supabase
        .from('org_members')
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq('id', memberId)
        .eq('organization_id', orgId);
      if (error) {
        throw error;
      }
      return { success: true };
    } catch (error) {
      console.error('❌ Exception in reactivateMember:', error);
      return { success: false, error: error.message };
    }
  }

  // ─────────────────────────────────────────────
  // INVITE / ADD
  // ─────────────────────────────────────────────

  async findUserByEmail(email) {
    try {
      console.log('🔍 Looking up user by email:', email);

      const { data, error } = await supabase
        .rpc('find_user_by_email', { p_email: email.toLowerCase().trim() });

      if (error) {
        if (error.code === 'PGRST202' || error.message?.includes('find_user_by_email')) {
          console.log('ℹ️ find_user_by_email RPC not available');
          return { found: false };
        }
        throw error;
      }

      if (data && data.length > 0) {
        const profile = data[0];
        console.log('✅ User found:', profile.full_name);
        return { found: true, userId: profile.id, profile };
      }

      return { found: false };
    } catch (error) {
      console.error('❌ Exception in findUserByEmail:', error);
      return { found: false, error: error.message };
    }
  }

  async checkExistingMembership(orgId, userId) {
    try {
      const { data, error } = await supabase
        .from('org_members')
        .select('id, role, is_active')
        .eq('organization_id', orgId)
        .eq('user_id', userId)
        .maybeSingle();
      if (error) {
        throw error;
      }
      return { isMember: !!data, member: data || null };
    } catch (error) {
      console.error('❌ Exception in checkExistingMembership:', error);
      return { isMember: false };
    }
  }

  async addExistingUserToOrg(orgId, userId, role) {
    try {
      console.log('➕ Adding user to org:', { orgId, userId, role });

      if (!ASSIGNABLE_ORG_ROLES.includes(role)) {
        return { success: false, error: `Invalid role: ${role}` };
      }

      const { isMember, member } = await this.checkExistingMembership(orgId, userId);

      if (isMember && member.is_active) {
        return { success: false, error: 'This user is already a member of the organization.' };
      }

      if (isMember && !member.is_active) {
        const { error } = await supabase
          .from('org_members')
          .update({ is_active: true, role, updated_at: new Date().toISOString() })
          .eq('id', member.id);
        if (error) {
          throw error;
        }
        return { success: true, reactivated: true };
      }

      const { error } = await supabase
        .from('org_members')
        .insert({
          organization_id: orgId,
          user_id:         userId,
          role,
          is_active:       true,
          joined_at:       new Date().toISOString(),
          created_at:      new Date().toISOString(),
          updated_at:      new Date().toISOString()
        });

      if (error) {
        throw error;
      }
      console.log('✅ User added to org');
      return { success: true };
    } catch (error) {
      console.error('❌ Exception in addExistingUserToOrg:', error);
      return { success: false, error: error.message };
    }
  }
}

export const userService = new UserService();
export default userService;
