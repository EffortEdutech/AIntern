/**
 * WorkLedger — Technician Dashboard
 *
 * Mobile-first home screen for technicians and field workers.
 * Intentionally minimal: only what a site technician needs on their phone.
 *
 * Features:
 *   - Offline/online status with sync queue count
 *   - Today's entries at a glance
 *   - Pending sync entries list (local entries awaiting server push)
 *   - Big "New Entry" button — always visible
 *   - Recent entries list with SyncStatusBadge
 *   - Cache health indicator (are contracts/templates cached?)
 *
 * Data sources (offline-first):
 *   - offlineDataService.getWorkEntries() — reads IndexedDB
 *   - offlineDataService.getCacheStatus() — tells us what's cached
 *
 * @file src/pages/technician/TechnicianDashboard.jsx
 * @created April 4, 2026 — Session 19
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import SyncStatusBadge from '../../components/common/SyncStatusBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { useOffline } from '../../hooks/useOffline';
import { useRole } from '../../hooks/useRole';
import { offlineDataService } from '../../services/offline/offlineDataService';
import { workEntryService } from '../../services/api/workEntryService';
import { useOrganization } from '../../context/OrganizationContext';

// ── Formatting helpers ────────────────────────────────────────────────────────

function formatDate(dateStr) {
  if (!dateStr) {
    return '—';
  }
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-MY', { weekday: 'short', day: 'numeric', month: 'short' });
}

const STATUS_STYLE = {
  draft:     { bg: 'bg-gray-100',   text: 'text-gray-700',   label: 'Draft'     },
  submitted: { bg: 'bg-blue-100',   text: 'text-blue-800',   label: 'Submitted' },
  approved:  { bg: 'bg-green-100',  text: 'text-green-800',  label: 'Approved'  },
  rejected:  { bg: 'bg-red-100',    text: 'text-red-800',    label: 'Rejected'  }
};

function StatusPill({ status }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.draft;
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}

// ── Entry card — mobile-optimised ─────────────────────────────────────────────

function EntryCard({ entry, onClick }) {
  const isLocal = !entry.remoteId; // exists only in IndexedDB, not yet on server
  const entryId = entry.remoteId ?? `local_${entry.localId}`;

  return (
    <button
      onClick={() => onClick(entryId, isLocal)}
      className="w-full text-left bg-white border border-gray-200 rounded-xl p-4 flex items-start gap-3 active:bg-gray-50 transition-colors"
    >
      {/* Status dot */}
      <div className="mt-1 flex-shrink-0">
        <div
          className={`w-3 h-3 rounded-full ${
            entry.status === 'approved' ? 'bg-green-400' :
              entry.status === 'rejected' ? 'bg-red-400'   :
                entry.status === 'submitted' ? 'bg-blue-400' :
                  'bg-gray-300'
          }`}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <p className="text-sm font-medium text-gray-900 truncate">
            {formatDate(entry.entry_date)}
          </p>
          <SyncStatusBadge syncStatus={entry.sync_status} showLabel={false} />
        </div>

        <p className="text-xs text-gray-500 truncate">
          Contract: {entry.contract_id ?? '—'}
        </p>

        <div className="flex items-center gap-2 mt-2">
          <StatusPill status={entry.status} />
          {isLocal && (
            <span className="text-xs text-amber-600 font-medium">Local only</span>
          )}
        </div>
      </div>

      {/* Chevron */}
      <div className="flex-shrink-0 mt-1 text-gray-400 text-sm">›</div>
    </button>
  );
}

// ── Cache health widget ───────────────────────────────────────────────────────

function CacheHealthBanner({ cacheStatus }) {
  if (cacheStatus.hasCachedData) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-3">
        <span className="text-green-600 text-lg">✅</span>
        <div>
          <p className="text-xs font-medium text-green-800">Ready for offline use</p>
          <p className="text-xs text-green-600">
            {cacheStatus.contracts} contracts · {cacheStatus.templates} templates cached
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-3">
      <span className="text-amber-600 text-lg">⚠️</span>
      <div>
        <p className="text-xs font-medium text-amber-800">No data cached for offline use</p>
        <p className="text-xs text-amber-600">
          Connect to the internet to cache your contracts and templates.
        </p>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TechnicianDashboard() {
  const navigate    = useNavigate();
  const { isOnline, syncStatus, pendingCount } = useOffline();
  const { currentOrg }  = useOrganization();
  const { displayName } = useRole();

  const [entries,     setEntries]     = useState([]);
  const [cacheStatus, setCacheStatus] = useState(null);
  const [loading,     setLoading]     = useState(true);

  const today = new Date().toISOString().split('T')[0];

  // ── Load entries from IndexedDB ─────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const [localEntries, cache] = await Promise.all([
        offlineDataService.getWorkEntries(),
        offlineDataService.getCacheStatus()
      ]);

      setEntries(localEntries);
      setCacheStatus(cache);
    } catch (err) {
      console.error('❌ TechnicianDashboard loadData:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(); 
  }, [loadData]);

  // Reload when coming back online (sync may have updated entries)
  useEffect(() => {
    if (isOnline) {
      loadData();
    }
  }, [isOnline]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived counts ──────────────────────────────────────────────────────
  const todayEntries   = entries.filter(e => e.entry_date === today);
  const pendingEntries = entries.filter(e =>
    e.sync_status === 'pending' || e.sync_status === 'syncing'
  );
  const recentEntries  = entries.slice(0, 10); // most recent 10

  // ── Entry tap handler ────────────────────────────────────────────────────
  const handleEntryTap = (entryId, isLocal) => {
    if (isLocal) {
      // Local-only entries have no server page — show a basic view from IndexedDB
      // For now navigate to /work (list page) — WorkEntryDetail offline support is next
      navigate('/work');
    } else {
      navigate(`/work/${entryId}`);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 pb-24">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="pt-4 pb-6">
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-2xl font-bold text-gray-900">My Work</h1>

            {/* Online/offline pill */}
            <span
              className={`text-xs font-medium px-3 py-1 rounded-full ${
                isOnline
                  ? 'bg-green-100 text-green-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {isOnline ? '🟢 Online' : '🔴 Offline'}
            </span>
          </div>

          {currentOrg && (
            <p className="text-sm text-gray-500">{currentOrg.name}</p>
          )}

          {/* Sync status message */}
          {syncStatus === 'syncing' && (
            <p className="text-xs text-blue-600 mt-1 animate-pulse">
              🔄 Syncing {pendingCount} {pendingCount === 1 ? 'entry' : 'entries'}…
            </p>
          )}
          {syncStatus === 'failed' && (
            <p className="text-xs text-red-600 mt-1">
              ⚠️ Sync failed — will retry automatically
            </p>
          )}
          {isOnline && syncStatus === 'idle' && pendingCount === 0 && (
            <p className="text-xs text-green-600 mt-1">
              ✅ All entries synced
            </p>
          )}
        </div>

        {/* ── New Entry button — always prominent ─────────────────────────── */}
        <Link
          to="/work/new"
          className="
            block w-full py-4 px-6 rounded-2xl text-center
            bg-blue-600 hover:bg-blue-700 active:bg-blue-800
            text-white font-semibold text-lg
            shadow-sm transition-colors mb-6
          "
        >
          + New Entry
        </Link>

        {loading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="md" />
          </div>
        ) : (
          <>
            {/* ── Cache health ───────────────────────────────────────────── */}
            {cacheStatus && (
              <div className="mb-4">
                <CacheHealthBanner cacheStatus={cacheStatus} />
              </div>
            )}

            {/* ── Stats row ──────────────────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-gray-900">{todayEntries.length}</p>
                <p className="text-xs text-gray-500 mt-0.5">Today</p>
              </div>
              <div className={`border rounded-xl p-3 text-center ${
                pendingEntries.length > 0
                  ? 'bg-amber-50 border-amber-200'
                  : 'bg-white border-gray-200'
              }`}>
                <p className={`text-2xl font-bold ${
                  pendingEntries.length > 0 ? 'text-amber-700' : 'text-gray-900'
                }`}>
                  {pendingEntries.length}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">Pending sync</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-gray-900">{entries.length}</p>
                <p className="text-xs text-gray-500 mt-0.5">Total cached</p>
              </div>
            </div>

            {/* ── Pending sync entries — show prominently if any ─────────── */}
            {pendingEntries.length > 0 && (
              <div className="mb-6">
                <h2 className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-2">
                  <span>🕐</span> Waiting to sync ({pendingEntries.length})
                </h2>
                <div className="space-y-2">
                  {pendingEntries.map(entry => (
                    <EntryCard
                      key={entry.localId}
                      entry={entry}
                      onClick={handleEntryTap}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ── Today's entries ────────────────────────────────────────── */}
            {todayEntries.length > 0 && (
              <div className="mb-6">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">
                  Today — {formatDate(today)}
                </h2>
                <div className="space-y-2">
                  {todayEntries.map(entry => (
                    <EntryCard
                      key={entry.localId}
                      entry={entry}
                      onClick={handleEntryTap}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ── All recent entries ─────────────────────────────────────── */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-700">Recent entries</h2>
                <Link
                  to="/work"
                  className="text-xs text-blue-600 font-medium"
                >
                  View all →
                </Link>
              </div>

              {recentEntries.length === 0 ? (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
                  <p className="text-4xl mb-3">📋</p>
                  <p className="text-sm font-medium text-gray-700 mb-1">No entries yet</p>
                  <p className="text-xs text-gray-500">
                    Tap the button above to create your first work entry.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentEntries.map(entry => (
                    <EntryCard
                      key={entry.localId}
                      entry={entry}
                      onClick={handleEntryTap}
                    />
                  ))}
                </div>
              )}
            </div>

          </>
        )}
      </div>
    </AppLayout>
  );
}
