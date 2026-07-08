/**
 * AIntern - Onboarding Wizard
 *
 * Four steps: You → Internship → Supervisor → Review cadence.
 * Writes profiles (step 1) and internships (final submit).
 *
 * @file src/pages/onboarding/Onboarding.jsx
 * @created July 9, 2026 - Session 2
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { internshipService } from '../../services/api/internshipService';
import { PLATFORM } from '../../config/platform';
import { useToast } from '../../context/ToastContext';

const STEPS = ['You', 'Internship', 'Supervisor', 'Reviews'];

const inputCls =
  'w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent';
const labelCls = 'block text-sm font-medium text-gray-700 mb-1';

export default function Onboarding() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    // Step 1 — profile
    full_name: profile?.full_name || '',
    phone: profile?.phone || '',
    university: profile?.university || '',
    course: profile?.course || '',
    // Step 2 — internship
    company_name: '',
    department: '',
    start_date: '',
    end_date: '',
    // Step 3 — supervisor
    supervisor_name: '',
    supervisor_email: '',
    // Step 4 — review settings
    evaluation_cadence_days: 7,
    digest_mode: 'daily',
  });

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const stepValid = () => {
    switch (step) {
      case 0: return form.full_name.trim().length > 1;
      case 1: return form.company_name.trim() && form.start_date && form.end_date
        && form.end_date >= form.start_date;
      case 2: return form.supervisor_name.trim()
        && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.supervisor_email);
      case 3: return true;
      default: return false;
    }
  };

  const next = async () => {
    if (step === 0) {
      // Persist profile as soon as step 1 completes
      const res = await internshipService.saveProfile({
        full_name: form.full_name,
        phone: form.phone || null,
        university: form.university || null,
        course: form.course || null,
      });
      if (!res.success) {
        toast.error('Could not save your profile: ' + res.error);
        return;
      }
    }
    setStep((s) => s + 1);
  };

  const submit = async () => {
    setSaving(true);
    const res = await internshipService.createInternship({
      company_name: form.company_name,
      department: form.department,
      supervisor_name: form.supervisor_name,
      supervisor_email: form.supervisor_email,
      start_date: form.start_date,
      end_date: form.end_date,
      evaluation_cadence_days: Number(form.evaluation_cadence_days),
      digest_mode: form.digest_mode,
    });
    setSaving(false);

    if (res.success) {
      toast.success('Internship set up. Welcome to AIntern!');
      navigate('/', { replace: true });
    } else {
      toast.error('Could not create internship: ' + res.error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto flex flex-col">
      {/* Progress header */}
      <header className="bg-slate-900 text-white px-4 py-4">
        <h1 className="font-semibold">Set up your internship</h1>
        <div className="flex gap-1.5 mt-3">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-white' : 'bg-slate-600'}`}
            />
          ))}
        </div>
        <p className="text-xs text-slate-300 mt-2">
          Step {step + 1} of {STEPS.length}: {STEPS[step]}
        </p>
      </header>

      <main className="flex-1 p-4 space-y-4">
        {step === 0 && (
          <>
            <div>
              <label className={labelCls}>Full name *</label>
              <input className={inputCls} value={form.full_name} onChange={set('full_name')} placeholder="As it should appear on your logbook" />
            </div>
            <div>
              <label className={labelCls}>Phone</label>
              <input className={inputCls} value={form.phone} onChange={set('phone')} placeholder="+60…" />
            </div>
            <div>
              <label className={labelCls}>University / Institution</label>
              <input className={inputCls} value={form.university} onChange={set('university')} placeholder="e.g. UiTM" />
            </div>
            <div>
              <label className={labelCls}>Course / Programme</label>
              <input className={inputCls} value={form.course} onChange={set('course')} placeholder="e.g. Diploma in Electrical Engineering" />
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <div>
              <label className={labelCls}>Company name *</label>
              <input className={inputCls} value={form.company_name} onChange={set('company_name')} />
            </div>
            <div>
              <label className={labelCls}>Department / Unit</label>
              <input className={inputCls} value={form.department} onChange={set('department')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Start date *</label>
                <input type="date" className={inputCls} value={form.start_date} onChange={set('start_date')} />
              </div>
              <div>
                <label className={labelCls}>End date *</label>
                <input type="date" className={inputCls} value={form.end_date} onChange={set('end_date')} />
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div>
              <label className={labelCls}>Supervisor name *</label>
              <input className={inputCls} value={form.supervisor_name} onChange={set('supervisor_name')} />
            </div>
            <div>
              <label className={labelCls}>Supervisor email *</label>
              <input type="email" className={inputCls} value={form.supervisor_email} onChange={set('supervisor_email')} placeholder="They'll receive review links here" />
            </div>
            <p className="text-xs text-gray-500">
              Your supervisor doesn't need an account — they review and sign
              your logs through secure email links.
            </p>
          </>
        )}

        {step === 3 && (
          <>
            <div>
              <label className={labelCls}>Evaluation frequency</label>
              <div className="grid grid-cols-3 gap-2">
                {PLATFORM.evaluationCadences.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, evaluation_cadence_days: d }))}
                    className={`rounded-lg border py-2.5 text-sm font-medium transition-colors ${
                      Number(form.evaluation_cadence_days) === d
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
              <label className={labelCls}>Supervisor email digest</label>
              <select className={inputCls} value={form.digest_mode} onChange={set('digest_mode')}>
                {PLATFORM.digestModes.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                How often your supervisor gets review emails. "Daily digest" is
                the friendly default.
              </p>
            </div>
          </>
        )}
      </main>

      {/* Footer actions */}
      <footer className="p-4 flex gap-3">
        {step > 0 && (
          <button
            onClick={() => setStep((s) => s - 1)}
            className="flex-1 rounded-lg border border-gray-300 py-3 font-medium text-gray-700 hover:bg-gray-100 transition-colors"
          >
            Back
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button
            onClick={next}
            disabled={!stepValid()}
            className="flex-1 rounded-lg bg-slate-900 text-white py-3 font-medium disabled:bg-gray-300 hover:bg-slate-700 transition-colors"
          >
            Continue
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={saving}
            className="flex-1 rounded-lg bg-slate-900 text-white py-3 font-medium disabled:bg-gray-300 hover:bg-slate-700 transition-colors"
          >
            {saving ? 'Setting up…' : 'Finish setup'}
          </button>
        )}
      </footer>
    </div>
  );
}
