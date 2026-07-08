/**
 * WorkLedger - Status Constants
 * 
 * Defines status values for various entities in the system.
 * Status transitions are enforced at the database level.
 * 
 * @module constants/status
 * @created January 29, 2026
 */

/**
 * Work Entry Status
 * Draft → Submitted → Approved/Rejected
 */
export const ENTRY_STATUS = {
  DRAFT: 'draft',           // Worker is still editing
  SUBMITTED: 'submitted',   // Submitted for approval
  APPROVED: 'approved',     // Manager approved
  REJECTED: 'rejected'      // Manager rejected
};

/**
 * Entry Status Display Names
 */
export const ENTRY_STATUS_NAMES = {
  [ENTRY_STATUS.DRAFT]: 'Draft',
  [ENTRY_STATUS.SUBMITTED]: 'Submitted',
  [ENTRY_STATUS.APPROVED]: 'Approved',
  [ENTRY_STATUS.REJECTED]: 'Rejected'
};

/**
 * Entry Status Colors (Tailwind classes)
 */
export const ENTRY_STATUS_COLORS = {
  [ENTRY_STATUS.DRAFT]: 'bg-gray-100 text-gray-800 border-gray-300',
  [ENTRY_STATUS.SUBMITTED]: 'bg-blue-100 text-blue-800 border-blue-300',
  [ENTRY_STATUS.APPROVED]: 'bg-green-100 text-green-800 border-green-300',
  [ENTRY_STATUS.REJECTED]: 'bg-red-100 text-red-800 border-red-300'
};

/**
 * Entry Status Icons
 */
export const ENTRY_STATUS_ICONS = {
  [ENTRY_STATUS.DRAFT]: '📝',
  [ENTRY_STATUS.SUBMITTED]: '📤',
  [ENTRY_STATUS.APPROVED]: '✅',
  [ENTRY_STATUS.REJECTED]: '❌'
};

/**
 * Project Status
 */
export const PROJECT_STATUS = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  ON_HOLD: 'on_hold',
  CANCELLED: 'cancelled'
};

/**
 * Project Status Display Names
 */
export const PROJECT_STATUS_NAMES = {
  [PROJECT_STATUS.ACTIVE]: 'Active',
  [PROJECT_STATUS.COMPLETED]: 'Completed',
  [PROJECT_STATUS.ON_HOLD]: 'On Hold',
  [PROJECT_STATUS.CANCELLED]: 'Cancelled'
};

/**
 * Project Status Colors
 */
export const PROJECT_STATUS_COLORS = {
  [PROJECT_STATUS.ACTIVE]: 'bg-green-100 text-green-800 border-green-300',
  [PROJECT_STATUS.COMPLETED]: 'bg-blue-100 text-blue-800 border-blue-300',
  [PROJECT_STATUS.ON_HOLD]: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  [PROJECT_STATUS.CANCELLED]: 'bg-red-100 text-red-800 border-red-300'
};

/**
 * Contract Status
 */
export const CONTRACT_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  COMPLETED: 'completed'
};

/**
 * Contract Status Display Names
 */
export const CONTRACT_STATUS_NAMES = {
  [CONTRACT_STATUS.DRAFT]: 'Draft',
  [CONTRACT_STATUS.ACTIVE]: 'Active',
  [CONTRACT_STATUS.SUSPENDED]: 'Suspended',
  [CONTRACT_STATUS.COMPLETED]: 'Completed'
};

/**
 * Contract Status Colors
 */
export const CONTRACT_STATUS_COLORS = {
  [CONTRACT_STATUS.DRAFT]: 'bg-gray-100 text-gray-800 border-gray-300',
  [CONTRACT_STATUS.ACTIVE]: 'bg-green-100 text-green-800 border-green-300',
  [CONTRACT_STATUS.SUSPENDED]: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  [CONTRACT_STATUS.COMPLETED]: 'bg-blue-100 text-blue-800 border-blue-300'
};

/**
 * Sync Status (for offline-first features)
 */
export const SYNC_STATUS = {
  PENDING: 'pending',       // Waiting to sync
  SYNCING: 'syncing',       // Currently syncing
  SYNCED: 'synced',         // Successfully synced
  FAILED: 'failed',         // Sync failed
  CONFLICT: 'conflict'      // Merge conflict detected
};

/**
 * Sync Status Display Names
 */
export const SYNC_STATUS_NAMES = {
  [SYNC_STATUS.PENDING]: 'Pending',
  [SYNC_STATUS.SYNCING]: 'Syncing',
  [SYNC_STATUS.SYNCED]: 'Synced',
  [SYNC_STATUS.FAILED]: 'Failed',
  [SYNC_STATUS.CONFLICT]: 'Conflict'
};

/**
 * Sync Status Colors
 */
export const SYNC_STATUS_COLORS = {
  [SYNC_STATUS.PENDING]: 'bg-amber-100 text-amber-800 border-amber-300',
  [SYNC_STATUS.SYNCING]: 'bg-blue-100 text-blue-800 border-blue-300',
  [SYNC_STATUS.SYNCED]: 'bg-green-100 text-green-800 border-green-300',
  [SYNC_STATUS.FAILED]: 'bg-red-100 text-red-800 border-red-300',
  [SYNC_STATUS.CONFLICT]: 'bg-orange-100 text-orange-800 border-orange-300'
};

/**
 * Sync Status Icons
 */
export const SYNC_STATUS_ICONS = {
  [SYNC_STATUS.PENDING]: '⏳',
  [SYNC_STATUS.SYNCING]: '🔄',
  [SYNC_STATUS.SYNCED]: '✅',
  [SYNC_STATUS.FAILED]: '❌',
  [SYNC_STATUS.CONFLICT]: '⚠️'
};

/**
 * Valid status transitions for work entries
 */
export const ENTRY_STATUS_TRANSITIONS = {
  [ENTRY_STATUS.DRAFT]: [ENTRY_STATUS.SUBMITTED],
  [ENTRY_STATUS.SUBMITTED]: [ENTRY_STATUS.APPROVED, ENTRY_STATUS.REJECTED],
  [ENTRY_STATUS.APPROVED]: [], // Terminal state
  [ENTRY_STATUS.REJECTED]: [ENTRY_STATUS.DRAFT] // Can be re-drafted
};

/**
 * Check if status transition is valid
 * @param {string} fromStatus - Current status
 * @param {string} toStatus - Target status
 * @returns {boolean} True if transition is valid
 */
export const isValidStatusTransition = (fromStatus, toStatus) => {
  const allowedTransitions = ENTRY_STATUS_TRANSITIONS[fromStatus] || [];
  return allowedTransitions.includes(toStatus);
};

/**
 * Check if status is final (no further transitions allowed)
 * @param {string} status - Status to check
 * @returns {boolean} True if status is final
 */
export const isFinalStatus = (status) => {
  return ENTRY_STATUS_TRANSITIONS[status]?.length === 0;
};
