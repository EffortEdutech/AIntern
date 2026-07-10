/**
 * AIntern - Report Version Service (v1.1 R1 — Report Engine foundation)
 *
 * Report-level versioned snapshots per spec v1.1: immutable, numbered,
 * created ONLY via the server-side RPC (verified status computed in
 * Postgres — the client can never mint 'verified'). Also runs the
 * deterministic half of the AI Ready Check.
 *
 * (Named reportVersionService to leave the parked WorkLedger
 * reportService.js untouched for engine compatibility.)
 *
 * @file src/services/api/reportVersionService.js
 * @created July 11, 2026 - v1.1 R1
 */

import { supabase } from '../supabase/client';
import { dailyLogService } from './dailyLogService';
import { logbookService } from './logbookService';

class ReportVersionService {
  /** All report versions for an internship, newest first (no content blob). */
  async listVersions(internshipId, reportType = 'logbook') {
    const { data, error } = await supabase
      .from('report_versions')
      .select('id, report_type, version, status, period_start, period_end, content_hash, verification_id, created_at')
      .eq('internship_id', internshipId)
      .eq('report_type', reportType)
      .order('version', { ascending: false });
    if (error) return { success: false, data: [], error: error.message };
    return { success: true, data: data ?? [], error: null };
  }

  /** Full snapshot (with frozen content) for PDF regeneration. */
  async getVersion(id) {
    const { data, error } = await supabase
      .from('report_versions')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return { success: false, error: error?.message ?? 'Not found' };
    return { success: true, data };
  }

  /** Create an official snapshot via the server-side RPC. */
  async createSnapshot(internshipId, reportType = 'logbook', periodStart = null, periodEnd = null) {
    const { data, error } = await supabase.rpc('create_report_snapshot', {
      p_internship: internshipId,
      p_type: reportType,
      p_start: periodStart,
      p_end: periodEnd,
    });
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  }

  /**
   * Ready Check — deterministic half (spec v1.1 §28).
   * Blocking issues prevent a 'verified' snapshot; warnings don't.
   */
  async readyCheck(internship) {
    const issues = [];
    const today = new Date().toISOString().split('T')[0];
    const start = internship.start_date;
    const end = today < internship.end_date ? today : internship.end_date;

    // Local drafts never submitted
    const drafts = await dailyLogService.listDrafts();
    const unsubmitted = drafts.filter((d) => ['draft', 'ready'].includes(d.status));
    if (unsubmitted.length > 0) {
      issues.push({
        level: 'warning',
        text: `${unsubmitted.length} log${unsubmitted.length === 1 ? '' : 's'} on this device not yet submitted (${unsubmitted.map((d) => d.entry_date).slice(0, 3).join(', ')}${unsubmitted.length > 3 ? '…' : ''}).`,
      });
    }
    const rejected = drafts.filter((d) => d.status === 'rejected');
    if (rejected.length > 0) {
      issues.push({
        level: 'warning',
        text: `${rejected.length} rejected log${rejected.length === 1 ? '' : 's'} awaiting your revision.`,
      });
    }

    // Server state
    const { data: pending } = await supabase
      .from('entry_submissions')
      .select('entry_date')
      .eq('internship_id', internship.id)
      .eq('status', 'pending');
    if ((pending ?? []).length > 0) {
      issues.push({
        level: 'blocking',
        text: `${pending.length} submission${pending.length === 1 ? '' : 's'} still awaiting supervisor review — the snapshot cannot be Verified until they are resolved.`,
      });
    }

    const { snapshots, evaluations } = await logbookService.getLogbook(internship.id);

    if ((snapshots ?? []).length === 0) {
      issues.push({ level: 'blocking', text: 'No approved entries yet — nothing to put in an official report.' });
    } else {
      // Coverage: weekdays in elapsed period without any known entry
      const known = new Set([
        ...snapshots.map((s) => s.entry_date),
        ...drafts.map((d) => d.entry_date),
        ...(pending ?? []).map((p) => p.entry_date),
      ]);
      let missing = 0;
      for (let d = new Date(start + 'T12:00:00'); d.toISOString().split('T')[0] <= end; d.setDate(d.getDate() + 1)) {
        const day = d.getDay();
        const ds = d.toISOString().split('T')[0];
        if (day !== 0 && day !== 6 && !known.has(ds)) missing++;
      }
      if (missing > 0) {
        issues.push({ level: 'warning', text: `${missing} weekday${missing === 1 ? '' : 's'} in your internship so far have no log at all.` });
      }
    }

    // Evaluation cadence coverage
    const elapsedDays = Math.floor((new Date(end) - new Date(start)) / 86400000) + 1;
    const expectedEvals = Math.floor(elapsedDays / internship.evaluation_cadence_days);
    if ((evaluations ?? []).length < expectedEvals) {
      const due = expectedEvals - (evaluations ?? []).length;
      issues.push({
        level: 'warning',
        text: `${due} supervisor evaluation${due === 1 ? '' : 's'} due but not completed — request a review to include the evaluation form.`,
      });
    }

    return {
      issues,
      blocking: issues.filter((i) => i.level === 'blocking').length,
      warnings: issues.filter((i) => i.level === 'warning').length,
      canVerify: issues.every((i) => i.level !== 'blocking'),
    };
  }
}

export const reportVersionService = new ReportVersionService();
export default reportVersionService;
