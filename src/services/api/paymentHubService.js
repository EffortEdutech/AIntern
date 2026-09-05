/**
 * AIntern - Payment Hub client
 *
 * Thin browser client for the Central Payment Hub integration.
 * This module does not import Stripe and does not know provider price IDs.
 *
 * Production-safe auth: when a Supabase user session exists, AIntern sends the
 * user's Supabase access token to the Payment Hub. The Hub validates that token
 * server-side and binds requests to the same user_ref. The old app token remains
 * only as a local sandbox/operator fallback.
 */

import { supabase } from '../supabase/client';

const HUB_BASE_URL = import.meta.env.VITE_PAYMENT_HUB_BASE_URL ?? 'http://127.0.0.1:3017';
const HUB_APP_ID = import.meta.env.VITE_PAYMENT_HUB_APP_ID ?? 'aintern';
const HUB_APP_TOKEN = import.meta.env.VITE_PAYMENT_HUB_APP_TOKEN ?? '';
const HUB_ENVIRONMENT = import.meta.env.VITE_PAYMENT_HUB_ENVIRONMENT ?? 'test';
const RETURN_CONTEXT = 'billing';

async function getBearerToken() {
  const { data } = await supabase.auth.getSession();
  const userToken = data?.session?.access_token;
  if (userToken) return userToken;
  if (HUB_APP_TOKEN) return HUB_APP_TOKEN;
  throw new Error('Payment Hub authentication is missing. Sign in to AIntern or configure VITE_PAYMENT_HUB_APP_TOKEN for local sandbox only.');
}

function idempotencyKey(operation, userRef, planKey = '') {
  return ['aintern', operation, userRef, planKey, Date.now()].filter(Boolean).join('-');
}

async function hubFetch(path, options = {}) {
  const token = await getBearerToken();
  const response = await fetch(`${HUB_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || data?.error?.code || `Payment Hub request failed (${response.status})`;
    throw new Error(message);
  }
  return data;
}

export const paymentHubService = {
  appId: HUB_APP_ID,
  environment: HUB_ENVIRONMENT,

  catalog() {
    const params = new URLSearchParams({ app_id: HUB_APP_ID, environment: HUB_ENVIRONMENT });
    return hubFetch(`/v1/catalog?${params.toString()}`);
  },

  currentSubscription(userRef) {
    const params = new URLSearchParams({ app_id: HUB_APP_ID, user_ref: userRef });
    return hubFetch(`/v1/subscriptions/current?${params.toString()}`);
  },

  currentEntitlements(userRef) {
    const params = new URLSearchParams({ app_id: HUB_APP_ID, user_ref: userRef });
    return hubFetch(`/v1/entitlements?${params.toString()}`);
  },

  createCheckout({ userRef, planKey }) {
    return hubFetch('/v1/checkout/sessions', {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey('checkout', userRef, planKey) },
      body: JSON.stringify({
        app_id: HUB_APP_ID,
        user_ref: userRef,
        plan_key: planKey,
        return_context: RETURN_CONTEXT,
        environment: HUB_ENVIRONMENT,
      }),
    });
  },

  createPortal({ userRef }) {
    return hubFetch('/v1/billing/portal-sessions', {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey('portal', userRef) },
      body: JSON.stringify({
        app_id: HUB_APP_ID,
        user_ref: userRef,
        return_context: RETURN_CONTEXT,
        environment: HUB_ENVIRONMENT,
      }),
    });
  },
};

export default paymentHubService;