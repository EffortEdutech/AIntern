/**
 * WorkLedger - Rejection Analytics Page
 *
 * Manager-only dashboard analysing work entry rejections over a
 * configurable period. Data source: reject_entry_history table
 * (Migration 031, Session 16 — append-only audit log).
 *
 * Access: APPROVE_WORK_ENTRY permission (managers, org_admin, org_owner)
 * Route:  /reports/rejections
 *
 * Data is fetched via reportService.getRejectionAnalytics() which was
 * added to reportService.js in Priority 1 of Session 17. That method
 * returns five datasets in a single service call:
 *   - summary    { total, uniqueEntries, repeatOffenders }
 *   - byTechnician  [{ userId, name, count }]
 *   - topReasons    [{ reason, count }]
 *   - repeatEntries [{ workEntryId, timesRejected, technicianName, ... }]
 *   - weeklyTrend   [{ week, count }]
 *
 * Charts use pure CSS (Tailwind progress bars) — no charting library
 * needed, keeps the bundle small and renders perfectly offline.
 *
 * Schema reference (reject_entry_history):
 *   work_entry_id, organization_id, contract_id, template_id,
 *   entry_date, entry_created_by (→ user_profiles), rejected_by,
 *   rejected_at, rejection_reason, rejection_count, entry_data_snapshot
 *
 * @module pages/reports/RejectionAnalytics
 * @created March 2, 2026 - Session 17
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { reportService } from '../../services/api/reportService';
import { useOrganization } from '../../context/OrganizationContext';
import AppLayout from '../../components/layout/AppLayout';
import LoadingSpinner from '../../components/common/LoadingSpinner';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (isoDate) =>
  isoDate
    ? new Date(isoDate).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric'
    })
    : '—';

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Summary stat card */
function StatCard({ label, value, sub, color = 'text-gray-900', bg = 'bg-white' }) {
  return (
    <div className={`${bg} border border-gray-200 rounded-lg p-4`}>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      <p className="text-sm font-medium text-gray-700 mt-1">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

/**
 * Horizontal bar chart built with CSS only.
 * `items` = [{ label, count }], `maxCount` used to size bars.
 */
function BarChart({ items, maxCount, barColor = 'bg-blue-500', emptyMessage = 'No data' }) {
  if (!items || items.length === 0) {
    return <p className="text-sm text-gray-400 py-4 text-center">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((item, idx) => {
        const pct = maxCount > 0 ? Math.max(4, (item.count / maxCount) * 100) : 4;
        return (
          <div key={idx} className="flex items-center gap-3">
            {/* Rank number */}
            <span className="w-5 text-xs text-gray-400 text-right flex-shrink-0">
              {idx + 1}
            </span>
            {/* Label */}
            <span
              className="text-sm text-gray-700 flex-shrink-0 truncate"
              style={{ width: '160px' }}
              title={item.label}
            >
              {item.label}
            </span>
            {/* Bar track */}
            <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
              <div
                className={`h-full ${barColor} rounded-full transition-all duration-500`}
                style={{ width: `${pct}%` }}
              />
            </div>
            {/* Count */}
            <span className="text-sm font-semibold text-gray-700 w-6 text-right flex-shrink-0">
              {item.count}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Weekly trend sparkline using CSS bars */
function WeeklyTrend({ data }) {
  if (!data || data.length === 0) {
    return <p className="text-sm text-gray-400 py-4 text-center">No trend data</p>;
  }

  const maxCount = Math.max(...data.map(d => d.count), 1);

  return (
    <div className="flex items-end gap-1 h-16">
      {data.map((week, idx) => {
        const heightPct = Math.max(8, (week.count / maxCount) * 100);
        return (
          <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
            <div className="w-full flex items-end" style={{ height: '48px' }}>
              <div
                className="w-full bg-red-400 group-hover:bg-red-500 rounded-t transition-colors"
                style={{ height: `${heightPct}%` }}
              />
            </div>
            {/* Tooltip on hover */}
            <span className="text-xs text-gray-400 truncate" style={{ fontSize: '9px' }}>
              {week.week?.substring(5)} {/* MM-DD */}
            </span>
            <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none z-10">
              Week of {fmt(week.week)}: {week.count} rejection{week.count !== 1 ? 's' : ''}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const PERIOD_OPTIONS = [
  { label: '7 days',  days: 7  },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
  { label: 'Custom',  days: 0  }
];

export default function RejectionAnalytics() {
  const navigate      = useNavigate();
  const { currentOrg } = useOrganization();

  // ── Period state ──────────────────────────────────────────────────────────
  const [activePeriod, setActivePeriod] = useState(30);
  const [customFrom,   setCustomFrom]   = useState('');
  const [customTo,     setCustomTo]     = useState('');
  const [isCustom,     setIsCustom]     = useState(false);

  // ── Data state ────────────────────────────────────────────────────────────
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const [analytics, setAnalytics] = useState(null);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const loadAnalytics = useCallback(async () => {
    if (!currentOrg?.id) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const options = isCustom && customFrom && customTo
        ? { from: customFrom, to: customTo }
        : { days: activePeriod };

      console.log('📊 RejectionAnalytics: Loading...', options);

      const result = await reportService.getRejectionAnalytics(currentOrg.id, options);

      if (!result.success) {
        throw new Error(result.error || 'Failed to load analytics');
      }

      setAnalytics(result.data);
      console.log('✅ Analytics loaded:', result.data.summary);

    } catch (err) {
      console.error('❌ RejectionAnalytics failed:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [currentOrg?.id, activePeriod, isCustom, customFrom, customTo]);

  // Load on mount + when period changes (auto-load for preset periods)
  useEffect(() => {
    if (!isCustom) {
      loadAnalytics();
    }
  }, [currentOrg?.id, activePeriod, isCustom]);

  // ── Derived display data ──────────────────────────────────────────────────
  const techItems   = (analytics?.byTechnician  || []).map(t => ({ label: t.name,   count: t.count }));
  const reasonItems = (analytics?.topReasons    || []).map(r => ({ label: r.reason, count: r.count }));
  const maxTech     = techItems.length   > 0 ? Math.max(...techItems.map(i => i.count))   : 1;
  const maxReason   = reasonItems.length > 0 ? Math.max(...reasonItems.map(i => i.count)) : 1;

  const periodLabel = isCustom && customFrom && customTo
    ? `${fmt(customFrom)} — ${fmt(customTo)}`
    : `Last ${activePeriod} days`;

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <AppLayout>
      <div className="space-y-6">

        {/* Back button */}
        <button
          onClick={() => navigate('/reports')}
          className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Reports
        </button>

        {/* Page header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Rejection Analytics</h1>
            <p className="text-gray-600 mt-1">
              Identify patterns in rejected work entries to improve field quality — {currentOrg?.name}
            </p>
          </div>
          {analytics && (
            <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full">
              {periodLabel}
            </span>
          )}
        </div>

        {/* ── Period Selector ──────────────────────────────────────────────── */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm font-medium text-gray-600 mr-1">Period:</span>

            {PERIOD_OPTIONS.map(opt => (
              <button
                key={opt.label}
                onClick={() => {
                  if (opt.days === 0) {
                    setIsCustom(true);
                  } else {
                    setIsCustom(false);
                    setActivePeriod(opt.days);
                  }
                }}
                className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                  (opt.days === 0 ? isCustom : (!isCustom && activePeriod === opt.days))
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Custom date range inputs */}
          {isCustom && (
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
                <input
                  type="date"
                  value={customTo}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={loadAnalytics}
                disabled={!customFrom || !customTo || loading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Apply
              </button>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-red-800">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">✕</button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        )}

        {/* ── Analytics content ─────────────────────────────────────────── */}
        {!loading && analytics && (
          <>
            {/* Zero state */}
            {analytics.summary.total === 0 ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
                <div className="text-4xl mb-3">🎉</div>
                <h3 className="text-lg font-semibold text-green-900">No rejections in this period!</h3>
                <p className="text-green-700 text-sm mt-1">
                  Great work — all submitted entries were approved without rejection.
                </p>
              </div>
            ) : (
              <>
                {/* ── Stat Cards ──────────────────────────────────────────── */}
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                  <StatCard
                    label="Total Rejections"
                    value={analytics.summary.total}
                    sub={periodLabel}
                    color="text-red-700"
                    bg="bg-red-50"
                  />
                  <StatCard
                    label="Unique Entries Rejected"
                    value={analytics.summary.uniqueEntries}
                    sub="distinct work entries"
                    color="text-orange-700"
                  />
                  <StatCard
                    label="Repeat Offenders"
                    value={analytics.summary.repeatOffenders}
                    sub="entries rejected 2+ times"
                    color={analytics.summary.repeatOffenders > 0 ? 'text-red-700' : 'text-gray-500'}
                  />
                </div>

                {/* ── Weekly Trend ─────────────────────────────────────────── */}
                {analytics.weeklyTrend.length > 1 && (
                  <div className="bg-white border border-gray-200 rounded-lg p-5">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">Weekly Rejection Trend</h3>
                    <WeeklyTrend data={analytics.weeklyTrend} />
                    <p className="text-xs text-gray-400 mt-2 text-center">Each bar = one week. Hover for details.</p>
                  </div>
                )}

                {/* ── Two-column charts ────────────────────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                  {/* Rejections per Technician */}
                  <div className="bg-white border border-gray-200 rounded-lg p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-gray-900">Rejections per Technician</h3>
                      <span className="text-xs text-gray-400">Training focus</span>
                    </div>
                    <BarChart
                      items={techItems}
                      maxCount={maxTech}
                      barColor="bg-orange-400"
                      emptyMessage="No technician data"
                    />
                    {techItems.length > 0 && (
                      <p className="text-xs text-gray-400 mt-3">
                        💡 Technicians with the most rejections may benefit from additional training or guidance.
                      </p>
                    )}
                  </div>

                  {/* Top Rejection Reasons */}
                  <div className="bg-white border border-gray-200 rounded-lg p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-gray-900">Top Rejection Reasons</h3>
                      <span className="text-xs text-gray-400">Most common first</span>
                    </div>
                    <BarChart
                      items={reasonItems}
                      maxCount={maxReason}
                      barColor="bg-red-400"
                      emptyMessage="No reason data"
                    />
                    {reasonItems.length > 0 && (
                      <p className="text-xs text-gray-400 mt-3">
                        💡 Common reasons highlight systemic issues — consider updating field guidelines or templates.
                      </p>
                    )}
                  </div>
                </div>

                {/* ── Repeat Offenders Table ───────────────────────────────── */}
                {analytics.repeatEntries.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 bg-red-50 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-red-900">
                        Entries Rejected Multiple Times
                        <span className="ml-2 px-2 py-0.5 bg-red-200 text-red-800 text-xs font-bold rounded-full">
                          {analytics.repeatEntries.length}
                        </span>
                      </h3>
                      <span className="text-xs text-red-600">Requires attention</span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 bg-gray-50">
                            <th className="text-left py-3 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Entry Date</th>
                            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Technician</th>
                            <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Times Rejected</th>
                            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Last Rejection Reason</th>
                            <th className="text-left py-3 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Last Rejected</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analytics.repeatEntries.map((entry) => (
                            <tr key={entry.workEntryId} className="border-b border-gray-100 hover:bg-red-50 transition-colors">
                              <td className="py-3 px-5 text-gray-700 whitespace-nowrap">
                                {fmt(entry.entryDate)}
                              </td>
                              <td className="py-3 px-4 text-gray-700 font-medium">
                                {entry.technicianName}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-100 text-red-700 text-xs font-bold">
                                  {entry.timesRejected}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-gray-600 text-sm max-w-xs">
                                {entry.lastReason
                                  ? entry.lastReason.length > 80
                                    ? entry.lastReason.substring(0, 80) + '…'
                                    : entry.lastReason
                                  : '—'}
                              </td>
                              <td className="py-3 px-5 text-gray-500 text-xs whitespace-nowrap">
                                {fmt(entry.lastRejectedAt)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* ── Insight banner if no repeat offenders ───────────────── */}
                {analytics.repeatEntries.length === 0 && analytics.summary.total > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
                    <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm text-green-800">
                      No entries were rejected more than once — technicians are correcting their submissions successfully.
                    </p>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Prompt before first load */}
        {!loading && !analytics && !error && (
          <div className="bg-white border border-gray-200 border-dashed rounded-lg p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p className="text-gray-600 font-medium">Loading analytics…</p>
          </div>
        )}

      </div>
    </AppLayout>
  );
}
