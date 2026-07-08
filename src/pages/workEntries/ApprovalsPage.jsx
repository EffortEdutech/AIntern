/**
 * WorkLedger - Approvals Page
 *
 * Manager/admin dashboard for reviewing submitted work entries.
 * Route: /work/approvals
 * Guard: APPROVE_WORK_ENTRY
 *
 * Features:
 *   - Header with count badge "X entries awaiting review"
 *   - PendingApprovalList (cards → click → WorkEntryDetail)
 *   - Empty state when queue is clear
 *   - Refreshes when route receives focus (via key prop workaround)
 *   - Follows flat AppLayout pattern (no nested routing)
 *
 * Access:
 *   - org_owner, org_admin, manager — via APPROVE_WORK_ENTRY permission
 *   - Technicians/workers → RouteGuard redirects them away
 *
 * @module pages/workEntries/ApprovalsPage
 * @created February 27, 2026 - Session 16
 */

import React, { useState, useEffect, useCallback } from 'react';
import AppLayout from '../../components/layout/AppLayout';
import PendingApprovalList from '../../components/workEntries/PendingApprovalList';
import { workEntryService } from '../../services/api/workEntryService';
import { useOrganization } from '../../context/OrganizationContext';
import {
  CheckCircleIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

export default function ApprovalsPage() {
  const { currentOrg } = useOrganization();

  const [entries,  setEntries]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  // ─────────────────────────────────────────────────────────────────────────
  // Data loading
  // ─────────────────────────────────────────────────────────────────────────

  const loadPending = useCallback(async () => {
    if (!currentOrg?.id) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const result = await workEntryService.getPendingApprovals(currentOrg.id);

      if (!result.success) {
        throw new Error(result.error || 'Failed to load pending approvals');
      }

      setEntries(result.data || []);
      setLastRefresh(new Date());
      console.log(`✅ Loaded ${result.data?.length || 0} pending approvals`);

    } catch (err) {
      console.error('❌ ApprovalsPage load error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [currentOrg?.id]);

  // Load on mount + when org changes
  useEffect(() => {
    loadPending();
  }, [loadPending]);

  // ─────────────────────────────────────────────────────────────────────────
  // Render helpers
  // ─────────────────────────────────────────────────────────────────────────

  const pendingCount = entries.length;

  const formatRefreshTime = () => {
    if (!lastRefresh) {
      return '';
    }
    return new Intl.DateTimeFormat('en-MY', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
    }).format(lastRefresh);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ── Page Header ──────────────────────────────────────────────── */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center">
                <CheckCircleIcon className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  Pending Approvals
                  {!loading && pendingCount > 0 && (
                    <span className="ml-2 inline-flex items-center justify-center
                                     w-6 h-6 text-xs font-bold text-white
                                     bg-blue-600 rounded-full">
                      {pendingCount > 99 ? '99+' : pendingCount}
                    </span>
                  )}
                </h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  {loading
                    ? 'Loading queue…'
                    : pendingCount === 0
                      ? 'No entries waiting for review'
                      : `${pendingCount} ${pendingCount === 1 ? 'entry' : 'entries'} awaiting your review`
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Refresh button */}
          <button
            onClick={loadPending}
            disabled={loading}
            title={lastRefresh ? `Last updated: ${formatRefreshTime()}` : 'Refresh'}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs
                       text-gray-500 hover:text-gray-700
                       bg-white border border-gray-200 hover:border-gray-300
                       rounded-lg transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowPathIcon className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* ── Org context info ─────────────────────────────────────────── */}
        {currentOrg && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5
                          flex items-center gap-2 text-xs text-gray-500">
            <span className="font-medium text-gray-700">{currentOrg.name}</span>
            <span>·</span>
            <span>Showing entries from your organization only</span>
          </div>
        )}

        {/* ── Error state ──────────────────────────────────────────────── */}
        {error && !loading && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-sm font-medium text-red-700 mb-1">Failed to load approvals</p>
            <p className="text-xs text-red-600">{error}</p>
            <button
              onClick={loadPending}
              className="mt-3 text-xs text-red-600 underline hover:text-red-800"
            >
              Try again
            </button>
          </div>
        )}

        {/* ── Main list ────────────────────────────────────────────────── */}
        {!error && (
          <PendingApprovalList
            entries={entries}
            loading={loading}
          />
        )}

        {/* ── Helpful context for managers ─────────────────────────────── */}
        {!loading && !error && pendingCount > 0 && (
          <p className="text-xs text-center text-gray-400">
            Click any entry to review it and approve or reject. Oldest entries appear first.
          </p>
        )}

      </div>
    </AppLayout>
  );
}
