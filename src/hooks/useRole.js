/**
 * WorkLedger - useRole Hook
 *
 * The primary hook for permission checks throughout the app.
 * Reads the user's effective role and exposes a `can()` function.
 *
 * USAGE:
 *   const { can, role, isBinaJayaStaff, loading } = useRole();
 *
 *   // Check a permission:
 *   if (can('CREATE_PROJECT')) { ... }
 *
 *   // Conditionally render:
 *   {can('MANAGE_ORG_USERS') && <ManageUsersButton />}
 *
 *   // Show role badge:
 *   <span>{role}</span>   // 'manager', 'org_admin', etc.
 *
 * HOW IT WORKS:
 *   - Reads `userOrgRole` from OrganizationContext (fetched per-org)
 *   - Reads `profile.global_role` from AuthContext (platform-level)
 *   - super_admin → ALWAYS returns true for any permission
 *   - Everyone else → checks against PERMISSIONS matrix in permissions.js
 *
 * @file src/hooks/useRole.js
 * @created February 21, 2026 - Session 11
 */

import { useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useOrganization } from '../context/OrganizationContext';
import { PERMISSIONS } from '../constants/permissions';

/**
 * useRole — main permission hook
 *
 * @returns {{
 *   can: (permission: string) => boolean,
 *   role: string|null,
 *   globalRole: string|null,
 *   isBinaJayaStaff: boolean,
 *   isFieldWorker: boolean,
 *   loading: boolean,
 * }}
 */
export function useRole() {
  const { profile } = useAuth();
  const { userOrgRole, isBinaJayaStaff, loading: orgLoading } = useOrganization();

  // ── Effective role for display/logic ──────────────────
  // BJ staff: their globalRole is their "role"
  // Regular users: their org_members role
  const globalRole    = profile?.global_role ?? null;
  const effectiveRole = isBinaJayaStaff ? globalRole : userOrgRole;

  // ── Field worker check ─────────────────────────────────
  const isFieldWorker = ['technician', 'worker', 'subcontractor'].includes(effectiveRole);

  // ── Permission checker ─────────────────────────────────
  /**
   * Check if the current user has a given permission.
   *
   * @param {string} permission - Key from PERMISSIONS (e.g. 'CREATE_PROJECT')
   * @returns {boolean}
   */
  const can = useCallback((permission) => {
    // Not logged in → no permissions
    if (!profile) {
      return false;
    }

    // super_admin → always allowed (no matrix check needed)
    if (globalRole === 'super_admin') {
      return true;
    }

    // No effective role yet (loading / no org membership) → deny
    if (!effectiveRole) {
      return false;
    }

    // Look up the permission matrix
    const allowed = PERMISSIONS[permission];
    if (!allowed) {
      // Unknown permission key → warn in dev, deny in prod
      if (import.meta.env.DEV) {
        console.warn(`⚠️ useRole: Unknown permission key "${permission}"`);
      }
      return false;
    }

    return allowed.includes(effectiveRole);
  }, [profile, globalRole, effectiveRole]);

  return {
    can,
    role:            effectiveRole,   // 'manager', 'org_owner', 'bina_jaya_staff', etc.
    globalRole,                        // 'super_admin' | 'bina_jaya_staff' | null
    isBinaJayaStaff,
    isFieldWorker,
    loading: orgLoading
  };
}

export default useRole;
