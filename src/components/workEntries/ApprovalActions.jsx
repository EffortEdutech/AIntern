/**
 * WorkLedger - Approval Actions Component
 *
 * Renders Approve + Reject action buttons for managers/admins
 * when viewing a SUBMITTED work entry.
 *
 * VISIBILITY RULES:
 *   - Only shown when entry.status === 'submitted'
 *   - Only shown when can('APPROVE_WORK_ENTRY')
 *   - Uses PermissionGuard as outer wrapper in WorkEntryDetail
 *
 * UX FLOW:
 *   Approve clicked →
 *     Modal opens with optional remarks textarea
 *     Manager clicks "Confirm Approve"
 *     onApproved() callback fires → parent reloads entry
 *
 *   Reject clicked →
 *     Modal opens with REQUIRED reason textarea
 *     Inline validation if reason empty
 *     Manager clicks "Confirm Reject"
 *     onRejected() callback fires → parent reloads entry
 *
 * USAGE:
 *   <ApprovalActions
 *     entry={workEntry}
 *     onApproved={() => loadWorkEntry()}
 *     onRejected={() => loadWorkEntry()}
 *   />
 *
 * @module components/workEntries/ApprovalActions
 * @created February 27, 2026 - Session 16
 */

import React, { useState } from 'react';
import { workEntryService } from '../../services/api/workEntryService';
import {
  CheckCircleIcon,
  XCircleIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

// ─────────────────────────────────────────────────────────────────────────────
// Inline Modal (no separate component file needed)
// ─────────────────────────────────────────────────────────────────────────────

function ConfirmModal({ isOpen, onClose, children }) {
  if (!isOpen) {
    return null;
  }

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => {
        // Close on backdrop click
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      {/* Modal panel */}
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {children}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {Object}   props
 * @param {Object}   props.entry       - Full work entry object
 * @param {Function} props.onApproved  - Called after successful approval
 * @param {Function} props.onRejected  - Called after successful rejection
 */
export default function ApprovalActions({ entry, onApproved, onRejected }) {
  // ── Modal state ───────────────────────────────────────────────────────────
  const [modalMode, setModalMode]     = useState(null);   // 'approve' | 'reject' | null
  const [noteText,  setNoteText]      = useState('');
  const [saving,    setSaving]        = useState(false);
  const [noteError, setNoteError]     = useState('');

  // ── Guard: only relevant when status is submitted ─────────────────────────
  if (!entry || entry.status !== 'submitted') {
    return null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────────────────────────────────

  const openApproveModal = () => {
    setModalMode('approve');
    setNoteText('');
    setNoteError('');
  };

  const openRejectModal = () => {
    setModalMode('reject');
    setNoteText('');
    setNoteError('');
  };

  const closeModal = () => {
    if (saving) {
      return;
    }   // don't close during save
    setModalMode(null);
    setNoteText('');
    setNoteError('');
  };

  const handleConfirmApprove = async () => {
    setSaving(true);
    try {
      const result = await workEntryService.approveWorkEntry(entry.id, noteText);
      if (!result.success) {
        throw new Error(result.error || 'Failed to approve entry');
      }
      closeModal();
      if (onApproved) {
        onApproved();
      }
    } catch (err) {
      console.error('❌ Approve failed:', err);
      setNoteError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmReject = async () => {
    // Validate required reason
    if (!noteText.trim()) {
      setNoteError('Please provide a reason for rejection so the technician knows what to correct.');
      return;
    }
    setSaving(true);
    try {
      const result = await workEntryService.rejectWorkEntry(entry.id, noteText);
      if (!result.success) {
        throw new Error(result.error || 'Failed to reject entry');
      }
      closeModal();
      if (onRejected) {
        onRejected();
      }
    } catch (err) {
      console.error('❌ Reject failed:', err);
      setNoteError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  const isApproveMode = modalMode === 'approve';

  return (
    <>
      {/* ── Action Buttons ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">
          Manager Actions
        </h3>

        {/* Info callout */}
        <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 mb-4 text-xs text-blue-700">
          This entry has been submitted for review. Once approved, it will be
          locked and cannot be edited by the technician.
        </div>

        <div className="flex gap-3">
          {/* Approve button */}
          <button
            onClick={openApproveModal}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5
                       bg-green-600 hover:bg-green-700 active:bg-green-800
                       text-white text-sm font-medium rounded-lg
                       transition-colors focus:outline-none focus:ring-2
                       focus:ring-green-500 focus:ring-offset-2"
          >
            <CheckCircleIcon className="w-4 h-4" />
            Approve
          </button>

          {/* Reject button */}
          <button
            onClick={openRejectModal}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5
                       bg-white hover:bg-red-50 active:bg-red-100
                       text-red-600 text-sm font-medium rounded-lg
                       border border-red-200 hover:border-red-300
                       transition-colors focus:outline-none focus:ring-2
                       focus:ring-red-500 focus:ring-offset-2"
          >
            <XCircleIcon className="w-4 h-4" />
            Reject
          </button>
        </div>
      </div>

      {/* ── Confirmation Modal ──────────────────────────────────────────── */}
      <ConfirmModal isOpen={modalMode !== null} onClose={closeModal}>

        {/* Modal Header */}
        <div
          className={`px-6 py-4 flex items-center justify-between border-b
            ${isApproveMode ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}
        >
          <div className="flex items-center gap-3">
            {isApproveMode ? (
              <CheckCircleIcon className="w-5 h-5 text-green-600" />
            ) : (
              <XCircleIcon className="w-5 h-5 text-red-600" />
            )}
            <h2 className={`text-base font-semibold
              ${isApproveMode ? 'text-green-800' : 'text-red-800'}`}
            >
              {isApproveMode ? 'Approve Work Entry' : 'Reject Work Entry'}
            </h2>
          </div>
          <button
            onClick={closeModal}
            disabled={saving}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="px-6 py-5">

          {/* Entry summary */}
          <div className="bg-gray-50 rounded-lg px-4 py-3 mb-5 text-sm">
            <div className="flex justify-between mb-1">
              <span className="text-gray-500">Contract</span>
              <span className="font-medium text-gray-800">
                {entry.contract?.contract_name || '—'}
              </span>
            </div>
            <div className="flex justify-between mb-1">
              <span className="text-gray-500">Entry Date</span>
              <span className="font-medium text-gray-800">
                {entry.entry_date
                  ? new Intl.DateTimeFormat('en-MY', {
                    day: 'numeric', month: 'long', year: 'numeric'
                  }).format(new Date(entry.entry_date))
                  : '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Technician</span>
              <span className="font-medium text-gray-800">
                {entry.creator?.user_profiles?.[0]?.full_name
                  || entry.creator?.email
                  || '—'}
              </span>
            </div>
          </div>

          {/* Note / Reason textarea */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {isApproveMode
                ? 'Remarks (optional)'
                : <>Reason for Rejection <span className="text-red-500">*</span></>
              }
            </label>
            <textarea
              value={noteText}
              onChange={(e) => {
                setNoteText(e.target.value);
                if (noteError) {
                  setNoteError('');
                }
              }}
              disabled={saving}
              rows={3}
              placeholder={
                isApproveMode
                  ? 'e.g. All items checked and verified. Good work.'
                  : 'e.g. Missing equipment ID and serial number. Please add and resubmit.'
              }
              className={`
                w-full px-3 py-2 rounded-lg border text-sm resize-none
                focus:outline-none focus:ring-2 transition-colors
                ${noteError
      ? 'border-red-300 focus:ring-red-300 bg-red-50'
      : 'border-gray-300 focus:ring-primary-300 bg-white'
    }
                ${saving ? 'opacity-60 cursor-not-allowed' : ''}
              `}
            />
            {noteError && (
              <p className="mt-1.5 text-xs text-red-600">{noteError}</p>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex gap-3 justify-end">
          <button
            onClick={closeModal}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-gray-700
                       bg-white border border-gray-300 rounded-lg
                       hover:bg-gray-50 transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>

          <button
            onClick={isApproveMode ? handleConfirmApprove : handleConfirmReject}
            disabled={saving}
            className={`
              px-5 py-2 text-sm font-medium text-white rounded-lg
              transition-colors flex items-center gap-2
              disabled:opacity-50 disabled:cursor-not-allowed
              ${isApproveMode
      ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
      : 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
    }
              focus:outline-none focus:ring-2 focus:ring-offset-2
            `}
          >
            {saving ? (
              <>
                <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {isApproveMode ? 'Approving…' : 'Rejecting…'}
              </>
            ) : (
              <>
                {isApproveMode
                  ? <><CheckCircleIcon className="w-4 h-4" /> Confirm Approve</>
                  : <><XCircleIcon className="w-4 h-4" /> Confirm Reject</>
                }
              </>
            )}
          </button>
        </div>
      </ConfirmModal>
    </>
  );
}
