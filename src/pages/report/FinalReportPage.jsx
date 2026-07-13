/**
 * AIntern - Final Training Report (/final-report) — Phase B, Case 2
 *
 * Chapter-based authoring for a full training report (distinct from the
 * daily-log Logbook page): narrative chapters the intern writes (with
 * optional evidence-only AI draft-assist), plus the SAME approved
 * entries/evaluations rendered automatically as appendix chapters.
 * Official versions go through the same immutable report_versions +
 * Verification Appendix + QR pipeline as the logbook — this page only
 * changes what feeds the BODY of a 'final'-type report.
 *
 * @file src/pages/report/FinalReportPage.jsx
 * @created July 12, 2026 - Phase B
 */

import { useEffect, useRef, useState } from 'react';
import InternShell from '../../components/layout/InternShell';
import { useAuth } from '../../context/AuthContext';
import { internshipService } from '../../services/api/internshipService';
import { logbookService } from '../../services/api/logbookService';
import { finalReportService } from '../../services/api/finalReportService';
import { reportVersionService } from '../../services/api/reportVersionService';
import { resolveLayout } from '../../services/render/reportLayout';
import { verificationOf } from '../../services/render/verification';
import { useAccess } from '../../hooks/useAccess';
import { useToast } from '../../context/ToastContext';
import {
  DocumentArrowDownIcon, DocumentTextIcon, SparklesIcon, CameraIcon,
  ClipboardDocumentCheckIcon, EyeIcon,
} from '@heroicons/react/24/outline';

const PROVIDERS = [
  { value: 'gemini', label: 'Gemini (photo + any PDF)' },
  { value: 'anthropic', label: 'Claude (photo + any PDF)' },
  { value: 'openai', label: 'OpenAI (photo + text-based PDF)' },
];

const KIND_LABEL = {
  narrative: 'You write this',
  auto_entries: 'Included automatically — your approved daily log',
  auto_evaluations: 'Included automatically — your supervisor evaluations',
};

export default function FinalReportPage() {
  const { profile } = useAuth();
  const toast = useToast();
  const { access } = useAccess();
  const passLocked = access ? !access.active : false;

  const [internship, setInternship] = useState(null);
  const [snapshots, setSnapshots] = useState(null);
  const [evaluations, setEvaluations] = useState([]);
  const [chapterInfo, setChapterInfo] = useState(null); // { template, reportTitle, chapters }
  const [draft, setDraft] = useState({});
  const [versions, setVersions] = useState([]);
  const [creating, setCreating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [draftingId, setDraftingId] = useState(null);

  // Report Studio (upload) state
  const [file, setFile] = useState(null);
  const [provider, setProvider] = useState('gemini');
  const [extracting, setExtracting] = useState(false);
  const [structureDraft, setStructureDraft] = useState(null);
  const [applying, setApplying] = useState(false);
  const fileInput = useRef(null);
  const saveTimers = useRef({});

  const loadAll = async () => {
    const { data: itn } = await internshipService.getMyInternship();
    setInternship(itn);
    if (!itn) {
      setSnapshots([]);
      return;
    }
    const [logbook, info, versionsRes] = await Promise.all([
      logbookService.getLogbook(itn.id),
      finalReportService.getActiveChapterTemplate(itn),
      reportVersionService.listVersions(itn.id, 'final'),
    ]);
    setSnapshots(logbook.success ? logbook.snapshots : []);
    setEvaluations(logbook.success ? logbook.evaluations : []);
    setChapterInfo(info);
    setDraft(finalReportService.getDraft(itn));
    if (versionsRes.success) setVersions(versionsRes.data);
  };

  useEffect(() => { loadAll(); }, []);

  const updateChapterText = (chapterId, text) => {
    setDraft((d) => ({ ...d, [chapterId]: text }));
    clearTimeout(saveTimers.current[chapterId]);
    saveTimers.current[chapterId] = setTimeout(async () => {
      const res = await finalReportService.saveDraftChapter(internship, chapterId, text);
      if (res.success) setInternship(res.data);
    }, 800);
  };

  const draftWithAi = async (chapter) => {
    if (!internship) return;
    setDraftingId(chapter.chapter_id);
    const res = await finalReportService.draftChapter({
      profile, internship, snapshots: snapshots ?? [], evaluations, chapter,
    });
    setDraftingId(null);
    if (res.success && res.text) {
      updateChapterText(chapter.chapter_id, res.text.trim());
      toast.success(`Draft ready (${res.tier === 'byok' ? 'your key' : 'built-in AI'}) — review and edit it.`);
    } else {
      toast.error(res.error);
    }
  };

  const extractStructure = async () => {
    setExtracting(true);
    setStructureDraft(null);
    const res = await finalReportService.extractStructure(file, provider);
    setExtracting(false);
    if (res.success) {
      setStructureDraft(res.structure);
      toast.success(`Chapter structure extracted (${res.extraction === 'text' ? 'read as text' : 'read as image'}).`);
    } else {
      toast.error(res.error);
    }
  };

  const applyStructure = async () => {
    if (!internship || !structureDraft) return;
    setApplying(true);
    const res = await finalReportService.saveAndApplyStructure(internship, structureDraft);
    setApplying(false);
    if (res.success) {
      setInternship(res.internship);
      setStructureDraft(null);
      setFile(null);
      toast.success('Custom report structure applied.');
      await loadAll();
    } else {
      toast.error(res.error);
    }
  };

  const revertStructure = async () => {
    if (!internship) return;
    const res = await finalReportService.revertToDefault(internship);
    if (res.success) {
      toast.success('Back to the default chapter structure.');
      await loadAll();
    } else {
      toast.error(res.error);
    }
  };

  const createVersion = async () => {
    if (!internship) return;
    setCreating(true);
    const res = await reportVersionService.createSnapshot(internship.id, 'final');
    setCreating(false);
    if (res.success) {
      const v = res.data;
      toast.success(
        v.status === 'verified'
          ? `Version ${v.version} created and VERIFIED — ID ${v.verification_id}`
          : `Version ${v.version} created (unverified — approve at least one entry with nothing pending).`
      );
      const versionsRes = await reportVersionService.listVersions(internship.id, 'final');
      if (versionsRes.success) setVersions(versionsRes.data);
    } else {
      toast.error(res.error);
    }
  };

  const exportVersion = async (versionId, format) => {
    setExporting(true);
    try {
      const res = await reportVersionService.getVersion(versionId);
      if (!res.success) throw new Error(res.error);
      const c = res.data.content;
      const verification = verificationOf(res.data);
      const common = {
        profile: c.intern,
        internship: c.internship,
        reportTitle: chapterInfo?.reportTitle,
        chapters: c.chapters ?? [],
        draft: c.narrative_draft ?? {},
        snapshots: c.entries ?? [],
        evaluations: c.evaluations ?? [],
        template: c.template ?? null,
        layout: resolveLayout(c.template, internship),
        verification,
      };
      if (format === 'pdf') {
        const { generateFinalReportPdf } = await import('../../services/pdf/finalReportPdf');
        generateFinalReportPdf(common);
      } else {
        let qrPng = null;
        if (verification) {
          const { qrPngDataUrl } = await import('../../services/render/qr');
          qrPng = qrPngDataUrl(verification.verify_url);
        }
        const { generateFinalReportDocx } = await import('../../services/docx/finalReportDocx');
        await generateFinalReportDocx({ ...common, qrPng });
      }
      toast.success(`v${res.data.version} ${format.toUpperCase()} downloaded.`);
    } catch (err) {
      toast.error('Export failed: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  const usingCustom = Boolean(internship?.final_report_template_id);
  const chapters = chapterInfo?.chapters ?? [];

  return (
    <InternShell title="Final Report">
      <div className="p-4 space-y-4">
        <div className="flex items-start gap-2 text-xs text-gray-500 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          <ClipboardDocumentCheckIcon className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
          <span>
            Narrative chapters are yours to write — the logbook and evaluation
            chapters below are pulled automatically from your approved,
            supervisor-signed record and can't be edited here.
          </span>
        </div>

        {snapshots === null ? (
          <div className="flex justify-center pt-16">
            <div className="w-8 h-8 border-4 border-slate-800 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Report Studio — import a full report to replace the default chapters */}
            <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
              <div className="flex items-center gap-2">
                <SparklesIcon className="w-5 h-5 text-slate-700" />
                <h2 className="font-semibold text-gray-900">Match your university's report format</h2>
              </div>
              <p className="text-xs text-gray-500">
                {usingCustom
                  ? 'Using a custom chapter structure imported from your institution\'s report.'
                  : 'Using the default chapter structure. Upload a copy of your institution\'s final report (or table of contents) to replace it.'}
              </p>
              {usingCustom && (
                <button type="button" onClick={revertStructure} className="text-xs font-medium text-blue-700 underline">
                  Revert to default structure
                </button>
              )}

              <input
                ref={fileInput}
                type="file"
                accept="image/png,image/jpeg,image/webp,application/pdf"
                className="hidden"
                onChange={(e) => { setFile(e.target.files?.[0] ?? null); setStructureDraft(null); }}
              />
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="w-full border-2 border-dashed border-gray-300 rounded-xl py-6 flex flex-col items-center gap-2 text-gray-500 hover:border-gray-400 transition-colors"
              >
                <CameraIcon className="w-7 h-7 text-gray-300" />
                <span className="text-sm font-medium">{file ? file.name : 'Tap to choose a photo or PDF'}</span>
                <span className="text-xs text-gray-400">PNG, JPG or PDF · max 5 MB</span>
              </button>

              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800"
              >
                {PROVIDERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>

              <button
                type="button"
                onClick={extractStructure}
                disabled={!file || extracting}
                className="w-full bg-slate-900 text-white rounded-lg py-3 font-medium hover:bg-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {extracting ? 'Reading the report…' : '✨ Extract chapter structure'}
              </button>

              {structureDraft && (
                <div className="border border-gray-200 rounded-lg p-3 space-y-2">
                  <p className="text-sm font-semibold text-gray-900">{structureDraft.report_title}</p>
                  <ul className="space-y-1">
                    {structureDraft.chapters.map((c) => (
                      <li key={c.chapter_id} className="flex items-center justify-between text-sm">
                        <span className="text-gray-800">{c.chapter_title}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{c.kind}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={applyStructure}
                    disabled={applying}
                    className="w-full bg-emerald-700 text-white rounded-lg py-2.5 font-medium hover:bg-emerald-600 transition-colors disabled:opacity-40"
                  >
                    {applying ? 'Applying…' : 'Looks right — use this structure'}
                  </button>
                </div>
              )}
            </section>

            {/* Chapters */}
            <section className="space-y-3">
              {chapters.map((ch) => (
                <div key={ch.chapter_id} className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">{ch.chapter_title}</h3>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                      {KIND_LABEL[ch.kind] ?? ch.kind}
                    </span>
                  </div>
                  {ch.guidance && <p className="text-xs text-gray-500">{ch.guidance}</p>}

                  {ch.kind === 'auto_entries' && (
                    <p className="text-sm text-gray-600">{(snapshots ?? []).length} approved entries will appear here.</p>
                  )}
                  {ch.kind === 'auto_evaluations' && (
                    <p className="text-sm text-gray-600">{evaluations.length} supervisor evaluations will appear here.</p>
                  )}
                  {ch.kind === 'narrative' && (
                    <>
                      <textarea
                        value={draft[ch.chapter_id] ?? ''}
                        onChange={(e) => updateChapterText(ch.chapter_id, e.target.value)}
                        rows={5}
                        placeholder="Write this chapter…"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-primary-500 focus:border-primary-500"
                      />
                      {ch.ai_draftable && (
                        <button
                          type="button"
                          onClick={() => draftWithAi(ch)}
                          disabled={draftingId === ch.chapter_id || (snapshots ?? []).length === 0}
                          className="text-xs font-medium px-2 py-1 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {draftingId === ch.chapter_id ? 'Drafting…' : '✨ Draft from my evidence'}
                        </button>
                      )}
                    </>
                  )}
                </div>
              ))}
            </section>

            {/* Official versions */}
            <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <ClipboardDocumentCheckIcon className="w-5 h-5 text-slate-700" />
                <h2 className="font-semibold text-gray-900">Official report versions</h2>
              </div>

              {passLocked && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Your free trial has ended — creating official versions and
                  exporting need an internship pass.{' '}
                  <a href="/profile" className="underline font-medium">Activate a pass</a>.
                </p>
              )}

              <button
                type="button"
                onClick={createVersion}
                disabled={creating || (snapshots?.length ?? 0) === 0 || passLocked}
                className="w-full bg-slate-900 text-white rounded-lg py-3 font-medium hover:bg-slate-700 transition-colors disabled:opacity-40"
              >
                {creating
                  ? 'Creating…'
                  : `Create official version ${versions.length > 0 ? `v${versions[0].version + 1}` : 'v1'}`}
              </button>

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
                          {String(v.created_at).slice(0, 10)}
                          {v.verification_id && <> · <span className="font-mono">{v.verification_id}</span></>}
                        </p>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => exportVersion(v.id, 'docx')}
                          disabled={exporting || passLocked}
                          aria-label={`Download Word document of version ${v.version}`}
                          className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                        >
                          <DocumentTextIcon className="w-5 h-5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => exportVersion(v.id, 'pdf')}
                          disabled={exporting || passLocked}
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
              {versions.length === 0 && (
                <p className="text-xs text-gray-400 flex items-center gap-1.5">
                  <EyeIcon className="w-4 h-4" /> No official versions yet — write your narrative chapters, then create v1.
                </p>
              )}
            </section>
          </>
        )}
      </div>
    </InternShell>
  );
}
