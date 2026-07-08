import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { useOrganization } from '../../context/OrganizationContext';
import { useToast } from '../../context/ToastContext';
import { templateImportService } from '../../services/api/templateImportService';

const stepLabels = ['Upload PDF', 'Analyze report', 'Review draft'];

const StatusDot = ({ active, done }) => (
  <span
    className={`h-2.5 w-2.5 rounded-full ${
      done ? 'bg-emerald-500' : active ? 'bg-blue-600' : 'bg-gray-300'
    }`}
  />
);

const FieldList = ({ fields = [] }) => {
  if (!fields.length) {
    return <p className="text-sm text-gray-500">No fields detected.</p>;
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {fields.map((field, index) => (
        <div key={`${field.key || field.name || index}`} className="rounded border border-gray-200 bg-white px-3 py-2">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium text-gray-900">{field.label || field.name || field.key}</p>
            <span className="rounded bg-gray-100 px-2 py-0.5 text-[11px] font-medium uppercase text-gray-600">
              {field.type || 'text'}
            </span>
          </div>
          {field.required && <p className="mt-1 text-xs text-red-600">Required</p>}
        </div>
      ))}
    </div>
  );
};

export default function TemplateImportPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { currentOrg } = useOrganization();

  const [file, setFile] = useState(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const draft = result?.draft || null;
  const template = draft?.template || {};
  const layout = draft?.report_layout || {};
  const formPages = draft?.form_pages || template?.fields_schema?.sections || [];
  const sections = template?.fields_schema?.sections || [];
  const fieldCount = sections.reduce((total, section) => total + (section.fields?.length || 0), 0);
  const layoutBlocks = layout?.blocks || layout?.sections || [];

  const jsonText = useMemo(() => (
    draft ? JSON.stringify(draft, null, 2) : ''
  ), [draft]);

  const canSubmit = file && !loading;

  const handleGenerate = async (event) => {
    event.preventDefault();
    setError('');
    setResult(null);

    if (!file) {
      toast.warning('Select a PDF report first.');
      return;
    }

    setLoading(true);
    setActiveStep(0);

    try {
      setActiveStep(1);
      const response = await templateImportService.createDraftFromPdf({
        file,
        organizationId: currentOrg?.id,
        notes
      });

      if (!response.success) {
        const message = response.error || 'Template generation failed.';
        setError(message);
        toast.error(message);
        return;
      }

      setResult(response.data);
      setActiveStep(2);
      toast.success('Draft template generated.');
    } finally {
      setLoading(false);
    }
  };

  const copyJson = async () => {
    if (!jsonText) return;
    await navigator.clipboard.writeText(jsonText);
    toast.success('Draft JSON copied.');
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => navigate('/reports')}
          className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Reports
        </button>

        <div className="flex flex-col gap-3 border-b border-gray-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AI Template Studio</h1>
            <p className="mt-1 text-sm text-gray-600">
              Convert a professional PDF report into a draft WorkLedger template and report layout.
            </p>
          </div>
          {currentOrg && (
            <span className="w-fit rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-600">
              {currentOrg.name || currentOrg.slug}
            </span>
          )}
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(320px,420px)_1fr]">
          <form onSubmit={handleGenerate} className="space-y-4 rounded-lg border border-gray-200 bg-white p-5">
            <div>
              <label className="block text-sm font-semibold text-gray-900" htmlFor="template-pdf">
                Reference PDF
              </label>
              <input
                id="template-pdf"
                type="file"
                accept="application/pdf,.pdf"
                onChange={(event) => {
                  setFile(event.target.files?.[0] || null);
                  setError('');
                }}
                className="mt-2 block w-full text-sm text-gray-700 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
              />
              {file && (
                <p className="mt-2 text-xs text-gray-500">
                  {file.name} - {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900" htmlFor="template-notes">
                Review notes
              </label>
              <textarea
                id="template-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={5}
                placeholder="Example: Daily site progress report for civil works. Keep weather, manpower, machinery, photos, and approvals."
                className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="space-y-3">
                {stepLabels.map((label, index) => (
                  <div key={label} className="flex items-center gap-3 text-sm">
                    <StatusDot active={activeStep === index && loading} done={activeStep > index || (!!draft && index <= 2)} />
                    <span className={activeStep === index || (!!draft && index <= 2) ? 'font-medium text-gray-900' : 'text-gray-500'}>
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {loading && (
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
              )}
              {loading ? 'Generating draft...' : 'Generate Draft'}
            </button>
          </form>

          <div className="space-y-4">
            {!draft ? (
              <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
                <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5l5 5v11a2 2 0 01-2 2z" />
                </svg>
                <h2 className="mt-3 text-sm font-semibold text-gray-900">No draft generated</h2>
                <p className="mt-1 text-sm text-gray-500">Generated form pages, report layout, and JSON will appear here.</p>
              </div>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="rounded-lg border border-gray-200 bg-white p-4">
                    <p className="text-xs font-medium uppercase text-gray-500">Confidence</p>
                    <p className="mt-2 text-2xl font-bold text-gray-900">{Math.round((draft.confidence || 0) * 100)}%</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-white p-4">
                    <p className="text-xs font-medium uppercase text-gray-500">Sections</p>
                    <p className="mt-2 text-2xl font-bold text-gray-900">{sections.length}</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-white p-4">
                    <p className="text-xs font-medium uppercase text-gray-500">Fields</p>
                    <p className="mt-2 text-2xl font-bold text-gray-900">{fieldCount}</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-white p-4">
                    <p className="text-xs font-medium uppercase text-gray-500">Layout Blocks</p>
                    <p className="mt-2 text-2xl font-bold text-gray-900">{layoutBlocks.length}</p>
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 bg-white p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">{template.name || 'Untitled Template'}</h2>
                      <p className="mt-1 text-sm text-gray-500">
                        {[template.category, template.report_type, template.industry].filter(Boolean).join(' - ') || 'Draft template'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={copyJson}
                      className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Copy JSON
                    </button>
                  </div>

                  {!!draft.warnings?.length && (
                    <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
                      <p className="text-sm font-semibold text-amber-900">Review warnings</p>
                      <ul className="mt-2 space-y-1 text-sm text-amber-800">
                        {draft.warnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}
                      </ul>
                    </div>
                  )}

                  {!!draft.review_checklist?.length && (
                    <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
                      <p className="text-sm font-semibold text-blue-900">Checklist</p>
                      <ul className="mt-2 space-y-1 text-sm text-blue-800">
                        {draft.review_checklist.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-gray-200 bg-white p-5">
                  <h2 className="text-lg font-semibold text-gray-900">Form Pages</h2>
                  <div className="mt-4 space-y-4">
                    {formPages.map((page, index) => (
                      <div key={`${page.page_key || page.key || page.title || index}`} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                        <p className="text-sm font-semibold text-gray-900">{page.title || page.page_title || page.label || `Page ${index + 1}`}</p>
                        <div className="mt-3">
                          <FieldList fields={page.fields || []} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 bg-white p-5">
                  <h2 className="text-lg font-semibold text-gray-900">Report Layout</h2>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {layoutBlocks.map((block, index) => (
                      <div key={`${block.id || block.type || index}`} className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
                        <p className="text-sm font-medium text-gray-900">{block.title || block.label || block.type || `Block ${index + 1}`}</p>
                        <p className="mt-1 text-xs uppercase text-gray-500">{block.type || 'section'}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <details className="rounded-lg border border-gray-200 bg-white">
                  <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-gray-900">Draft JSON</summary>
                  <pre className="max-h-[460px] overflow-auto border-t border-gray-200 bg-gray-950 p-5 text-xs leading-5 text-gray-100">
                    {jsonText}
                  </pre>
                </details>
              </>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
