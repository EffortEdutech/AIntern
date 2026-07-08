/**
 * WorkLedger — SyncStatusBadge
 *
 * Reusable pill that shows a work entry's sync status.
 * Used on WorkEntryCard, TechnicianDashboard entry list, and WorkEntryDetail.
 *
 * Props:
 *   syncStatus  — 'pending' | 'syncing' | 'synced' | 'failed' | null
 *   size        — 'sm' | 'md' (default 'sm')
 *   showLabel   — show text label alongside icon (default true)
 *   className   — additional Tailwind classes
 *
 * @file src/components/common/SyncStatusBadge.jsx
 * @created April 4, 2026 — Session 19
 */

import React from 'react';

const SYNC_CONFIG = {
  pending: {
    icon:      '🕐',
    label:     'Pending sync',
    bg:        'bg-amber-100',
    text:      'text-amber-800',
    border:    'border-amber-200',
    dot:       'bg-amber-400'
  },
  syncing: {
    icon:      '🔄',
    label:     'Syncing…',
    bg:        'bg-blue-100',
    text:      'text-blue-800',
    border:    'border-blue-200',
    dot:       'bg-blue-400',
    animate:   true
  },
  synced: {
    icon:      '✅',
    label:     'Synced',
    bg:        'bg-green-100',
    text:      'text-green-800',
    border:    'border-green-200',
    dot:       'bg-green-400'
  },
  failed: {
    icon:      '⚠️',
    label:     'Sync failed',
    bg:        'bg-red-100',
    text:      'text-red-800',
    border:    'border-red-200',
    dot:       'bg-red-400'
  }
};

// Dot-only variant — compact, for card lists
export function SyncDot({ syncStatus }) {
  if (!syncStatus || syncStatus === 'synced') {
    return null;
  }
  const cfg = SYNC_CONFIG[syncStatus];
  if (!cfg) {
    return null;
  }

  return (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full ${cfg.dot} ${cfg.animate ? 'animate-pulse' : ''}`}
      title={cfg.label}
    />
  );
}

// Full badge variant
export default function SyncStatusBadge({
  syncStatus,
  size      = 'sm',
  showLabel = true,
  className = ''
}) {
  if (!syncStatus) {
    return null;
  }

  const cfg = SYNC_CONFIG[syncStatus];
  if (!cfg) {
    return null;
  }

  const sizeClasses = size === 'md'
    ? 'text-sm px-3 py-1.5 gap-2'
    : 'text-xs px-2 py-0.5 gap-1';

  return (
    <span
      className={`
        inline-flex items-center rounded-full border font-medium
        ${cfg.bg} ${cfg.text} ${cfg.border} ${sizeClasses} ${className}
      `}
    >
      <span
        className={`inline-block w-1.5 h-1.5 rounded-full ${cfg.dot} ${cfg.animate ? 'animate-pulse' : ''}`}
      />
      {showLabel && cfg.label}
    </span>
  );
}
