/**
 * AIntern - Supervisor Review Page (/review?token=...)
 *
 * PUBLIC, token-gated. Supervisors open this from their email — no
 * account, no login. Renders the intern's submitted logs for
 * approve/reject with comments, plus the periodic evaluation rubric
 * when it's due, and captures the supervisor's on-screen signature.
 *
 * All data access and writes go through the supervisor-review Edge
 * Function; this page never talks to tables directly.
 *
 * @file src/pages/review/SupervisorReview.jsx
 * @created July 10, 2026 - Sessions 7-9
 */

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../services/supabase/client';

const FN = 'supervisor-review';

async function callFn(body) {
  try {
    const { data, error } = await supabase.functions.invoke(FN, { body });
    if (error) {
      let message = error.message;
      try {
        const ctx = await error.context?.json?.();
        if (ctx?.error) message = ctx.error;
      } catch { /* keep original */ }
      return { success: false, error: message };
    }
    return data;
  } catch (err) {
    return { success: false, error: err.message };
  }
}

const RUBRIC = [
  ['communication', 'Communication'],
  ['punctuality', 'Punctuality & discipline'],
  ['problem_solving', 'Problem-solving'],
  ['quality', 'Quality of work'],
  ['initiative', 'Initiative'],
  ['teamwork', 'Teamwork'],
  ['professionalism', 'Professionalism'],
];

/** Minimal signature pad — standalone, no attachment-service coupling. */
function SignaturePad({ onChange }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);

  const pos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const point = e.touches ? e.touches[0] : e;
    return { x: point.clientX - rect.left, y: point.clientY - rect.top };
  };

  const start = (e) => {
    e.preventDefault();
    drawing.current = true;
    const ctx = canvasRef.current.getContext('2d');
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0f172a';
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (empty) setEmpty(false);
    onChange(canvasRef.current.toDataURL('image/png'));
  };

  const end = () => { drawing.current = false; };

  const clear = () => {
    const canvas = canvasRef.current;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    setEmpty(true);
    onChange(null);
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={440}
        height={140}
        className="w-full bg-white border border-gray-300 rounded-lg touch-none"
        onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
        onTouchStart={start} onTouchMove={move} onTouchEnd={end}
      />
      <div className="flex justify-between items-center mt-1">
        <span className="text-xs text-gray-400">{empty ? 'Sign above with your finger or mouse' : 'Signature captured'}</span>
        <button type="button" onClick={clear} className="text-xs font-medium text-gray-500 hover:text-gray-700">Clear</button>
      </div>
    </div>
  );
}

/** Render one submission's data using template labels. */
function EntryContent({ data, template }) {
  const sections = template?.fields_schema?.sections ?? [];
  return (
    <div className="space-y-2">
      {sections.map((section) => {
        const rows = (section.fields ?? [])
          .map((f) => ({ label: f.field_name, value: data?.[`${section.section_id}.${f.field_id}`] }))
          .filter((r) => r.value !== undefined && r.value !== null && String(r.value).trim() !== '');
        if (rows.length === 0) return null;
        return (
          <div key={section.section_id}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{section.section_name}</p>
            {rows.map((r) => (
              <p key={r.label} className="text-sm text-gray-800 mt-0.5">
                <span className="text-gray-500">{r.label}:</span> {String(r.value)}
              </p>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export default function SupervisorReview() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';

  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [decisions, setDecisions] = useState({});   // id → { decision, comment }
  const [scores, setScores] = useState({});
  const [kpiScores, setKpiScores] = useState({});
  const [comments, setComments] = useState({ strengths: '', improvements: '' });
  const [signature, setSignature] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await callFn({ action: 'get_review', token });
      if (res.success) setReview(res);
      else setLoadError(res.error);
      setLoading(false);
    })();
  }, [token]);

  const setDecision = (id, decision) =>
    setDecisions((d) => ({ ...d, [id]: { ...d[id], decision } }));
  const setComment = (id, comment) =>
    setDecisions((d) => ({ ...d, [id]: { ...d[id], comment } }));

  const pendingSubs = (review?.submissions ?? []).filter((s) => s.status === 'pending');
  const allDecided = pendingSubs.every((s) => decisions[s.id]?.decision);
  const rejectionsCommented = pendingSubs.every(
    (s) => decisions[s.id]?.decision !== 'reject' || (decisions[s.id]?.comment ?? '').trim(),
  );
  const evalComplete = !review?.evaluation ||
    RUBRIC.every(([key]) => scores[key]) ;
  const canSubmit = allDecided && rejectionsCommented && evalComplete && signature && !submitting;

  const submit = async () => {
    setSubmitting(true);
    let ok = true;

    if (pendingSubs.length > 0) {
      const res = await callFn({
        action: 'decide',
        token,
        signature,
        decisions: pendingSubs.map((s) => ({
          id: s.id,
          decision: decisions[s.id].decision,
          comment: decisions[s.id].comment ?? '',
        })),
      });
      ok = res.success;
      if (!ok) setLoadError(res.error || 'Some decisions failed — reopen the link to retry.');
    }

    if (ok && review?.evaluation) {
      const res = await callFn({
        action: 'submit_evaluation',
        token,
        signature,
        scores,
        custom_kpis: (review.custom_kpis ?? []).map((name) => ({ name, score: kpiScores[name] ?? null })),
        comments,
      });
      ok = res.success;
      if (!ok) setLoadError(res.error);
    }

    setSubmitting(false);
    if (ok) setDone(true);
  };

  // ── Render states ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-800 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (loadError && !review) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-2">
          <h1 className="text-lg font-semibold text-gray-900">Link unavailable</h1>
          <p className="text-sm text-gray-500">{loadError}</p>
          <p className="text-xs text-gray-400">Ask your intern to send a new review request.</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-2">
          <div className="text-4xl">✅</div>
          <h1 className="text-lg font-semibold text-gray-900">Review recorded</h1>
          <p className="text-sm text-gray-500">
            Thank you — your decisions and signature have been saved to {review.intern_name}'s internship record. You can close this page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto pb-16">
        <header className="bg-slate-900 text-white px-4 py-4">
          <h1 className="font-semibold">AIntern — Supervisor review</h1>
          <p className="text-sm text-slate-300 mt-0.5">
            {review.intern_name} · {review.internship?.company_name}
            {review.internship?.department ? ` · ${review.internship.department}` : ''}
          </p>
        </header>

        <main className="p-4 space-y-4">
          {loadError && (
            <p className="text-sm bg-red-50 border border-red-200 text-red-800 rounded-lg px-3 py-2">{loadError}</p>
          )}

          {/* ── Daily logs ── */}
          {pendingSubs.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-semibold text-gray-900">
                Daily logs ({pendingSubs.length})
              </h2>
              {pendingSubs.map((sub) => {
                const d = decisions[sub.id] ?? {};
                return (
                  <div key={sub.id} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                    <p className="font-medium text-gray-900">{sub.entry_date}</p>
                    <EntryContent data={sub.data} template={review.template} />
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setDecision(sub.id, 'approve')}
                        className={`rounded-lg border py-2 text-sm font-medium transition-colors ${
                          d.decision === 'approve'
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50'
                        }`}
                      >
                        ✓ Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => setDecision(sub.id, 'reject')}
                        className={`rounded-lg border py-2 text-sm font-medium transition-colors ${
                          d.decision === 'reject'
                            ? 'bg-red-600 text-white border-red-600'
                            : 'bg-white text-red-700 border-red-300 hover:bg-red-50'
                        }`}
                      >
                        ✗ Needs revision
                      </button>
                    </div>
                    {d.decision === 'reject' && (
                      <textarea
                        value={d.comment ?? ''}
                        onChange={(e) => setComment(sub.id, e.target.value)}
                        placeholder="What should the intern revise? (required)"
                        rows={2}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800"
                      />
                    )}
                  </div>
                );
              })}
            </section>
          )}

          {/* ── Evaluation ── */}
          {review.evaluation && (
            <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
              <div>
                <h2 className="font-semibold text-gray-900">
                  {review.evaluation.cadence_days}-day evaluation
                </h2>
                <p className="text-xs text-gray-400">
                  Period {review.evaluation.period_start} → {review.evaluation.period_end}
                </p>
              </div>

              {RUBRIC.map(([key, label]) => (
                <div key={key}>
                  <p className="text-sm font-medium text-gray-700 mb-1">{label}</p>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setScores((s) => ({ ...s, [key]: n }))}
                        className={`rounded-lg border py-1.5 text-sm font-medium transition-colors ${
                          scores[key] === n
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              {(review.custom_kpis ?? []).map((name) => (
                <div key={name}>
                  <p className="text-sm font-medium text-gray-700 mb-1">{name} <span className="text-gray-400">(custom)</span></p>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setKpiScores((s) => ({ ...s, [name]: n }))}
                        className={`rounded-lg border py-1.5 text-sm font-medium transition-colors ${
                          kpiScores[name] === n
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Strengths</p>
                <textarea
                  value={comments.strengths}
                  onChange={(e) => setComments((c) => ({ ...c, strengths: e.target.value }))}
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800"
                />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Areas for improvement</p>
                <textarea
                  value={comments.improvements}
                  onChange={(e) => setComments((c) => ({ ...c, improvements: e.target.value }))}
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800"
                />
              </div>
            </section>
          )}

          {/* ── Signature + submit ── */}
          <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <h2 className="font-semibold text-gray-900">Your signature</h2>
            <SignaturePad onChange={setSignature} />
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              className="w-full bg-slate-900 text-white rounded-lg py-3 font-medium hover:bg-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? 'Recording…' : 'Submit review'}
            </button>
            {!canSubmit && !submitting && (
              <p className="text-xs text-gray-400">
                {!allDecided
                  ? 'Decide on every log to continue.'
                  : !rejectionsCommented
                    ? 'Add a comment to each log marked "Needs revision".'
                    : !evalComplete
                      ? 'Complete all evaluation ratings.'
                      : 'Sign above to enable submission.'}
              </p>
            )}
            <p className="text-[11px] text-gray-400">
              Your decisions, signature, timestamp, and network address are recorded
              as part of the internship's audit trail.
            </p>
          </section>
        </main>
      </div>
    </div>
  );
}
