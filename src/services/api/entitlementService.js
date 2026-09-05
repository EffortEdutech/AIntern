/**
 * AIntern - Entitlement Service (Phase 4 S13 + Payment Hub Phase 3)
 *
 * Supabase remains the server-side gate for AIntern access. Payment Hub is now
 * the checkout/provider boundary. AIntern does not import Stripe or own
 * provider price IDs.
 */

import { supabase } from '../supabase/client';
import { paymentHubService } from './paymentHubService';

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
  async getAccess() {
    try {
      const { data, error } = await supabase.rpc('get_access_state');
      if (error) return { success: false, error: error.message };
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async getHubAccess(userRef) {
    try {
      if (!userRef) return { success: false, error: 'User reference is required.' };
      const [subscription, entitlements] = await Promise.all([
        paymentHubService.currentSubscription(userRef),
        paymentHubService.currentEntitlements(userRef),
      ]);
      return { success: true, data: { subscription, entitlements } };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async checkout({ userRef, planKey }) {
    try {
      const data = await paymentHubService.createCheckout({ userRef, planKey });
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async portal({ userRef }) {
    try {
      const data = await paymentHubService.createPortal({ userRef });
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

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

  daysLeft(iso) {
    if (!iso) return 0;
    return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));
  }
}

export const entitlementService = new EntitlementService();
export default entitlementService;