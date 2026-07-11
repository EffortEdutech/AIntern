/**
 * AIntern - Review Service (intern side of the supervisor loop)
 *
 * Requests a supervisor review email via the supervisor-review Edge
 * Function. The function revokes prior open links, creates a fresh
 * single-purpose token covering all pending submissions (plus the
 * evaluation form when the cadence period is due), and emails the link.
 *
 * @file src/services/api/reviewService.js
 * @created July 10, 2026 - Sessions 7-9
 */

import { supabase } from '../supabase/client';

class ReviewService {
  /**
   * @param {string} internshipId
   * @param {Object} opts - { linkOnly: true } skips email entirely and
   *   returns the secure link for manual sharing (WhatsApp/copy) even
   *   when email IS configured — instant, no delivery dependency.
   */
  async requestReview(internshipId, opts = {}) {
    try {
      const { data, error } = await supabase.functions.invoke('supervisor-review', {
        body: {
          action: 'request_review',
          internship_id: internshipId,
          ...(opts.linkOnly ? { share_mode: 'link' } : {}),
        },
      });
      if (error) {
        let message = error.message;
        try {
          const ctx = await error.context?.json?.();
          if (ctx?.error) message = ctx.error;
        } catch { /* keep original */ }
        return { success: false, error: message };
      }
      return data;
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

export const reviewService = new ReviewService();
export default reviewService;
