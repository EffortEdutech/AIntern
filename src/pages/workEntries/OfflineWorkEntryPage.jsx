/**
 * WorkLedger — Offline Work Entry Page
 *
 * Dedicated offline workspace. Shows ONLY local entries (remoteId=null)
 * from IndexedDB. No server calls. No confused mix of approved/rejected/
 * submitted entries from the server.
 *
 * Rules:
 *   - Only shows entries with remoteId=null (never pushed to Supabase)
 *   - Works fully offline — reads exclusively from IndexedDB
 *   - Actions: View (expand), Edit → /work/offline/:localId/edit, Delete
 *   - Photos: shows count from db.attachments per entry
 *   - Sync Now button when online
 *   - When empty + online: "All synced!" → link to /work
 *   - When empty + offline: "No local entries yet"
 *   - Auto-refreshes when pendingCount changes (sync pushed entries)
 *
 * @file src/pages/workEntries/OfflineWorkEntryPage.jsx
 * @created April 5, 2026 — Session 19
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { useOffline } from '../../hooks/useOffline';
import { db } from '../../services/offline/db';
import { useToast } from '../../context/ToastContext';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(str) {
  if (!str) {
    return '—';
  }
  return new Date(str + 'T00:00:00').toLocaleDateString('en-MY', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
  });
}

// ── Entry card ────────────────────────────────────────────────────────────────

function LocalEntryCard({ entry, contractName, templateName, photoCount, onDelete, onNavigateEdit }) {
  const toast = useToast();
  const [expanded, setExpanded] = useState(false);
  const [deleting,  setDeleting]  = useState(false);

  const handleDelete = async () => {
    if (!window.confirm(
      `Delete this draft entry (${formatDate(entry.entry_date)})?\n\n` +
      'It has never been synced and cannot be recovered.'
    )) {
      return;
    }

    try {
      setDeleting(true);
      // Delete attachments first
      await db.attachments.where('entry_local_id').equals(entry.localId).delete();
      // Delete sync queue items
      await db.syncQueue
        .filter(q => q.entity_type === 'work_entry' && q.entity_local_id === entry.localId)
        .delete();
      // Delete the entry
      await db.workEntries.delete(entry.localId);
      onDelete(entry.localId);
    } catch (err) {
      console.error('❌ Delete failed:', err);
      toast.error('Failed to delete. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const fields = entry.data ? Object.keys(entry.data).filter(k => entry.data[k] !== '' && entry.data[k] !== null) : [];

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">

      {/* Card header — always visible */}
      <div
        className="flex items-center gap-3 px-4 py-4 cursor-pointer active:bg-gray-50"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Status dot */}
        <div className="flex-shrink-0 w-2.5 h-2.5 rounded-full bg-amber-400 mt-0.5" />

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">{formatDate(entry.entry_date)}</p>
          <p className="text-xs text-gray-500 truncate mt-0.5">{contractName}</p>
          {templateName && (
            <p className="text-xs text-gray-400 truncate">{templateName}</p>
          )}
        </div>

        <div className="flex-shrink-0 flex flex-col items-end gap-1">
          <span className="text-xs font-medium bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
            Draft · Not synced
          </span>
          {photoCount > 0 && (
            <span className="text-xs text-gray-500">📷 {photoCount} photo{photoCount > 1 ? 's' : ''}</span>
          )}
          {entry.shift && (
            <span className="text-xs text-gray-400 capitalize">{entry.shift} shift</span>
          )}
        </div>

        <span className="flex-shrink-0 text-gray-400 ml-1">{expanded ? '▲' : '▼'}</span>
      </div>

      {/* Expanded section */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">

          {/* Field summary */}
          {fields.length > 0 ? (
            <div className="mb-3">
              <p className="text-xs font-medium text-gray-600 mb-1">
                {fields.length} field{fields.length > 1 ? 's' : ''} filled
              </p>
              <div className="flex flex-wrap gap-1">
                {fields.slice(0, 6).map(k => (
                  <span key={k} className="text-xs bg-white border border-gray-200 text-gray-600 px-2 py-0.5 rounded-md">
                    {k.split('.').pop().replace(/_/g, ' ')}
                  </span>
                ))}
                {fields.length > 6 && (
                  <span className="text-xs text-gray-400">+{fields.length - 6} more</span>
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-400 mb-3">No fields filled yet</p>
          )}

          {/* Sync error */}
          {entry.sync_error && (
            <div className="mb-3 bg-red-50 border border-red-200 rounded-lg p-2">
              <p className="text-xs font-semibold text-red-800">Last sync error:</p>
              <p className="text-xs text-red-700 font-mono break-all mt-0.5">{entry.sync_error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => onNavigateEdit(entry.localId)}
              className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              ✏️ Edit / Add Photos
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-4 py-2 text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
            >
              {deleting ? '…' : 'Delete'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function OfflineWorkEntryPage() {
  const navigate = useNavigate();
  const { isOnline, pendingCount, syncStatus, triggerSync } = useOffline();

  const [entries,      setEntries]      = useState([]);
  const [contracts,    setContracts]    = useState({});   // id → contract
  const [templates,    setTemplates]    = useState({});   // contract_id → template name
  const [photoCounts,  setPhotoCounts]  = useState({});   // localId → count
  const [loading,      setLoading]      = useState(true);

  const isSyncing = syncStatus === 'syncing';

  // ── Load all local data from IndexedDB ────────────────────────────────────
  const loadLocalData = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch unsynced entries only
      const localEntries = await db.workEntries
        .filter(e => !e.remoteId && !e.deleted_at)
        .toArray();
      localEntries.sort((a, b) => (b.entry_date || '').localeCompare(a.entry_date || ''));
      setEntries(localEntries);

      if (!localEntries.length) {
        setLoading(false); return; 
      }

      // Load contracts for display names
      const contractIds = [...new Set(localEntries.map(e => e.contract_id).filter(Boolean))];
      const contractMap = {};
      for (const cid of contractIds) {
        const c = await db.contracts.get(cid);
        if (c) {
          contractMap[cid] = c;
        }
      }
      setContracts(contractMap);

      // Load template names via junction table
      const templateMap = {};
      for (const cid of contractIds) {
        const jRows = await db.contractTemplates.where('contract_id').equals(cid).toArray();
        if (jRows.length > 0) {
          const defaultRow = jRows.find(r => r.is_default) ?? jRows[0];
          templateMap[cid] = defaultRow.template?.template_name ?? null;
        }
      }
      setTemplates(templateMap);

      // Load photo counts
      const photoMap = {};
      for (const entry of localEntries) {
        const count = await db.attachments
          .where('entry_local_id').equals(entry.localId)
          .count();
        photoMap[entry.localId] = count;
      }
      setPhotoCounts(photoMap);

    } catch (err) {
      console.error('❌ OfflineWorkEntryPage loadLocalData:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLocalData(); 
  }, [loadLocalData]);

  // Reload when pendingCount changes (sync pushed entries → they get remoteId → disappear here)
  useEffect(() => {
    loadLocalData(); 
  }, [pendingCount, loadLocalData]);

  const handleEntryDeleted = (localId) => {
    setEntries(prev => prev.filter(e => e.localId !== localId));
    setPhotoCounts(prev => {
      const n = { ...prev }; delete n[localId]; return n; 
    });
  };

  const handleNavigateEdit = (localId) => {
    navigate(`/work/offline/${localId}/edit`);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 pb-24 pt-2">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Local Drafts</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {isOnline ? '🟢 Online' : '🔴 Offline'} · {entries.length} unsynced {entries.length === 1 ? 'entry' : 'entries'}
            </p>
          </div>

          <div className="flex gap-2">
            {isOnline && entries.length > 0 && (
              <button
                onClick={triggerSync}
                disabled={isSyncing}
                className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isSyncing ? '🔄 Syncing…' : '⬆️ Sync Now'}
              </button>
            )}
            <Link
              to="/work/new"
              className="px-3 py-1.5 text-xs font-semibold bg-green-600 text-white rounded-full hover:bg-green-700 transition-colors"
            >
              + New Entry
            </Link>
          </div>
        </div>

        {/* Status explanation */}
        <div className={`mb-4 rounded-xl p-3 text-xs ${isOnline ? 'bg-blue-50 text-blue-800' : 'bg-amber-50 text-amber-800'}`}>
          {isOnline
            ? 'These entries are saved on this device only. Tap "Sync Now" to upload them to the server.'
            : 'You are offline. These entries are safely stored on this device. They will sync when you reconnect.'}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>

        ) : entries.length === 0 ? (
          /* Empty state */
          <div className="text-center py-16">
            <p className="text-5xl mb-4">✅</p>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {isOnline ? 'All synced!' : 'No local drafts'}
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              {isOnline
                ? 'All your entries have been uploaded to the server.'
                : 'Create a new entry below to start working offline.'}
            </p>
            <div className="flex flex-col gap-3 max-w-xs mx-auto">
              {isOnline && (
                <Link
                  to="/work"
                  className="py-3 px-6 bg-blue-600 text-white rounded-xl font-medium text-sm text-center hover:bg-blue-700 transition-colors"
                >
                  View All Entries →
                </Link>
              )}
              <Link
                to="/work/new"
                className="py-3 px-6 bg-green-600 text-white rounded-xl font-medium text-sm text-center hover:bg-green-700 transition-colors"
              >
                + Create New Entry
              </Link>
            </div>
          </div>

        ) : (
          /* Entry list */
          <div className="space-y-3">
            {entries.map(entry => (
              <LocalEntryCard
                key={entry.localId}
                entry={entry}
                contractName={
                  contracts[entry.contract_id]
                    ? `${contracts[entry.contract_id].contract_number} — ${contracts[entry.contract_id].contract_name}`
                    : entry.contract_id?.slice(0, 8) + '…'
                }
                templateName={templates[entry.contract_id] ?? null}
                photoCount={photoCounts[entry.localId] ?? 0}
                onDelete={handleEntryDeleted}
                onNavigateEdit={handleNavigateEdit}
              />
            ))}

            {/* Link to server entries when online */}
            {isOnline && (
              <Link
                to="/work"
                className="block text-center text-xs text-gray-400 hover:text-gray-600 mt-4 underline"
              >
                View synced entries on server →
              </Link>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
