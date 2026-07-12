/**
 * AIntern - Portfolio Page (/portfolio) — v1.1 R5 Portfolio Engine
 *
 * Turns the verified record into career assets (spec §43): professional
 * summary, skills, résumé bullets, highlights, interview talking points.
 * Evidence-only AI (approved snapshots + evaluations); result cached in
 * internships.metadata.portfolio. Exports: copy-as-markdown, compact PDF
 * stamped with the latest Verification ID + QR when one exists.
 *
 * @file src/pages/portfolio/PortfolioPage.jsx
 * @created July 11, 2026 - v1.1 R5
 */

import { useEffect, useState } from 'react';
import InternShell from '../../components/layout/InternShell';
import { useAuth } from '../../context/AuthContext';
import { internshipService } from '../../services/api/internshipService';
import { logbookService } from '../../services/api/logbookService';
import { reportVersionService } from '../../services/api/reportVersionService';
import { portfolioService } from '../../services/api/portfolioService';
import { resolveLayout } from '../../services/render/reportLayout';
import { useToast } from '../../context/ToastContext';
import { useAccess } from '../../hooks/useAccess';
import {
  SparklesIcon, DocumentArrowDownIcon, ClipboardIcon,
  ShieldCheckIcon, BriefcaseIcon,
} from '@heroicons/react/24/outline';

function Chip({ label, tone = 'slate' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };
  return (
    <span className={`inline-block text-xs px-2.5 py-1 rounded-full border ${tones[tone]}`}>
      {label}
    </span>
  );
}

export default function PortfolioPage() {
  const { profile } = useAuth();
  const toast = useToast();
  const { access } = useAccess();
  const passLocked = access ? !access.active : false; // Phase 4 export gate
  const [internship, setInternship] = useState(null);
  const [snapshots, setSnapshots] = useState(null);
  const [evaluations, setEvaluations] = useState([]);
  const [verified, setVerified] = useState(null); // latest verified report version
  const [portfolio, setPortfolio] = useState(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: itn } = await internshipService.getMyInternship();
      if (!mounted) return;
      setInternship(itn);
      if (!itn) { setSnapshots([]); return; }
      setPortfolio(portfolioService.cached(itn));
      const [log, vers] = await Promise.all([
        logbookService.getLogbook(itn.id),
        reportVersionService.listVersions(itn.id),
      ]);
      if (!mounted) return;
      setSnapshots(log.success ? log.snapshots : []);
      setEvaluations(log.success ? log.evaluations : []);
      if (vers.success) setVerified(vers.data.find((v) => v.status === 'verified') ?? null);
    })();
    return () => { mounted = false; };
  }, []);

  const verification = verified
    ? {
        verification_id: verified.verification_id,
        version: verified.version,
        verify_url: `${window.location.origin}/verify?id=${verified.verification_id}`,
      }
    : null;

  const generate = async () => {
    setGenerating(true);
    const res = await portfolioService.generate({ profile, internship, snapshots, evaluations });
    if (res.success) {
      setPortfolio(res.data);
      const saved = await portfolioService.save(internship, res.data);
      if (saved.success) setInternship(saved.data);
      toast.success('Portfolio generated from your verified record.');
    } else {
      toast.error(res.error);
    }
    setGenerating(false);
  };

  const copyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(portfolioService.toMarkdown(portfolio, profile));
      toast.success('Portfolio copied — paste it into your résumé or LinkedIn.');
    } catch {
      toast.error('Could not access the clipboard.');
    }
  };

  const downloadPdf = async () => {
    try {
      const { generatePortfolioPdf } = await import('../../services/pdf/portfolioPdf');
      generatePortfolioPdf({
        profile,
        internship,
        portfolio,
        verification,
        accent: resolveLayout(null, internship).accent,
      });
      toast.success('Portfolio PDF downloaded.');
    } catch (err) {
      toast.error('PDF export failed: ' + err.message);
    }
  };

  const loading = snapshots === null;
  const empty = !loading && (snapshots?.length ?? 0) === 0;

  return (
    <InternShell title="Portfolio">
      <div className="p-4 space-y-4">
        <div className="flex items-start gap-2 text-xs text-gray-500 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
          <BriefcaseIcon className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
          <span>
            Built ONLY from supervisor-approved entries and evaluations — career
            claims your record can back up.
          </span>
        </div>

        {loading && <p className="text-sm text-gray-400 py-8 text-center">Loading your record…</p>}

        {empty && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-center space-y-2">
            <p className="font-medium text-gray-900">No approved entries yet</p>
            <p className="text-sm text-gray-500">
              The portfolio is generated from your verified record. Once your
              supervisor approves daily entries, come back here.
            </p>
          </div>
        )}

        {!loading && !empty && (
          <>
            {/* Evidence + generate */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">
                  <strong>{snapshots.length}</strong> approved entries ·{' '}
                  <strong>{evaluations.length}</strong> evaluations
                </span>
                {verification && (
                  <span className="inline-flex items-center gap-1 text-emerald-700 text-xs font-medium">
                    <ShieldCheckIcon className="w-4 h-4" />
                    {verification.verification_id}
                  </span>
                )}
              </div>
              <button
                onClick={generate}
                disabled={generating}
                className="w-full inline-flex items-center justify-center gap-2 bg-slate-900 text-white rounded-lg py-3 font-medium hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                <SparklesIcon className="w-5 h-5" />
                {generating ? 'Generating…' : portfolio ? 'Regenerate portfolio' : 'Generate my portfolio'}
              </button>
              {portfolio?.generated_at && (
                <p className="text-xs text-gray-400 text-center">
                  Last generated {String(portfolio.generated_at).slice(0, 10)} from{' '}
                  {portfolio.source?.entries} entries.
                </p>
              )}
            </div>

            {portfolio && (
              <>
                {/* Summary */}
                <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
                  <h3 className="font-semibold text-gray-900">Professional summary</h3>
                  <p className="text-sm text-gray-700 leading-relaxed">{portfolio.summary}</p>
                </div>

                {/* Résumé bullets */}
                {portfolio.resume_bullets?.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
                    <h3 className="font-semibold text-gray-900">Key achievements</h3>
                    <ul className="space-y-2">
                      {portfolio.resume_bullets.map((b, i) => (
                        <li key={i} className="text-sm text-gray-700 flex gap-2">
                          <span className="text-slate-400 shrink-0">•</span>
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Highlights */}
                {portfolio.highlights?.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                    <h3 className="font-semibold text-gray-900">Highlights</h3>
                    {portfolio.highlights.map((h, i) => (
                      <div key={i}>
                        <p className="text-sm font-medium text-gray-900">{h.title}</p>
                        <p className="text-sm text-gray-600">{h.description}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Skills */}
                {(portfolio.technical_skills?.length > 0 || portfolio.soft_skills?.length > 0) && (
                  <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                    {portfolio.technical_skills?.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-gray-900 mb-2">Technical skills</h3>
                        <div className="flex flex-wrap gap-1.5">
                          {portfolio.technical_skills.map((s, i) => <Chip key={i} label={s} />)}
                        </div>
                      </div>
                    )}
                    {portfolio.soft_skills?.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-gray-900 mb-2">Soft skills</h3>
                        <div className="flex flex-wrap gap-1.5">
                          {portfolio.soft_skills.map((s, i) => <Chip key={i} label={s} tone="emerald" />)}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Talking points */}
                {portfolio.talking_points?.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
                    <h3 className="font-semibold text-gray-900">Interview talking points</h3>
                    <ul className="space-y-2">
                      {portfolio.talking_points.map((t, i) => (
                        <li key={i} className="text-sm text-gray-700 flex gap-2">
                          <span className="text-indigo-400 shrink-0">{i + 1}.</span>
                          <span>{t}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Exports */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={copyMarkdown}
                    className="inline-flex items-center justify-center gap-1.5 border border-gray-300 bg-white text-gray-700 rounded-lg py-2.5 text-sm font-medium hover:bg-gray-50"
                  >
                    <ClipboardIcon className="w-4 h-4" /> Copy as text
                  </button>
                  <button
                    onClick={downloadPdf}
                    disabled={passLocked}
                    className="inline-flex items-center justify-center gap-1.5 bg-slate-900 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-slate-700 disabled:opacity-40"
                  >
                    <DocumentArrowDownIcon className="w-4 h-4" /> Portfolio PDF
                  </button>
                </div>
                {passLocked && (
                  <p className="text-xs text-amber-700 text-center">
                    Exports need an internship pass — activate one in Profile.
                  </p>
                )}
                {verification && (
                  <p className="text-xs text-gray-400 text-center">
                    The PDF footer carries Verification ID {verification.verification_id} + QR —
                    employers can check your record independently.
                  </p>
                )}
              </>
            )}
          </>
        )}
      </div>
    </InternShell>
  );
}
