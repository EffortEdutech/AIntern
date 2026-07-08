/**
 * WorkLedger - Approval Badge Component
 *
 * Colour-coded status badge for work entry approval states.
 * Replaces / supersedes the simpler StatusBadge.jsx by adding
 * approval-specific icons, colours, and labels.
 *
 * STATUS COLOUR MAP:
 *   draft      → 🔘 Gray    "Draft"
 *   submitted  → 🔵 Blue    "Pending Review"
 *   approved   → 🟢 Green   "Approved"
 *   rejected   → 🔴 Red     "Rejected"
 *
 * USAGE:
 *   <ApprovalBadge status={workEntry.status} />
 *   <ApprovalBadge status="approved" size="lg" />
 *   <ApprovalBadge status="rejected" showIcon={false} />
 *
 * @module components/workEntries/ApprovalBadge
 * @created February 27, 2026 - Session 16
 */

import React from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Status configuration map
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  draft: {
    label:    'Draft',
    icon:     '○',
    classes:  'bg-gray-100 text-gray-600 border-gray-200',
    dotClass: 'bg-gray-400'
  },
  submitted: {
    label:    'Pending Review',
    icon:     '◉',
    classes:  'bg-blue-50 text-blue-700 border-blue-200',
    dotClass: 'bg-blue-500'
  },
  approved: {
    label:    'Approved',
    icon:     '✓',
    classes:  'bg-green-50 text-green-700 border-green-200',
    dotClass: 'bg-green-500'
  },
  rejected: {
    label:    'Rejected',
    icon:     '✕',
    classes:  'bg-red-50 text-red-700 border-red-200',
    dotClass: 'bg-red-500'
  }
};

const SIZE_CLASSES = {
  sm:   'px-2 py-0.5 text-xs gap-1',
  md:   'px-2.5 py-1 text-xs gap-1.5',
  lg:   'px-3 py-1.5 text-sm gap-2'
};

const DOT_SIZE_CLASSES = {
  sm:  'w-1.5 h-1.5',
  md:  'w-2 h-2',
  lg:  'w-2.5 h-2.5'
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {Object} props
 * @param {string}  props.status    - 'draft' | 'submitted' | 'approved' | 'rejected'
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Badge size
 * @param {boolean} [props.showDot=true]     - Show animated dot indicator
 * @param {string}  [props.className='']     - Extra CSS classes
 */
export default function ApprovalBadge({
  status,
  size = 'md',
  showDot = true,
  className = ''
}) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;
  const dotSize   = DOT_SIZE_CLASSES[size] || DOT_SIZE_CLASSES.md;

  return (
    <span
      className={`
        inline-flex items-center font-medium rounded-full border
        ${config.classes}
        ${sizeClass}
        ${className}
      `}
    >
      {/* Animated pulsing dot for submitted status, static dot for others */}
      {showDot && (
        <span className="relative flex">
          {status === 'submitted' ? (
            <>
              {/* Outer ping animation for "awaiting action" */}
              <span
                className={`
                  animate-ping absolute inline-flex h-full w-full
                  rounded-full opacity-60
                  ${config.dotClass}
                `}
              />
              <span
                className={`
                  relative inline-flex rounded-full
                  ${dotSize} ${config.dotClass}
                `}
              />
            </>
          ) : (
            <span
              className={`
                inline-flex rounded-full
                ${dotSize} ${config.dotClass}
              `}
            />
          )}
        </span>
      )}

      {config.label}
    </span>
  );
}

/**
 * Minimal inline version — just the dot + label, no border/bg.
 * Useful in tables where you need a very compact indicator.
 *
 * USAGE: <ApprovalBadge.Minimal status="approved" />
 */
ApprovalBadge.Minimal = function ApprovalBadgeMinimal({ status }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${config.classes.split(' ').find(c => c.startsWith('text-'))}`}>
      <span className={`w-1.5 h-1.5 rounded-full inline-block ${config.dotClass}`} />
      {config.label}
    </span>
  );
};
