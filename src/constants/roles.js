/**
 * WorkLedger - RBAC Role Constants
 * 
 * Defines all user roles in the system with their hierarchy and permissions.
 * These roles are enforced at the database level via RLS policies.
 * 
 * @module constants/roles
 * @created January 29, 2026
 */

/**
 * User Roles (Ordered by hierarchy - highest to lowest)
 */
export const ROLES = {
  SUPER_ADMIN: 'super_admin',    // Platform administrator (Anthropic/Bina Jaya)
  ORG_ADMIN: 'org_admin',        // Organization administrator
  MANAGER: 'manager',            // Project/site manager
  WORKER: 'worker',              // Field worker/technician
  CLIENT: 'client'               // Client/customer (view-only)
};

/**
 * Role Hierarchy (for permission checks)
 * Higher number = more privileges
 */
export const ROLE_HIERARCHY = {
  [ROLES.SUPER_ADMIN]: 5,
  [ROLES.ORG_ADMIN]: 4,
  [ROLES.MANAGER]: 3,
  [ROLES.WORKER]: 2,
  [ROLES.CLIENT]: 1
};

/**
 * Role Display Names (for UI)
 */
export const ROLE_NAMES = {
  [ROLES.SUPER_ADMIN]: 'Super Admin',
  [ROLES.ORG_ADMIN]: 'Organization Admin',
  [ROLES.MANAGER]: 'Manager',
  [ROLES.WORKER]: 'Worker',
  [ROLES.CLIENT]: 'Client'
};

/**
 * Role Descriptions (for UI)
 */
export const ROLE_DESCRIPTIONS = {
  [ROLES.SUPER_ADMIN]: 'Platform administrator with full system access',
  [ROLES.ORG_ADMIN]: 'Manage organization, users, projects, and contracts',
  [ROLES.MANAGER]: 'Manage projects, approve work entries, view reports',
  [ROLES.WORKER]: 'Create and submit work entries, upload photos',
  [ROLES.CLIENT]: 'View-only access to approved work entries and reports'
};

/**
 * Role Colors (for badges and UI)
 */
export const ROLE_COLORS = {
  [ROLES.SUPER_ADMIN]: 'bg-purple-100 text-purple-800 border-purple-300',
  [ROLES.ORG_ADMIN]: 'bg-blue-100 text-blue-800 border-blue-300',
  [ROLES.MANAGER]: 'bg-green-100 text-green-800 border-green-300',
  [ROLES.WORKER]: 'bg-gray-100 text-gray-800 border-gray-300',
  [ROLES.CLIENT]: 'bg-orange-100 text-orange-800 border-orange-300'
};

/**
 * Check if a role has higher or equal privilege than another role
 * @param {string} userRole - The user's role
 * @param {string} requiredRole - The required role
 * @returns {boolean} True if user role meets or exceeds required role
 */
export const hasRolePrivilege = (userRole, requiredRole) => {
  const userLevel = ROLE_HIERARCHY[userRole] || 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0;
  return userLevel >= requiredLevel;
};

/**
 * Get all roles that have equal or higher privilege than given role
 * @param {string} role - The role to compare
 * @returns {string[]} Array of roles with equal or higher privilege
 */
export const getRolesWithPrivilege = (role) => {
  const roleLevel = ROLE_HIERARCHY[role] || 0;
  return Object.entries(ROLE_HIERARCHY)
    .filter(([, level]) => level >= roleLevel)
    .map(([roleName]) => roleName);
};

/**
 * Check if role is valid
 * @param {string} role - Role to validate
 * @returns {boolean} True if role exists
 */
export const isValidRole = (role) => {
  return Object.values(ROLES).includes(role);
};

/**
 * Default role for new users
 */
export const DEFAULT_ROLE = ROLES.WORKER;
