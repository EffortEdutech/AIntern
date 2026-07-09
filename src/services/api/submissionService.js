/**
 * AIntern - Submission Service
 *
 * Pushes ready local drafts to Supabase entry_submissions for supervisor
 * review, then mirrors readable server status back into Dexie. Interns
 * create pending rows only; approvals/rejections remain service-role work.
 *
 * @file src/services/api/submissionService.js
 * @created July 9, 2026 - Session 6
 */

import { supabase } from '../supabase/client';
import { dailyLogService } from './dailyLogService';

function normalizeSubmissionStatus(status) {
  return status === 'approved' || status === 'rejected' ? status : 'submitted';
}

class SubmissionService {
  async getSubmissions(internshipId) {
    if (!internshipId) {
      return { success: false, data: [], error: 'Set up your internship before submitting logs.' };
    }

    const { data, error } = await supabase
      .from('entry_submissions')
      .select('id, entry_date, status, supervisor_comment, submitted_at, resolved_at')
      .eq('internship_id', internshipId)
      .order('entry_date', { ascending: false });

    if (error) {
      return { success: false, data: [], error: error.message };
    }

    return { success: true, data: data ?? [], error: null };
  }

  async getSubmissionByDate(internshipId, entryDate) {
    const { data, error } = await supabase
      .from('entry_submissions')
      .select('id, entry_date, status, supervisor_comment, submitted_at, resolved_at')
      .eq('internship_id', internshipId)
      .eq('entry_date', entryDate)
      .maybeSingle();

    if (error) {
      return { success: false, data: null, error: error.message };
    }

    return { success: true, data, error: null };
  }

  async submitDraft(internshipId, draft) {
    if (!internshipId) {
      return { success: false, entryDate: draft?.entry_date, error: 'Set up your internship first.' };
    }
    if (!draft?.entry_date || !draft?.data) {
      return { success: false, entryDate: draft?.entry_date, error: 'Draft is incomplete.' };
    }
    if (draft.status !== 'ready') {
      return { success: false, entryDate: draft.entry_date, error: 'Only ready logs can be submitted.' };
    }

    const existing = await this.getSubmissionByDate(internshipId, draft.entry_date);
    if (!existing.success) {
      return { success: false, entryDate: draft.entry_date, error: existing.error };
    }
    if (existing.data && existing.data.status === 'rejected') {
      // Session 6 review fix: resubmission — clear the rejected row
      // (owner delete policy, migration 003) so a fresh insert can follow.
      const { error: clearError } = await supabase
        .from('entry_submissions')
        .delete()
        .eq('id', existing.data.id)
        .eq('internship_id', internshipId)
        .eq('status', 'rejected');
      if (clearError) {
        return { success: false, entryDate: draft.entry_date, error: clearError.message };
      }
    } else if (existing.data) {
      const local = await dailyLogService.markSubmitted(draft.entry_date, existing.data);
      return {
        success: true,
        entryDate: draft.entry_date,
        data: existing.data,
        local,
        alreadySubmitted: true
      };
    }

    const { data, error } = await supabase
      .from('entry_submissions')
      .insert({
        internship_id: internshipId,
        entry_date: draft.entry_date,
        client_created_at: draft.client_created_at,
        data: draft.data,
        photo_paths: [],
        status: 'pending'
      })
      .select('id, entry_date, status, supervisor_comment, submitted_at, resolved_at')
      .single();

    if (error) {
      return { success: false, entryDate: draft.entry_date, error: error.message };
    }

    const local = await dailyLogService.markSubmitted(draft.entry_date, data);
    return { success: true, entryDate: draft.entry_date, data, local, alreadySubmitted: false };
  }

  async submitReadyDrafts(internshipId, drafts) {
    const results = [];
    for (const draft of drafts) {
      results.push(await this.submitDraft(internshipId, draft));
    }

    const failed = results.filter((result) => !result.success);
    return {
      success: failed.length === 0,
      results,
      submitted: results.filter((result) => result.success),
      failed
    };
  }

  async syncLocalStatuses(internshipId) {
    const submissions = await this.getSubmissions(internshipId);
    if (!submissions.success) {
      return submissions;
    }

    const synced = [];
    for (const submission of submissions.data) {
      const local = await dailyLogService.markSubmitted(submission.entry_date, submission);
      if (local) {
        synced.push({
          entryDate: submission.entry_date,
          status: normalizeSubmissionStatus(submission.status)
        });
      }
    }

    return { success: true, data: synced, error: null };
  }

  async withdrawPending(internshipId, draft) {
    if (!internshipId || !draft?.submission_id) {
      return { success: false, error: 'No pending submission found for this log.' };
    }

    const { error } = await supabase
      .from('entry_submissions')
      .delete()
      .eq('id', draft.submission_id)
      .eq('internship_id', internshipId)
      .eq('status', 'pending');

    if (error) {
      return { success: false, error: error.message };
    }

    const local = await dailyLogService.markReady(draft.entry_date);
    return { success: true, data: local, error: null };
  }
}

export const submissionService = new SubmissionService();
export default submissionService;
