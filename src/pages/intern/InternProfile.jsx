/**
 * AIntern - Intern Profile
 *
 * View/edit profile fields (profiles table), internship review settings
 * (cadence, digest mode), and AI Assistant BYOK keys (Session 3).
 *
 * @file src/pages/intern/InternProfile.jsx
 * @created July 9, 2026 - Session 2
 * @updated July 9, 2026 - Session 3: AI BYOK section
 */

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { internshipService } from '../../services/api/internshipService';
import { aiService } from '../../services/api/aiService';
import { PLATFORM } from '../../config/platform';
import InternShell from '../../components/layout/InternShell';

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

  // AI BYOK state
  const [aiProvider, setAiProvider] = useState('openai');
  const [aiKey, setAiKey] = useState('');
  const [savedKeys, setSavedKeys] = useState([]);
  const [aiSaving, setAiSaving] = useState(false);

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

  useEffect(() => {
    internshipService.getMyInternship().then(({ data }) => {
      setInternship(data);
      if (data) {
        setSupFields({
          supervisor_name: data.supervisor_name || '',
          supervisor_email: data.supervisor_email || '',
        });
      }
    });
    aiService.listKeys().then((res) => {
      if (res.success) setSavedKeys(res.keys ?? []);
    });
  }, []);

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
      toast.success('Key removed');
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

        {/* Logbook format (Session 11) */}
        <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-2">
          <h2 className="font-semibold text-gray-900">Logbook format</h2>
          <p className="text-xs text-gray-500">
            {internship?.daily_template_id
              ? 'Using a custom format imported from your institution\'s form.'
              : 'Using the default AIntern daily log format.'}
          </p>
          <Link
            to="/template-studio"
            className="block text-center w-full border border-slate-300 text-slate-800 rounded-lg py-2.5 font-medium hover:bg-slate-50 transition-colors"
          >
            ✨ Open Template Studio
          </Link>
        </section>

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
                  className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2"
                >
                  <span className="text-sm text-gray-700 capitalize">
                    {k.provider} · ••••••••
                  </span>
                  <button
                    onClick={() => removeAiKey(k.provider)}
                    className="text-xs text-red-600 font-medium hover:text-red-700"
                  >
                    Remove
                  </button>
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
