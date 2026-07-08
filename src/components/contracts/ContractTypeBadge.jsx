/**
 * WorkLedger - Contract Type Badge Component
 * 
 * Displays color-coded badge for contract categories (PMC, CMC, AMC, SLA, etc.).
 * 
 * @module components/contracts/ContractTypeBadge
 * @created January 31, 2026 - Session 10
 */

import React from 'react';

/**
 * Contract category configurations
 */
const CONTRACT_TYPES = {
  'preventive-maintenance': {
    label: 'PMC',
    fullName: 'Preventive Maintenance',
    color: 'bg-green-100 text-green-800 border-green-200'
  },
  'comprehensive-maintenance': {
    label: 'CMC',
    fullName: 'Comprehensive Maintenance',
    color: 'bg-blue-100 text-blue-800 border-blue-200'
  },
  'annual-maintenance': {
    label: 'AMC',
    fullName: 'Annual Maintenance',
    color: 'bg-purple-100 text-purple-800 border-purple-200'
  },
  'sla-based-maintenance': {
    label: 'SLA',
    fullName: 'SLA-Based Maintenance',
    color: 'bg-indigo-100 text-indigo-800 border-indigo-200'
  },
  'corrective-maintenance': {
    label: 'Corrective',
    fullName: 'Corrective Maintenance',
    color: 'bg-orange-100 text-orange-800 border-orange-200'
  },
  'emergency-on-call': {
    label: 'Emergency',
    fullName: 'Emergency On-Call',
    color: 'bg-red-100 text-red-800 border-red-200'
  },
  'time-and-material': {
    label: 'T&M',
    fullName: 'Time & Material',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200'
  },
  'construction-daily-diary': {
    label: 'Construction',
    fullName: 'Construction Daily Diary',
    color: 'bg-gray-100 text-gray-800 border-gray-200'
  }
};

export function ContractTypeBadge({ category, showFullName = false, size = 'md' }) {
  const typeConfig = CONTRACT_TYPES[category] || {
    label: 'Unknown',
    fullName: 'Unknown Type',
    color: 'bg-gray-100 text-gray-800 border-gray-200'
  };

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-0.5',
    lg: 'text-base px-3 py-1'
  };

  return (
    <span 
      className={`
        inline-flex items-center rounded-md font-medium border
        ${typeConfig.color}
        ${sizeClasses[size]}
      `}
      title={typeConfig.fullName}
    >
      {showFullName ? typeConfig.fullName : typeConfig.label}
    </span>
  );
}

/**
 * Get all contract type options for select dropdown
 */
export function getContractTypeOptions() {
  return Object.entries(CONTRACT_TYPES).map(([value, config]) => ({
    value,
    label: `${config.label} - ${config.fullName}`,
    shortLabel: config.label
  }));
}

/**
 * Get contract type config
 */
export function getContractTypeConfig(category) {
  return CONTRACT_TYPES[category] || CONTRACT_TYPES['preventive-maintenance'];
}

export default ContractTypeBadge;
