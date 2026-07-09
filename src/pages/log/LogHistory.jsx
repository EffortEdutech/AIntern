/**
 * AIntern - Log History (/history)
 *
 * Lists all local drafts newest-first with status chips. Tapping an
 * entry opens it in the Daily Log editor. Once the supervisor loop
 * lands (Phase 2), approved/rejected statuses and comments appear here.
 *
 * @file src/pages/log/LogHistory.jsx
 * @created July 9, 2026 - Session 4
 */

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import InternShell from '../../components/layout/InternShell';
import { dailyLogService } from '../../services/api/dailyLogService';
import { PencilSquareIcon } from '@heroicons/react/24/outline';

const STATUS_CHIP = {
  draft: 'bg-gray-100 text-gray-600',
  ready: 'bg-blue-100 text-blue-700',
  submitted: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
};

function summarize(data) {
  const text = data?.['tasks.task_summary'] || '';
  return text.length > 90 ? text.slice(0, 90) + '…' : text || 'No summary yet';
}

export default function LogHistory() {
  const [drafts, setDrafts] = useState(null);

  useEffect(() => {
    dailyLogService.listDrafts().then(setDrafts);
  }, []);

  return (
    <InternShell title="History">
      <div className="p-4 space-y-3">
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
              Start today's log
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {drafts.map((d) => (
              <li key={d.entry_date}>
                <Link
                  to={`/log?date=${d.entry_date}`}
                  className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">{d.entry_date}</span>
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
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </InternShell>
  );
}
