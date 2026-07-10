/**
 * AIntern - Daily Log Page (/log, /log?date=YYYY-MM-DD)
 *
 * Renders the Daily Task Sheet via the template engine. Offline-first:
 * template served from Dexie cache when offline, drafts autosaved to
 * Dexie on every change. "Save" marks the draft ready; History handles
 * supervisor submission batching.
 *
 * AI polish: wraps DynamicForm in AiPolishProvider → every textarea
 * gets the ✨ Polish button (BYOK or bundled via ai-gateway).
 *
 * @file src/pages/log/DailyLogPage.jsx
 * @created July 9, 2026 - Session 4
 */

import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import InternShell from '../../components/layout/InternShell';
import DynamicForm from '../../components/templates/DynamicForm';
import { AiPolishProvider } from '../../context/AiPolishContext';
import { dailyLogService } from '../../services/api/dailyLogService';
import { internshipService } from '../../services/api/internshipService';
import { aiService } from '../../services/api/aiService';
import { useToast } from '../../context/ToastContext';
import { useOffline } from '../../hooks/useOffline';

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function shiftDate(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

const STATUS_LABEL = {
  draft: { text: 'Draft — saved on this device', cls: 'bg-gray-100 text-gray-600' },
  ready: { text: 'Ready to submit', cls: 'bg-blue-100 text-blue-700' },
  submitted: { text: 'Awaiting review', cls: 'bg-amber-100 text-amber-700' },
  approved: { text: 'Approved', cls: 'bg-emerald-100 text-emerald-700' },
  rejected: { text: 'Needs revision', cls: 'bg-red-100 text-red-700' }
};

export default function DailyLogPage() {
  const [params] = useSearchParams();
  const entryDate = params.get('date') || todayStr();
  const navigate = useNavigate();
  const toast = useToast();
  const { isOnline } = useOffline();

  const [template, setTemplate] = useState(null);
  const [fromCache, setFromCache] = useState(false);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [internship, setInternship] = useState(null);
  const [savedAt, setSavedAt] = useState(null);
  const autosaveTimer = useRef(null);

  // ── Load template + draft + internship ──────────────────────────────
  useEffect(() => {
    let mounted = true;
    (async () => {
      const [existing, { data: itn }] = await Promise.all([
        dailyLogService.getDraft(entryDate),
        internshipService.getMyInternship()
      ]);
      // Session 11: template choice depends on the internship (custom format)
      const tpl = await dailyLogService.getDailyTemplate(itn);
      if (!mounted) {
        return;
      }
      if (tpl.success) {
        setTemplate(tpl.data);
        setFromCache(tpl.fromCache);
      } else {
        setLoadError(tpl.error);
      }
      setDraft(existing);
      setInternship(itn);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [entryDate]);

  const deadlineTime = internship?.metadata?.deadline_time || '23:59';

  // ── Autosave (debounced 800ms) ──────────────────────────────────────
  const handleChange = (formData) => {
    clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(async () => {
      const status = draft?.status && draft.status !== 'draft' ? draft.status : 'draft';
      const rec = await dailyLogService.saveDraft(entryDate, formData, status, deadlineTime);
      setDraft(rec);
      setSavedAt(new Date());
    }, 800);
  };

  // ── Explicit save (marks ready) ─────────────────────────────────────
  const handleSubmit = async (formData) => {
    clearTimeout(autosaveTimer.current);
    await dailyLogService.saveDraft(entryDate, formData, 'ready', deadlineTime);
    toast.success('Saved as ready. Submit it from History when you are online.');
    navigate('/history');
  };

  // ── AI polish bridge ────────────────────────────────────────────────
  const polish = async (text) => {
    if (!navigator.onLine) {
      return { success: false, error: 'AI polish needs a connection — your text is safe, try again when online.' };
    }
    return aiService.polish(text, {
      industry: internship?.department || internship?.company_name || ''
    });
  };

  const status = draft?.status || 'draft';
  const badge = STATUS_LABEL[status] ?? STATUS_LABEL.draft;
  const readOnly = ['submitted', 'approved'].includes(status);

  return (
    <InternShell title="Daily Log">
      <div className="p-4 space-y-3">
        {/* Header row with date navigation (Session 5) */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Previous day"
              onClick={() => navigate(`/log?date=${shiftDate(entryDate, -1)}`)}
              className="p-1.5 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50"
            >
              ‹
            </button>
            <div className="text-center">
              <h2 className="font-semibold text-gray-900">
                {entryDate === todayStr() ? "Today's log" : entryDate}
              </h2>
              <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium mt-1 ${badge.cls}`}>
                {badge.text}
              </span>
              {draft?.late && (
                <span className="inline-block text-xs px-2 py-0.5 rounded-full font-medium mt-1 ml-1 bg-orange-100 text-orange-700">
                  Late
                </span>
              )}
            </div>
            <button
              type="button"
              aria-label="Next day"
              disabled={entryDate >= todayStr()}
              onClick={() => navigate(`/log?date=${shiftDate(entryDate, 1)}`)}
              className="p-1.5 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ›
            </button>
          </div>
          {savedAt && (
            <span className="text-xs text-gray-400">
              Autosaved {savedAt.toLocaleTimeString()}
            </span>
          )}
        </div>

        {!isOnline && (
          <p className="text-xs rounded-lg bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2">
            You are offline — everything you type is saved on this device.
            {fromCache && ' (Form loaded from offline cache.)'}
          </p>
        )}

        {loading ? (
          <div className="flex justify-center pt-16">
            <div className="w-8 h-8 border-4 border-slate-800 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : loadError ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">
            {loadError}
          </div>
        ) : readOnly ? (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-600">
            This log is {status === 'submitted' ? 'awaiting supervisor review' : status} and can no longer be edited here.
            {draft?.supervisor_comment && (
              <p className="mt-2 text-gray-700">
                Supervisor comment: {draft.supervisor_comment}
              </p>
            )}
          </div>
        ) : (
          <AiPolishProvider polish={polish}>
            <DynamicForm
              template={template}
              initialData={draft?.data ?? {}}
              onChange={handleChange}
              onSubmit={handleSubmit}
              submitLabel="Save as ready"
              showCancel={false}
            />
          </AiPolishProvider>
        )}
      </div>
    </InternShell>
  );
}
