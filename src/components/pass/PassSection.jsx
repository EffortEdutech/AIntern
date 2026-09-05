/**
 * AIntern - Internship Pass section
 *
 * Phase 3 Payment Hub integration: checkout and portal are created by the
 * Central Payment Hub. AIntern does not import Stripe or own provider prices.
 */

import { useEffect, useState } from 'react';
import { useAccess } from '../../hooks/useAccess';
import { useAuth } from '../../context/AuthContext';
import { entitlementService, PASS_PLANS, planLabel } from '../../services/api/entitlementService';
import { useToast } from '../../context/ToastContext';
import { TicketIcon, CheckBadgeIcon, ClockIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

export default function PassSection() {
  const { user } = useAuth();
  const { access, loading, refresh } = useAccess();
  const toast = useToast();
  const [code, setCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState(null);
  const [portalBusy, setPortalBusy] = useState(false);
  const [hubAccess, setHubAccess] = useState(null);
  const [hubError, setHubError] = useState('');

  const userRef = user?.id;

  const refreshHubAccess = async () => {
    if (!userRef) return;
    const res = await entitlementService.getHubAccess(userRef);
    if (res.success) {
      setHubAccess(res.data);
      setHubError('');
    } else {
      setHubError(res.error);
    }
  };

  useEffect(() => {
    refreshHubAccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userRef]);

  const startCheckout = async (planKey) => {
    if (!userRef) {
      toast.error('Please sign in before activating a pass.');
      return;
    }
    setCheckoutPlan(planKey);
    const res = await entitlementService.checkout({ userRef, planKey });
    setCheckoutPlan(null);
    if (res.success) {
      window.location.href = res.data.redirect_url;
    } else {
      toast.error(res.error);
    }
  };

  const openPortal = async () => {
    if (!userRef) return;
    setPortalBusy(true);
    const res = await entitlementService.portal({ userRef });
    setPortalBusy(false);
    if (res.success) {
      window.location.href = res.data.redirect_url;
    } else {
      toast.error(res.error);
    }
  };

  const redeem = async () => {
    if (!code.trim()) return;
    setRedeeming(true);
    const res = await entitlementService.redeem(code);
    setRedeeming(false);
    if (res.success) {
      setCode('');
      await refresh();
      await refreshHubAccess();
      toast.success(`${planLabel(res.data.plan)} activated — valid until ${String(res.data.expires_at).slice(0, 10)}.`);
    } else {
      toast.error(res.error);
    }
  };

  const trialDays = access ? entitlementService.daysLeft(access.trial_ends_at) : 0;
  const hubSubscription = hubAccess?.subscription;
  const hubEntitlements = hubAccess?.entitlements?.entitlements ?? [];
  const hasHubCustomer = hubSubscription && hubSubscription.state !== 'none';

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <TicketIcon className="w-5 h-5 text-slate-700" />
        <h2 className="font-semibold text-gray-900">Internship pass</h2>
      </div>

      {loading && <p className="text-sm text-gray-400">Checking your access…</p>}

      {access && access.pass && (
        <div className="flex items-start gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2.5">
          <CheckBadgeIcon className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <p className="text-sm text-emerald-800">
            <strong>{planLabel(access.pass.plan)}</strong> active until{' '}
            {String(access.pass.expires_at).slice(0, 10)} — reviews, official
            reports, exports, and bundled AI all unlocked.
          </p>
        </div>
      )}

      {access && !access.pass && access.trial_active && (
        <div className="flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2.5">
          <ClockIcon className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <p className="text-sm text-blue-800">
            Free trial — <strong>{trialDays} day{trialDays === 1 ? '' : 's'} left</strong>.
            Reviews and official reports work during the trial; bundled AI needs
            a pass (or your own key in AI Assistant below).
          </p>
        </div>
      )}

      {access && !access.active && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5">
          <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            Your free trial has ended. Your drafts and approved record are
            safe and always yours — activate a pass to request reviews and
            create official reports again.
          </p>
        </div>
      )}

      {hubSubscription && hubSubscription.state !== 'none' && (
        <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5 text-sm text-slate-700">
          Payment Hub state: <strong>{hubSubscription.state}</strong>
          {hubSubscription.planKey ? <> · {planLabel(hubSubscription.planKey)}</> : null}
          {hubEntitlements.length > 0 ? <> · {hubEntitlements.length} entitlement(s)</> : null}
        </div>
      )}

      {hubError && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Payment Hub is not reachable yet: {hubError}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {PASS_PLANS.map((p) => (
          <div key={p.id} className="rounded-lg border border-gray-200 p-3 text-center space-y-2">
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-gray-900">{p.label}</p>
              <p className="text-xl font-bold text-slate-900">{p.price}</p>
              <p className="text-[11px] text-gray-500">{p.blurb}</p>
            </div>
            <button
              type="button"
              onClick={() => startCheckout(p.id)}
              disabled={checkoutPlan !== null}
              className="w-full bg-slate-900 text-white rounded-lg px-3 py-2 text-sm font-medium hover:bg-slate-700 disabled:opacity-40"
            >
              {checkoutPlan === p.id ? 'Opening checkout…' : 'Pay with Stripe sandbox'}
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 justify-center">
        <button
          type="button"
          onClick={refreshHubAccess}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Refresh payment state
        </button>
        <button
          type="button"
          onClick={openPortal}
          disabled={portalBusy || !hasHubCustomer}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
        >
          {portalBusy ? 'Opening portal…' : 'Manage billing'}
        </button>
      </div>

      <p className="text-xs text-gray-500 text-center">
        Sandbox checkout is powered by the Central Payment Hub. Promo codes remain as a pilot fallback.
      </p>

      <div className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Activation code"
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent"
        />
        <button
          type="button"
          onClick={redeem}
          disabled={redeeming || !code.trim()}
          className="bg-slate-900 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-slate-700 disabled:opacity-40"
        >
          {redeeming ? 'Activating…' : 'Activate'}
        </button>
      </div>
    </section>
  );
}