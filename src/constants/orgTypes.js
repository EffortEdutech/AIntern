/**
 * WorkLedger - Organisation Type Constants
 *
 * Defines the four organisation types supported by WorkLedger.
 * These map directly to organizations.org_type in the database.
 *
 * Usage:
 *   import { ORG_TYPES, ORG_TYPE_CONFIG } from '../constants/orgTypes';
 *
 * @module constants/orgTypes
 */

// ── Type values (match DB CHECK constraint exactly) ──────────────────────────

export const ORG_TYPES = {
  CLIENT:          'client',
  MAIN_CONTRACTOR: 'main_contractor',
  SUBCONTRACTOR:   'subcontractor',
  FREELANCER:      'freelancer'
};

// ── Display config ────────────────────────────────────────────────────────────

export const ORG_TYPE_CONFIG = {
  [ORG_TYPES.CLIENT]: {
    label:       'Service Provider / Company',
    description: 'A company that manages its own work, staff, and client contracts. Reports are exported as PDFs for clients.',
    badge:       'bg-blue-100 text-blue-800',
    icon:        '🏢'
  },
  [ORG_TYPES.MAIN_CONTRACTOR]: {
    label:       'Main Contractor',
    description: 'A contractor that holds primary contracts and can assign subcontractors to work under those contracts.',
    badge:       'bg-orange-100 text-orange-800',
    icon:        '🏗️'
  },
  [ORG_TYPES.SUBCONTRACTOR]: {
    label:       'Subcontractor',
    description: 'An organisation that performs work under a main contractor\'s contracts. Work diaries are approved by the main contractor.',
    badge:       'bg-purple-100 text-purple-800',
    icon:        '🔧'
  },
  [ORG_TYPES.FREELANCER]: {
    label:       'Freelancer / Solo',
    description: 'A single-person operation managing their own work records and client reports independently.',
    badge:       'bg-green-100 text-green-800',
    icon:        '👤'
  }
};

// ── Ordered list for dropdowns ────────────────────────────────────────────────

export const ORG_TYPE_OPTIONS = [
  { value: ORG_TYPES.CLIENT,          ...ORG_TYPE_CONFIG[ORG_TYPES.CLIENT] },
  { value: ORG_TYPES.MAIN_CONTRACTOR, ...ORG_TYPE_CONFIG[ORG_TYPES.MAIN_CONTRACTOR] },
  { value: ORG_TYPES.SUBCONTRACTOR,   ...ORG_TYPE_CONFIG[ORG_TYPES.SUBCONTRACTOR] },
  { value: ORG_TYPES.FREELANCER,      ...ORG_TYPE_CONFIG[ORG_TYPES.FREELANCER] }
];

// ── Helper ────────────────────────────────────────────────────────────────────

/**
 * Returns display config for a given org_type value.
 * Falls back to CLIENT config if value is unknown.
 */
export function getOrgTypeConfig(orgType) {
  return ORG_TYPE_CONFIG[orgType] || ORG_TYPE_CONFIG[ORG_TYPES.CLIENT];
}
