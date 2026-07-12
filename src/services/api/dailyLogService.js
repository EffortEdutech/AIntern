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
// Phase A.2: opt-in variant with repeatable Tasks Performed entries. Never
// mutate v1 in place (its field paths are frozen into historical evidence
// and already-official report versions) — v2 is a separate, additive row.
export const DAILY_TEMPLATE_ID_V2 = 'aintern-daily-log-v2';

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

class DailyLogService {
  /**
   * Fetch the daily log template — network first, Dexie cache fallback.
   * Session 11: when the internship has a custom template assigned
   * (daily_template_id via AI Template Studio), that one wins.
   */
  async getDailyTemplate(internship = null) {
    const customId = internship?.daily_template_id ?? null;
    try {
      let query = supabase.from('templates').select('*');
      query = customId
        ? query.eq('id', customId)
        : query.eq('template_id', DAILY_TEMPLATE_ID);
      const { data, error } = await query.maybeSingle();

      if (!error && data) {
        await internDb.templateCache.put({
          template_id: data.template_id,
          template: data,
          cached_at: new Date().toISOString()
        });
        // Remember which template this internship uses, for offline lookup
        if (customId) {
          await internDb.templateCache.put({
            template_id: `active-${customId}`,
            template: data,
            cached_at: new Date().toISOString()
          });
        }
        return { success: true, data, fromCache: false };
      }
      throw new Error(error?.message || 'Template not found online');
    } catch {
      // Offline (or fetch failed) — use cache
      const cacheKey = customId ? `active-${customId}` : DAILY_TEMPLATE_ID;
      const cached = await internDb.templateCache.get(cacheKey)
        ?? (customId ? null : await internDb.templateCache.get(DAILY_TEMPLATE_ID));
      if (cached?.template) {
        return { success: true, data: cached.template, fromCache: true };
      }
      return {
        success: false,
        error: 'Template unavailable offline. Open the app once while online to cache it.'
      };
    }
  }

  /**
   * Look up a public template row by its template_id — used by Profile to
   * (a) list the ACTIVE template's fields for the visibility toggles, and
   * (b) resolve the "aintern-daily-log-v2" repeater-tasks variant's id for
   * the "Allow multiple tasks per day" opt-in (Phase A.2).
   */
  async getTemplateByKey(templateId) {
    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .eq('template_id', templateId)
      .maybeSingle();
    if (error || !data) return null;
    return data;
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
      ...existing,
      entry_date: entryDate,
      data,
      status,
      late,
      client_created_at: clientCreatedAt,
      updated_at: new Date().toISOString()
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
   * Ready drafts selected for supervisor submission.
   */
  async listReadyDrafts(entryDates = []) {
    const wanted = new Set(entryDates);
    const all = await this.listDrafts();
    return all.filter((draft) => draft.status === 'ready' && wanted.has(draft.entry_date));
  }

  /**
   * Merge server-side submission status into the local draft.
   */
  async markSubmitted(entryDate, submission) {
    const existing = await internDb.dailyDrafts.get(entryDate);
    if (!existing) {
      return null;
    }

    // Session 6 review fix: if the intern has already revised a rejected
    // log back to 'ready' (or is re-drafting it), a status sync must not
    // clobber that revision with the stale server 'rejected' row.
    if (
      submission.status === 'rejected' &&
      ['ready', 'draft'].includes(existing.status) &&
      existing.updated_at &&
      submission.resolved_at &&
      new Date(existing.updated_at) > new Date(submission.resolved_at)
    ) {
      return existing;
    }

    const status = submission.status === 'approved' || submission.status === 'rejected'
      ? submission.status
      : 'submitted';

    const next = {
      ...existing,
      status,
      submission_id: submission.id,
      submitted_at: submission.submitted_at ?? existing.submitted_at ?? new Date().toISOString(),
      resolved_at: submission.resolved_at ?? null,
      supervisor_comment: submission.supervisor_comment ?? null,
      updated_at: new Date().toISOString()
    };
    await internDb.dailyDrafts.put(next);
    return next;
  }

  /**
   * Reopen a pending submitted draft after the intern withdraws it.
   */
  async markReady(entryDate) {
    const existing = await internDb.dailyDrafts.get(entryDate);
    if (!existing) {
      return null;
    }

    const next = {
      ...existing,
      status: 'ready',
      submission_id: null,
      submitted_at: null,
      resolved_at: null,
      supervisor_comment: null,
      updated_at: new Date().toISOString()
    };
    await internDb.dailyDrafts.put(next);
    return next;
  }

  /**
   * Device restore (Session 10): write a full record directly — used when
   * rebuilding local History on a new device from server-known entries.
   * Preserves the server's client_created_at (late-flag authority).
   */
  async restoreRecord(record) {
    const existing = await internDb.dailyDrafts.get(record.entry_date);
    if (existing) {
      return existing; // never overwrite local work during restore
    }
    const next = {
      entry_date: record.entry_date,
      data: record.data ?? {},
      status: record.status ?? 'submitted',
      late: false,
      client_created_at: record.client_created_at ?? new Date().toISOString(),
      updated_at: record.updated_at ?? new Date().toISOString(),
    };
    await internDb.dailyDrafts.put(next);
    return next;
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
