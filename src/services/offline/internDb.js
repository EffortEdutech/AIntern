/**
 * AIntern - Local Database (Dexie / IndexedDB)
 *
 * The device is the draft authority: daily logs live here until the
 * intern submits them for supervisor review (Phase 2). Templates are
 * cached for offline form rendering.
 *
 * Deliberately separate from the parked WorkLedger db.js — clean v1
 * schema, no legacy tables.
 *
 * @file src/services/offline/internDb.js
 * @created July 9, 2026 - Session 4
 */

import Dexie from 'dexie';

export const internDb = new Dexie('aintern');

internDb.version(1).stores({
  // One draft per calendar day. status: draft | ready | submitted | approved | rejected
  dailyDrafts: 'entry_date, status, updated_at',
  // Cached templates for offline rendering
  templateCache: 'template_id, cached_at',
});

export default internDb;
