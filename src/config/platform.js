/**
 * AIntern - Platform Configuration
 *
 * Single source of truth for app identity, enabled modules, and
 * terminology defaults. Seeded-from-WorkLedger engine dirs read labels
 * through useTerminology() instead of hardcoded strings, so the same
 * engine can serve different industries/institutions.
 *
 * Per-internship overrides live in internships.metadata.terminology
 * and are merged by useTerminology().
 *
 * @file src/config/platform.js
 * @created July 9, 2026 - Session 2
 */

export const PLATFORM = {
  name: 'AIntern',
  tagline: 'Your internship logbook',
  company: 'Effort Edutech',
  supportEmail: 'myeffort.studio@gmail.com',

  // Modules toggled off are excluded from routing and navigation.
  // WorkLedger business modules are parked, not deleted — engine reuse.
  modules: {
    dailyLog: true,        // Phase 1
    approvals: true,       // Phase 2 (supervisor email links)
    evaluations: true,     // Phase 2
    logbookExport: true,   // Phase 3
    aiAssistant: true,     // Phase 1 (via ai-gateway)
    templateImport: true,  // Phase 3 (premium)
    // Parked WorkLedger modules — do not enable without a plan revision:
    organizations: false,
    projects: false,
    contracts: false,
    subcontractors: false,
    quickEntry: false,
  },

  // Evaluation cadence options (days) — mirrors internships CHECK constraint
  evaluationCadences: [7, 14, 30],

  // Supervisor email digest modes — mirrors internships CHECK constraint
  digestModes: [
    { value: 'per-entry', label: 'Every submission' },
    { value: 'daily', label: 'Daily digest' },
    { value: 'batch', label: 'At evaluation time' },
  ],
};

/**
 * Terminology defaults. Keys are stable identifiers used by engine
 * components; values are what the intern sees. Overridable per
 * internship via metadata.terminology (e.g. "Shift Log" for medical).
 */
export const TERMINOLOGY_DEFAULTS = {
  entry: 'Daily Log',
  entries: 'Daily Logs',
  newEntry: 'New Daily Log',
  placement: 'Internship',
  supervisor: 'Supervisor',
  evaluation: 'Evaluation',
  evaluations: 'Evaluations',
  logbook: 'Logbook',
  approve: 'Approve',
  approved: 'Approved',
  rejected: 'Needs revision',
  pending: 'Awaiting review',
};

export default PLATFORM;
