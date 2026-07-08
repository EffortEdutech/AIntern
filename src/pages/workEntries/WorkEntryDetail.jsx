/**
 * WorkLedger - Work Entry Detail Page
 *
 * Read-only view of a work entry with all details.
 *
 * SESSION 13: Initial version — basic detail display
 * SESSION 15: Added photo/signature attachments via PhotoGallery
 * SESSION 16: Added approval workflow:
 *   - ApprovalBadge replaces StatusBadge in header
 *   - ApprovalActions (approve/reject) shown for managers on submitted entries
 *   - ApprovalHistory timeline shown at bottom for all statuses
 *   - Resubmit button for rejected entries (technician only)
 *   - Edit/Submit/Delete buttons remain for draft status only
 * SESSION 16 FIX:
 *   - ApprovalActions now gated by isOwnOrgEntry — MTSB cannot approve FEST ENT entries
 *   - WorkEntryList now passes isOwnEntry prop (was missing — caused Edit/Delete on sub entries)
 * SESSION 19 FIX:
 *   - canEditOwn now checks isCreator for technicians (EDIT_ANY_WORK_ENTRY holders bypass)
 *   - canDelete now checks isCreator for technicians (managers bypass with org check)
 *   - Previously canEditOwn = can('EDIT_OWN_WORK_ENTRY') — true for ALL roles,
 *     meaning any org member could edit any entry from the detail page
 *   - Previously canDelete used (!user || created_by === user.id) — blocks managers
 *     from deleting entries they didn't personally create, which is wrong
 *
 * @module pages/workEntries/WorkEntryDetail
 * @created February 1, 2026 - Session 13
 * @updated February 27, 2026 - Session 16: Approval workflow
 * @updated April 6, 2026    - Session 19: isCreator guard on canEditOwn + canDelete
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import ApprovalBadge from '../../components/workEntries/ApprovalBadge';
import ApprovalActions from '../../components/workEntries/ApprovalActions';
import ApprovalHistory from '../../components/workEntries/ApprovalHistory';
import PhotoGallery from '../../components/attachments/PhotoGallery';
import Button from '../../components/common/Button';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import PermissionGuard from '../../components/auth/PermissionGuard';
import { workEntryService }  from '../../services/api/workEntryService';
import { attachmentService } from '../../services/api/attachmentService';
import { useOrganization }   from '../../context/OrganizationContext';
import { useRole }           from '../../hooks/useRole';
import { useAuth }           from '../../context/AuthContext';
import {
  ArrowLeftIcon,
  CalendarIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { useToast } from '../../context/ToastContext';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatDate(dateStr) {
  if (!dateStr) {
    return '—';
  }
  try {
    return new Intl.DateTimeFormat('en-MY', {
      day: 'numeric', month: 'long', year: 'numeric'
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

function formatDateTime(ts) {
  if (!ts) {
    return '—';
  }
  try {
    return new Intl.DateTimeFormat('en-MY', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    }).format(new Date(ts));
  } catch {
    return ts;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function WorkEntryDetail() {
  const toast = useToast();
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentOrg } = useOrganization();
  const { can }        = useRole();
  const { user }       = useAuth();

  // ── State ─────────────────────────────────────────────────────────────────
  const [workEntry,     setWorkEntry]     = useState(null);
  const [attachments,   setAttachments]   = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // ── Load work entry ───────────────────────────────────────────────────────

  const loadWorkEntry = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await workEntryService.getWorkEntry(id);

      if (result.success) {
        setWorkEntry(result.data);
      } else {
        setError(result.error || 'Work entry not found');
      }
    } catch (err) {
      console.error('❌ Error loading work entry:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadAttachments = useCallback(async () => {
    try {
      const result = await attachmentService.getAttachments(id);
      if (result.success) {
        setAttachments(result.data || []);
      }
    } catch (err) {
      console.error('❌ Error loading attachments:', err);
    }
  }, [id]);

  useEffect(() => {
    loadWorkEntry();
    loadAttachments();
  }, [loadWorkEntry, loadAttachments]);

  // ── Action handlers ───────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!window.confirm('Delete this work entry? This cannot be undone.')) {
      return;
    }

    try {
      setActionLoading(true);
      const result = await workEntryService.deleteWorkEntry(id, currentOrg?.id);
      if (result.success) {
        navigate('/work');
      } else {
        toast.error(`Failed to delete: ${result.error}`);
      }
    } catch (err) {
      toast.error('Failed to delete work entry');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!window.confirm("Submit this work entry for approval? You won't be able to edit it after submission.")) {
      return;
    }

    try {
      setActionLoading(true);
      const result = await workEntryService.submitWorkEntry(id);
      if (result.success) {
        await loadWorkEntry();   // reload to show updated status
      } else {
        toast.error(`Failed to submit: ${result.error}`);
      }
    } catch (err) {
      toast.error('Failed to submit work entry');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResubmit = async () => {
    if (!window.confirm('Resubmit this entry for review? The manager will see it again in their queue.')) {
      return;
    }

    try {
      setActionLoading(true);
      const result = await workEntryService.resubmitWorkEntry(id);
      if (result.success) {
        await loadWorkEntry();
      } else {
        toast.error(`Failed to resubmit: ${result.error}`);
      }
    } catch (err) {
      toast.error('Failed to resubmit');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Render fields from JSONB data ─────────────────────────────────────────

  const renderDataFields = () => {
    if (!workEntry?.data || !workEntry?.template?.fields_schema) {
      return (
        <p className="text-sm text-gray-500 italic">No field data available.</p>
      );
    }

    const schema   = workEntry.template.fields_schema;
    const data     = workEntry.data;
    const sections = schema.sections || [];

    if (sections.length === 0) {
      return (
        <p className="text-sm text-gray-500 italic">No sections defined in template.</p>
      );
    }

    return sections.map((section) => {
      const fields = section.fields || [];
      const sectionHasData = fields.some((field) => {
        const key = `${section.section_id}.${field.field_id}`;
        return data[key] !== undefined && data[key] !== null && data[key] !== '';
      });

      if (!sectionHasData) {
        return null;
      }

      return (
        <div key={section.section_id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Section header */}
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700">
              {section.section_name}
            </h3>
          </div>

          {/* Fields */}
          <div className="divide-y divide-gray-100">
            {fields.map((field) => {
              const fieldKey = `${section.section_id}.${field.field_id}`;
              const value    = data[fieldKey];

              if (value === undefined || value === null || value === '') {
                return null;
              }

              return (
                <div key={field.field_id} className="px-5 py-3 flex gap-4">
                  <span className="text-sm text-gray-500 min-w-0 w-2/5 flex-shrink-0">
                    {field.field_name}
                  </span>
                  <span className="text-sm text-gray-900 flex-1 break-words">
                    {renderFieldValue(field.field_type, value)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      );
    });
  };

  const renderFieldValue = (fieldType, value) => {
    if (fieldType === 'checkbox') {
      return value ? '✅ Yes' : '❌ No';
    }
    if (fieldType === 'date') {
      return formatDate(value);
    }
    if (fieldType === 'photo' || fieldType === 'signature') {
      return <span className="text-xs text-gray-400 italic">See attachments below</span>;
    }
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    return String(value);
  };

  // ── Loading state ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-64 py-16">
          <LoadingSpinner />
        </div>
      </AppLayout>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────────

  if (error || !workEntry) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 text-center">
          <ExclamationTriangleIcon className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Entry Not Found</h2>
          <p className="text-sm text-gray-500 mb-6">{error || 'This work entry could not be loaded.'}</p>
          <Button onClick={() => navigate('/work')} variant="secondary">
            Back to Work Entries
          </Button>
        </div>
      </AppLayout>
    );
  }

  // ── Derived values ────────────────────────────────────────────────────────

  const isDraft     = workEntry.status === 'draft';
  const isSubmitted = workEntry.status === 'submitted';
  const isApproved  = workEntry.status === 'approved';
  const isRejected  = workEntry.status === 'rejected';
  const isLocked    = isApproved;  // approved = fully immutable

  // ── SESSION 19: Creator + manager-level permission checks ─────────────────
  //
  // isCreator:        this user personally created this entry
  // isManagerOrAbove: has EDIT_ANY_WORK_ENTRY → can act on any entry in own org
  // isOwnOrgEntry:    entry belongs to user's org (cross-org guard for managers)
  //
  // For Edit and Delete:
  //   Managers/admins/owners → org-level check (isOwnOrgEntry) is sufficient
  //   Technicians/workers    → must be the creator (isCreator)
  //
  const isCreator        = !!user && workEntry.created_by === user.id;
  const isManagerOrAbove = can('EDIT_ANY_WORK_ENTRY');

  // Session 16: org ownership check for approval actions.
  // MTSB manager cannot approve FEST ENT entries.
  // currentOrg?.id is null for super_admin → they can approve all.
  const isOwnOrgEntry = !currentOrg?.id || workEntry.organization_id === currentOrg.id;

  // canEditOwn: managers can edit any entry in own org; technicians only own
  const canEditOwn = can('EDIT_OWN_WORK_ENTRY')
    && (isManagerOrAbove ? isOwnOrgEntry : isCreator);

  // canDelete: same logic — managers any in org; technicians only own
  const canDelete  = can('DELETE_WORK_ENTRY')
    && (isManagerOrAbove ? isOwnOrgEntry : isCreator);

  const canApprove = can('APPROVE_WORK_ENTRY');

  // ─────────────────────────────────────────────────────────────────────────
  // Full render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* ── Back button ────────────────────────────────────────────────── */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Back
        </button>

        {/* ── Page header ────────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <DocumentTextIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <p className="text-xs text-gray-500 font-mono truncate">
                  {workEntry.contract?.contract_number || 'No contract number'}
                </p>
              </div>
              <h1 className="text-lg font-bold text-gray-900 mb-1">
                {workEntry.contract?.contract_name || 'Work Entry'}
              </h1>
              <p className="text-sm text-gray-500 flex items-center gap-1.5">
                <CalendarIcon className="w-3.5 h-3.5" />
                {formatDate(workEntry.entry_date)}
                {workEntry.shift && (
                  <span className="ml-1 px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                    {workEntry.shift} shift
                  </span>
                )}
              </p>
            </div>

            {/* Approval badge */}
            <ApprovalBadge status={workEntry.status} size="md" />
          </div>

          {/* Meta row */}
          <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-y-2 gap-x-4 text-xs">
            <div>
              <span className="text-gray-400">Template</span>
              <p className="text-gray-700 font-medium">
                {workEntry.template?.template_name || '—'}
              </p>
            </div>
            <div>
              <span className="text-gray-400">Project</span>
              <p className="text-gray-700 font-medium">
                {workEntry.contract?.project?.project_name || '—'}
              </p>
            </div>
            <div>
              <span className="text-gray-400">Created by</span>
              <p className="text-gray-700 font-medium">
                {workEntry.creator?.user_profiles?.[0]?.full_name
                  || workEntry.creator?.email
                  || '—'}
              </p>
            </div>
            <div>
              <span className="text-gray-400">Created at</span>
              <p className="text-gray-700 font-medium">
                {formatDateTime(workEntry.created_at)}
              </p>
            </div>
          </div>
        </div>

        {/* ── Rejection banner (shown to technician when rejected) ─────── */}
        {isRejected && workEntry.rejection_reason && !canApprove && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <ExclamationTriangleIcon className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-800 mb-1">
                  Entry Rejected — Action Required
                </p>
                <p className="text-sm text-red-700">
                  {workEntry.rejection_reason}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── DRAFT action buttons ───────────────────────────────────────── */}
        {isDraft && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Actions</h3>
            <div className="flex flex-wrap gap-3">
              {canEditOwn && (
                <Button
                  onClick={() => navigate(`/work/${id}/edit`)}
                  variant="secondary"
                  disabled={actionLoading}
                >
                  Edit Entry
                </Button>
              )}
              {/* Submit only for the creator — only they should submit their own work */}
              {isCreator && (
                <Button
                  onClick={handleSubmit}
                  variant="primary"
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Submitting…' : 'Submit for Approval'}
                </Button>
              )}
              {canDelete && (
                <Button
                  onClick={handleDelete}
                  variant="danger"
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Deleting…' : 'Delete'}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* ── REJECTED — resubmit button (technician / creator only) ──── */}
        {isRejected && !canApprove && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Actions</h3>
            <p className="text-xs text-gray-500 mb-4">
              Edit this entry to address the rejection reason, then resubmit.
            </p>
            <div className="flex flex-wrap gap-3">
              {canEditOwn && (
                <Button
                  onClick={() => navigate(`/work/${id}/edit`)}
                  variant="secondary"
                  disabled={actionLoading}
                >
                  Edit Entry
                </Button>
              )}
              {isCreator && (
                <Button
                  onClick={handleResubmit}
                  variant="primary"
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Resubmitting…' : 'Resubmit for Review'}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* ── MANAGER: Approve / Reject actions ────────────────────────── */}
        {/* Session 16 fix: isOwnOrgEntry ensures MTSB managers cannot        */}
        {/* approve/reject FEST ENT's entries. Only the entry's own org       */}
        {/* manager can approve. PermissionGuard handles the role check.      */}
        <PermissionGuard permission="APPROVE_WORK_ENTRY">
          {isSubmitted && isOwnOrgEntry && (
            <ApprovalActions
              entry={workEntry}
              onApproved={loadWorkEntry}
              onRejected={loadWorkEntry}
            />
          )}
        </PermissionGuard>

        {/* ── Work entry data (template fields) ────────────────────────── */}
        {renderDataFields()}

        {/* ── Photo attachments ─────────────────────────────────────────── */}
        {attachments.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">
              Attachments
            </h3>
            <PhotoGallery attachments={attachments} />
          </div>
        )}

        {/* ── Approval history timeline ──────────────────────────────────── */}
        <ApprovalHistory entry={workEntry} />

      </div>
    </AppLayout>
  );
}
