/**
 * WorkLedger - Edit Work Entry Page
 *
 * Edit existing work entry.
 * Handles two editing modes:
 *   - DRAFT mode: "Save Changes" — saves and returns to detail
 *   - REJECTED mode: "Save & Resubmit" — saves AND resubmits in one action
 *
 * @module pages/workEntries/EditWorkEntry
 * @created February 1, 2026 - Session 13
 * @updated February 2, 2026  - Session 15: workEntryId for photo/signature editing
 * @updated February 27, 2026 - Session 16: rejected entry workflow + Save & Resubmit
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import DynamicForm from '../../components/templates/DynamicForm';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { workEntryService } from '../../services/api/workEntryService';

/**
 * Edit Work Entry Page
 *
 * Features:
 * - Edit draft AND rejected work entries
 * - Template-driven form (DynamicForm)
 * - Photo/signature editing support (Session 15)
 * - DRAFT mode: Save Changes → returns to detail
 * - REJECTED mode: Save & Resubmit → saves + resubmits in one action
 * - Cancel returns to detail view
 */
export default function EditWorkEntry() {
  const { id } = useParams();
  const navigate = useNavigate();

  // State
  const [workEntry,    setWorkEntry]    = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState(null);

  // Derived — computed from workEntry once loaded
  const isRejected = workEntry?.status === 'rejected';

  // Load work entry
  useEffect(() => {
    loadWorkEntry();
  }, [id]);

  /**
   * Load work entry data
   */
  const loadWorkEntry = async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await workEntryService.getWorkEntry(id);

      if (result.success) {
        // Check if entry is editable
        if (result.data.status !== 'draft' && result.data.status !== 'rejected') {
          setError('Only draft entries can be edited');
          return;
        }

        setWorkEntry(result.data);
      } else {
        setError(result.error);
      }
    } catch (err) {
      console.error('❌ Error loading work entry:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle form submission.
   *
   * DRAFT mode:    Save changes only → back to detail (status stays 'draft')
   * REJECTED mode: Save changes AND resubmit in one action → back to detail
   *                (status transitions to 'submitted' for manager re-review)
   *
   * @param {Object} formData - Field key/value pairs from DynamicForm
   */
  const handleSubmit = async (formData) => {
    try {
      setSaving(true);
      console.log('💾 Updating work entry:', id, isRejected ? '(rejected → save & resubmit)' : '(draft → save)');

      // Step 1: Save the field data
      const updateResult = await workEntryService.updateWorkEntry(id, {
        data: formData
      });

      if (!updateResult.success) {
        throw new Error(updateResult.error || 'Failed to save changes');
      }

      console.log('✅ Work entry data saved');

      // Step 2 (rejected only): Resubmit after saving
      if (isRejected) {
        const resubmitResult = await workEntryService.resubmitWorkEntry(id);
        if (!resubmitResult.success) {
          throw new Error(resubmitResult.error || 'Saved but failed to resubmit — please resubmit from the detail page');
        }
        console.log('✅ Work entry resubmitted for review');
      }

      navigate(`/work/${id}`);

    } catch (err) {
      console.error('❌ Error in handleSubmit:', err);
      throw err;   // DynamicForm catches this and shows inline error
    } finally {
      setSaving(false);
    }
  };

  /**
   * Handle cancel
   */
  const handleCancel = () => {
    navigate(`/work/${id}`);
  };

  // Loading state
  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      </AppLayout>
    );
  }

  // Error state
  if (error || !workEntry) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-red-900">{error || 'Work entry not found'}</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto">
        {/* Page Header — title differs for rejected vs draft */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            {isRejected ? 'Correct & Resubmit' : 'Edit Work Entry'}
          </h1>
          <p className="text-gray-600 mt-2">
            {workEntry.contract?.contract_number} — {workEntry.contract?.contract_name}
          </p>
          {isRejected && workEntry.rejection_reason && (
            <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <p className="text-sm font-semibold text-red-800 mb-0.5">Rejection reason</p>
              <p className="text-sm text-red-700">{workEntry.rejection_reason}</p>
            </div>
          )}
        </div>

        {/* Edit Form */}
        {workEntry.template && (
          <DynamicForm
            template={workEntry.template}
            contract={workEntry.contract}
            initialData={workEntry.data}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            submitLabel={
              saving
                ? (isRejected ? 'Saving & Resubmitting…' : 'Saving…')
                : (isRejected ? 'Save & Resubmit'         : 'Save Changes')
            }
            workEntryId={id}
          />
        )}
      </div>
    </AppLayout>
  );
}
