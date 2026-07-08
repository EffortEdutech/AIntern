/**
 * WorkLedger - Approval History Component
 *
 * Read-only audit timeline shown at the bottom of WorkEntryDetail.
 * Displays the full lifecycle of a work entry:
 *   Created → Submitted → Approved / Rejected
 *
 * Data comes from work_entries columns (already fetched by WorkEntryDetail):
 *   created_at, created_by / creator
 *   submitted_at, submitted_by / submitter
 *   approved_at, approved_by / approver + approval_remarks
 *   rejected_at, rejected_by / rejector + rejection_reason
 *
 * USAGE:
 *   <ApprovalHistory entry={workEntry} />
 *
 * Notes:
 *   - Shown for ALL statuses (even draft shows "Created" event)
 *   - If status=rejected and then resubmitted, the old rejection
 *     fields are cleared by resubmitWorkEntry(), so only the
 *     current state is shown
 *
 * @module components/workEntries/ApprovalHistory
 * @created February 27, 2026 - Session 16
 */

import React from 'react';
import {
  PencilIcon,
  PaperAirplaneIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon
} from '@heroicons/react/24/outline';

// ─────────────────────────────────────────────────────────────────────────────
// Helper: format timestamp to Malaysian locale
// ─────────────────────────────────────────────────────────────────────────────

function formatTimestamp(ts) {
  if (!ts) {
    return null;
  }
  try {
    return new Intl.DateTimeFormat('en-MY', {
      day:    'numeric',
      month:  'short',
      year:   'numeric',
      hour:   '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(new Date(ts));
  } catch {
    return ts;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: extract name from nested user relations
// ─────────────────────────────────────────────────────────────────────────────

function extractName(userRel) {
  if (!userRel) {
    return null;
  }
  // userRel shape: { email, user_profiles: [{ full_name }] }
  return (
    userRel.user_profiles?.[0]?.full_name ||
    userRel.full_name ||
    userRel.email ||
    null
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Timeline Event sub-component
// ─────────────────────────────────────────────────────────────────────────────

function TimelineEvent({
  icon,
  iconBg,
  iconColor,
  label,
  byName,
  timestamp,
  note,
  noteColor = 'text-gray-600',
  notePrefix = '',
  isLast = false
}) {
  return (
    <div className="relative flex gap-4">
      {/* Vertical connector line */}
      {!isLast && (
        <div className="absolute left-[18px] top-9 bottom-0 w-px bg-gray-200" />
      )}

      {/* Icon */}
      <div className={`relative z-10 flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${iconBg}`}>
        {React.createElement(icon, { className: `w-4 h-4 ${iconColor}` })}
      </div>

      {/* Content */}
      <div className="flex-1 pb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-900">{label}</span>
          {byName && (
            <span className="text-sm text-gray-500">by {byName}</span>
          )}
        </div>

        {timestamp && (
          <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
            <ClockIcon className="w-3 h-3" />
            {timestamp}
          </p>
        )}

        {note && (
          <div className={`mt-2 text-xs ${noteColor} bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 leading-relaxed`}>
            {notePrefix && <span className="font-medium">{notePrefix} </span>}
            {note}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {Object} props
 * @param {Object} props.entry - Full work entry object (with joined relations)
 */
export default function ApprovalHistory({ entry }) {
  if (!entry) {
    return null;
  }

  // Build events array — only include events that have actually occurred
  const events = [];

  // ── 1. Created ──────────────────────────────────────────────────────────
  events.push({
    key:       'created',
    icon:      PencilIcon,
    iconBg:    'bg-gray-100',
    iconColor: 'text-gray-500',
    label:     'Created',
    byName:    extractName(entry.creator),
    timestamp: formatTimestamp(entry.created_at),
    note:      null
  });

  // ── 2. Submitted ────────────────────────────────────────────────────────
  if (entry.submitted_at) {
    events.push({
      key:       'submitted',
      icon:      PaperAirplaneIcon,
      iconBg:    'bg-blue-50',
      iconColor: 'text-blue-600',
      label:     'Submitted for Review',
      byName:    extractName(entry.submitter) || extractName(entry.creator),
      timestamp: formatTimestamp(entry.submitted_at),
      note:      null
    });
  }

  // ── 3a. Approved ────────────────────────────────────────────────────────
  if (entry.approved_at) {
    events.push({
      key:        'approved',
      icon:       CheckCircleIcon,
      iconBg:     'bg-green-50',
      iconColor:  'text-green-600',
      label:      'Approved',
      byName:     extractName(entry.approver),
      timestamp:  formatTimestamp(entry.approved_at),
      note:       entry.approval_remarks || null,
      noteColor:  'text-green-700',
      notePrefix: 'Remarks:'
    });
  }

  // ── 3b. Rejected ────────────────────────────────────────────────────────
  if (entry.rejected_at) {
    events.push({
      key:        'rejected',
      icon:       XCircleIcon,
      iconBg:     'bg-red-50',
      iconColor:  'text-red-600',
      label:      'Rejected',
      byName:     extractName(entry.rejector),
      timestamp:  formatTimestamp(entry.rejected_at),
      note:       entry.rejection_reason || null,
      noteColor:  'text-red-700',
      notePrefix: 'Reason:'
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      {/* Header */}
      <h3 className="text-sm font-semibold text-gray-700 mb-5">
        Approval History
      </h3>

      {/* Timeline */}
      <div>
        {events.map((event, index) => (
          <TimelineEvent
            key={event.key}
            icon={event.icon}
            iconBg={event.iconBg}
            iconColor={event.iconColor}
            label={event.label}
            byName={event.byName}
            timestamp={event.timestamp}
            note={event.note}
            noteColor={event.noteColor}
            notePrefix={event.notePrefix}
            isLast={index === events.length - 1}
          />
        ))}
      </div>

      {/* If still pending, show awaiting note */}
      {entry.status === 'submitted' && (
        <div className="mt-2 border border-blue-100 bg-blue-50 rounded-lg px-4 py-3 flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <p className="text-xs text-blue-700">
            Awaiting review by a manager or admin.
          </p>
        </div>
      )}
    </div>
  );
}
