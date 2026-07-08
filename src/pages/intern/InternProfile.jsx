/**
 * AIntern - Intern Profile
 *
 * View/edit profile fields (profiles table) and internship review
 * settings (cadence, digest mode). Replaces WorkLedger's ProfilePage,
 * which depended on organization membership.
 *
 * @file src/pages/intern/InternProfile.jsx
 * @created July 9, 2026 - Session 2
 */

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { internshipService } from '../../services/api/internshipService';
import { PLATFORM } from '../../config/platform';
import InternShell from '../../components/layout/InternShell';

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
    internshipService.getMyInternship().then(({ data }) => setInternship(data));
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
      </div>
    </InternShell>
  );
}
