/**
 * AIntern - Intern Home
 *
 * The intern's landing page. Shows the active internship card (or the
 * onboarding CTA), today's log status, and quick actions. Daily-log
 * creation lands in Phase 1 (S4-S6); the buttons are wired but
 * feature-gated until then.
 *
 * @file src/pages/intern/InternHome.jsx
 * @created July 9, 2026 - Session 2
 */

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { internshipService } from '../../services/api/internshipService';
import { useTerminology } from '../../hooks/useTerminology';
import InternShell from '../../components/layout/InternShell';

function daysBetween(a, b) {
  return Math.max(0, Math.round((b - a) / 86400000));
}

export default function InternHome() {
  const { profile, user } = useAuth();
  const [internship, setInternship] = useState(null);
  const [loading, setLoading] = useState(true);
  const t = useTerminology(internship?.metadata?.terminology);

  useEffect(() => {
    let mounted = true;
    internshipService.getMyInternship().then(({ data }) => {
      if (mounted) {
        setInternship(data);
        setLoading(false);
      }
    });
    return () => { mounted = false; };
  }, []);

  const firstName =
    profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'there';

  if (loading) {
    return (
      <InternShell>
        <div className="flex justify-center pt-20">
          <div className="w-8 h-8 border-4 border-slate-800 border-t-transparent rounded-full animate-spin" />
        </div>
      </InternShell>
    );
  }

  return (
    <InternShell>
      <div className="p-4 space-y-4">
        <p className="text-lg font-semibold text-gray-900">
          Assalamualaikum, {firstName} 👋
        </p>

        {!internship ? (
          /* ── No internship yet — onboarding CTA ── */
          <div className="bg-white rounded-xl border border-gray-200 p-5 text-center space-y-3">
            <p className="text-gray-700 font-medium">
              Set up your {t('placement').toLowerCase()} to start logging.
            </p>
            <p className="text-sm text-gray-500">
              Takes 2 minutes — company, supervisor, and how often they review.
            </p>
            <Link
              to="/onboarding"
              className="inline-block w-full bg-slate-900 text-white rounded-lg py-3 font-medium hover:bg-slate-700 transition-colors"
            >
              Get started
            </Link>
          </div>
        ) : (
          <>
            {/* ── Internship card ── */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">{internship.company_name}</h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium capitalize">
                  {internship.pass_status}
                </span>
              </div>
              {internship.department && (
                <p className="text-sm text-gray-500">{internship.department}</p>
              )}
              <p className="text-sm text-gray-600">
                {t('supervisor')}: {internship.supervisor_name}
              </p>
              <p className="text-sm text-gray-600">
                {internship.start_date} → {internship.end_date}
              </p>
              <p className="text-xs text-gray-400">
                {t('evaluation')} every {internship.evaluation_cadence_days} days ·{' '}
                {daysBetween(new Date(), new Date(internship.end_date))} days remaining
              </p>
            </div>

            {/* ── Today's log ── */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
              <h3 className="font-semibold text-gray-900">Today's {t('entry')}</h3>
              <p className="text-sm text-gray-500">
                {t('entry')} creation arrives with the next update — your{' '}
                {t('placement').toLowerCase()} is ready and waiting.
              </p>
              <button
                disabled
                className="w-full bg-gray-100 text-gray-400 rounded-lg py-3 font-medium cursor-not-allowed"
              >
                Start today's {t('entry').toLowerCase()} (coming soon)
              </button>
            </div>
          </>
        )}
      </div>
    </InternShell>
  );
}
