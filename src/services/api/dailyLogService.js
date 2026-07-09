/**
 * AIntern - Daily Log Service
 *
 * Template fetch (network-first with offline cache) and local draft CRUD.
 * Drafts never leave the device in this phase; submission to the
 * supervisor (entry_submissions) arrives in Phase 2.
 *
 * @file src/services/api/dailyLogService.js
 * @created July 9, 2026 - Session 4
 */

import { supabase } from '../supabase/client';
import { internDb } from '../offline/internDb';

export const DAILY_TEMPLATE_ID = 'aintern-daily-log-v1';

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

class DailyLogService {
  /**
   * Fetch the daily log template — network first, Dexie cache fallback.
   */
  async getDailyTemplate() {
    try {
      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .eq('template_id', DAILY_TEMPLATE_ID)
        .maybeSingle();

      if (!error && data) {
        await internDb.templateCache.put({
          template_id: DAILY_TEMPLATE_ID,
          template: data,
          cached_at: new Date().toISOString(),
        });
        return { success: true, data, fromCache: false };
      }
      throw new Error(error?.message || 'Template not found online');
    } catch (err) {
      // Offline (or fetch failed) — use cache
      const cached = await internDb.templateCache.get(DAILY_TEMPLATE_ID);
      if (cached?.template) {
        console.log('📦 Daily template served from offline cache');
        return { success: true, data: cached.template, fromCache: true };
      }
      console.error('❌ getDailyTemplate: no network and no cache:', err);
      return {
        success: false,
        error: 'Template unavailable offline. Open the app once while online to cache it.',
      };
    }
  }

  /**
   * Get the draft for a date (default today), or null.
   */
  async getDraft(entryDate = todayStr()) {
    return (await internDb.dailyDrafts.get(entryDate)) ?? null;
  }

  /**
   * Create/update the draft for a date. Preserves client_created_at
   * (late-flag authority) from the first save.
   *
   * Late policy (Session 5): a log is late when its FIRST save happened
   * after the deadline on the entry date (default 23:59 local, override
   * via internships.metadata.deadline_time "HH:MM"). Uses the device
   * timestamp, so offline entries created on time never get flagged late
   * just because they synced later.
   */
  async saveDraft(entryDate, data, status = 'draft', deadlineTime = '23:59') {
    const existing = await internDb.dailyDrafts.get(entryDate);
    const clientCreatedAt = existing?.client_created_at ?? new Date().toISOString();
    const deadline = new Date(`${entryDate}T${deadlineTime}:59`);
    const late = Number.isFinite(deadline.getTime())
      ? new Date(clientCreatedAt) > deadline
      : false;
    const record = {
      entry_date: entryDate,
      data,
      status,
      late,
      client_created_at: clientCreatedAt,
      updated_at: new Date().toISOString(),
    };
    await internDb.dailyDrafts.put(record);
    return record;
  }

  /**
   * All local drafts, newest first.
   */
  async listDrafts() {
    const all = await internDb.dailyDrafts.toArray();
    return all.sort((a, b) => (a.entry_date < b.entry_date ? 1 : -1));
  }

  /**
   * Delete a local draft (only sensible while status is draft/ready).
   */
  async deleteDraft(entryDate) {
    await internDb.dailyDrafts.delete(entryDate);
  }
}

export const dailyLogService = new DailyLogService();
export default dailyLogService;
