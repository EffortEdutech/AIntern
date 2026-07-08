/**
 * WorkLedger — useOffline hook
 *
 * Exposes offline state and sync controls to any component.
 * Must be used inside <OfflineProvider> (mounted in main.jsx).
 *
 * Returns:
 *   isOnline            boolean  — current network status
 *   syncStatus          string   — 'idle' | 'syncing' | 'error'
 *   pendingCount        number   — items waiting to sync
 *   triggerSync         fn       — manually kick off a sync cycle
 *   refreshPendingCount fn       — refresh the pending badge count
 *
 * @module hooks/useOffline
 * @created March 4, 2026 — Session 18
 *
 * File destination: src/hooks/useOffline.js
 */

import { useOfflineContext } from '../context/OfflineContext';

export function useOffline() {
  return useOfflineContext();
}

export default useOffline;
