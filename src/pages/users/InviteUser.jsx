/**
 * WorkLedger - Invite User Page
 *
 * Two-path invite flow:
 *
 * Path A — Email is already registered:
 *   → Add them to org_members directly with selected role.
 *   → They see the org on their next login (org switcher).
 *
 * Path B — Email not in system:
 *   → Show "Not registered" message.
 *   → Display the app URL they need to sign up at.
 *   → Admin can copy the link and send via WhatsApp / email manually.
 *   → No email-sending infrastructure needed (zero-budget).
 *
 * @module pages/users/InviteUser
 * @created February 23, 2026 - Session 12
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { userService } from '../../services/api/userService';
import { useOrganization } from '../../context/OrganizationContext';
import { getRoleMeta, ASSIGNABLE_ORG_ROLES } from '../../constants/permissions';
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  MagnifyingGlassIcon,
  ClipboardDocumentIcon
} from '@heroicons/react/24/outline';

// Roles available when inviting (omit org_owner by default — too powerful to grant easily)
const INVITE_ROLES = ASSIGNABLE_ORG_ROLES.filter(r => r !== 'org_owner');

export default function InviteUser() {
  const navigate       = useNavigate();
  const { currentOrg } = useOrganization();

  // Form fields
  const [email,       setEmail]       = useState('');
  const [selectedRole, setSelectedRole] = useState('technician');

  // Flow state
  const [step,        setStep]        = useState('form'); // 'form' | 'not_found' | 'confirm' | 'success'
  const [foundUser,   setFoundUser]   = useState(null);   // user profile if found
  const [checking,    setChecking]    = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState(null);
  const [copied,      setCopied]      = useState(false);

  const signupUrl = `${window.location.origin}/register`;
  const roleMeta  = getRoleMeta(selectedRole);

  // ── Handlers ─────────────────────────────────────────────

  const handleLookup = async (e) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      return;
    }

    try {
      setChecking(true);
      setError(null);

      const result = await userService.findUserByEmail(trimmed);

      if (result.found) {
        // Check they aren't already a member
        const { isMember, member } = await userService.checkExistingMembership(
          currentOrg.id,
          result.userId
        );

        if (isMember && member.is_active) {
          setError('This person is already an active member of your organization.');
          return;
        }

        setFoundUser(result.profile);
        setStep('confirm');
      } else {
        setStep('not_found');
      }
    } catch (err) {
      setError('Lookup failed. Please try again.');
    } finally {
      setChecking(false);
    }
  };

  const handleAddMember = async () => {
    try {
      setSaving(true);
      setError(null);

      const result = await userService.addExistingUserToOrg(
        currentOrg.id,
        foundUser.id,
        selectedRole
      );

      if (!result.success) {
        setError(result.error);
        return;
      }

      setStep('success');
    } catch (err) {
      setError('Failed to add member. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(signupUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const input = document.createElement('input');
      input.value = signupUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleReset = () => {
    setEmail('');
    setFoundUser(null);
    setError(null);
    setStep('form');
  };

  // ── Guard ─────────────────────────────────────────────────

  if (!currentOrg) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20 text-gray-500">
          Select an organization first.
        </div>
      </AppLayout>
    );
  }

  // ── Render ────────────────────────────────────────────────

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto space-y-6">

        {/* Back nav */}
        <button
          onClick={() => navigate('/users')}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Team
        </button>

        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invite Team Member</h1>
          <p className="text-sm text-gray-500 mt-1">{currentOrg.name}</p>
        </div>

        {/* ── STEP: Form ── */}
        {step === 'form' && (
          <form onSubmit={handleLookup} className="bg-white rounded-xl shadow p-6 space-y-5">

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Email Address <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                We&apos;ll check if this email is already registered in WorkLedger.
              </p>
            </div>

            {/* Role selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Assign Role <span className="text-red-500">*</span>
              </label>
              <div className="space-y-2">
                {INVITE_ROLES.map(role => {
                  const meta       = getRoleMeta(role);
                  const isSelected = role === selectedRole;
                  return (
                    <label
                      key={role}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        isSelected
                          ? 'border-primary-400 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
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
                      <div>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${meta.badge}`}>
                          {meta.label}
                        </span>
                        <p className="text-xs text-gray-500 mt-0.5">{meta.description}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={checking || !email.trim()}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {checking ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Checking...
                </>
              ) : (
                <>
                  <MagnifyingGlassIcon className="h-4 w-4" />
                  Look Up & Invite
                </>
              )}
            </button>
          </form>
        )}

        {/* ── STEP: Not Found ── */}
        {step === 'not_found' && (
          <div className="bg-white rounded-xl shadow p-6 space-y-4">
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <svg className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-sm font-medium text-amber-800">Not registered yet</p>
                <p className="text-sm text-amber-700 mt-1">
                  <span className="font-semibold">{email}</span> does not have a WorkLedger account.
                </p>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">
                Share the signup link with them:
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={signupUrl}
                  className="flex-1 px-3 py-2 text-sm bg-gray-50 border border-gray-300 rounded-lg text-gray-700 select-all"
                  onClick={e => e.target.select()}
                />
                <button
                  onClick={handleCopyLink}
                  className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                    copied
                      ? 'bg-green-600 text-white border-green-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <ClipboardDocumentIcon className="h-4 w-4" />
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Send via WhatsApp or email. Once they sign up, come back here and invite them by email.
              </p>
            </div>

            {/* Role preview */}
            <div className="p-3 bg-gray-50 rounded-lg flex items-center gap-3 text-sm">
              <span className="text-gray-600">Selected role:</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${roleMeta.badge}`}>
                {roleMeta.label}
              </span>
              <span className="text-xs text-gray-400">— will be applied once they join</span>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleReset}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Try Another Email
              </button>
              <button
                onClick={() => navigate('/users')}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
              >
                Back to Team
              </button>
            </div>
          </div>
        )}

        {/* ── STEP: Confirm ── */}
        {step === 'confirm' && foundUser && (
          <div className="bg-white rounded-xl shadow p-6 space-y-5">

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex items-center gap-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="h-12 w-12 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold flex-shrink-0">
                {(foundUser.full_name || '?').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-gray-900">{foundUser.full_name || 'Unknown'}</p>
                <p className="text-sm text-gray-500 truncate">{foundUser.email}</p>
                <p className="text-xs text-green-700 font-medium mt-0.5">✓ WorkLedger account found</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-gray-700">
                Add <span className="font-semibold">{foundUser.full_name || foundUser.email}</span> to{' '}
                <span className="font-semibold">{currentOrg.name}</span> as:
              </p>
              <div className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium ${roleMeta.badge} border`}>
                {roleMeta.label} &mdash; <span className="font-normal ml-1 text-xs">{roleMeta.description}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleReset}
                disabled={saving}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddMember}
                disabled={saving}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-60 transition-colors"
              >
                {saving ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Adding...
                  </>
                ) : 'Add to Organization'}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP: Success ── */}
        {step === 'success' && (
          <div className="bg-white rounded-xl shadow p-8 text-center space-y-4">
            <CheckCircleIcon className="mx-auto h-14 w-14 text-green-500" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Member Added!</h2>
              <p className="text-sm text-gray-500 mt-1">
                <span className="font-medium">{foundUser?.full_name || email}</span> has been added
                to <span className="font-medium">{currentOrg.name}</span> as{' '}
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${roleMeta.badge}`}>
                  {roleMeta.label}
                </span>.
              </p>
              <p className="text-xs text-gray-400 mt-2">
                They will see this organization on their next login.
              </p>
            </div>
            <div className="flex gap-3 justify-center">
              <button
                onClick={handleReset}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Invite Another
              </button>
              <button
                onClick={() => navigate('/users')}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
              >
                Back to Team
              </button>
            </div>
          </div>
        )}

      </div>
    </AppLayout>
  );
}
