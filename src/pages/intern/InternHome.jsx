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
import { dailyLogService } from '../../services/api/dailyLogService';
import { useTerminology } from '../../hooks/useTerminology';
import { useAccess } from '../../hooks/useAccess';
import { entitlementService, planLabel } from '../../services/api/entitlementService';
import InternShell from '../../components/layout/InternShell';

/** Last 7 calendar days, oldest first. */
function lastSevenDays() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }
  return days;
}

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function daysBetween(a, b) {
  return Math.max(0, Math.round((b - a) / 86400000));
}

export default function InternHome() {
  const { profile, user } = useAuth();
  const [internship, setInternship] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loggedDates, setLoggedDates] = useState(new Set());
  const t = useTerminology(internship?.metadata?.terminology);
  const { access } = useAccess(); // Phase 4: pass/trial status strip

  useEffect(() => {
    let mounted = true;
    internshipService.getMyInternship().then(({ data }) => {
      if (mounted) {
        setInternship(data);
        setLoading(false);
      }
    });
    dailyLogService.listDrafts().then((drafts) => {
      if (mounted) setLoggedDates(new Set(drafts.map((d) => d.entry_date)));
    });
    return () => { mounted = false; };
  }, []);

  const today = new Date().toISOString().split('T')[0];
  const todayLogged = loggedDates.has(today);

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

        {/* ── Pass / trial status (Phase 4 S13) ── */}
        {access && access.pass && (
          <Link to="/profile" className="block text-xs px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800">
            ✅ {planLabel(access.pass.plan)} active until {String(access.pass.expires_at).slice(0, 10)}
          </Link>
        )}
        {access && !access.pass && access.trial_active && (
          <Link to="/profile" className="block text-xs px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-800">
            ⏳ Free trial — {entitlementService.daysLeft(access.trial_ends_at)} day
            {entitlementService.daysLeft(access.trial_ends_at) === 1 ? '' : 's'} left.
            Tap to see pass options.
          </Link>
        )}
        {access && !access.active && (
          <Link to="/profile" className="block text-xs px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
            ⚠️ Trial ended — activate an internship pass to request reviews and
            export official reports. Your data is always yours.
          </Link>
        )}

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
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Today's {t('entry')}</h3>
                {!todayLogged && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">
                    Not logged yet
                  </span>
                )}
              </div>

              {/* Session 5: last-7-days strip */}
              <div className="flex justify-between px-1">
                {lastSevenDays().map((date) => {
                  const logged = loggedDates.has(date);
                  const isToday = date === today;
                  const letter = DAY_LETTERS[new Date(date + 'T12:00:00').getDay()];
                  return (
                    <Link key={date} to={`/log?date=${date}`} className="flex flex-col items-center gap-1">
                      <span className="text-[10px] text-gray-400">{letter}</span>
                      <span
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium border ${
                          logged
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                            : isToday
                              ? 'bg-white text-slate-900 border-slate-900'
                              : 'bg-gray-50 text-gray-300 border-gray-200'
                        }`}
                      >
                        {logged ? '✓' : new Date(date + 'T12:00:00').getDate()}
                      </span>
                    </Link>
                  );
                })}
              </div>

              <p className="text-sm text-gray-500">
                Rough notes are fine — the ✨ AI polish button turns them into
                formal logbook text.
              </p>
              <Link
                to="/log"
                className="block text-center w-full bg-slate-900 text-white rounded-lg py-3 font-medium hover:bg-slate-700 transition-colors"
              >
                {todayLogged ? `Continue today's ${t('entry').toLowerCase()}` : `Start today's ${t('entry').toLowerCase()}`}
              </Link>
            </div>

            {/* ── Logbook (Session 10) ── */}
            <Link
              to="/logbook"
              className="block bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-300 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{t('logbook')}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Your approved, signed record — export as PDF anytime.
                  </p>
                </div>
                <span className="text-gray-300 text-xl">›</span>
              </div>
            </Link>

            {/* ── Portfolio (v1.1 R5) ── */}
            <Link
              to="/portfolio"
              className="block bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-300 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">Career portfolio</h3>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Turn your verified record into résumé bullets, skills, and
                    interview talking points.
                  </p>
                </div>
                <span className="text-gray-300 text-xl">›</span>
              </div>
            </Link>
          </>
        )}
      </div>
    </InternShell>
  );
}
