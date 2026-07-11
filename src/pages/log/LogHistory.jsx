/**
 * AIntern - Log History (/history)
 *
 * Lists all local drafts newest-first with status chips. Tapping an
 * entry opens it in the Daily Log editor. Ready logs can be submitted
 * to Supabase entry_submissions for supervisor review.
 *
 * @file src/pages/log/LogHistory.jsx
 * @created July 9, 2026 - Session 4
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import InternShell from '../../components/layout/InternShell';
import { dailyLogService } from '../../services/api/dailyLogService';
import { internshipService } from '../../services/api/internshipService';
import { submissionService } from '../../services/api/submissionService';
import { reviewService } from '../../services/api/reviewService';
import { useToast } from '../../context/ToastContext';
import { useOffline } from '../../hooks/useOffline';
import { PencilSquareIcon, ArrowUpTrayIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

const STATUS_CHIP = {
  draft: 'bg-gray-100 text-gray-600',
  ready: 'bg-blue-100 text-blue-700',
  submitted: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700'
};

function summarize(data) {
  const text = data?.['tasks.task_summary'] || '';
  return text.length > 90 ? text.slice(0, 90) + '…' : text || 'No summary yet';
}

export default function LogHistory() {
  const [drafts, setDrafts] = useState(null);
  const [internship, setInternship] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const toast = useToast();
  const { isOnline } = useOffline();

  const loadDrafts = async () => {
    setDrafts(await dailyLogService.listDrafts());
  };

  const syncStatuses = async (internshipId = internship?.id) => {
    if (!internshipId || !navigator.onLine) {
      return;
    }
    setSyncing(true);
    const result = await submissionService.syncLocalStatuses(internshipId);
    setSyncing(false);
    if (!result.success) {
      toast.error(`Status sync failed: ${result.error}`);
      return;
    }
    await loadDrafts();
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [{ data: itn }] = await Promise.all([
        internshipService.getMyInternship()
      ]);
      if (!mounted) {
        return;
      }
      setInternship(itn);
      await loadDrafts();
      if (itn && navigator.onLine) {
        await syncStatuses(itn.id);
      }
    })();
    return () => {
      mounted = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const readyDrafts = useMemo(
    () => (drafts ?? []).filter((draft) => draft.status === 'ready'),
    [drafts]
  );

  const selectedCount = selected.size;

  const toggleSelected = (entryDate) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(entryDate)) {
        next.delete(entryDate);
      } else {
        next.add(entryDate);
      }
      return next;
    });
  };

  const selectAllReady = () => {
    setSelected(new Set(readyDrafts.map((draft) => draft.entry_date)));
  };

  const clearSelected = () => {
    setSelected(new Set());
  };

  const submitSelected = async () => {
    if (!internship) {
      toast.warning('Set up your internship before submitting logs.');
      return;
    }
    if (!isOnline) {
      toast.warning('Submission needs a connection. Your ready logs are still saved here.');
      return;
    }
    const selectedDrafts = await dailyLogService.listReadyDrafts([...selected]);
    if (selectedDrafts.length === 0) {
      toast.warning('Select at least one ready log.');
      return;
    }

    setSubmitting(true);
    const result = await submissionService.submitReadyDrafts(internship.id, selectedDrafts);
    setSubmitting(false);
    await loadDrafts();
    clearSelected();

    if (result.success) {
      toast.success(`${result.submitted.length} log${result.submitted.length === 1 ? '' : 's'} submitted for supervisor review.`);
      // Honor digest mode: "Every submission" emails the supervisor now.
      if (internship.digest_mode === 'per-entry') {
        await emailSupervisor();
      }
    } else {
      toast.warning(`${result.submitted.length} submitted, ${result.failed.length} failed. Open the failed logs and try again.`);
    }
  };

  /** Instant link (no email dependency): create token, share/copy directly. */
  const copyReviewLink = async () => {
    if (!internship || !isOnline) {
      toast.warning('Creating a review link needs a connection.');
      return;
    }
    setEmailing(true);
    const res = await reviewService.requestReview(internship.id, { linkOnly: true });
    setEmailing(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    let shared = false;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'AIntern — review request', url: res.review_link });
        shared = true;
      } catch { /* user dismissed */ }
    }
    if (!shared) {
      try {
        await navigator.clipboard.writeText(res.review_link);
        toast.success('Review link copied — paste it to your supervisor (WhatsApp/email).');
      } catch {
        toast.info(`Share this link: ${res.review_link}`);
      }
    }
  };

  const emailSupervisor = async () => {
    if (!internship || !isOnline) {
      toast.warning('Emailing your supervisor needs a connection.');
      return;
    }
    setEmailing(true);
    const res = await reviewService.requestReview(internship.id);
    setEmailing(false);
    if (res.success) {
      const bits = [`${res.submissions} log${res.submissions === 1 ? '' : 's'}`];
      if (res.evaluation_included) bits.push('evaluation form');
      if (res.email_sent === false && res.review_link) {
        // Email not configured — share the secure link directly (WhatsApp etc.)
        let shared = false;
        if (navigator.share) {
          try {
            await navigator.share({
              title: 'AIntern — review request',
              text: `Please review my internship logs (${bits.join(' + ')}):`,
              url: res.review_link,
            });
            shared = true;
          } catch { /* user dismissed the share sheet */ }
        }
        if (!shared) {
          try {
            await navigator.clipboard.writeText(res.review_link);
            toast.success('Review link copied — paste it to your supervisor on WhatsApp or email.');
          } catch {
            toast.info(`Share this link with your supervisor: ${res.review_link}`);
          }
        }
      } else {
        toast.success(`Review link (${bits.join(' + ')}) emailed to ${res.emailed_to}.`);
      }
    } else {
      toast.error(res.error);
    }
  };

  const withdrawDraft = async (draft) => {
    if (!internship) {
      return;
    }
    if (!isOnline) {
      toast.warning('Withdrawing a submitted log needs a connection.');
      return;
    }
    const result = await submissionService.withdrawPending(internship.id, draft);
    if (!result.success) {
      toast.error(`Withdraw failed: ${result.error}`);
      return;
    }
    toast.success('Submission withdrawn. The log is ready again.');
    await loadDrafts();
  };

  return (
    <InternShell title="History">
      <div className="p-4 space-y-3">
        {drafts !== null && drafts.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-gray-900">Submit for review</h2>
                <p className="text-sm text-gray-500">
                  Select ready logs and send them to your supervisor queue.
                </p>
              </div>
              <button
                type="button"
                onClick={() => syncStatuses()}
                disabled={!isOnline || syncing || !internship}
                className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Sync review status"
              >
                <ArrowPathIcon className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>{readyDrafts.length} ready</span>
              <div className="flex gap-3">
                <button type="button" onClick={selectAllReady} disabled={readyDrafts.length === 0} className="font-medium text-slate-700 disabled:text-gray-300">
                  Select ready
                </button>
                <button type="button" onClick={clearSelected} disabled={selectedCount === 0} className="font-medium text-slate-700 disabled:text-gray-300">
                  Clear
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={submitSelected}
              disabled={submitting || selectedCount === 0 || !isOnline || !internship}
              className="w-full inline-flex items-center justify-center gap-2 bg-slate-900 text-white rounded-lg py-3 font-medium hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowUpTrayIcon className="w-5 h-5" />
              {submitting ? 'Submitting...' : `Submit ${selectedCount || ''} selected`.trim()}
            </button>

            {(drafts ?? []).some((d) => d.status === 'submitted') && (
              <button
                type="button"
                onClick={emailSupervisor}
                disabled={emailing || !isOnline || !internship}
                className="w-full rounded-lg border border-slate-300 text-slate-800 py-2.5 font-medium hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {emailing ? 'Sending…' : '✉️ Email my supervisor a review link'}
              </button>
            )}

            {(drafts ?? []).some((d) => d.status === 'submitted') && (
              <button
                type="button"
                onClick={copyReviewLink}
                disabled={emailing || !isOnline || !internship}
                className="w-full rounded-lg border border-slate-300 text-slate-800 py-2.5 font-medium hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                🔗 Copy review link (no email)
              </button>
            )}

            {!isOnline && (
              <p className="text-xs text-amber-700">
                You are offline. Ready logs stay on this device until you submit them.
              </p>
            )}
          </div>
        )}

        {drafts === null ? (
          <div className="flex justify-center pt-16">
            <div className="w-8 h-8 border-4 border-slate-800 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : drafts.length === 0 ? (
          <div className="flex flex-col items-center pt-20 text-center space-y-3 px-6">
            <PencilSquareIcon className="w-10 h-10 text-gray-300" />
            <p className="font-medium text-gray-700">No logs yet</p>
            <p className="text-sm text-gray-500">
              Your daily logs will appear here, saved safely on this device.
            </p>
            <Link
              to="/log"
              className="mt-2 bg-slate-900 text-white rounded-lg px-6 py-2.5 font-medium hover:bg-slate-700 transition-colors"
            >
              Start today
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {drafts.map((d) => (
              <li key={d.entry_date}>
                <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {d.status === 'ready' && (
                        <input
                          type="checkbox"
                          checked={selected.has(d.entry_date)}
                          onChange={() => toggleSelected(d.entry_date)}
                          aria-label={`Select ${d.entry_date} for submission`}
                          className="h-4 w-4 rounded border-gray-300 text-slate-900 focus:ring-slate-900"
                        />
                      )}
                      <Link to={`/log?date=${d.entry_date}`} className="font-medium text-gray-900 hover:text-slate-700">
                        {d.entry_date}
                      </Link>
                    </div>
                    <span className="flex items-center gap-1">
                      {d.late && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-orange-100 text-orange-700">
                          late
                        </span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_CHIP[d.status] ?? STATUS_CHIP.draft}`}>
                        {d.status}
                      </span>
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{summarize(d.data)}</p>
                  {d.supervisor_comment && (
                    <p className="text-xs rounded-lg bg-red-50 border border-red-100 text-red-700 px-3 py-2">
                      Supervisor comment: {d.supervisor_comment}
                    </p>
                  )}
                  {d.status === 'submitted' && (
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>Submitted {d.submitted_at ? new Date(d.submitted_at).toLocaleString() : ''}</span>
                      <button
                        type="button"
                        onClick={() => withdrawDraft(d)}
                        disabled={!isOnline}
                        className="font-medium text-slate-700 disabled:text-gray-300"
                      >
                        Withdraw
                      </button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </InternShell>
  );
}
