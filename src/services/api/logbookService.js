/**
 * AIntern - Logbook Service (Phase 3, Session 10)
 *
 * Reads the AUTHORITATIVE record: approved_snapshots and evaluations
 * (immutable, owner-readable via RLS). Also powers device restore —
 * rebuilding local History on a new device from what the server knows.
 *
 * @file src/services/api/logbookService.js
 * @created July 10, 2026 - Session 10
 */

import { supabase } from '../supabase/client';

class LogbookService {
  /** All approved snapshots for the internship, oldest first. */
  async getApprovedSnapshots(internshipId) {
    if (!internshipId) return { success: false, data: [], error: 'No internship' };
    const { data, error } = await supabase
      .from('approved_snapshots')
      .select('id, entry_date, client_created_at, content, supervisor_name, supervisor_comment, supervisor_signature, approved_at, audit')
      .eq('internship_id', internshipId)
      .order('entry_date', { ascending: true });
    if (error) return { success: false, data: [], error: error.message };
    return { success: true, data: data ?? [], error: null };
  }

  /** All evaluations for the internship, oldest first. */
  async getEvaluations(internshipId) {
    if (!internshipId) return { success: false, data: [], error: 'No internship' };
    const { data, error } = await supabase
      .from('evaluations')
      .select('id, period_start, period_end, cadence_days, summary, scores, custom_kpis, comments, supervisor_name, supervisor_signature, submitted_at')
      .eq('internship_id', internshipId)
      .order('period_start', { ascending: true });
    if (error) return { success: false, data: [], error: error.message };
    return { success: true, data: data ?? [], error: null };
  }

  /** Everything the logbook needs in one call. */
  async getLogbook(internshipId) {
    const [snaps, evals] = await Promise.all([
      this.getApprovedSnapshots(internshipId),
      this.getEvaluations(internshipId),
    ]);
    return {
      success: snaps.success && evals.success,
      snapshots: snaps.data,
      evaluations: evals.data,
      error: snaps.error || evals.error,
    };
  }
}

export const logbookService = new LogbookService();
export default logbookService;
