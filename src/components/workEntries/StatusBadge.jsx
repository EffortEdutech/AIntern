/**
 * WorkLedger - Status Badge Component
 * 
 * Displays work entry status with appropriate colors and icons.
 * Supports draft, submitted, approved, and rejected statuses.
 * 
 * @module components/workEntries/StatusBadge
 * @created February 1, 2026 - Session 13
 */

import React from 'react';

/**
 * Status Badge - Visual indicator for work entry status
 * 
 * Status Colors:
 * - draft: Gray
 * - submitted: Blue
 * - approved: Green
 * - rejected: Red
 */
export default function StatusBadge({ status, showIcon = false, size = 'md' }) {
  // Status configuration
  const statusConfig = {
    draft: {
      label: 'Draft',
      color: 'bg-gray-100 text-gray-700 border-gray-300',
      icon: '📝'
    },
    submitted: {
      label: 'Submitted',
      color: 'bg-blue-100 text-blue-700 border-blue-300',
      icon: '📤'
    },
    approved: {
      label: 'Approved',
      color: 'bg-green-100 text-green-700 border-green-300',
      icon: '✅'
    },
    rejected: {
      label: 'Rejected',
      color: 'bg-red-100 text-red-700 border-red-300',
      icon: '❌'
    }
  };

  // Get config for current status
  const config = statusConfig[status] || statusConfig.draft;

  // Size classes
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5'
  };

  const sizeClass = sizeClasses[size] || sizeClasses.md;

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 rounded-full border font-medium
        ${config.color}
        ${sizeClass}
      `}
    >
      {showIcon && <span>{config.icon}</span>}
      <span>{config.label}</span>
    </span>
  );
}
