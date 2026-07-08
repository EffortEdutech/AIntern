/**
 * WorkLedger - Pending Approval List Component
 *
 * Card list of submitted work entries awaiting manager review.
 * Used by ApprovalsPage.jsx.
 *
 * Each card shows:
 *   - Entry date + shift
 *   - Contract name + number
 *   - Technician name
 *   - Submitted timestamp (relative)
 *   - Click → navigate to WorkEntryDetail where approve/reject lives
 *
 * USAGE:
 *   <PendingApprovalList
 *     entries={pendingEntries}
 *     loading={loading}
 *   />
 *
 * @module components/workEntries/PendingApprovalList
 * @created February 27, 2026 - Session 16
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarIcon,
  UserIcon,
  ClockIcon,
  ChevronRightIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatDate(dateStr) {
  if (!dateStr) {
    return '—';
  }
  try {
    return new Intl.DateTimeFormat('en-MY', {
      day: 'numeric', month: 'long', year: 'numeric'
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

function timeAgo(ts) {
  if (!ts) {
    return '—';
  }
  try {
    const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
    if (diff < 60)            {
      return 'just now';
    }
    if (diff < 3600)          {
      return `${Math.floor(diff / 60)}m ago`;
    }
    if (diff < 86400)         {
      return `${Math.floor(diff / 3600)}h ago`;
    }
    if (diff < 86400 * 7)     {
      return `${Math.floor(diff / 86400)}d ago`;
    }
    return formatDate(ts);
  } catch {
    return '—';
  }
}

// created_by is a plain UUID (auth.users cross-schema join not supported).
// We show a short UUID as the technician identifier in the list.
// Full name is visible on the WorkEntryDetail page after clicking the card.
function shortId(uuid) {
  if (!uuid) {
    return 'Unknown';
  }
  return uuid.substring(0, 8).toUpperCase();
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton loader card
// ─────────────────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 rounded w-1/3" />
          <div className="h-3 bg-gray-200 rounded w-1/2" />
          <div className="h-3 bg-gray-200 rounded w-1/4" />
        </div>
        <div className="w-6 h-6 bg-gray-200 rounded" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Single entry card
// ─────────────────────────────────────────────────────────────────────────────

function PendingCard({ entry }) {
  const navigate = useNavigate();

  // Show short UUID — full name visible on detail page
  const techName = entry.creator?.user_profiles?.[0]?.full_name
    || entry.creator?.email
    || `ID: ${shortId(entry.created_by)}`;
  const contractName  = entry.contract?.contract_name || '—';
  const contractNo    = entry.contract?.contract_number || '';
  const entryDate     = formatDate(entry.entry_date);
  const submittedAgo  = timeAgo(entry.submitted_at);

  const handleClick = () => navigate(`/work/${entry.id}`);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
      className="
        bg-white rounded-xl border border-gray-200 p-4
        hover:border-blue-300 hover:shadow-md
        active:scale-[0.99]
        transition-all cursor-pointer
        focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-1
        group
      "
    >
      <div className="flex items-start justify-between gap-3">
        {/* Left content */}
        <div className="flex-1 min-w-0">

          {/* Pending badge + submitted ago */}
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse inline-block" />
              Pending Review
            </span>
            <span className="text-xs text-gray-400 flex items-center gap-0.5">
              <ClockIcon className="w-3 h-3" />
              {submittedAgo}
            </span>
          </div>

          {/* Contract name */}
          <p className="text-sm font-semibold text-gray-900 truncate">
            {contractName}
          </p>

          {/* Contract number */}
          {contractNo && (
            <p className="text-xs text-gray-400 font-mono mb-2">{contractNo}</p>
          )}

          {/* Entry date + technician */}
          <div className="flex flex-wrap gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <CalendarIcon className="w-3.5 h-3.5 text-gray-400" />
              {entryDate}
              {entry.shift && ` (${entry.shift})`}
            </span>
            <span className="flex items-center gap-1">
              <UserIcon className="w-3.5 h-3.5 text-gray-400" />
              {techName}
            </span>
          </div>
        </div>

        {/* Right arrow */}
        <ChevronRightIcon
          className="w-5 h-5 text-gray-300 group-hover:text-blue-400 flex-shrink-0 mt-1 transition-colors"
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {Object}   props
 * @param {Array}    props.entries   - Array of pending work entry objects
 * @param {boolean}  props.loading   - Show skeleton while loading
 */
export default function PendingApprovalList({ entries = [], loading = false }) {

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  // ── Empty state ───────────────────────────────────────────────────────────
  if (entries.length === 0) {
    return (
      <div className="bg-white rounded-xl border-2 border-dashed border-gray-200 p-12 text-center">
        <div className="text-5xl mb-4">🎉</div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">
          All caught up!
        </h3>
        <p className="text-sm text-gray-500">
          No work entries pending review at the moment.
        </p>
      </div>
    );
  }

  // ── Entry list ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <PendingCard key={entry.id} entry={entry} />
      ))}
    </div>
  );
}
