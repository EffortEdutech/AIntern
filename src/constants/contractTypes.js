/**
 * WorkLedger - Contract Type Constants
 * 
 * Defines contract categories for Malaysian construction, maintenance,
 * facilities, and service industries.
 * 
 * @module constants/contractTypes
 * @created January 29, 2026
 */

/**
 * Contract Categories (Malaysian Market)
 * These align with database CHECK constraints
 */
export const CONTRACT_CATEGORIES = {
  // Maintenance Contracts
  PMC: 'preventive-maintenance',
  CMC: 'comprehensive-maintenance',
  AMC: 'annual-maintenance',
  SLA: 'sla-based-maintenance',
  
  // Service Contracts
  CORRECTIVE: 'corrective-maintenance',
  EMERGENCY: 'emergency-on-call',
  T_AND_M: 'time-and-material',
  
  // Construction
  CONSTRUCTION: 'construction-daily-diary'
};

/**
 * Contract Category Display Names
 */
export const CONTRACT_CATEGORY_NAMES = {
  [CONTRACT_CATEGORIES.PMC]: 'Preventive Maintenance (PMC)',
  [CONTRACT_CATEGORIES.CMC]: 'Comprehensive Maintenance (CMC)',
  [CONTRACT_CATEGORIES.AMC]: 'Annual Maintenance (AMC)',
  [CONTRACT_CATEGORIES.SLA]: 'SLA-Based Maintenance',
  [CONTRACT_CATEGORIES.CORRECTIVE]: 'Corrective Maintenance',
  [CONTRACT_CATEGORIES.EMERGENCY]: 'Emergency On-Call',
  [CONTRACT_CATEGORIES.T_AND_M]: 'Time & Material (T&M)',
  [CONTRACT_CATEGORIES.CONSTRUCTION]: 'Construction Daily Diary'
};

/**
 * Contract Category Short Names
 */
export const CONTRACT_CATEGORY_SHORT_NAMES = {
  [CONTRACT_CATEGORIES.PMC]: 'PMC',
  [CONTRACT_CATEGORIES.CMC]: 'CMC',
  [CONTRACT_CATEGORIES.AMC]: 'AMC',
  [CONTRACT_CATEGORIES.SLA]: 'SLA',
  [CONTRACT_CATEGORIES.CORRECTIVE]: 'Corrective',
  [CONTRACT_CATEGORIES.EMERGENCY]: 'Emergency',
  [CONTRACT_CATEGORIES.T_AND_M]: 'T&M',
  [CONTRACT_CATEGORIES.CONSTRUCTION]: 'Construction'
};

/**
 * Contract Category Descriptions
 */
export const CONTRACT_CATEGORY_DESCRIPTIONS = {
  [CONTRACT_CATEGORIES.PMC]: 'Scheduled preventive maintenance with fixed cycle',
  [CONTRACT_CATEGORIES.CMC]: 'Full-service maintenance covering all systems',
  [CONTRACT_CATEGORIES.AMC]: 'Annual maintenance contract with fixed scope',
  [CONTRACT_CATEGORIES.SLA]: 'Service level agreement with response/resolution targets',
  [CONTRACT_CATEGORIES.CORRECTIVE]: 'Breakdown/reactive maintenance services',
  [CONTRACT_CATEGORIES.EMERGENCY]: '24/7 emergency callout services',
  [CONTRACT_CATEGORIES.T_AND_M]: 'Time and material based billing',
  [CONTRACT_CATEGORIES.CONSTRUCTION]: 'Daily construction site diary and reports'
};

/**
 * Contract Category Colors (from Tailwind config)
 */
export const CONTRACT_CATEGORY_COLORS = {
  [CONTRACT_CATEGORIES.PMC]: 'bg-contract-pmc text-blue-900 border-blue-400',
  [CONTRACT_CATEGORIES.CMC]: 'bg-contract-cmc text-purple-900 border-purple-400',
  [CONTRACT_CATEGORIES.AMC]: 'bg-contract-amc text-green-900 border-green-400',
  [CONTRACT_CATEGORIES.SLA]: 'bg-contract-sla text-red-900 border-red-400',
  [CONTRACT_CATEGORIES.CORRECTIVE]: 'bg-contract-corrective text-orange-900 border-orange-400',
  [CONTRACT_CATEGORIES.EMERGENCY]: 'bg-contract-emergency text-rose-900 border-rose-400',
  [CONTRACT_CATEGORIES.T_AND_M]: 'bg-contract-tm text-cyan-900 border-cyan-400',
  [CONTRACT_CATEGORIES.CONSTRUCTION]: 'bg-contract-construction text-amber-900 border-amber-400'
};

/**
 * Contract Category Icons
 */
export const CONTRACT_CATEGORY_ICONS = {
  [CONTRACT_CATEGORIES.PMC]: '🔧',
  [CONTRACT_CATEGORIES.CMC]: '⚙️',
  [CONTRACT_CATEGORIES.AMC]: '📅',
  [CONTRACT_CATEGORIES.SLA]: '⏱️',
  [CONTRACT_CATEGORIES.CORRECTIVE]: '🔨',
  [CONTRACT_CATEGORIES.EMERGENCY]: '🚨',
  [CONTRACT_CATEGORIES.T_AND_M]: '⏰',
  [CONTRACT_CATEGORIES.CONSTRUCTION]: '🏗️'
};

/**
 * Reporting Frequency Options
 */
export const REPORTING_FREQUENCY = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  ADHOC: 'adhoc'
};

/**
 * Reporting Frequency Display Names
 */
export const REPORTING_FREQUENCY_NAMES = {
  [REPORTING_FREQUENCY.DAILY]: 'Daily',
  [REPORTING_FREQUENCY.WEEKLY]: 'Weekly',
  [REPORTING_FREQUENCY.MONTHLY]: 'Monthly',
  [REPORTING_FREQUENCY.ADHOC]: 'Ad-hoc'
};

/**
 * SLA Tiers (Priority Levels)
 */
export const SLA_TIERS = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
};

/**
 * SLA Tier Display Names
 */
export const SLA_TIER_NAMES = {
  [SLA_TIERS.CRITICAL]: 'Critical',
  [SLA_TIERS.HIGH]: 'High',
  [SLA_TIERS.MEDIUM]: 'Medium',
  [SLA_TIERS.LOW]: 'Low'
};

/**
 * SLA Tier Colors
 */
export const SLA_TIER_COLORS = {
  [SLA_TIERS.CRITICAL]: 'bg-red-100 text-red-800 border-red-300',
  [SLA_TIERS.HIGH]: 'bg-orange-100 text-orange-800 border-orange-300',
  [SLA_TIERS.MEDIUM]: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  [SLA_TIERS.LOW]: 'bg-blue-100 text-blue-800 border-blue-300'
};

/**
 * Default SLA Response Times (in minutes)
 */
export const DEFAULT_SLA_RESPONSE_TIMES = {
  [SLA_TIERS.CRITICAL]: 30,   // 30 minutes
  [SLA_TIERS.HIGH]: 120,       // 2 hours
  [SLA_TIERS.MEDIUM]: 240,     // 4 hours
  [SLA_TIERS.LOW]: 480         // 8 hours
};

/**
 * Default SLA Resolution Times (in hours)
 */
export const DEFAULT_SLA_RESOLUTION_TIMES = {
  [SLA_TIERS.CRITICAL]: 4,     // 4 hours
  [SLA_TIERS.HIGH]: 8,         // 8 hours
  [SLA_TIERS.MEDIUM]: 24,      // 1 day
  [SLA_TIERS.LOW]: 72          // 3 days
};

/**
 * Maintenance Cycles
 */
export const MAINTENANCE_CYCLES = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  BIWEEKLY: 'bi-weekly',
  MONTHLY: 'monthly',
  QUARTERLY: 'quarterly',
  SEMI_ANNUAL: 'semi-annual',
  ANNUAL: 'annual'
};

/**
 * Maintenance Cycle Display Names
 */
export const MAINTENANCE_CYCLE_NAMES = {
  [MAINTENANCE_CYCLES.DAILY]: 'Daily',
  [MAINTENANCE_CYCLES.WEEKLY]: 'Weekly',
  [MAINTENANCE_CYCLES.BIWEEKLY]: 'Bi-Weekly',
  [MAINTENANCE_CYCLES.MONTHLY]: 'Monthly',
  [MAINTENANCE_CYCLES.QUARTERLY]: 'Quarterly',
  [MAINTENANCE_CYCLES.SEMI_ANNUAL]: 'Semi-Annual',
  [MAINTENANCE_CYCLES.ANNUAL]: 'Annual'
};

/**
 * Common Asset Categories for Maintenance
 */
export const ASSET_CATEGORIES = [
  'HVAC Systems',
  'Electrical Systems',
  'Plumbing Systems',
  'Fire Protection',
  'Security Systems',
  'Elevators & Escalators',
  'Building Automation',
  'Lighting Systems',
  'Generators',
  'Pumps & Motors',
  'Chillers',
  'Cooling Towers',
  'Air Handling Units',
  'Access Control',
  'CCTV Systems',
  'Other'
];

/**
 * Work Shifts
 */
export const WORK_SHIFTS = {
  MORNING: 'morning',
  AFTERNOON: 'afternoon',
  NIGHT: 'night',
  FULL_DAY: 'full-day'
};

/**
 * Work Shift Display Names
 */
export const WORK_SHIFT_NAMES = {
  [WORK_SHIFTS.MORNING]: 'Morning (7am-3pm)',
  [WORK_SHIFTS.AFTERNOON]: 'Afternoon (3pm-11pm)',
  [WORK_SHIFTS.NIGHT]: 'Night (11pm-7am)',
  [WORK_SHIFTS.FULL_DAY]: 'Full Day'
};

/**
 * Get recommended reporting frequency for contract category
 * @param {string} category - Contract category
 * @returns {string} Recommended reporting frequency
 */
export const getRecommendedReportingFrequency = (category) => {
  const recommendations = {
    [CONTRACT_CATEGORIES.PMC]: REPORTING_FREQUENCY.DAILY,
    [CONTRACT_CATEGORIES.CMC]: REPORTING_FREQUENCY.MONTHLY,
    [CONTRACT_CATEGORIES.AMC]: REPORTING_FREQUENCY.MONTHLY,
    [CONTRACT_CATEGORIES.SLA]: REPORTING_FREQUENCY.ADHOC,
    [CONTRACT_CATEGORIES.CORRECTIVE]: REPORTING_FREQUENCY.ADHOC,
    [CONTRACT_CATEGORIES.EMERGENCY]: REPORTING_FREQUENCY.ADHOC,
    [CONTRACT_CATEGORIES.T_AND_M]: REPORTING_FREQUENCY.DAILY,
    [CONTRACT_CATEGORIES.CONSTRUCTION]: REPORTING_FREQUENCY.DAILY
  };
  
  return recommendations[category] || REPORTING_FREQUENCY.DAILY;
};

/**
 * Check if contract category requires SLA tracking
 * @param {string} category - Contract category
 * @returns {boolean} True if SLA tracking required
 */
export const requiresSLATracking = (category) => {
  return category === CONTRACT_CATEGORIES.SLA;
};

/**
 * Check if contract category requires approval workflow
 * @param {string} category - Contract category
 * @returns {boolean} True if approval workflow required
 */
export const requiresApprovalWorkflow = (category) => {
  // All except emergency (which needs immediate documentation)
  return category !== CONTRACT_CATEGORIES.EMERGENCY;
};
