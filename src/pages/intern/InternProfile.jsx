/**
 * AIntern - Intern Profile
 *
 * View/edit profile fields (profiles table), internship review settings
 * (cadence, digest mode), and AI Assistant BYOK keys (Session 3).
 *
 * @file src/pages/intern/InternProfile.jsx
 * @created July 9, 2026 - Session 2
 * @updated July 9, 2026 - Session 3: AI BYOK section
 * @updated July 12, 2026 - v11: per-BYOK-provider model picker, fetched live
 *   from that provider's own model-list API (never a hardcoded model name).
 */

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { internshipService } from '../../services/api/internshipService';
import { dailyLogService, DAILY_TEMPLATE_ID_V2 } from '../../services/api/dailyLogService';
import { aiService } from '../../services/api/aiService';
import { PLATFORM } from '../../config/platform';
import { ACCENT_CHOICES, LAYOUT_DEFAULTS } from '../../services/render/reportLayout';
import InternShell from '../../components/layout/InternShell';
import PassSection from '../../components/pass/PassSection';

const AI_PROVIDERS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic (Claude)' },
  { value: 'gemini', label: 'Google Gemini' },
];

const inputCls =
  'w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent';
const labelCls = 'block text-sm font-medium text-gray-700 mb-1';

export default function InternProfile() {
  const { user, profile, updateProfile } = useAuth();
  const toast = useToast();

  const [fields, setFields] = useState({
    full_name: '', phone: '', university: '', course: '',
  });
  const [internship, setInternship] = useState(null);
  const [saving, setSaving] = useState(false);
  const [supFields, setSupFields] = useState({ supervisor_name: '', supervisor_email: '' });
  const [supSaving, setSupSaving] = useState(false);

  // Report style prefs (v1.1 R2, spec section 18)
  const [prefs, setPrefs] = useState({});
  const [prefsSaving, setPrefsSaving] = useState(false);

  // Daily log fields (Phase A.2): per-field visibility + multi-task opt-in
  const [dailyTemplate, setDailyTemplate] = useState(null);
  const [hiddenFields, setHiddenFields] = useState([]);
  const [v2TemplateId, setV2TemplateId] = useState(null);
  const [fieldPrefsSaving, setFieldPrefsSaving] = useState(false);
  const [multiTaskSaving, setMultiTaskSaving] = useState(false);

  // AI BYOK state
  const [aiProvider, setAiProvider] = useState('openai');
  const [aiKey, setAiKey] = useState('');
  const [savedKeys, setSavedKeys] = useState([]);
  const [aiSaving, setAiSaving] = useState(false);

  // Model choice per BYOK provider (v11): options are fetched on demand from
  // that provider's own live model-list API, never hardcoded here.
  const [modelOptions, setModelOptions] = useState({}); // { [provider]: [{id,label}] }
  const [modelsLoading, setModelsLoading] = useState({}); // { [provider]: bool }

  useEffect(() => {
    if (profile) {
      setFields({
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        university: profile.university || '',
        course: profile.course || '',
      });
    }
  }, [profile]);

  // Phase A.2: reload the ACTIVE template (whichever one is currently
  // assigned) so the visibility toggle list and the multi-task switch
  // always reflect what /log is actually using right now.
  const loadDailyTemplate = async (itn) => {
    const tpl = await dailyLogService.getDailyTemplate(itn);
    if (tpl.success) setDailyTemplate(tpl.data);
  };

  useEffect(() => {
    internshipService.getMyInternship().then(({ data }) => {
      setInternship(data);
      if (data) {
        setSupFields({
          supervisor_name: data.supervisor_name || '',
          supervisor_email: data.supervisor_email || '',
        });
        setPrefs(data.metadata?.report_prefs ?? {});
        setHiddenFields(data.metadata?.field_prefs?.hidden ?? []);
        loadDailyTemplate(data);
      }
    });
    dailyLogService.getTemplateByKey(DAILY_TEMPLATE_ID_V2).then((tpl) => {
      if (tpl) setV2TemplateId(tpl.id);
    });
    aiService.listKeys().then((res) => {
      if (res.success) setSavedKeys(res.keys ?? []);
    });
  }, []);

  const toggleFieldVisibility = async (path) => {
    if (!internship) return;
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
      setHiddenFields(hiddenFields); // revert
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

  const set = (key) => (e) => setFields((f) => ({ ...f, [key]: e.target.value }));

  const saveProfile = async () => {
    setSaving(true);
    const res = await updateProfile(fields);
    setSaving(false);
    res.success ? toast.success('Profile saved') : toast.error(res.error);
  };

  const updateSetting = async (key, value) => {
    if (!internship) return;
    const res = await internshipService.updateInternship(internship.id, { [key]: value });
    if (res.success) {
      setInternship(res.data);
      toast.success('Setting updated');
    } else {
      toast.error(res.error);
    }
  };

  const saveSupervisor = async () => {
    if (!internship) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supFields.supervisor_email)) {
      toast.error('Please enter a valid supervisor email.');
      return;
    }
    setSupSaving(true);
    const res = await internshipService.updateInternship(internship.id, supFields);
    setSupSaving(false);
    if (res.success) {
      setInternship(res.data);
      toast.success('Supervisor updated — future review links go to the new address.');
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
      toast.success('Report style saved');
    } else {
      toast.error(res.error);
    }
  };

  const saveAiKey = async () => {
    setAiSaving(true);
    const res = await aiService.saveKey(aiProvider, aiKey.trim());
    setAiSaving(false);
    if (res.success) {
      setAiKey('');
      toast.success('Key saved securely');
      const list = await aiService.listKeys();
      if (list.success) setSavedKeys(list.keys ?? []);
    } else {
      toast.error(res.error);
    }
  };

  const removeAiKey = async (provider) => {
    const res = await aiService.deleteKey(provider);
    if (res.success) {
      setSavedKeys((k) => k.filter((x) => x.provider !== provider));
      setModelOptions((m) => { const n = { ...m }; delete n[provider]; return n; });
      toast.success('Key removed');
    } else {
      toast.error(res.error);
    }
  };

  // Toggle the model picker open/closed for a provider, fetching the LIVE
  // list from that provider's own API the first time (never hardcoded).
  const toggleModelPicker = async (provider) => {
    if (modelOptions[provider]) {
      setModelOptions((m) => { const n = { ...m }; delete n[provider]; return n; });
      return;
    }
    setModelsLoading((s) => ({ ...s, [provider]: true }));
    const res = await aiService.listModels(provider);
    setModelsLoading((s) => ({ ...s, [provider]: false }));
    if (res.success) {
      setModelOptions((m) => ({ ...m, [provider]: res.models ?? [] }));
    } else {
      toast.error(res.error);
    }
  };

  const chooseModel = async (provider, model) => {
    const res = await aiService.setModel(provider, model);
    if (res.success) {
      setSavedKeys((keys) => keys.map((k) => (k.provider === provider ? { ...k, model: model || null } : k)));
      toast.success(model ? 'Model saved' : 'Reverted to the default model');
    } else {
      toast.error(res.error);
    }
  };

  return (
    <InternShell title="Profile">
      <div className="p-4 space-y-6">
        {/* Account */}
        <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <h2 className="font-semibold text-gray-900">Your details</h2>
          <p className="text-xs text-gray-400">{user?.email}</p>
          <div>
            <label className={labelCls}>Full name</label>
            <input className={inputCls} value={fields.full_name} onChange={set('full_name')} />
          </div>
          <div>
            <label className={labelCls}>Phone</label>
            <input className={inputCls} value={fields.phone} onChange={set('phone')} />
          </div>
          <div>
            <label className={labelCls}>University / Institution</label>
            <input className={inputCls} value={fields.university} onChange={set('university')} />
          </div>
          <div>
            <label className={labelCls}>Course / Programme</label>
            <input className={inputCls} value={fields.course} onChange={set('course')} />
          </div>
          <button
            onClick={saveProfile}
            disabled={saving}
            className="w-full bg-slate-900 text-white rounded-lg py-2.5 font-medium disabled:bg-gray-300 hover:bg-slate-700 transition-colors"
          >
            {saving ? 'Saving…' : 'Save details'}
          </button>
        </section>

        {/* Internship pass (Phase 4 S13) */}
        <PassSection />

        {/* Review settings */}
        {internship && (
          <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h2 className="font-semibold text-gray-900">Review settings</h2>
            <div>
              <label className={labelCls}>Evaluation frequency</label>
              <div className="grid grid-cols-3 gap-2">
                {PLATFORM.evaluationCadences.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => updateSetting('evaluation_cadence_days', d)}
                    className={`rounded-lg border py-2 text-sm font-medium transition-colors ${
                      internship.evaluation_cadence_days === d
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    {d} days
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={labelCls}>Supervisor name</label>
              <input
                className={inputCls}
                value={supFields.supervisor_name}
                onChange={(e) => setSupFields((f) => ({ ...f, supervisor_name: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelCls}>Supervisor email</label>
              <input
                type="email"
                className={inputCls}
                value={supFields.supervisor_email}
                onChange={(e) => setSupFields((f) => ({ ...f, supervisor_email: e.target.value }))}
                placeholder="Review links are sent here"
              />
            </div>
            {(supFields.supervisor_name !== (internship?.supervisor_name || '') ||
              supFields.supervisor_email !== (internship?.supervisor_email || '')) && (
              <button
                type="button"
                onClick={saveSupervisor}
                disabled={supSaving}
                className="w-full bg-slate-900 text-white rounded-lg py-2.5 font-medium disabled:bg-gray-300 hover:bg-slate-700 transition-colors"
              >
                {supSaving ? 'Saving…' : 'Update supervisor'}
              </button>
            )}
            <div>
              <label className={labelCls}>Supervisor email digest</label>
              <select
                className={inputCls}
                value={internship.digest_mode}
                onChange={(e) => updateSetting('digest_mode', e.target.value)}
              >
                {PLATFORM.digestModes.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          </section>
        )}

        {/* Report style (v1.1 R2, spec section 18) */}
        {internship && (
          <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h2 className="font-semibold text-gray-900">Report style</h2>
            <p className="text-xs text-gray-500">
              Personalise your generated reports — the official record itself never changes.
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
            {prefsSaving && <p className="text-xs text-gray-400">Saving…</p>}
          </section>
        )}

        {/* Logbook format (Session 11 + Phase A.2 multi-task opt-in) */}
        <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-2">
          <h2 className="font-semibold text-gray-900">Logbook format</h2>
          <p className="text-xs text-gray-500">
            {usingCustomTemplate
              ? 'Using a custom format imported from your institution\'s form.'
              : usingMultiTask
                ? 'Using the default AIntern daily log format (multiple tasks per day).'
                : 'Using the default AIntern daily log format.'}
          </p>
          <Link
            to="/template-studio"
            className="block text-center w-full border border-slate-300 text-slate-800 rounded-lg py-2.5 font-medium hover:bg-slate-50 transition-colors"
          >
            ✨ Open Template Studio
          </Link>
          {!usingCustomTemplate && v2TemplateId && (
            <label className="flex items-start gap-2 text-sm text-gray-700 pt-2">
              <input
                type="checkbox"
                checked={usingMultiTask}
                disabled={multiTaskSaving}
                onChange={toggleMultiTask}
                className="h-4 w-4 rounded border-gray-300 mt-0.5"
              />
              <span>
                Allow multiple tasks per day (add a category + description for each task you worked on)
                <span className="block text-xs text-gray-400 mt-0.5">
                  Only applies to new logs — entries you've already approved keep showing exactly as they were.
                </span>
              </span>
            </label>
          )}
        </section>

        {/* Daily log fields (Phase A.2) */}
        {internship && dailyTemplate && (
          <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h2 className="font-semibold text-gray-900">Daily log fields</h2>
            <p className="text-xs text-gray-500">
              Choose what shows up on your daily log page. Everything is shown by default.
            </p>
            <div className="space-y-3">
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
            {fieldPrefsSaving && <p className="text-xs text-gray-400">Saving…</p>}
          </section>
        )}

        {/* AI Assistant (BYOK) */}
        <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <h2 className="font-semibold text-gray-900">AI Assistant</h2>
          <p className="text-xs text-gray-500">
            Add your own AI key for unlimited polishing (free tiers work great),
            or use the built-in AI with a monthly quota. Keys are encrypted and
            never shown again.
          </p>

          {savedKeys.length > 0 && (
            <ul className="space-y-2">
              {savedKeys.map((k) => (
                <li
                  key={k.provider}
                  className="rounded-lg border border-gray-200 px-3 py-2 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700 capitalize">
                      {k.provider} · ••••••••
                    </span>
                    <button
                      onClick={() => removeAiKey(k.provider)}
                      className="text-xs text-red-600 font-medium hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-gray-500">
                      Model: <span className="font-medium text-gray-700">{k.model || 'default'}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleModelPicker(k.provider)}
                      disabled={modelsLoading[k.provider]}
                      className="text-xs text-blue-700 font-medium underline disabled:opacity-40"
                    >
                      {modelsLoading[k.provider]
                        ? 'Checking available models…'
                        : modelOptions[k.provider] ? 'Close' : 'Change'}
                    </button>
                  </div>
                  {modelOptions[k.provider] && (
                    modelOptions[k.provider].length > 0 ? (
                      <select
                        className={inputCls}
                        value={k.model || ''}
                        onChange={(e) => chooseModel(k.provider, e.target.value)}
                      >
                        <option value="">Use the built-in default</option>
                        {modelOptions[k.provider].map((m) => (
                          <option key={m.id} value={m.id}>{m.label}</option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-xs text-gray-400">
                        No usable models reported by {k.provider} right now — keeping the built-in default.
                      </p>
                    )
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="grid grid-cols-3 gap-2">
            <select
              className={inputCls + ' col-span-1'}
              value={aiProvider}
              onChange={(e) => setAiProvider(e.target.value)}
            >
              {AI_PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            <input
              type="password"
              className={inputCls + ' col-span-2'}
              value={aiKey}
              onChange={(e) => setAiKey(e.target.value)}
              placeholder="Paste API key"
              autoComplete="off"
            />
          </div>
          <button
            onClick={saveAiKey}
            disabled={aiSaving || aiKey.trim().length < 10}
            className="w-full bg-slate-900 text-white rounded-lg py-2.5 font-medium disabled:bg-gray-300 hover:bg-slate-700 transition-colors"
          >
            {aiSaving ? 'Saving…' : 'Save key'}
          </button>
        </section>
      </div>
    </InternShell>
  );
}
