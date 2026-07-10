/**
 * AIntern - Logbook Page (/logbook) — Phase 3, Session 10
 *
 * The authoritative record: supervisor-approved entries and evaluations
 * read from immutable server tables (approved_snapshots, evaluations).
 * Unlike History (device drafts), this is identical on every device.
 * Exports the university-ready PDF.
 *
 * @file src/pages/logbook/LogbookPage.jsx
 * @created July 10, 2026 - Session 10
 */

import { useEffect, useState } from 'react';
import InternShell from '../../components/layout/InternShell';
import { useAuth } from '../../context/AuthContext';
import { internshipService } from '../../services/api/internshipService';
import { logbookService } from '../../services/api/logbookService';
import { dailyLogService } from '../../services/api/dailyLogService';
import { useToast } from '../../context/ToastContext';
import { DocumentArrowDownIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';

function summarize(content) {
  const text = content?.['tasks.task_summary'] || '';
  return text.length > 110 ? text.slice(0, 110) + '…' : text || '—';
}

export default function LogbookPage() {
  const { profile } = useAuth();
  const toast = useToast();
  const [internship, setInternship] = useState(null);
  const [snapshots, setSnapshots] = useState(null);
  const [evaluations, setEvaluations] = useState([]);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: itn } = await internshipService.getMyInternship();
      if (!mounted) return;
      setInternship(itn);
      if (itn) {
        const res = await logbookService.getLogbook(itn.id);
        if (!mounted) return;
        if (res.success) {
          setSnapshots(res.snapshots);
          setEvaluations(res.evaluations);
        } else {
          setSnapshots([]);
        }
      } else {
        setSnapshots([]);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const exportPdf = async () => {
    setExporting(true);
    try {
      const tpl = await dailyLogService.getDailyTemplate(internship);
      const { generateLogbookPdf } = await import('../../services/pdf/logbookPdf');
      generateLogbookPdf({
        profile,
        internship,
        snapshots: snapshots ?? [],
        evaluations,
        template: tpl.success ? tpl.data : null,
      });
      toast.success('Logbook PDF downloaded.');
    } catch (err) {
      toast.error('PDF export failed: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <InternShell title="Logbook">
      <div className="p-4 space-y-4">
        <div className="flex items-start gap-2 text-xs text-gray-500 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          <ShieldCheckIcon className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
          <span>
            This is your permanent record — every entry here was approved and
            signed by your supervisor, and can never be altered. It follows you
            to any device.
          </span>
        </div>

        {snapshots === null ? (
          <div className="flex justify-center pt-16">
            <div className="w-8 h-8 border-4 border-slate-800 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Stats + export */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3 text-center">
                <div>
                  <p className="text-2xl font-bold text-gray-900">{snapshots.length}</p>
                  <p className="text-xs text-gray-500">Approved entries</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{evaluations.length}</p>
                  <p className="text-xs text-gray-500">Evaluations</p>
                </div>
              </div>
              <button
                type="button"
                onClick={exportPdf}
                disabled={exporting || snapshots.length === 0}
                className="w-full inline-flex items-center justify-center gap-2 bg-slate-900 text-white rounded-lg py-3 font-medium hover:bg-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <DocumentArrowDownIcon className="w-5 h-5" />
                {exporting ? 'Building PDF…' : 'Export logbook PDF'}
              </button>
              {snapshots.length === 0 && (
                <p className="text-xs text-gray-400 text-center">
                  Approved entries appear here after your supervisor reviews your submissions.
                </p>
              )}
            </div>

            {/* Evaluations */}
            {evaluations.length > 0 && (
              <section className="space-y-2">
                <h2 className="font-semibold text-gray-900">Evaluations</h2>
                {evaluations.map((ev) => {
                  const scores = Object.values(ev.scores ?? {}).filter((n) => typeof n === 'number');
                  const avg = scores.length
                    ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
                    : null;
                  return (
                    <div key={ev.id} className="bg-white rounded-xl border border-gray-200 p-4">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900 text-sm">
                          {ev.period_start} → {ev.period_end}
                        </span>
                        {avg && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-900 text-white font-semibold">
                            {avg} / 5
                          </span>
                        )}
                      </div>
                      {ev.comments?.strengths && (
                        <p className="text-sm text-gray-600 mt-1">{ev.comments.strengths}</p>
                      )}
                    </div>
                  );
                })}
              </section>
            )}

            {/* Approved entries */}
            {snapshots.length > 0 && (
              <section className="space-y-2">
                <h2 className="font-semibold text-gray-900">Approved entries</h2>
                {[...snapshots].reverse().map((snap) => (
                  <div key={snap.id} className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900">{snap.entry_date}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                        ✓ signed
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{summarize(snap.content)}</p>
                    {snap.supervisor_comment && (
                      <p className="text-xs text-gray-400 mt-1 italic">
                        "{snap.supervisor_comment}" — {snap.supervisor_name}
                      </p>
                    )}
                  </div>
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </InternShell>
  );
}
