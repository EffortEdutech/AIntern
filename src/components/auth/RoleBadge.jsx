/**
 * WorkLedger - Role Badge Component
 *
 * Displays a role label with the correct colour from ROLE_META.
 * Used in user lists, org member tables, profile headers.
 *
 * USAGE:
 *   <RoleBadge role="manager" />
 *   <RoleBadge role="technician" size="sm" />
 *   <RoleBadge role={userOrgRole} showDescription />
 *
 * @file src/components/auth/RoleBadge.jsx
 * @created February 21, 2026 - Session 11
 */

import { getRoleMeta } from '../../constants/permissions';

/**
 * RoleBadge Component
 *
 * @param {Object} props
 * @param {string}  props.role            - Role key (e.g. 'manager', 'org_owner')
 * @param {'sm'|'md'} [props.size='md']   - Badge size
 * @param {boolean} [props.showDescription] - Show tooltip with description on hover
 */
export function RoleBadge({ role, size = 'md', showDescription = false }) {
  const meta = getRoleMeta(role);

  const sizeClasses = size === 'sm'
    ? 'px-2 py-0.5 text-xs'
    : 'px-2.5 py-1 text-xs font-medium';

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${meta.badge} ${sizeClasses}`}
      title={showDescription ? meta.description : undefined}
    >
      {meta.label}
    </span>
  );
}

export default RoleBadge;
