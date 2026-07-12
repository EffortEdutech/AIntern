/**
 * AIntern - Internship Pass section (Phase 4 S13) — used in Profile.
 *
 * Shows access state (trial countdown / active pass / expired), the two
 * pass plans (display prices from entitlementService config), and the
 * promo/activation-code redemption input — the pilot's activation path.
 * Online payment (toyyibPay/Stripe) arrives in Phase 4b.
 *
 * @file src/components/pass/PassSection.jsx
 * @created July 12, 2026 - Phase 4 S13
 */

import { useState } from 'react';
import { useAccess } from '../../hooks/useAccess';
import { entitlementService, PASS_PLANS, planLabel } from '../../services/api/entitlementService';
import { useToast } from '../../context/ToastContext';
import { TicketIcon, CheckBadgeIcon, ClockIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

export default function PassSection() {
  const { access, loading, refresh } = useAccess();
  const toast = useToast();
  const [code, setCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);

  const redeem = async () => {
    if (!code.trim()) return;
    setRedeeming(true);
    const res = await entitlementService.redeem(code);
    setRedeeming(false);
    if (res.success) {
      setCode('');
      await refresh();
      toast.success(`${planLabel(res.data.plan)} activated — valid until ${String(res.data.expires_at).slice(0, 10)}.`);
    } else {
      toast.error(res.error);
    }
  };

  const trialDays = access ? entitlementService.daysLeft(access.trial_ends_at) : 0;

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

      <div className="grid grid-cols-2 gap-2">
        {PASS_PLANS.map((p) => (
          <div key={p.id} className="rounded-lg border border-gray-200 p-3 text-center space-y-0.5">
            <p className="text-sm font-semibold text-gray-900">{p.label}</p>
            <p className="text-xl font-bold text-slate-900">{p.price}</p>
            <p className="text-[11px] text-gray-500">{p.blurb}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-500 text-center">
        Online payment is coming soon — for now, activate with a code.
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
