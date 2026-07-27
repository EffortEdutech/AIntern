/**
 * AIntern - Report Template Preview
 *
 * Visual review surface for AI-extracted report templates. This keeps JSON as
 * implementation detail and shows the intern a report-like page instead.
 *
 * @file src/components/report/ReportTemplatePreview.jsx
 * @created July 27, 2026 - Visual extracted-template review
 */

const SAMPLE_DAYS = [
  ['Mon', 'Reviewed task brief, prepared work plan, and documented progress.'],
  ['Tue', 'Completed assigned task, discussed feedback, and updated notes.'],
  ['Wed', 'Supported team work, resolved issues, and captured learning outcomes.'],
];

const KIND_COPY = {
  profile_info: 'Student, institution, company, supervisor, and placement details.',
  period_summary: 'Summary of attendance, progress, hours, and report period.',
  computed_summary: 'Auto-calculated totals from approved daily logs and evaluations.',
  auto_entries_narrative: 'Approved daily activities rewritten as a formal narrative.',
  auto_entries_table: 'Approved daily activities displayed in a day-by-day table.',
  narrative: 'Student-written reflection, learning, challenges, or plan.',
  comments_table: 'Supervisor comments from approved log records.',
  auto_evaluations: 'Supervisor evaluation scores and comments.',
  signature: 'Supervisor verification and signature area.',
};

function SectionPreview({ section }) {
  const kind = section.kind;
  if (kind === 'auto_entries_table') {
    return (
      <div className="overflow-hidden rounded-md border border-gray-300">
        <div className="grid grid-cols-[52px_1fr] bg-gray-100 text-[10px] font-semibold uppercase text-gray-600">
          <div className="border-r border-gray-300 px-2 py-1.5">Day</div>
          <div className="px-2 py-1.5">Approved activity</div>
        </div>
        {SAMPLE_DAYS.map(([day, text]) => (
          <div key={day} className="grid grid-cols-[52px_1fr] border-t border-gray-200 text-[11px] text-gray-700">
            <div className="border-r border-gray-200 px-2 py-1.5 font-medium">{day}</div>
            <div className="px-2 py-1.5">{text}</div>
          </div>
        ))}
      </div>
    );
  }

  if (kind === 'signature') {
    return (
      <div className="grid grid-cols-2 gap-3 text-[11px] text-gray-600">
        <div className="border-t border-gray-400 pt-2">Intern signature</div>
        <div className="border-t border-gray-400 pt-2">Supervisor signature</div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-[11px] leading-relaxed text-gray-600">{KIND_COPY[kind] ?? 'Report content section.'}</p>
      {kind === 'narrative' && (
        <div className="space-y-1.5">
          <div className="h-2 rounded bg-gray-200" />
          <div className="h-2 w-11/12 rounded bg-gray-200" />
          <div className="h-2 w-3/4 rounded bg-gray-200" />
        </div>
      )}
    </div>
  );
}

export function PeriodReportTemplatePreview({ template, profile, internship, periodLabel }) {
  if (!template) return null;
  const layout = template.layout ?? {};

  return (
    <div className="mx-auto max-w-[560px] rounded-lg bg-gray-200 p-3">
      <article className="min-h-[720px] bg-white px-7 py-8 shadow-sm">
        {layout.show_cover !== false && (
          <header className="mb-6 border-b-2 border-slate-800 pb-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
              {template.report_type === 'monthly' ? 'Monthly Report' : 'Weekly Report'}
            </p>
            <h1 className="mt-1 text-xl font-bold text-slate-900">{layout.title ?? template.name}</h1>
            <p className="mt-2 text-xs text-gray-600">{periodLabel || 'Selected reporting period'}</p>
          </header>
        )}

        <section className="mb-5 grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-md border border-gray-200 p-3 text-[11px]">
          <div><span className="font-semibold">Student:</span> {profile?.full_name || 'Student name'}</div>
          <div><span className="font-semibold">Institution:</span> {profile?.university || 'Institution name'}</div>
          <div><span className="font-semibold">Course:</span> {profile?.course || 'Course / programme'}</div>
          <div><span className="font-semibold">Company:</span> {internship?.company_name || 'Host company'}</div>
        </section>

        <div className="space-y-4">
          {(template.sections ?? []).map((section, index) => (
            <section key={section.id ?? index} className="break-inside-avoid">
              <div className="mb-1.5 flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] font-semibold text-white">
                  {index + 1}
                </span>
                <h2 className="text-sm font-bold text-slate-900">{section.title}</h2>
              </div>
              <SectionPreview section={section} />
            </section>
          ))}
        </div>

        <footer className="mt-8 border-t border-gray-200 pt-3 text-center text-[10px] text-gray-400">
          {layout.footer_text || 'AIntern Official Report'}
        </footer>
      </article>
    </div>
  );
}

export function FinalReportStructurePreview({ structure }) {
  if (!structure) return null;
  return (
    <div className="mx-auto max-w-[560px] rounded-lg bg-gray-200 p-3">
      <article className="min-h-[720px] bg-white px-7 py-8 shadow-sm">
        <header className="mb-6 border-b-2 border-slate-800 pb-4 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Final Training Report</p>
          <h1 className="mt-2 text-xl font-bold text-slate-900">{structure.report_title}</h1>
          <p className="mt-2 text-xs text-gray-500">Extracted chapter structure preview</p>
        </header>

        <section className="mb-6">
          <h2 className="mb-2 text-sm font-bold text-slate-900">Table of Contents</h2>
          <ol className="space-y-2">
            {(structure.chapters ?? []).map((chapter, index) => (
              <li key={chapter.chapter_id} className="flex items-start gap-3 border-b border-dotted border-gray-300 pb-2">
                <span className="mt-0.5 w-5 text-xs font-semibold text-gray-500">{index + 1}.</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">{chapter.chapter_title}</p>
                    <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                      {chapter.kind}
                    </span>
                  </div>
                  {chapter.guidance && <p className="mt-1 text-[11px] text-gray-500">{chapter.guidance}</p>}
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="rounded-md border border-gray-200 p-3">
          <h2 className="text-sm font-bold text-slate-900">Automatic appendices</h2>
          <p className="mt-1 text-[11px] text-gray-600">
            Chapters marked as approved logbook or supervisor evaluation sections will be filled from the verified record.
          </p>
        </section>
      </article>
    </div>
  );
}

export default PeriodReportTemplatePreview;
