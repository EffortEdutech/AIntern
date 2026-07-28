/**
 * AIntern - Report Center
 *
 * Standard templates for Weekly, Monthly, and Final reports. Weekly and
 * monthly official versions use the existing immutable report_versions
 * pipeline; Final links into the chapter-based studio.
 *
 * @file src/pages/report/ReportCenterPage.jsx
 * @created July 27, 2026 - Report Center foundation
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import InternShell from '../../components/layout/InternShell';
import Modal from '../../components/common/Modal';
import { PeriodReportTemplatePreview } from '../../components/report/ReportTemplatePreview';
import { useAuth } from '../../context/AuthContext';
import { aiService } from '../../services/api/aiService';
import { dailyLogService, DAILY_TEMPLATE_ID_V2 } from '../../services/api/dailyLogService';
import { internshipService } from '../../services/api/internshipService';
import { logbookService } from '../../services/api/logbookService';
import { reportVersionService } from '../../services/api/reportVersionService';
import { useAccess } from '../../hooks/useAccess';
import { ACCENT_CHOICES, LAYOUT_DEFAULTS, resolveLayout } from '../../services/render/reportLayout';
import { verificationOf } from '../../services/render/verification';
import {
  REPORT_TYPES,
  clampPeriodToInternship,
  currentMonthPeriod,
  currentWeekPeriod,
  normalizePeriodReportTemplate,
  reportTemplateOptions,
  reportTemplateFromSnapshot,
  reportTemplateToPdfTemplate,
  selectedReportTemplate,
  templateAsJson,
} from '../../services/render/reportTemplates';
import { useToast } from '../../context/ToastContext';
import {
  CalendarDaysIcon, ClipboardDocumentCheckIcon, DocumentArrowDownIcon,
  DocumentTextIcon, SparklesIcon, SwatchIcon, TableCellsIcon,
} from '@heroicons/react/24/outline';

const REPORT_META = {
  [REPORT_TYPES.WEEKLY]: {
    label: 'Weekly report',
    copy: 'Choose narrative or table format, then freeze the selected week as an official report.',
  },
  [REPORT_TYPES.MONTHLY]: {
    label: 'Monthly report',
    copy: 'Combined table and narrative format for monthly progress and reflection.',
  },
  [REPORT_TYPES.FINAL]: {
    label: 'Final report',
    copy: 'Chapter-based final training report with logbook and evaluation appendices.',
  },
};

const DATE_FMT = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
const inputCls =
  'w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent';
const labelCls = 'block text-sm font-medium text-gray-700 mb-1';

function periodLabel(period) {
  if (!period?.start || !period?.end) return '';
  return `${DATE_FMT.format(new Date(period.start + 'T12:00:00'))} - ${DATE_FMT.format(new Date(period.end + 'T12:00:00'))}`;
}

function initialPeriods(internship) {
  return {
    [REPORT_TYPES.WEEKLY]: clampPeriodToInternship(currentWeekPeriod(), internship),
    [REPORT_TYPES.MONTHLY]: clampPeriodToInternship(currentMonthPeriod(), internship),
  };
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file.'));
    reader.readAsDataURL(file);
  });
}

export default function ReportCenterPage() {
  const { profile } = useAuth();
  const toast = useToast();
  const { access } = useAccess();
  const passLocked = access ? !access.active : false;

  const [internship, setInternship] = useState(null);
  const [snapshots, setSnapshots] = useState(null);
  const [evaluations, setEvaluations] = useState([]);
  const [activeType, setActiveType] = useState(REPORT_TYPES.WEEKLY);
  const [periods, setPeriods] = useState({});
  const [versions, setVersions] = useState({ weekly: [], monthly: [] });
  const [busy, setBusy] = useState(false);
  const [provider, setProvider] = useState('gemini');
  const [sampleFile, setSampleFile] = useState(null);
  const [structureDraft, setStructureDraft] = useState(null);
  const [showDraftPreview, setShowDraftPreview] = useState(false);
  const [showActivePreview, setShowActivePreview] = useState(false);
  const [prefs, setPrefs] = useState({});
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [dailyTemplate, setDailyTemplate] = useState(null);
  const [hiddenFields, setHiddenFields] = useState([]);
  const [v2TemplateId, setV2TemplateId] = useState(null);
  const [fieldPrefsSaving, setFieldPrefsSaving] = useState(false);
  const [multiTaskSaving, setMultiTaskSaving] = useState(false);

  const loadDailyTemplate = async (itn) => {
    const tpl = await dailyLogService.getDailyTemplate(itn);
    if (tpl.success) setDailyTemplate(tpl.data);
  };

  const loadVersions = async (internshipId) => {
    const [weekly, monthly] = await Promise.all([
      reportVersionService.listVersions(internshipId, REPORT_TYPES.WEEKLY),
      reportVersionService.listVersions(internshipId, REPORT_TYPES.MONTHLY),
    ]);
    setVersions({
      weekly: weekly.success ? weekly.data : [],
      monthly: monthly.success ? monthly.data : [],
    });
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: itn } = await internshipService.getMyInternship();
      if (!mounted) return;
      setInternship(itn);
      setPeriods(initialPeriods(itn));
      if (!itn) {
        setSnapshots([]);
        return;
      }
      setPrefs(itn.metadata?.report_prefs ?? {});
      setHiddenFields(itn.metadata?.field_prefs?.hidden ?? []);
      await loadDailyTemplate(itn);
      const [logbook] = await Promise.all([
        logbookService.getLogbook(itn.id),
        loadVersions(itn.id),
      ]);
      if (!mounted) return;
      setSnapshots(logbook.success ? logbook.snapshots : []);
      setEvaluations(logbook.success ? logbook.evaluations : []);
    })();
    dailyLogService.getTemplateByKey(DAILY_TEMPLATE_ID_V2).then((tpl) => {
      if (tpl) setV2TemplateId(tpl.id);
    });
    return () => { mounted = false; };
  }, []);

  const selectedTemplate = useMemo(
    () => selectedReportTemplate(internship, activeType),
    [internship, activeType],
  );

  const templateOptions = useMemo(
    () => reportTemplateOptions(internship, activeType),
    [internship, activeType],
  );

  const saveTemplate = async (templateId) => {
    if (!internship) return;
    const next = {
      ...(internship.metadata ?? {}),
      report_templates: {
        ...(internship.metadata?.report_templates ?? {}),
        [activeType]: templateId,
      },
    };
    const res = await internshipService.updateInternship(internship.id, { metadata: next });
    if (res.success) {
      setInternship(res.data);
      toast.success('Report template saved.');
    } else {
      toast.error(res.error);
    }
  };

  const savePrefs = async (next) => {
    if (!internship) return;
    setPrefs(next);
    setPrefsSaving(true);
    const res = await internshipService.updateInternship(internship.id, {
      metadata: { ...(internship.metadata ?? {}), report_prefs: next },
    });
    setPrefsSaving(false);
    if (res.success) {
      setInternship(res.data);
      toast.success('Report style saved.');
    } else {
      toast.error(res.error);
    }
  };

  const toggleFieldVisibility = async (path) => {
    if (!internship) return;
    const previous = hiddenFields;
    const next = hiddenFields.includes(path)
      ? hiddenFields.filter((p) => p !== path)
      : [...hiddenFields, path];
    setHiddenFields(next);
    setFieldPrefsSaving(true);
    const res = await internshipService.updateInternship(internship.id, {
      metadata: { ...(internship.metadata ?? {}), field_prefs: { hidden: next } },
    });
    setFieldPrefsSaving(false);
    if (res.success) {
      setInternship(res.data);
    } else {
      setHiddenFields(previous);
      toast.error(res.error);
    }
  };

  const usingCustomTemplate = Boolean(
    internship?.daily_template_id && internship.daily_template_id !== v2TemplateId
  );
  const usingMultiTask = Boolean(v2TemplateId && internship?.daily_template_id === v2TemplateId);

  const toggleMultiTask = async () => {
    if (!internship || !v2TemplateId) return;
    const nextId = usingMultiTask ? null : v2TemplateId;
    setMultiTaskSaving(true);
    const res = await internshipService.updateInternship(internship.id, { daily_template_id: nextId });
    setMultiTaskSaving(false);
    if (res.success) {
      setInternship(res.data);
      await loadDailyTemplate(res.data);
      toast.success(nextId ? 'Multiple tasks per day enabled.' : 'Back to one task per day.');
    } else {
      toast.error(res.error);
    }
  };

  const extractSampleTemplate = async () => {
    if (!sampleFile) {
      toast.error('Choose a weekly or monthly sample report first.');
      return;
    }
    setBusy(true);
    try {
      const file_base64 = await fileToBase64(sampleFile);
      const res = await aiService.importPeriodReportStructure(activeType, sampleFile.type, file_base64, provider);
      if (!res.success) throw new Error(res.error);
      const template = normalizePeriodReportTemplate({
        ...res.template,
        imported_at: new Date().toISOString(),
      }, activeType);
      setStructureDraft({
        template,
        meta: {
          provider: res.provider,
          tier: res.tier,
          extraction: res.extraction,
          filename: sampleFile.name,
        },
      });
      setShowDraftPreview(true);
      toast.success('Sample extracted. Review the visual preview before applying it.');
    } catch (err) {
      toast.error('Extraction failed: ' + err.message);
    } finally {
      setBusy(false);
    }
  };

  const applyCustomTemplate = async () => {
    if (!internship || !structureDraft?.template) return;
    const currentDefs = internship.metadata?.report_template_defs?.[activeType];
    const existing = Array.isArray(currentDefs) ? currentDefs : currentDefs ? [currentDefs] : [];
    const nextTemplate = structureDraft.template;
    const withoutSame = existing.filter((tpl) => tpl?.id !== nextTemplate.id);
    const next = {
      ...(internship.metadata ?? {}),
      report_templates: {
        ...(internship.metadata?.report_templates ?? {}),
        [activeType]: nextTemplate.id,
      },
      report_template_defs: {
        ...(internship.metadata?.report_template_defs ?? {}),
        [activeType]: [nextTemplate, ...withoutSame].slice(0, 5),
      },
    };
    const res = await internshipService.updateInternship(internship.id, { metadata: next });
    if (res.success) {
      setInternship(res.data);
      setStructureDraft(null);
      setShowDraftPreview(false);
      toast.success('Custom report template applied.');
    } else {
      toast.error(res.error);
    }
  };

  const updatePeriod = (reportType, key, value) => {
    setPeriods((p) => ({
      ...p,
      [reportType]: { ...(p[reportType] ?? {}), [key]: value },
    }));
  };

  const createVersion = async (reportType) => {
    if (!internship) return;
    const period = periods[reportType];
    setBusy(true);
    const res = await reportVersionService.createSnapshot(internship.id, reportType, period.start, period.end);
    setBusy(false);
    if (res.success) {
      const v = res.data;
      toast.success(
        v.status === 'verified'
          ? `${REPORT_META[reportType].label} v${v.version} verified - ${v.verification_id}`
          : `${REPORT_META[reportType].label} v${v.version} created unverified.`
      );
      await loadVersions(internship.id);
    } else {
      toast.error(res.error);
    }
  };

  const templateForVersion = (reportType, content = null) => {
    const template = reportTemplateFromSnapshot(
      content,
      selectedReportTemplate(internship, reportType),
    );
    return reportTemplateToPdfTemplate(template);
  };

  const exportVersion = async (versionId, format) => {
    setBusy(true);
    try {
      const res = await reportVersionService.getVersion(versionId);
      if (!res.success) throw new Error(res.error);
      const c = res.data.content;
      const frozenTemplate = reportTemplateFromSnapshot(
        c,
        selectedReportTemplate(internship, res.data.report_type),
      );
      const tpl = templateForVersion(res.data.report_type, c);
      const layout = {
        ...resolveLayout(tpl, internship),
        ...frozenTemplate.layout,
      };
      const verification = verificationOf(res.data);
      const common = {
        profile: c.intern,
        internship: c.internship,
        snapshots: c.entries ?? [],
        evaluations: c.evaluations ?? [],
        template: c.template ?? null,
        layout,
        verification,
      };
      if (format === 'pdf') {
        const { generateLogbookPdf } = await import('../../services/pdf/logbookPdf');
        generateLogbookPdf(common);
      } else {
        let qrPng = null;
        if (verification) {
          const { qrPngDataUrl } = await import('../../services/render/qr');
          qrPng = qrPngDataUrl(verification.verify_url);
        }
        const { generateLogbookDocx } = await import('../../services/docx/logbookDocx');
        await generateLogbookDocx({ ...common, qrPng });
      }
      toast.success(`${format.toUpperCase()} downloaded.`);
    } catch (err) {
      toast.error('Export failed: ' + err.message);
    } finally {
      setBusy(false);
    }
  };

  const activeJson = templateAsJson(selectedTemplate);
  const typeVersions = versions[activeType] ?? [];
  const period = periods[activeType] ?? {};
  const canCreatePeriodReport = activeType !== REPORT_TYPES.FINAL && snapshots?.length > 0 && !passLocked;

  return (
    <InternShell title="Report Center">
      <div className="p-4 space-y-4">
        <div className="flex items-start gap-2 text-xs text-gray-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
          <ClipboardDocumentCheckIcon className="w-4 h-4 text-slate-700 mt-0.5 shrink-0" />
          <span>
            Standard report templates are live. Uploaded institution samples
            open as a visual preview before you apply them.
          </span>
        </div>

        {snapshots === null ? (
          <div className="flex justify-center pt-16">
            <div className="w-8 h-8 border-4 border-slate-800 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              {[REPORT_TYPES.WEEKLY, REPORT_TYPES.MONTHLY, REPORT_TYPES.FINAL].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setActiveType(type);
                    setSampleFile(null);
                    setStructureDraft(null);
                  }}
                  className={`rounded-lg border px-2 py-2 text-xs font-semibold ${
                    activeType === type
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-gray-200 bg-white text-gray-600'
                  }`}
                >
                  {REPORT_META[type].label.replace(' report', '')}
                </button>
              ))}
            </div>

            <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
              <div>
                <h2 className="font-semibold text-gray-900">Reporting workspace</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Report templates, daily log format, style, exports, and final report studio are managed here.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <Link
                  to="/logbook"
                  className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-3 hover:border-gray-300"
                >
                  <span className="flex items-center gap-2">
                    <DocumentTextIcon className="w-5 h-5 text-slate-700" />
                    <span>
                      <span className="block text-sm font-semibold text-gray-900">Official logbook</span>
                      <span className="block text-xs text-gray-500">Approved snapshots and evaluation exports.</span>
                    </span>
                  </span>
                  <span className="text-gray-300 text-xl">{'>'}</span>
                </Link>
                <Link
                  to="/template-studio"
                  className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-3 hover:border-gray-300"
                >
                  <span className="flex items-center gap-2">
                    <SparklesIcon className="w-5 h-5 text-slate-700" />
                    <span>
                      <span className="block text-sm font-semibold text-gray-900">Daily log Template Studio</span>
                      <span className="block text-xs text-gray-500">Import your institution daily log form.</span>
                    </span>
                  </span>
                  <span className="text-gray-300 text-xl">{'>'}</span>
                </Link>
                <Link
                  to="/final-report"
                  className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-3 hover:border-gray-300"
                >
                  <span className="flex items-center gap-2">
                    <ClipboardDocumentCheckIcon className="w-5 h-5 text-slate-700" />
                    <span>
                      <span className="block text-sm font-semibold text-gray-900">Final Report Studio</span>
                      <span className="block text-xs text-gray-500">Chapters, narrative draft, official final versions.</span>
                    </span>
                  </span>
                  <span className="text-gray-300 text-xl">{'>'}</span>
                </Link>
              </div>

              {internship && (
                <div className="rounded-lg border border-gray-200 p-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <SwatchIcon className="w-5 h-5 text-slate-700" />
                    <h3 className="text-sm font-semibold text-gray-900">Report style</h3>
                  </div>
                  <p className="text-xs text-gray-500">
                    These change presentation only. Official approved records stay untouched.
                  </p>
                  <div>
                    <label className={labelCls}>Report title</label>
                    <input
                      className={inputCls}
                      value={prefs.title ?? ''}
                      placeholder={LAYOUT_DEFAULTS.title}
                      onBlur={() => savePrefs({ ...prefs, title: (prefs.title ?? '').trim() || undefined })}
                      onChange={(e) => setPrefs((p) => ({ ...p, title: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Accent colour</label>
                    <div className="flex gap-2">
                      {ACCENT_CHOICES.map((c) => {
                        const active = JSON.stringify(prefs.accent ?? LAYOUT_DEFAULTS.accent) === JSON.stringify(c.rgb);
                        return (
                          <button
                            key={c.name}
                            type="button"
                            aria-label={c.name}
                            onClick={() => savePrefs({ ...prefs, accent: c.rgb })}
                            className={`w-9 h-9 rounded-full border-2 ${active ? 'border-slate-900 ring-2 ring-slate-300' : 'border-transparent'}`}
                            style={{ backgroundColor: `rgb(${c.rgb[0]}, ${c.rgb[1]}, ${c.rgb[2]})` }}
                          />
                        );
                      })}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {[
                      ['show_signatures', 'Include supervisor signatures'],
                      ['show_comments', 'Include supervisor comments'],
                      ['show_evaluations', 'Include evaluations section'],
                    ].map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={prefs[key] ?? LAYOUT_DEFAULTS[key]}
                          onChange={(e) => savePrefs({ ...prefs, [key]: e.target.checked })}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  {prefsSaving && <p className="text-xs text-gray-400">Saving...</p>}
                </div>
              )}

              {internship && (
                <div className="rounded-lg border border-gray-200 p-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <TableCellsIcon className="w-5 h-5 text-slate-700" />
                    <h3 className="text-sm font-semibold text-gray-900">Daily log format</h3>
                  </div>
                  <p className="text-xs text-gray-500">
                    {usingCustomTemplate
                      ? "Using a custom format imported from your institution's form."
                      : usingMultiTask
                        ? 'Using the default AIntern daily log format with multiple tasks per day.'
                        : 'Using the default AIntern daily log format.'}
                  </p>
                  {!usingCustomTemplate && v2TemplateId && (
                    <label className="flex items-start gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={usingMultiTask}
                        disabled={multiTaskSaving}
                        onChange={toggleMultiTask}
                        className="h-4 w-4 rounded border-gray-300 mt-0.5"
                      />
                      <span>
                        Allow multiple tasks per day
                        <span className="block text-xs text-gray-400 mt-0.5">
                          Applies to new logs only. Approved entries keep their original frozen evidence.
                        </span>
                      </span>
                    </label>
                  )}
                  {dailyTemplate && (
                    <details className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <summary className="cursor-pointer text-xs font-semibold text-gray-700">
                        Choose visible daily log fields
                      </summary>
                      <div className="mt-3 space-y-3">
                        {dailyTemplate.fields_schema.sections.map((section) => (
                          <div key={section.section_id}>
                            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">
                              {section.section_name}
                            </p>
                            <div className="space-y-1">
                              {section.fields.map((f) => {
                                const path = `${section.section_id}.${f.field_id}`;
                                const isHidden = hiddenFields.includes(path);
                                return (
                                  <label
                                    key={path}
                                    className="flex items-center justify-between gap-2 text-sm text-gray-700 py-0.5"
                                  >
                                    <span>
                                      {f.field_name}
                                      {f.required && <span className="text-red-400"> *</span>}
                                    </span>
                                    <input
                                      type="checkbox"
                                      checked={!isHidden}
                                      disabled={fieldPrefsSaving}
                                      onChange={() => toggleFieldVisibility(path)}
                                      className="h-4 w-4 rounded border-gray-300"
                                    />
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                      {fieldPrefsSaving && <p className="mt-2 text-xs text-gray-400">Saving...</p>}
                    </details>
                  )}
                </div>
              )}
            </section>

            <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
              <div>
                <h2 className="font-semibold text-gray-900">{REPORT_META[activeType].label}</h2>
                <p className="text-sm text-gray-500 mt-0.5">{REPORT_META[activeType].copy}</p>
              </div>

              {activeType === REPORT_TYPES.FINAL ? (
                <div className="space-y-3">
                  <div className="rounded-lg border border-gray-200 p-3">
                    <p className="text-sm font-medium text-gray-900">{selectedTemplate.name}</p>
                    <p className="text-xs text-gray-500 mt-1">{selectedTemplate.description}</p>
                  </div>
                  <Link
                    to="/final-report"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 py-3 text-sm font-medium text-white hover:bg-slate-700"
                  >
                    <SparklesIcon className="w-4 h-4" />
                    Open Final Report Studio
                  </Link>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {templateOptions.map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => saveTemplate(tpl.id)}
                        className={`w-full text-left rounded-lg border p-3 transition-colors ${
                          selectedTemplate.id === tpl.id
                            ? 'border-emerald-400 bg-emerald-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <p className="text-sm font-semibold text-gray-900">
                          {tpl.name}
                          {tpl.custom && (
                            <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-sky-700">
                              Custom
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">{tpl.description}</p>
                      </button>
                    ))}
                  </div>

                  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 space-y-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Import institution sample</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Upload a PDF/photo of a {activeType} report. AI extracts structure only; you review a visual preview before applying.
                      </p>
                    </div>
                    <div className="grid grid-cols-[1fr_auto] gap-2">
                      <input
                        type="file"
                        accept="application/pdf,image/png,image/jpeg,image/webp"
                        onChange={(e) => {
                          setSampleFile(e.target.files?.[0] ?? null);
                          setStructureDraft(null);
                        }}
                        className="w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-xs"
                      />
                      <select
                        value={provider}
                        onChange={(e) => setProvider(e.target.value)}
                        className="rounded-lg border border-gray-300 bg-white px-2 py-2 text-xs"
                        aria-label="AI provider"
                      >
                        <option value="gemini">Gemini</option>
                        <option value="anthropic">Claude</option>
                        <option value="openai">OpenAI</option>
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={extractSampleTemplate}
                      disabled={busy || !sampleFile}
                      className="w-full rounded-lg border border-slate-900 bg-white py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-100 disabled:opacity-40"
                    >
                      Extract sample template
                    </button>
                    {structureDraft && (
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2 text-[11px] text-gray-500">
                          <span className="rounded-full bg-white px-2 py-1 border border-gray-200">{structureDraft.meta.filename}</span>
                          <span className="rounded-full bg-white px-2 py-1 border border-gray-200">{structureDraft.meta.provider}</span>
                          <span className="rounded-full bg-white px-2 py-1 border border-gray-200">{structureDraft.meta.extraction}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowDraftPreview(true)}
                          className="w-full rounded-lg border border-gray-300 bg-white py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                          Preview extracted template
                        </button>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setStructureDraft(null)}
                            className="rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700"
                          >
                            Discard
                          </button>
                          <button
                            type="button"
                            onClick={applyCustomTemplate}
                            disabled={busy}
                            className="rounded-lg bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
                          >
                            Apply custom template
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-xs font-medium text-gray-600">
                      Start
                      <input
                        type="date"
                        value={period.start ?? ''}
                        onChange={(e) => updatePeriod(activeType, 'start', e.target.value)}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"
                      />
                    </label>
                    <label className="text-xs font-medium text-gray-600">
                      End
                      <input
                        type="date"
                        value={period.end ?? ''}
                        onChange={(e) => updatePeriod(activeType, 'end', e.target.value)}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"
                      />
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={() => createVersion(activeType)}
                    disabled={busy || !canCreatePeriodReport || !period.start || !period.end}
                    className="w-full rounded-lg bg-slate-900 py-3 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40"
                  >
                    Create official {REPORT_META[activeType].label.toLowerCase()}
                  </button>

                  {passLocked && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      Your free trial has ended - creating official reports needs an internship pass.
                    </p>
                  )}
                </>
              )}
            </section>

            <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <CalendarDaysIcon className="w-5 h-5 text-slate-700" />
                <h2 className="font-semibold text-gray-900">Active template preview</h2>
              </div>
              <p className="text-xs text-gray-500">
                {activeType === REPORT_TYPES.FINAL
                  ? 'Final report structure is managed in the Final Report Studio.'
                  : `Current period: ${periodLabel(period)}`}
              </p>
              {activeType === REPORT_TYPES.FINAL ? (
                <Link to="/final-report" className="inline-flex w-full items-center justify-center rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700">
                  Open Final Report Studio
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowActivePreview(true)}
                  className="w-full rounded-lg border border-gray-300 bg-white py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Preview current template
                </button>
              )}
            </section>

            {activeType !== REPORT_TYPES.FINAL && (
              <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                <h2 className="font-semibold text-gray-900">Official versions</h2>
                {typeVersions.length === 0 ? (
                  <p className="text-xs text-gray-400">No official {activeType} reports yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {typeVersions.map((v) => (
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
                            {v.period_start} - {v.period_end}
                            {v.verification_id && <> - <span className="font-mono">{v.verification_id}</span></>}
                          </p>
                        </div>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => exportVersion(v.id, 'docx')}
                            disabled={busy || passLocked}
                            aria-label={`Download Word document of ${activeType} version ${v.version}`}
                            className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                          >
                            <DocumentTextIcon className="w-5 h-5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => exportVersion(v.id, 'pdf')}
                            disabled={busy || passLocked}
                            aria-label={`Download PDF of ${activeType} version ${v.version}`}
                            className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                          >
                            <DocumentArrowDownIcon className="w-5 h-5" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </>
        )}
      </div>

      <Modal
        isOpen={showDraftPreview && Boolean(structureDraft)}
        onClose={() => setShowDraftPreview(false)}
        title="Extracted template preview"
        size="xl"
        footer={(
          <>
            <button
              type="button"
              onClick={() => setShowDraftPreview(false)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700"
            >
              Keep reviewing
            </button>
            <button
              type="button"
              onClick={applyCustomTemplate}
              disabled={busy}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              Apply custom template
            </button>
          </>
        )}
      >
        {structureDraft && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 text-[11px] text-gray-500">
              <span className="rounded-full bg-white px-2 py-1 border border-gray-200">{structureDraft.meta.filename}</span>
              <span className="rounded-full bg-white px-2 py-1 border border-gray-200">{structureDraft.meta.provider}</span>
              <span className="rounded-full bg-white px-2 py-1 border border-gray-200">{structureDraft.meta.extraction}</span>
            </div>
            <PeriodReportTemplatePreview
              template={structureDraft.template}
              profile={profile}
              internship={internship}
              periodLabel={periodLabel(period)}
            />
            <details className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <summary className="cursor-pointer text-xs font-medium text-gray-600">Technical JSON</summary>
              <pre className="mt-2 max-h-56 overflow-auto rounded-lg bg-slate-950 p-3 text-[11px] leading-relaxed text-slate-100">
                {JSON.stringify(templateAsJson(structureDraft.template), null, 2)}
              </pre>
            </details>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={showActivePreview && activeType !== REPORT_TYPES.FINAL}
        onClose={() => setShowActivePreview(false)}
        title="Current template preview"
        size="xl"
      >
        <div className="space-y-3">
          <PeriodReportTemplatePreview
            template={selectedTemplate}
            profile={profile}
            internship={internship}
            periodLabel={periodLabel(period)}
          />
          <details className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <summary className="cursor-pointer text-xs font-medium text-gray-600">Technical JSON</summary>
            <pre className="mt-2 max-h-56 overflow-auto rounded-lg bg-slate-950 p-3 text-[11px] leading-relaxed text-slate-100">
              {JSON.stringify(activeJson, null, 2)}
            </pre>
          </details>
        </div>
      </Modal>
    </InternShell>
  );
}
