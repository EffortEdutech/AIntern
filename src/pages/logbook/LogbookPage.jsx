/**
 * AIntern - Logbook & Reports Page (/logbook) — v1.1 R1
 *
 * Two layers per spec v1.1:
 *  - Working preview (§10): live view + quick PDF from current records.
 *  - Official versions (§11-12, §19): immutable numbered snapshots created
 *    via server-side RPC; Verified ones carry a permanent Verification ID.
 *    Official PDFs regenerate from the FROZEN snapshot, never live data.
 *  - Ready Check (§28): deterministic gap detection before snapshotting.
 *
 * @file src/pages/logbook/LogbookPage.jsx
 * @created July 10, 2026 - Session 10
 * @updated July 11, 2026 - v1.1 R1: report versions + ready check
 */

import { useEffect, useState } from 'react';
import InternShell from '../../components/layout/InternShell';
import { useAuth } from '../../context/AuthContext';
import { internshipService } from '../../services/api/internshipService';
import { logbookService } from '../../services/api/logbookService';
import { dailyLogService } from '../../services/api/dailyLogService';
import { reportVersionService } from '../../services/api/reportVersionService';
import { aiService } from '../../services/api/aiService';
import { resolveLayout } from '../../services/render/reportLayout';
import ReportPreview from '../../components/report/ReportPreview';
import { useToast } from '../../context/ToastContext';
import {
  DocumentArrowDownIcon, ShieldCheckIcon, ClipboardDocumentCheckIcon,
  ExclamationTriangleIcon, XCircleIcon, CheckBadgeIcon, EyeIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';

/** Verification payload for exports of VERIFIED versions (spec 25-27). */
function verificationOf(v) {
  if (v?.status !== 'verified' || !v?.verification_id) return null;
  return {
    verification_id: v.verification_id,
    version: v.version,
    created_at: v.created_at,
    content_hash: v.content_hash,
    verify_url: `${window.location.origin}/verify?id=${v.verification_id}`,
  };
}

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
  const [versions, setVersions] = useState([]);
  const [check, setCheck] = useState(null);
  const [checking, setChecking] = useState(false);
  const [aiCheck, setAiCheck] = useState(null);     // v1.1 R1.5 — advisory text
  const [aiChecking, setAiChecking] = useState(false);
  const [creating, setCreating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [preview, setPreview] = useState(null); // { model, layout, label }

  const loadVersions = async (internshipId) => {
    const res = await reportVersionService.listVersions(internshipId);
    if (res.success) setVersions(res.data);
  };

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
        await loadVersions(itn.id);
      } else {
        setSnapshots([]);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const runReadyCheck = async () => {
    if (!internship) return;
    setChecking(true);
    setCheck(await reportVersionService.readyCheck(internship));
    setChecking(false);
  };

  /**
   * v1.1 R1.5 — AI narrative-quality check (ADVISORY ONLY). The
   * deterministic Ready Check above remains the authority on whether a
   * version can be Verified; this reads the prose and flags weak entries.
   */
  const runAiCheck = async () => {
    if (!snapshots?.length) {
      toast.info('No approved entries to review yet.');
      return;
    }
    setAiChecking(true);
    const digest = snapshots
      .map((s) => {
        const text = Object.values(s.content ?? {})
          .map((v) => String(v ?? '').trim())
          .filter((v) => v && v.length > 1)
          .join(' | ')
          .slice(0, 280);
        return `${s.entry_date}: ${text}`;
      })
      .join('\n')
      .slice(0, 7000);
    const res = await aiService.generate('ready_check', digest);
    setAiChecking(false);
    if (res.success) {
      setAiCheck(res.text.trim());
    } else {
      toast.error(res.error);
    }
  };

  const createVersion = async () => {
    if (!internship) return;
    setCreating(true);
    const res = await reportVersionService.createSnapshot(internship.id);
    setCreating(false);
    if (res.success) {
      const v = res.data;
      toast.success(
        v.status === 'verified'
          ? `Version ${v.version} created and VERIFIED — ID ${v.verification_id}`
          : `Version ${v.version} created (unverified — see Ready Check).`
      );
      await loadVersions(internship.id);
    } else {
      toast.error(res.error);
    }
  };

  /** Official PDF — regenerated from the FROZEN snapshot content. */
  const exportVersionPdf = async (versionId) => {
    setExporting(true);
    try {
      const res = await reportVersionService.getVersion(versionId);
      if (!res.success) throw new Error(res.error);
      const c = res.data.content;
      const { generateLogbookPdf } = await import('../../services/pdf/logbookPdf');
      generateLogbookPdf({
        profile: c.intern,
        internship: c.internship,
        snapshots: c.entries ?? [],
        evaluations: c.evaluations ?? [],
        template: c.template ?? null,
        layout: resolveLayout(c.template, internship),
        verification: verificationOf(res.data),
      });
      toast.success(`Official PDF (v${res.data.version}) downloaded.`);
    } catch (err) {
      toast.error('PDF export failed: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  /** Editable Word export of a FROZEN official version (spec section 22). */
  const exportVersionDocx = async (versionId) => {
    setExporting(true);
    try {
      const res = await reportVersionService.getVersion(versionId);
      if (!res.success) throw new Error(res.error);
      const c = res.data.content;
      const verification = verificationOf(res.data);
      let qrPng = null;
      if (verification) {
        const { qrPngDataUrl } = await import('../../services/render/qr');
        qrPng = qrPngDataUrl(verification.verify_url);
      }
      const { generateLogbookDocx } = await import('../../services/docx/logbookDocx');
      await generateLogbookDocx({
        profile: c.intern,
        internship: c.internship,
        snapshots: c.entries ?? [],
        evaluations: c.evaluations ?? [],
        template: c.template ?? null,
        layout: resolveLayout(c.template, internship),
        verification,
        qrPng,
      });
      toast.success(`Word document (v${res.data.version}) downloaded.`);
    } catch (err) {
      toast.error('Word export failed: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  /** HTML preview of a FROZEN official version (spec §29). */
  const previewVersion = async (versionId) => {
    const res = await reportVersionService.getVersion(versionId);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    const c = res.data.content;
    setPreview({
      model: { intern: c.intern, internship: c.internship, entries: c.entries ?? [], evaluations: c.evaluations ?? [], template: c.template ?? null },
      layout: resolveLayout(c.template, internship),
      label: `Official v${res.data.version}`,
    });
  };

  /** HTML preview of the WORKING report (live records, spec §10+§29). */
  const previewWorking = async () => {
    const tpl = await dailyLogService.getDailyTemplate(internship);
    setPreview({
      model: {
        intern: { full_name: profile?.full_name, university: profile?.university, course: profile?.course },
        internship,
        entries: snapshots ?? [],
        evaluations,
        template: tpl.success ? tpl.data : null,
      },
      layout: resolveLayout(tpl.success ? tpl.data : null, internship),
      label: 'Working report',
    });
  };

  /** Working preview — live data, not an official record. */
  const exportWorkingPdf = async () => {
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
        layout: resolveLayout(tpl.success ? tpl.data : null, internship),
      });
      toast.success('Working preview PDF downloaded.');
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
            Every entry here was approved and signed by your supervisor and can
            never be altered. Official versions below carry a permanent
            Verification ID.
          </span>
        </div>

        {snapshots === null ? (
          <div className="flex justify-center pt-16">
            <div className="w-8 h-8 border-4 border-slate-800 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* ── Latest verified — one-tap access (ad-hoc polish) ── */}
            {(() => {
              const latestVerified = versions.find((v) => v.status === 'verified');
              if (!latestVerified) return null;
              return (
                <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckBadgeIcon className="w-6 h-6 text-emerald-600" />
                      <div>
                        <p className="font-semibold text-gray-900">Verified logbook v{latestVerified.version}</p>
                        <p className="text-[11px] font-mono text-emerald-700">{latestVerified.verification_id}</p>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => exportVersionPdf(latestVerified.id)}
                      disabled={exporting}
                      className="inline-flex items-center justify-center gap-1.5 bg-emerald-700 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-emerald-600 disabled:opacity-40"
                    >
                      <DocumentArrowDownIcon className="w-4 h-4" /> PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => exportVersionDocx(latestVerified.id)}
                      disabled={exporting}
                      className="inline-flex items-center justify-center gap-1.5 border border-emerald-700 text-emerald-800 rounded-lg py-2.5 text-sm font-medium hover:bg-emerald-100 disabled:opacity-40"
                    >
                      <DocumentTextIcon className="w-4 h-4" /> Word
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const url = `${window.location.origin}/verify?id=${latestVerified.verification_id}`;
                      try {
                        await navigator.clipboard.writeText(url);
                        toast.success('Verification link copied — anyone can confirm your record with it.');
                      } catch {
                        toast.info(url);
                      }
                    }}
                    className="w-full text-xs font-medium text-emerald-800 underline"
                  >
                    Copy public verification link
                  </button>
                </div>
              );
            })()}

            {/* ── Official report versions (v1.1) ── */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <ClipboardDocumentCheckIcon className="w-5 h-5 text-slate-700" />
                <h2 className="font-semibold text-gray-900">Official report versions</h2>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={runReadyCheck}
                  disabled={checking || !internship}
                  className="border border-slate-300 text-slate-800 rounded-lg py-2.5 text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-40"
                >
                  {checking ? 'Checking…' : '🔍 Ready Check'}
                </button>
                <button
                  type="button"
                  onClick={runAiCheck}
                  disabled={aiChecking || !internship || (snapshots?.length ?? 0) === 0}
                  className="border border-indigo-300 text-indigo-800 rounded-lg py-2.5 text-sm font-medium hover:bg-indigo-50 transition-colors disabled:opacity-40"
                >
                  {aiChecking ? 'Reading…' : '✨ AI quality check'}
                </button>
              </div>

              {aiCheck && (
                <div className="text-xs text-indigo-900 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 whitespace-pre-line">
                  <p className="font-semibold mb-1">AI narrative review (advisory — does not affect verification):</p>
                  {aiCheck}
                </div>
              )}

              {check && (
                <div className="space-y-1.5">
                  {check.issues.length === 0 ? (
                    <p className="text-sm text-emerald-700 flex items-center gap-1.5">
                      <CheckBadgeIcon className="w-4 h-4" /> Everything looks complete — a Verified version can be created.
                    </p>
                  ) : (
                    check.issues.map((issue, i) => (
                      <p key={i} className={`text-xs flex items-start gap-1.5 ${issue.level === 'blocking' ? 'text-red-700' : 'text-amber-700'}`}>
                        {issue.level === 'blocking'
                          ? <XCircleIcon className="w-4 h-4 mt-0.5 shrink-0" />
                          : <ExclamationTriangleIcon className="w-4 h-4 mt-0.5 shrink-0" />}
                        {issue.text}
                      </p>
                    ))
                  )}
                  <button
                    type="button"
                    onClick={createVersion}
                    disabled={creating || (snapshots.length === 0)}
                    className="w-full mt-1 bg-slate-900 text-white rounded-lg py-3 font-medium hover:bg-slate-700 transition-colors disabled:opacity-40"
                  >
                    {creating
                      ? 'Creating…'
                      : `Create official version ${versions.length > 0 ? `v${versions[0].version + 1}` : 'v1'}${check.canVerify ? ' (will be Verified)' : ' (will be Unverified)'}`}
                  </button>
                </div>
              )}

              {versions.length > 0 && (
                <ul className="space-y-2 pt-1">
                  {versions.map((v) => (
                    <li key={v.id} className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2.5">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          v{v.version}
                          <span className={`ml-2 text-xs px-2 py-0.5 rounded-full font-medium ${
                            v.status === 'verified' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {v.status}
                          </span>
                        </p>
                        <p className="text-[11px] text-gray-400">
                          {String(v.created_at).slice(0, 10)} · {v.period_start} → {v.period_end}
                          {v.verification_id && <> · <span className="font-mono">{v.verification_id}</span></>}
                        </p>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => previewVersion(v.id)}
                          aria-label={`Preview version ${v.version}`}
                          className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
                        >
                          <EyeIcon className="w-5 h-5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => exportVersionDocx(v.id)}
                          disabled={exporting}
                          aria-label={`Download Word document of version ${v.version}`}
                          className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                        >
                          <DocumentTextIcon className="w-5 h-5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => exportVersionPdf(v.id)}
                          disabled={exporting}
                          aria-label={`Download PDF of version ${v.version}`}
                          className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                        >
                          <DocumentArrowDownIcon className="w-5 h-5" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* ── Working preview ── */}
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
                onClick={previewWorking}
                disabled={snapshots.length === 0}
                className="w-full inline-flex items-center justify-center gap-2 border border-slate-300 text-slate-800 rounded-lg py-2.5 font-medium hover:bg-slate-50 transition-colors disabled:opacity-40"
              >
                <EyeIcon className="w-5 h-5" />
                Live preview (HTML)
              </button>
              <button
                type="button"
                onClick={exportWorkingPdf}
                disabled={exporting || snapshots.length === 0}
                className="w-full inline-flex items-center justify-center gap-2 border border-slate-300 text-slate-800 rounded-lg py-2.5 font-medium hover:bg-slate-50 transition-colors disabled:opacity-40"
              >
                <DocumentArrowDownIcon className="w-5 h-5" />
                {exporting ? 'Building…' : 'Working preview PDF (not official)'}
              </button>
            </div>

            {/* ── Evaluations ── */}
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

            {/* ── Approved entries ── */}
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

      {preview && (
        <ReportPreview
          model={preview.model}
          layout={preview.layout}
          label={preview.label}
          onClose={() => setPreview(null)}
        />
      )}
    </InternShell>
  );
}
