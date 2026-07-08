/**
 * WorkLedger - Work Entry List Component
 *
 * Pure display component — renders a grid of WorkEntryCard components.
 * ALL filtering, sorting, and state is handled by WorkEntryListPage.
 * This component receives already-filtered workEntries and renders them.
 *
 * SESSION 13: Initial version (had internal filters — caused duplicate UI)
 * SESSION 13 FIX: Stripped internal filters — pure display only
 * SESSION 15 UPDATE:
 *   - Added currentOrgId + subcontractorOrgIds props
 *   - Delete button hidden for entries not owned by currentOrgId
 *   - Source badge shown in "All" tab for subcontractor entries
 *
 * @module components/workEntries/WorkEntryList
 * @created February 1, 2026 - Session 13
 * @updated February 26, 2026 - Session 15: ownership guard + source badge
 */

import React from 'react';
import WorkEntryCard from './WorkEntryCard';

export default function WorkEntryList({
  workEntries = [],
  loading = false,
  onDelete,
  onEdit,
  onView,
  currentOrgId = null,         // used to derive per-card delete permission
  subcontractorOrgIds = [],    // used to show source badge
  showSourceBadge = false,     // show "Subcontractor" badge in All tab
  isSubcontractorView = false // true = read-only Subcontractor tab
}) {

  // ── Loading ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mb-3" />
          <p className="text-sm text-gray-500">Loading work entries…</p>
        </div>
      </div>
    );
  }

  // ── Empty state ───────────────────────────────────────────────────
  if (workEntries.length === 0) {
    return (
      <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-12 text-center">
        <div className="text-5xl mb-4">📝</div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">No work entries found</h3>
        <p className="text-sm text-gray-500">
          {isSubcontractorView
            ? 'No subcontractor entries yet for the current filters.'
            : 'Try adjusting your filters, or create a new work entry.'}
        </p>
      </div>
    );
  }

  // ── Grid ──────────────────────────────────────────────────────────
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {workEntries.map((workEntry) => {
        // Only allow delete/edit for entries owned by the current org.
        // MTSB cannot delete or edit FEST ENT's subcontractor entries.
        const isOwnEntry = !currentOrgId || workEntry.organization_id === currentOrgId;
        const isSubEntry = subcontractorOrgIds.includes(workEntry.organization_id);

        return (
          <WorkEntryCard
            key={workEntry.id}
            workEntry={workEntry}
            onDelete={isOwnEntry && !isSubcontractorView ? onDelete : null}
            onEdit={isOwnEntry && !isSubcontractorView ? onEdit : null}
            onView={onView}
            isOwnEntry={isOwnEntry}              // ← Session 16 fix: was missing, defaulted to true
            isSubcontractorView={isSubcontractorView}
            showSourceBadge={showSourceBadge && isSubEntry}
            sourceOrgId={workEntry.organization_id}
          />
        );
      })}
    </div>
  );
}
