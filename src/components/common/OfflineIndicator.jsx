/**
 * WorkLedger — Offline Indicator Banner
 *
 * Slim full-width banner inside <main> (AppLayout).
 * Flows in normal document flow — NOT position:fixed.
 *
 * SESSION 19 FIX:
 *   The "online but pending" state had no action button.
 *   User would see "2 pending entries queued for sync..." forever
 *   with no way to retry. Added "Sync Now" button.
 *   Also: pending state now shows an amber warning colour (not blue)
 *   so it reads as "needs attention", not "working".
 *
 * States:
 *   hidden        — online, idle, nothing pending
 *   offline       — red banner, informational
 *   syncing       — blue banner, animated spinner
 *   error         — amber banner, Retry button
 *   pending       — amber banner, Sync Now button  ← FIXED
 *   success flash — green banner, auto-hides after 3s
 *
 * @module components/common/OfflineIndicator
 * @created March 4, 2026 — Session 18
 * @updated April 4, 2026 — Session 19: pending state + Sync Now button
 *
 * File destination: src/components/common/OfflineIndicator.jsx
 */

import React, { useState, useEffect } from 'react';
import { useOffline } from '../../hooks/useOffline';

export function OfflineIndicator() {
  const { isOnline, syncStatus, pendingCount, triggerSync } = useOffline();
  const [showSuccess, setShowSuccess] = useState(false);
  const [prevCount,   setPrevCount]   = useState(pendingCount);

  // Detect when pending count drops to 0 — flash a success banner briefly
  useEffect(() => {
    if (prevCount > 0 && pendingCount === 0 && isOnline) {
      setShowSuccess(true);
      const timer = setTimeout(() => setShowSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
    setPrevCount(pendingCount);
  }, [pendingCount, isOnline]); // eslint-disable-line

  // ── Success flash ─────────────────────────────────────────────────────
  if (showSuccess && isOnline && pendingCount === 0) {
    return (
      <div className="bg-green-500 px-4 py-2 flex items-center justify-center gap-2">
        <span className="text-white text-sm">✅</span>
        <p className="text-sm text-white font-medium">All entries synced successfully</p>
      </div>
    );
  }

  // ── Fully idle — hide ─────────────────────────────────────────────────
  if (isOnline && syncStatus === 'idle' && pendingCount === 0) {
    return null;
  }

  // ── Offline ───────────────────────────────────────────────────────────
  if (!isOnline) {
    return (
      <div className="bg-red-500 px-4 py-2 flex items-center justify-center gap-2 flex-wrap">
        <span className="inline-block w-2 h-2 rounded-full bg-white animate-pulse flex-shrink-0" />
        <p className="text-sm text-white font-medium text-center">
          You are offline — entries are saved locally and will sync when reconnected
        </p>
      </div>
    );
  }

  // ── Syncing ───────────────────────────────────────────────────────────
  if (syncStatus === 'syncing') {
    return (
      <div className="bg-blue-500 px-4 py-2 flex items-center justify-center gap-2">
        <svg className="w-4 h-4 text-white animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        <p className="text-sm text-white font-medium">
          {pendingCount > 0
            ? `Syncing ${pendingCount} ${pendingCount === 1 ? 'entry' : 'entries'}…`
            : 'Syncing…'}
        </p>
      </div>
    );
  }

  // ── Sync error ────────────────────────────────────────────────────────
  if (syncStatus === 'error') {
    return (
      <div className="bg-amber-500 px-4 py-2 flex items-center justify-center gap-2 flex-wrap">
        <svg className="w-4 h-4 text-white flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        <p className="text-sm text-white font-medium">
          {pendingCount > 0
            ? `${pendingCount} ${pendingCount === 1 ? 'entry' : 'entries'} failed to sync`
            : 'Sync failed'}
        </p>
        <button
          onClick={triggerSync}
          className="ml-1 px-2 py-0.5 text-xs bg-white text-amber-700 rounded font-semibold hover:bg-amber-50 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  // ── Online with pending entries — SESSION 19 FIX ──────────────────────
  // Previously: just showed text, no action. User was stuck.
  // Fixed: amber colour (needs attention) + "Sync Now" button.
  if (isOnline && pendingCount > 0) {
    return (
      <div className="bg-amber-400 px-4 py-2 flex items-center justify-center gap-3 flex-wrap">
        <span className="inline-block w-2 h-2 rounded-full bg-white animate-pulse flex-shrink-0" />
        <p className="text-sm text-white font-medium">
          {pendingCount} {pendingCount === 1 ? 'entry' : 'entries'} waiting to sync
        </p>
        <button
          onClick={triggerSync}
          className="px-3 py-0.5 text-xs bg-white text-amber-700 rounded-full font-semibold hover:bg-amber-50 transition-colors"
        >
          Sync Now
        </button>
      </div>
    );
  }

  return null;
}

export default OfflineIndicator;
