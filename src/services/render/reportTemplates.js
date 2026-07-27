/**
 * AIntern - Standard Report Templates
 *
 * User-selectable report formats for the Report Center. These are
 * presentation/structure definitions only; official records still come from
 * immutable report_versions snapshots.
 *
 * @file src/services/render/reportTemplates.js
 * @created July 27, 2026 - Report Center foundation
 */

export const REPORT_TYPES = {
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  FINAL: 'final',
};

export const STANDARD_REPORT_TEMPLATES = {
  weekly_narrative: {
    id: 'weekly_narrative',
    report_type: REPORT_TYPES.WEEKLY,
    name: 'Weekly Narrative Report',
    description: 'A reflection-led weekly report with evidence-backed activity summaries.',
    layout: {
      title: 'Weekly Industrial Training Report',
      density: 'normal',
      show_cover: true,
      show_signatures: true,
      show_comments: true,
      show_evaluations: false,
      footer_text: 'AIntern Weekly Report',
    },
    sections: [
      { id: 'student_info', title: 'Student & Placement Information', kind: 'profile_info', source: 'profile+internship' },
      { id: 'weekly_overview', title: 'Weekly Overview', kind: 'narrative', source: 'intern_written' },
      { id: 'daily_activity_summary', title: 'Daily Activity Summary', kind: 'auto_entries_narrative', source: 'approved_snapshots' },
      { id: 'skills_learned', title: 'Skills / Knowledge Learned', kind: 'narrative', source: 'intern_written' },
      { id: 'challenges', title: 'Problems Faced and Solutions', kind: 'narrative', source: 'intern_written' },
      { id: 'supervisor_verification', title: 'Supervisor Verification', kind: 'signature', source: 'approved_snapshots' },
    ],
  },
  weekly_table: {
    id: 'weekly_table',
    report_type: REPORT_TYPES.WEEKLY,
    name: 'Weekly Table Report',
    description: 'A compact tabular weekly activity report for institutions that prefer structured logs.',
    layout: {
      title: 'Weekly Industrial Training Activity Table',
      density: 'compact',
      show_cover: true,
      show_signatures: true,
      show_comments: true,
      show_evaluations: false,
      footer_text: 'AIntern Weekly Table Report',
    },
    sections: [
      { id: 'student_info', title: 'Student & Placement Information', kind: 'profile_info', source: 'profile+internship' },
      { id: 'activity_table', title: 'Approved Daily Activities', kind: 'auto_entries_table', source: 'approved_snapshots' },
      { id: 'hours_summary', title: 'Hours / Attendance Summary', kind: 'computed_summary', source: 'approved_snapshots' },
      { id: 'supervisor_comments', title: 'Supervisor Comments', kind: 'comments_table', source: 'approved_snapshots' },
      { id: 'supervisor_verification', title: 'Supervisor Verification', kind: 'signature', source: 'approved_snapshots' },
    ],
  },
  monthly_combined: {
    id: 'monthly_combined',
    report_type: REPORT_TYPES.MONTHLY,
    name: 'Monthly Combined Report',
    description: 'Monthly tables plus narrative reflection and supervisor evaluation summary.',
    layout: {
      title: 'Monthly Industrial Training Report',
      density: 'normal',
      show_cover: true,
      show_signatures: true,
      show_comments: true,
      show_evaluations: true,
      footer_text: 'AIntern Monthly Report',
    },
    sections: [
      { id: 'student_info', title: 'Student & Placement Information', kind: 'profile_info', source: 'profile+internship' },
      { id: 'monthly_summary', title: 'Monthly Summary', kind: 'computed_summary', source: 'approved_snapshots+evaluations' },
      { id: 'activity_table', title: 'Approved Activity Table', kind: 'auto_entries_table', source: 'approved_snapshots' },
      { id: 'reflection', title: 'Monthly Reflection', kind: 'narrative', source: 'intern_written' },
      { id: 'skills_growth', title: 'Skills Growth and Learning Outcomes', kind: 'narrative', source: 'intern_written' },
      { id: 'evaluation_summary', title: 'Supervisor Evaluation Summary', kind: 'auto_evaluations', source: 'evaluations' },
      { id: 'next_month_plan', title: 'Plan for Next Month', kind: 'narrative', source: 'intern_written' },
      { id: 'verification', title: 'Supervisor Verification', kind: 'signature', source: 'approved_snapshots+evaluations' },
    ],
  },
  final_default: {
    id: 'final_default',
    report_type: REPORT_TYPES.FINAL,
    name: 'Final Training Report',
    description: 'Chapter-based final report with approved logbook and evaluations as appendices.',
    layout: {
      title: 'Final Industrial Training Report',
      density: 'normal',
      show_cover: true,
      show_signatures: true,
      show_comments: true,
      show_evaluations: true,
      footer_text: 'AIntern Final Report',
    },
    sections: [
      { id: 'introduction', title: 'Introduction', kind: 'narrative', source: 'intern_written' },
      { id: 'company_profile', title: 'Company Profile', kind: 'narrative', source: 'intern_written' },
      { id: 'logbook_appendix', title: 'Daily Activity Log Appendix', kind: 'auto_entries', source: 'approved_snapshots' },
      { id: 'evaluation_appendix', title: 'Supervisor Evaluation Appendix', kind: 'auto_evaluations', source: 'evaluations' },
      { id: 'reflection', title: 'Reflection', kind: 'narrative', source: 'intern_written' },
      { id: 'conclusion', title: 'Conclusion', kind: 'narrative', source: 'intern_written' },
    ],
  },
};

export const REPORT_TEMPLATE_OPTIONS = {
  [REPORT_TYPES.WEEKLY]: [
    STANDARD_REPORT_TEMPLATES.weekly_narrative,
    STANDARD_REPORT_TEMPLATES.weekly_table,
  ],
  [REPORT_TYPES.MONTHLY]: [
    STANDARD_REPORT_TEMPLATES.monthly_combined,
  ],
  [REPORT_TYPES.FINAL]: [
    STANDARD_REPORT_TEMPLATES.final_default,
  ],
};

export const DEFAULT_TEMPLATE_BY_TYPE = {
  [REPORT_TYPES.WEEKLY]: 'weekly_narrative',
  [REPORT_TYPES.MONTHLY]: 'monthly_combined',
  [REPORT_TYPES.FINAL]: 'final_default',
};

export function selectedTemplateId(internship, reportType) {
  return internship?.metadata?.report_templates?.[reportType]
    ?? DEFAULT_TEMPLATE_BY_TYPE[reportType];
}

export function selectedReportTemplate(internship, reportType) {
  return STANDARD_REPORT_TEMPLATES[selectedTemplateId(internship, reportType)]
    ?? STANDARD_REPORT_TEMPLATES[DEFAULT_TEMPLATE_BY_TYPE[reportType]];
}

export function templateAsJson(template) {
  return {
    report_type: template.report_type,
    template_id: template.id,
    name: template.name,
    layout: template.layout,
    sections: template.sections,
  };
}

export function reportTemplateToPdfTemplate(template) {
  return {
    template_id: `aintern-standard-${template.id}`,
    template_name: template.name,
    fields_schema: { sections: [] },
    pdf_layout: { report: template.layout },
  };
}

function iso(d) {
  return d.toISOString().split('T')[0];
}

export function currentWeekPeriod(base = new Date()) {
  const d = new Date(base);
  const day = d.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = new Date(d);
  start.setDate(d.getDate() + mondayOffset);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start: iso(start), end: iso(end) };
}

export function currentMonthPeriod(base = new Date()) {
  const start = new Date(base.getFullYear(), base.getMonth(), 1);
  const end = new Date(base.getFullYear(), base.getMonth() + 1, 0);
  return { start: iso(start), end: iso(end) };
}

export function clampPeriodToInternship(period, internship) {
  if (!internship) return period;
  return {
    start: period.start < internship.start_date ? internship.start_date : period.start,
    end: period.end > internship.end_date ? internship.end_date : period.end,
  };
}
