/**
 * AIntern - Template Studio (/template-studio) — Phase 3, Session 11
 *
 * Upload a photo or PDF of the university's logbook form → AI extracts
 * the structure → intern reviews the sections/fields → apply. The daily
 * log form and PDF export switch to the custom format automatically.
 *
 * Human review before applying is mandatory by design (AI output is
 * sanitized server-side, but meaning is checked by a human).
 *
 * @file src/pages/studio/TemplateStudioPage.jsx
 * @created July 10, 2026 - Session 11
 */

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import InternShell from '../../components/layout/InternShell';
import { internshipService } from '../../services/api/internshipService';
import { templateStudioService } from '../../services/api/templateStudioService';
import { useToast } from '../../context/ToastContext';
import { CameraIcon, SparklesIcon } from '@heroicons/react/24/outline';

const PROVIDERS = [
  { value: 'gemini', label: 'Gemini (photo + PDF)' },
  { value: 'anthropic', label: 'Claude (photo + PDF)' },
  { value: 'openai', label: 'OpenAI (photo only)' },
];

export default function TemplateStudioPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const fileInput = useRef(null);

  const [internship, setInternship] = useState(null);
  const [file, setFile] = useState(null);
  const [provider, setProvider] = useState('gemini');
  const [extracting, setExtracting] = useState(false);
  const [draft, setDraft] = useState(null);
  const [applying, setApplying] = useState(false);
  const usingCustom = Boolean(internship?.daily_template_id);

  useEffect(() => {
    internshipService.getMyInternship().then(({ data }) => setInternship(data));
  }, []);

  const extract = async () => {
    setExtracting(true);
    setDraft(null);
    const res = await templateStudioService.extractTemplate(file, provider);
    setExtracting(false);
    if (res.success) {
      setDraft(res.template);
      toast.success(`Form structure extracted (${res.tier === 'byok' ? 'your key' : 'built-in AI'}).`);
    } else {
      toast.error(res.error);
    }
  };

  const apply = async () => {
    if (!internship || !draft) return;
    setApplying(true);
    const res = await templateStudioService.saveAndApply(internship, draft);
    setApplying(false);
    if (res.success) {
      toast.success('Custom format applied — your daily log now uses it.');
      navigate('/log');
    } else {
      toast.error(res.error);
    }
  };

  const revert = async () => {
    if (!internship) return;
    const res = await templateStudioService.revertToDefault(internship);
    if (res.success) {
      setInternship({ ...internship, daily_template_id: null });
      toast.success('Back to the default AIntern daily log format.');
    } else {
      toast.error(res.error);
    }
  };

  return (
    <InternShell title="Template Studio">
      <div className="p-4 space-y-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <SparklesIcon className="w-5 h-5 text-slate-700" />
            <h2 className="font-semibold text-gray-900">Match your university's logbook</h2>
          </div>
          <p className="text-sm text-gray-500">
            Upload a clear photo or PDF of your institution's daily log form.
            AI rebuilds it as a digital form — your entries and PDF export
            will follow that format.
          </p>

          {usingCustom && (
            <div className="flex items-center justify-between text-xs bg-blue-50 border border-blue-200 text-blue-800 rounded-lg px-3 py-2">
              <span>A custom format is currently active.</span>
              <button type="button" onClick={revert} className="font-semibold underline">
                Revert to default
              </button>
            </div>
          )}

          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp,application/pdf"
            className="hidden"
            onChange={(e) => { setFile(e.target.files?.[0] ?? null); setDraft(null); }}
          />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="w-full border-2 border-dashed border-gray-300 rounded-xl py-8 flex flex-col items-center gap-2 text-gray-500 hover:border-gray-400 transition-colors"
          >
            <CameraIcon className="w-8 h-8 text-gray-300" />
            <span className="text-sm font-medium">
              {file ? file.name : 'Tap to choose a photo or PDF'}
            </span>
            <span className="text-xs text-gray-400">PNG, JPG or PDF · max 5 MB</span>
          </button>

          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800"
          >
            {PROVIDERS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>

          <button
            type="button"
            onClick={extract}
            disabled={!file || extracting}
            className="w-full bg-slate-900 text-white rounded-lg py-3 font-medium hover:bg-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {extracting ? 'Reading the form…' : '✨ Extract form structure'}
          </button>
        </div>

        {/* Review the draft */}
        {draft && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h3 className="font-semibold text-gray-900">{draft.template_name}</h3>
            <p className="text-xs text-gray-400">
              Review before applying — check the fields match your form.
            </p>
            {draft.fields_schema.sections.map((section) => (
              <div key={section.section_id}>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-2">
                  {section.section_name}
                </p>
                <ul className="mt-1 space-y-1">
                  {section.fields.map((f) => (
                    <li key={f.field_id} className="flex items-center justify-between text-sm">
                      <span className="text-gray-800">
                        {f.field_name}
                        {f.required && <span className="text-red-500"> *</span>}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                        {f.field_type}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <button
              type="button"
              onClick={apply}
              disabled={applying || !internship}
              className="w-full bg-emerald-700 text-white rounded-lg py-3 font-medium hover:bg-emerald-600 transition-colors disabled:opacity-40"
            >
              {applying ? 'Applying…' : 'Looks right — use this format'}
            </button>
            <p className="text-[11px] text-gray-400">
              Already-approved entries keep their original format. New logs use
              this one. You can revert to the default anytime.
            </p>
          </div>
        )}
      </div>
    </InternShell>
  );
}
