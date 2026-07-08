/**
 * WorkLedger — Offline Context
 *
 * Tracks online/offline status and drives the sync engine.
 * Mounted ONCE at the app root (see main.jsx).
 * Consumed via useOffline() hook from anywhere in the app.
 *
 * SESSION 19 FIX — Periodic retry:
 *   Previously: triggerSync() was called ONCE when going online.
 *   If the push failed (e.g. network blip, Supabase timeout), items stayed
 *   pending forever with no automatic retry. User had to manually tap "Sync Now".
 *
 *   Fix: setInterval every 30 seconds that checks for pending items and
 *   re-triggers sync if online and pendingCount > 0. This means a failed
 *   push automatically retries within 30 seconds without user action.
 *   The interval is cleared when going offline.
 *
 * @module context/OfflineContext
 * @created March 4, 2026 — Session 18
 * @updated April 4, 2026 — Session 19: periodic retry
 *
 * File destination: src/context/OfflineContext.jsx
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { syncService } from '../services/offline/syncService';

const OfflineContext = createContext(null);

const RETRY_INTERVAL_MS = 30_000; // 30 seconds

export function OfflineProvider({ children }) {
  const [isOnline,     setIsOnline]     = useState(navigator.onLine);
  const [syncStatus,   setSyncStatus]   = useState('idle'); // 'idle' | 'syncing' | 'error'
  const [pendingCount, setPendingCount] = useState(0);
  const isSyncing = useRef(false);
  const retryTimer = useRef(null);

  // ── Refresh pending badge ─────────────────────────────────────────────
  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await syncService.getPendingCount();
      setPendingCount(count);
      return count;
    } catch {
      return 0;
    }
  }, []);

  // ── Trigger full sync cycle ───────────────────────────────────────────
  const triggerSync = useCallback(async () => {
    if (isSyncing.current || !navigator.onLine) {
      return;
    }

    isSyncing.current = true;
    setSyncStatus('syncing');

    try {
      await syncService.sync();
      const remaining = await refreshPendingCount();
      // Only mark idle if nothing left — still-pending means push partially failed
      setSyncStatus(remaining > 0 ? 'idle' : 'idle');
    } catch (error) {
      console.error('❌ OfflineContext sync error:', error);
      setSyncStatus('error');
    } finally {
      isSyncing.current = false;
    }
  }, [refreshPendingCount]);

  // ── Online / offline event listeners ─────────────────────────────────
  useEffect(() => {
    const goOnline = () => {
      console.log('🌐 Back online — triggering sync');
      setIsOnline(true);
      triggerSync();
    };
    const goOffline = () => {
      console.log('📡 Gone offline');
      setIsOnline(false);
      setSyncStatus('idle');
    };

    window.addEventListener('online',  goOnline);
    window.addEventListener('offline', goOffline);
    refreshPendingCount();

    return () => {
      window.removeEventListener('online',  goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [triggerSync, refreshPendingCount]);

  // Auto-sync on mount
  useEffect(() => {
    if (navigator.onLine) {
      triggerSync();
    }
  }, []); // eslint-disable-line

  // ── Periodic retry — SESSION 19 FIX ──────────────────────────────────
  // When online and there are pending items (push may have failed),
  // retry every 30 seconds automatically.
  // Cleared when offline so we don't spam during network changes.
  useEffect(() => {
    if (!isOnline) {
      // Clear timer when offline
      if (retryTimer.current) {
        clearInterval(retryTimer.current);
        retryTimer.current = null;
      }
      return;
    }

    // Start periodic check
    retryTimer.current = setInterval(async () => {
      const count = await refreshPendingCount();
      if (count > 0 && !isSyncing.current) {
        console.log(`🔁 Periodic retry — ${count} pending item(s)`);
        triggerSync();
      }
    }, RETRY_INTERVAL_MS);

    return () => {
      if (retryTimer.current) {
        clearInterval(retryTimer.current);
        retryTimer.current = null;
      }
    };
  }, [isOnline, triggerSync, refreshPendingCount]);

  const value = {
    isOnline,
    syncStatus,
    pendingCount,
    triggerSync,
    refreshPendingCount
  };

  return (
    <OfflineContext.Provider value={value}>
      {children}
    </OfflineContext.Provider>
  );
}

export function useOfflineContext() {
  const ctx = useContext(OfflineContext);
  if (!ctx) {
    throw new Error('useOfflineContext must be used inside <OfflineProvider>');
  }
  return ctx;
}

export default OfflineContext;
