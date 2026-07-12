/**
 * AIntern - Entitlement Service (Phase 4 S13: internship pass + trial)
 *
 * Client wrapper around the server-side entitlement truth:
 *   get_access_state()      — { trial_ends_at, trial_active, pass, active }
 *   redeem_promo_code(code) — pilot/manual activation path
 *
 * Prices live HERE (display config); the DB stores plan identity only,
 * so pricing can change without a migration. Payment provider integration
 * (toyyibPay/Stripe) is Phase 4b — after the pilot validates pricing.
 *
 * The client NEVER decides access — the server gates review requests
 * (supervisor-review v4), official versions (create_report_snapshot),
 * and bundled AI (ai-gateway v7). This service just powers the UX.
 *
 * @file src/services/api/entitlementService.js
 * @created July 12, 2026 - Phase 4 S13
 */

import { supabase } from '../supabase/client';

export const PASS_PLANS = [
  {
    id: 'pass_3m',
    label: '3-month pass',
    months: 3,
    price: 'RM39',
    blurb: 'One short internship, fully covered.',
  },
  {
    id: 'pass_6m',
    label: '6-month pass',
    months: 6,
    price: 'RM59',
    blurb: 'Best value for longer placements.',
  },
];

export const planLabel = (id) =>
  PASS_PLANS.find((p) => p.id === id)?.label ?? id;

class EntitlementService {
  /** Server-computed access state for the logged-in intern. */
  async getAccess() {
    try {
      const { data, error } = await supabase.rpc('get_access_state');
      if (error) return { success: false, error: error.message };
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /** Redeem a promo/activation code → activates a pass server-side. */
  async redeem(code) {
    try {
      const { data, error } = await supabase.rpc('redeem_promo_code', {
        p_code: String(code ?? '').trim(),
      });
      if (error) return { success: false, error: error.message };
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /** Whole days remaining until an ISO timestamp (min 0). */
  daysLeft(iso) {
    if (!iso) return 0;
    return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));
  }
}

export const entitlementService = new EntitlementService();
export default entitlementService;
