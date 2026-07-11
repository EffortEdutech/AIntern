/**
 * AIntern - Public Verification Page (/verify?id=AIN-XXXX-XXXX) — v1.1 R3
 *
 * Spec §27: the QR code in exported reports links here. Anyone
 * (university admin, employer) can confirm a document was generated
 * from an officially verified internship record. Discloses ONLY the
 * public-safe fields returned by the verify_report RPC — never content.
 *
 * @file src/pages/verify/VerifyPage.jsx
 * @created July 11, 2026 - v1.1 R3
 */

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../services/supabase/client';
import { ShieldCheckIcon, ShieldExclamationIcon } from '@heroicons/react/24/outline';

export default function VerifyPage() {
  const [params] = useSearchParams();
  const [id, setId] = useState(params.get('id') ?? '');
  const [state, setState] = useState('idle'); // idle | loading | found | notfound
  const [result, setResult] = useState(null);

  const lookup = async (vid) => {
    const clean = String(vid ?? '').trim();
    if (clean.length < 8) return;
    setState('loading');
    const { data, error } = await supabase.rpc('verify_report', { p_verification_id: clean });
    if (!error && data) {
      setResult(data);
      setState('found');
    } else {
      setResult(null);
      setState('notfound');
    }
  };

  useEffect(() => {
    if (params.get('id')) lookup(params.get('id'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto p-6 space-y-4">
        <header className="text-center pt-6">
          <h1 className="text-xl font-bold text-gray-900">AIntern Verification</h1>
          <p className="text-sm text-gray-500 mt-1">
            Confirm that an internship report was generated from an officially
            verified record.
          </p>
        </header>

        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
          <label className="block text-sm font-medium text-gray-700">Verification ID</label>
          <div className="flex gap-2">
            <input
              value={id}
              onChange={(e) => setId(e.target.value.toUpperCase())}
              placeholder="AIN-XXXX-XXXX"
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-800"
            />
            <button
              type="button"
              onClick={() => lookup(id)}
              disabled={state === 'loading' || id.trim().length < 8}
              className="bg-slate-900 text-white rounded-lg px-4 font-medium hover:bg-slate-700 disabled:opacity-40"
            >
              {state === 'loading' ? '…' : 'Verify'}
            </button>
          </div>
        </div>

        {state === 'found' && result && (
          <div className="bg-white rounded-xl border-2 border-emerald-300 p-5 space-y-3">
            <div className="flex items-center gap-2 text-emerald-700">
              <ShieldCheckIcon className="w-7 h-7" />
              <div>
                <p className="font-bold">Verified internship record</p>
                <p className="text-xs font-mono">{result.verification_id}</p>
              </div>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {[
                  ['Intern', result.intern_name],
                  ['Institution', result.university],
                  ['Company', result.company],
                  ['Internship period', `${result.period_start} to ${result.period_end}`],
                  ['Report', `${result.report_type} — version ${result.version}`],
                  ['Verified on', String(result.verified_at).slice(0, 10)],
                  ['Approved entries', result.approved_entries],
                  ['Supervisor evaluations', result.evaluations],
                ].filter(([, v]) => v !== null && v !== undefined && v !== '').map(([k, v]) => (
                  <tr key={k} className="border-b border-gray-100 last:border-0">
                    <td className="py-1.5 pr-3 text-gray-500">{k}</td>
                    <td className="py-1.5 font-medium text-gray-900">{String(v)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[11px] text-gray-400">
              Record fingerprint: <span className="font-mono">{String(result.content_hash).slice(0, 24)}…</span>
              <br />
              Every entry in this record was individually approved and digitally
              signed by the workplace supervisor. Report content remains private
              to the intern.
            </p>
          </div>
        )}

        {state === 'notfound' && (
          <div className="bg-white rounded-xl border-2 border-red-200 p-5 flex items-start gap-2">
            <ShieldExclamationIcon className="w-6 h-6 text-red-600 shrink-0" />
            <div>
              <p className="font-semibold text-red-700">No verified record found</p>
              <p className="text-sm text-gray-500 mt-1">
                This ID doesn't match any verified internship record. Check the
                ID for typos — or treat the document with caution.
              </p>
            </div>
          </div>
        )}

        <p className="text-center text-[11px] text-gray-400 pt-2">
          Powered by AIntern — tamper-evident internship records
        </p>
      </div>
    </div>
  );
}
