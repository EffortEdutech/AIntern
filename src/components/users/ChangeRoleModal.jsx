/**
 * WorkLedger - Change Role Modal
 *
 * Modal for changing a member's role within the organization.
 * Shows ROLE_META descriptions so the admin understands what each role means.
 * Includes confirmation step and last-owner guard.
 *
 * @module components/users/ChangeRoleModal
 * @created February 23, 2026 - Session 12
 */

import React, { useState } from 'react';
import { userService } from '../../services/api/userService';
import { getRoleMeta, ASSIGNABLE_ORG_ROLES } from '../../constants/permissions';
import { XMarkIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

/**
 * ChangeRoleModal
 *
 * @param {object}   member       — org_members row (with user sub-object)
 * @param {string}   orgId
 * @param {function} onSuccess    — called after successful role change
 * @param {function} onClose      — called to close modal
 */
export default function ChangeRoleModal({ member, orgId, onSuccess, onClose }) {
  const currentRole = member.role;
  const memberName  = member.user?.full_name || member.user?.email || 'This member';

  const [selectedRole, setSelectedRole] = useState(currentRole);
  const [step,         setStep]         = useState('select'); // 'select' | 'confirm'
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState(null);

  const selectedMeta = getRoleMeta(selectedRole);
  const currentMeta  = getRoleMeta(currentRole);
  const hasChanged   = selectedRole !== currentRole;

  // ── Handlers ─────────────────────────────────────────────

  const handleProceedToConfirm = () => {
    if (!hasChanged) {
      return;
    }
    setError(null);
    setStep('confirm');
  };

  const handleConfirm = async () => {
    try {
      setSaving(true);
      setError(null);

      const result = await userService.updateMemberRole(orgId, member.id, selectedRole);

      if (!result.success) {
        setError(result.error);
        setStep('select');
        return;
      }

      onSuccess(member.id, selectedRole);
    } catch (err) {
      console.error('❌ Role change failed:', err);
      setError('Unexpected error. Please try again.');
      setStep('select');
    } finally {
      setSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────

  return (
    /* Backdrop */
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            {step === 'confirm' ? 'Confirm Role Change' : 'Change Role'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">

          {/* Member info */}
          <div className="flex items-center gap-3 mb-5 p-3 bg-gray-50 rounded-lg">
            <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold text-sm flex-shrink-0">
              {(member.user?.full_name || '?').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {member.user?.full_name || 'Unknown'}
              </p>
              <p className="text-xs text-gray-500 truncate">{member.user?.email}</p>
            </div>
            <span className={`ml-auto flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${currentMeta.badge}`}>
              {currentMeta.label}
            </span>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {step === 'select' ? (
            /* ── Step 1: Role selector ── */
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700 mb-3">Select new role</p>
              {ASSIGNABLE_ORG_ROLES.map(role => {
                const meta      = getRoleMeta(role);
                const isSelected = role === selectedRole;
                const isCurrent  = role === currentRole;

                return (
                  <label
                    key={role}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      isSelected
                        ? 'border-primary-400 bg-primary-50'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={role}
                      checked={isSelected}
                      onChange={() => setSelectedRole(role)}
                      className="mt-0.5 h-4 w-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${meta.badge}`}>
                          {meta.label}
                        </span>
                        {isCurrent && (
                          <span className="text-xs text-gray-400 italic">current</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{meta.description}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          ) : (
            /* ── Step 2: Confirmation ── */
            <div className="text-center py-2">
              <CheckCircleIcon className="mx-auto h-12 w-12 text-primary-400 mb-4" />
              <p className="text-gray-900 font-medium mb-2">Are you sure?</p>
              <p className="text-sm text-gray-600">
                Change <span className="font-semibold">{memberName}</span> from{' '}
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${currentMeta.badge}`}>
                  {currentMeta.label}
                </span>
                {' '}to{' '}
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${selectedMeta.badge}`}>
                  {selectedMeta.label}
                </span>
              </p>
              <p className="text-xs text-gray-400 mt-3">
                They will see the new permissions on their next page load.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button
            onClick={step === 'confirm' ? () => setStep('select') : onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            disabled={saving}
          >
            {step === 'confirm' ? 'Back' : 'Cancel'}
          </button>

          {step === 'select' ? (
            <button
              onClick={handleProceedToConfirm}
              disabled={!hasChanged}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Continue
            </button>
          ) : (
            <button
              onClick={handleConfirm}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-60 transition-colors flex items-center gap-2"
            >
              {saving ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving...
                </>
              ) : (
                'Confirm Change'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
