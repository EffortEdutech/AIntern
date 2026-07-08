/**
 * WorkLedger - Permission Constants
 *
 * Single source of truth for every role-permission mapping in the platform.
 * Used by useRole(), PermissionGuard, Sidebar, BottomNav, and individual pages.
 *
 * ── ROLE SOURCES ──────────────────────────────────────────────────────────
 *
 * PLATFORM ROLES  (user_profiles.global_role)
 *   super_admin      → Eff. Has every permission. Can see all orgs.
 *   bina_jaya_staff  → BJ employee. Can view/edit client data, not manage users.
 *
 * ORG ROLES  (org_members.role for current org)
 *   org_owner        → Client company owner. Full control of their org.
 *   org_admin        → Client admin. Manage users and contracts.
 *   manager          → Supervisor. See all work in org, can approve.
 *   technician       → Field worker. See and edit own entries only.
 *   subcontractor    → External worker. Own entries only, no reports.
 *   worker           → Legacy alias for technician (kept for backward compat).
 *   client           → Legacy external viewer (kept for backward compat).
 *
 * ── PERMISSION CHECK PRIORITY ─────────────────────────────────────────────
 *   1. super_admin      → always true (no check needed)
 *   2. bina_jaya_staff  → allowed for most read/write, blocked from user mgmt
 *   3. org_owner        → full org control
 *   4. org_admin        → manage users + contracts within own org
 *   5. manager          → view all, create/edit work, generate reports
 *   6. technician/worker → own entries only
 *   7. subcontractor    → own entries, no reports
 *
 * @file src/constants/permissions.js
 * @created February 21, 2026 - Session 11
 */

// ─────────────────────────────────────────────────────────
// ROLE CONSTANTS
// ─────────────────────────────────────────────────────────

export const PLATFORM_ROLES = {
  SUPER_ADMIN:      'super_admin',
  BINA_JAYA_STAFF:  'bina_jaya_staff'
};

export const ORG_ROLES = {
  ORG_OWNER:      'org_owner',
  ORG_ADMIN:      'org_admin',
  MANAGER:        'manager',
  TECHNICIAN:     'technician',
  SUBCONTRACTOR:  'subcontractor',
  WORKER:         'worker',    // legacy alias for technician
  CLIENT:         'client'    // legacy viewer
};

// All roles that are "field workers" (can only see their own entries)
export const FIELD_WORKER_ROLES = ['technician', 'worker', 'subcontractor'];

// All roles that are "org managers" (can see all entries in org)
export const ORG_MANAGER_ROLES = ['org_owner', 'org_admin', 'manager'];

// ─────────────────────────────────────────────────────────
// PERMISSION MATRIX
// Each key = a permission name.
// Value = array of roles that HAVE that permission.
// super_admin is NOT listed — it's handled separately
// in hasPermission() (always returns true).
// ─────────────────────────────────────────────────────────

export const PERMISSIONS = {

  NAV_QUICK_ENTRY: ['super_admin', 'bina_jaya_staff'],  
  
  // ── WORK ENTRIES ──────────────────────────────────────
  // Who can see all entries in the org (not just their own)
  VIEW_ALL_WORK_ENTRIES: [
    'bina_jaya_staff',
    'org_owner', 'org_admin', 'manager'
  ],
  // Who can see their own entries
  VIEW_OWN_WORK_ENTRIES: [
    'bina_jaya_staff',
    'org_owner', 'org_admin', 'manager',
    'technician', 'worker', 'subcontractor'
  ],
  // Who can create new entries
  CREATE_WORK_ENTRY: [
    'bina_jaya_staff',
    'org_owner', 'org_admin', 'manager',
    'technician', 'worker', 'subcontractor'
  ],
  // Who can edit ANY entry in the org
  EDIT_ANY_WORK_ENTRY: [
    'bina_jaya_staff',
    'org_owner', 'org_admin', 'manager'
  ],
  // Who can edit their own entries (everyone who can create)
  EDIT_OWN_WORK_ENTRY: [
    'bina_jaya_staff',
    'org_owner', 'org_admin', 'manager',
    'technician', 'worker', 'subcontractor'
  ],
  // Who can delete entries
  // Technicians/workers/subcontractors can delete their OWN draft entries only.
  // User-level guard enforced in WorkEntryCard (created_by === user.id).
  // Org-level guard enforced in workEntryService.deleteWorkEntry.
  // DB-level guard enforced by RLS DELETE policy (Migration 029d).
  DELETE_WORK_ENTRY: [
    'bina_jaya_staff',
    'org_owner', 'org_admin', 'manager',
    'technician', 'worker', 'subcontractor'
  ],
  // Who can submit entries for approval
  SUBMIT_WORK_ENTRY: [
    'bina_jaya_staff',
    'org_owner', 'org_admin', 'manager',
    'technician', 'worker', 'subcontractor'
  ],
  // Who can approve/reject submissions
  APPROVE_WORK_ENTRY: [
    'bina_jaya_staff',
    'org_owner', 'org_admin', 'manager'
  ],

  // ── PROJECTS ──────────────────────────────────────────
  VIEW_PROJECTS: [
    'bina_jaya_staff',
    'org_owner', 'org_admin', 'manager',
    'technician', 'worker', 'subcontractor'
  ],
  MANAGE_PROJECTS: [
    'bina_jaya_staff',
    'org_owner', 'org_admin'
  ],
  CREATE_PROJECT: [
    'bina_jaya_staff',
    'org_owner', 'org_admin'
  ],
  EDIT_PROJECT: [
    'bina_jaya_staff',
    'org_owner', 'org_admin'
  ],
  DELETE_PROJECT: [
    'bina_jaya_staff',
    'org_owner', 'org_admin'
  ],

  // ── CONTRACTS ─────────────────────────────────────────
  VIEW_CONTRACTS: [
    'bina_jaya_staff',
    'org_owner', 'org_admin', 'manager',
    'technician', 'worker', 'subcontractor'
  ],
  MANAGE_CONTRACTS: [
    'bina_jaya_staff',
    'org_owner', 'org_admin'
  ],
  CREATE_CONTRACT: [
    'bina_jaya_staff',
    'org_owner', 'org_admin'
  ],
  EDIT_CONTRACT: [
    'bina_jaya_staff',
    'org_owner', 'org_admin'
  ],
  DELETE_CONTRACT: [
    'bina_jaya_staff',
    'org_owner', 'org_admin'
  ],

  // ── TEMPLATES ─────────────────────────────────────────
  VIEW_TEMPLATES: [
    'bina_jaya_staff',
    'org_owner', 'org_admin', 'manager'
  ],
  MANAGE_TEMPLATES: [
    'bina_jaya_staff',
    'org_owner', 'org_admin'
  ],
  IMPORT_REPORT_TEMPLATE: [
    'bina_jaya_staff',
    'org_owner', 'org_admin'
  ],

  // ── REPORTS ───────────────────────────────────────────
  VIEW_REPORTS: [
    'bina_jaya_staff',
    'org_owner', 'org_admin', 'manager'
  ],
  GENERATE_REPORTS: [
    'bina_jaya_staff',
    'org_owner', 'org_admin', 'manager'
  ],

  // ── LAYOUTS ───────────────────────────────────────────
  VIEW_LAYOUTS: [
    'bina_jaya_staff',
    'org_owner', 'org_admin', 'manager'
  ],
  MANAGE_LAYOUTS: [
    'bina_jaya_staff',
    'org_owner', 'org_admin'
  ],

  // ── USER & ORG MANAGEMENT ─────────────────────────────
  VIEW_ORG_MEMBERS: [
    'bina_jaya_staff',
    'org_owner', 'org_admin', 'manager'
  ],
  MANAGE_ORG_USERS: [
    'org_owner', 'org_admin'
    // Note: bina_jaya_staff intentionally excluded from USER management
    // BJ staff manage platform, not client's user roster
  ],
  INVITE_USERS: [
    'org_owner', 'org_admin'
  ],
  CHANGE_USER_ROLES: [
    'org_owner', 'org_admin'
  ],
  MANAGE_ORG_SETTINGS: [
    'org_owner'
  ],

  // ── NAVIGATION ITEMS (used by Sidebar / BottomNav) ────
  // These determine what nav items are VISIBLE to each role.
  NAV_DASHBOARD: [
    'bina_jaya_staff',
    'org_owner', 'org_admin', 'manager',
    'technician', 'worker', 'subcontractor'
  ],
  NAV_WORK_ENTRIES: [
    'bina_jaya_staff',
    'org_owner', 'org_admin', 'manager',
    'technician', 'worker', 'subcontractor'
  ],
  NAV_PROJECTS: [
    'bina_jaya_staff',
    'org_owner', 'org_admin', 'manager',
    'technician', 'worker', 'subcontractor'
  ],
  NAV_CONTRACTS: [
    'bina_jaya_staff',
    'org_owner', 'org_admin', 'manager',
    'technician', 'worker', 'subcontractor'
  ],
  NAV_TEMPLATES: [
    'bina_jaya_staff',
    'org_owner', 'org_admin', 'manager'
  ],
  NAV_REPORTS: [
    'bina_jaya_staff',
    'org_owner', 'org_admin', 'manager'
  ],
  NAV_LAYOUTS: [
    'bina_jaya_staff',
    'org_owner', 'org_admin'
  ],
  NAV_AI_TEMPLATE_STUDIO: [
    'bina_jaya_staff',
    'org_owner', 'org_admin'
  ],
  NAV_USERS: [
    'org_owner', 'org_admin'
  ],
  NAV_ORGANIZATIONS: [
    'bina_jaya_staff',
    'org_owner', 'org_admin'
  ],
  // ── SUBCONTRACTORS (Session 15) ────────────────────────────────────
  // Who can SEE the Subcontractors nav item
  NAV_SUBCONTRACTORS: [
    'bina_jaya_staff',
    'org_owner', 'org_admin', 'manager'
  ],
  // Who can MANAGE (add/terminate) subcontractor relationships
  MANAGE_SUBCONTRACTORS: [
    'bina_jaya_staff',
    'org_owner', 'org_admin'
  ],
  // Who can VIEW subcontractor work entries (cross-org)
  VIEW_SUBCONTRACTOR_WORK: [
    'bina_jaya_staff',
    'org_owner', 'org_admin', 'manager'
  ]
};

// ─────────────────────────────────────────────────────────
// ROLE DISPLAY METADATA
// Used by UI badges, dropdowns, role pickers
// ─────────────────────────────────────────────────────────

export const ROLE_META = {
  super_admin: {
    label:       'Super Admin',
    description: 'Bina Jaya owner — full platform access',
    color:       'red',
    badge:       'bg-red-100 text-red-700'
  },
  bina_jaya_staff: {
    label:       'BJ Staff',
    description: 'Bina Jaya employee — view and manage client data',
    color:       'amber',
    badge:       'bg-amber-100 text-amber-700'
  },
  org_owner: {
    label:       'Owner',
    description: 'Company owner — full control of their organization',
    color:       'purple',
    badge:       'bg-purple-100 text-purple-700'
  },
  org_admin: {
    label:       'Admin',
    description: 'Organization admin — manage users and contracts',
    color:       'blue',
    badge:       'bg-blue-100 text-blue-700'
  },
  manager: {
    label:       'Manager',
    description: 'Supervisor — view all work, approve entries, generate reports',
    color:       'green',
    badge:       'bg-green-100 text-green-700'
  },
  technician: {
    label:       'Technician',
    description: 'Field worker — create and view own work entries',
    color:       'gray',
    badge:       'bg-gray-100 text-gray-700'
  },
  worker: {
    label:       'Worker',
    description: 'Field worker — create and view own work entries',
    color:       'gray',
    badge:       'bg-gray-100 text-gray-700'
  },
  subcontractor: {
    label:       'Subcontractor',
    description: 'External worker — own entries only, no reports',
    color:       'orange',
    badge:       'bg-orange-100 text-orange-700'
  },
  client: {
    label:       'Client',
    description: 'External viewer — read-only access',
    color:       'gray',
    badge:       'bg-gray-100 text-gray-500'
  }
};

/**
 * Roles that org_admin / org_owner can assign via the User Management UI.
 * Platform-level roles (super_admin, bina_jaya_staff) are excluded —
 * those are managed directly in the database by Bina Jaya.
 */
export const ASSIGNABLE_ORG_ROLES = [
  'org_owner',
  'org_admin',
  'manager',
  'technician',
  'worker',
  'subcontractor',
  'client'
];

/**
 * Get display meta for a role.
 * Safe — returns a default if role is unknown.
 */
export function getRoleMeta(role) {
  return ROLE_META[role] || {
    label:       role || 'Unknown',
    description: '',
    color:       'gray',
    badge:       'bg-gray-100 text-gray-500'
  };
}
