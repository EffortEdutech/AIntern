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
import { useAuth } from '../../context/AuthContext';
import { internshipService } from '../../services/api/internshipService';
import { logbookService } from '../../services/api/logbookService';
import { reportVersionService } from '../../services/api/reportVersionService';
import { useAccess } from '../../hooks/useAccess';
import { resolveLayout } from '../../services/render/reportLayout';
import { verificationOf } from '../../services/render/verification';
import {
  REPORT_TEMPLATE_OPTIONS,
  REPORT_TYPES,
  clampPeriodToInternship,
  currentMonthPeriod,
  currentWeekPeriod,
  reportTemplateToPdfTemplate,
  selectedReportTemplate,
  templateAsJson,
} from '../../services/render/reportTemplates';
import { useToast } from '../../context/ToastContext';
import {
  CalendarDaysIcon, ClipboardDocumentCheckIcon, DocumentArrowDownIcon,
  DocumentTextIcon, SparklesIcon,
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
      const [logbook] = await Promise.all([
        logbookService.getLogbook(itn.id),
        loadVersions(itn.id),
      ]);
      if (!mounted) return;
      setSnapshots(logbook.success ? logbook.snapshots : []);
      setEvaluations(logbook.success ? logbook.evaluations : []);
    })();
    return () => { mounted = false; };
  }, []);

  const selectedTemplate = useMemo(
    () => selectedReportTemplate(internship, activeType),
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

  const templateForVersion = (reportType) => {
    const template = selectedReportTemplate(internship, reportType);
    return reportTemplateToPdfTemplate(template);
  };

  const exportVersion = async (versionId, format) => {
    setBusy(true);
    try {
      const res = await reportVersionService.getVersion(versionId);
      if (!res.success) throw new Error(res.error);
      const c = res.data.content;
      const tpl = templateForVersion(res.data.report_type);
      const layout = {
        ...resolveLayout(tpl, internship),
        ...selectedReportTemplate(internship, res.data.report_type).layout,
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
            will generate the same JSON structure before being applied.
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
                  onClick={() => setActiveType(type)}
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
                    {REPORT_TEMPLATE_OPTIONS[activeType].map((tpl) => (
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
                        <p className="text-sm font-semibold text-gray-900">{tpl.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{tpl.description}</p>
                      </button>
                    ))}
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
                <h2 className="font-semibold text-gray-900">Active JSON template</h2>
              </div>
              <p className="text-xs text-gray-500">
                {activeType === REPORT_TYPES.FINAL
                  ? 'Final report structure is managed in the Final Report Studio.'
                  : `Current period: ${periodLabel(period)}`}
              </p>
              <pre className="max-h-80 overflow-auto rounded-lg bg-slate-950 p-3 text-[11px] leading-relaxed text-slate-100">
                {JSON.stringify(activeJson, null, 2)}
              </pre>
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
    </InternShell>
  );
}
