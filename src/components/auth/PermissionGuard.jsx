/**
 * WorkLedger - Permission Guard Component
 *
 * Conditionally renders children based on whether the current user
 * has the required permission. Shows nothing (or a fallback) if denied.
 *
 * USAGE — Hide an element:
 *   <PermissionGuard permission="CREATE_PROJECT">
 *     <NewProjectButton />
 *   </PermissionGuard>
 *
 * USAGE — Show fallback for unauthorized:
 *   <PermissionGuard permission="GENERATE_REPORTS" fallback={<ReadOnlyBadge />}>
 *     <GenerateReportButton />
 *   </PermissionGuard>
 *
 * USAGE — Multiple permissions (ALL required):
 *   <PermissionGuard permissions={['MANAGE_CONTRACTS', 'MANAGE_PROJECTS']}>
 *     <AdminPanel />
 *   </PermissionGuard>
 *
 * USAGE — Multiple permissions (ANY one sufficient):
 *   <PermissionGuard permissions={['EDIT_ANY_WORK_ENTRY', 'EDIT_OWN_WORK_ENTRY']} requireAll={false}>
 *     <EditButton />
 *   </PermissionGuard>
 *
 * @file src/components/auth/PermissionGuard.jsx
 * @created February 21, 2026 - Session 11
 */

import { useRole } from '../../hooks/useRole';

/**
 * PermissionGuard Component
 *
 * @param {Object} props
 * @param {string}    [props.permission]    - Single permission key
 * @param {string[]}  [props.permissions]   - Array of permission keys
 * @param {boolean}   [props.requireAll]    - true = AND logic (default), false = OR logic
 * @param {React.ReactNode} [props.fallback] - What to show if denied (default: null)
 * @param {React.ReactNode} props.children  - Content to show if allowed
 */
export function PermissionGuard({
  permission,
  permissions,
  requireAll = true,
  fallback = null,
  children
}) {
  const { can, loading } = useRole();

  // While role is loading, show nothing (avoids flash of unauthorized content)
  if (loading) {
    return null;
  }

  // Normalize to array
  const permList = permission
    ? [permission]
    : (permissions || []);

  if (permList.length === 0) {
    // No permission specified → always show
    return children;
  }

  // Check permissions
  const allowed = requireAll
    ? permList.every(p => can(p))    // AND: must have ALL
    : permList.some(p => can(p));    // OR: any one is enough

  return allowed ? children : fallback;
}

export default PermissionGuard;
