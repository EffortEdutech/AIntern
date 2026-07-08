/**
 * WorkLedger — New Work Entry Page
 *
 * Thin wrapper around WorkEntryForm. Handles save / submit callbacks
 * with full offline-first behaviour:
 *
 *   SAVE AS DRAFT (online or offline):
 *     1. Write to IndexedDB immediately with sync_status='pending'
 *     2. Add to syncQueue
 *     3. If online: attempt Supabase push, update IndexedDB with remoteId
 *     4. Navigate to /tech (technician) or /work (other roles)
 *
 *   SUBMIT (online only):
 *     1. WorkEntryForm blocks the DynamicForm submit button when offline
 *     2. If somehow called while offline, save as draft instead + warn
 *     3. If online: push to Supabase with status='submitted'
 *     4. Sync IndexedDB entry to reflect remote ID + synced status
 *
 * Session 19 — Apr 4, 2026
 *
 * @file src/pages/workEntries/NewWorkEntry.jsx
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import WorkEntryForm from '../../components/workEntries/WorkEntryForm';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { workEntryService } from '../../services/api/workEntryService';
import { useOffline } from '../../hooks/useOffline';
import { useRole } from '../../hooks/useRole';
import { db } from '../../services/offline/db';
import { supabase } from '../../services/supabase/client';

export default function NewWorkEntry() {
  const navigate = useNavigate();
  const { isOnline } = useOffline();
  const { role } = useRole();

  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState(null);

  // Technicians always return to the technician dashboard after saving
  const isTechnician = ['technician', 'worker'].includes(role);
  const afterSaveRoute = isTechnician ? '/tech' : '/work';

  // ─────────────────────────────────────────────────────────────────────
  // OFFLINE-FIRST SAVE HELPER
  // Always writes IndexedDB first. Supabase push is attempted only online.
  // Returns { success, localId, remoteId? }
  // ─────────────────────────────────────────────────────────────────────
  const saveToIndexedDB = async (workEntryData) => {
    const userId = (await supabase.auth.getUser()).data?.user?.id ?? null;

    const localEntry = {
      // Map to Dexie workEntries schema columns
      remoteId:        null,              // set after Supabase push
      contract_id:     workEntryData.contract_id,
      template_id:     workEntryData.template_id,
      organization_id: workEntryData.organization_id ?? null,
      created_by:      userId,
      entry_date:      workEntryData.entry_date,
      shift:           workEntryData.shift ?? null,
      data:            workEntryData.data ?? {},
      status:          workEntryData.status,
      submitted_at:    workEntryData.submitted_at ?? null,
      sync_status:     'pending',
      created_at:      new Date().toISOString()
    };

    const localId = await db.workEntries.add(localEntry);

    await db.syncQueue.add({
      entity_type:     'work_entry',
      entity_local_id: localId,
      action:          'create',
      sync_status:     'pending',
      retry_count:     0,
      created_at:      new Date().toISOString()
    });

    console.log(`✅ Saved to IndexedDB (localId: ${localId})`);
    return { localId };
  };

  const pushToSupabase = async (workEntryData, localId) => {
    try {
      const result = await workEntryService.createWorkEntry(workEntryData);
      if (result.success && result.data?.id) {
        await db.workEntries.update(localId, {
          remoteId:    result.data.id,
          sync_status: 'synced'
        });
        // Remove from sync queue — already pushed
        await db.syncQueue
          .where('entity_local_id').equals(localId)
          .and(item => item.entity_type === 'work_entry')
          .delete();
        console.log(`✅ Synced to Supabase (remoteId: ${result.data.id})`);
        return { success: true, remoteId: result.data.id };
      }
      // Supabase push failed — leave as pending in queue for syncService to retry
      console.warn('⚠️  Supabase push failed — entry queued for retry:', result.error);
      return { success: false };
    } catch (err) {
      console.warn('⚠️  Supabase push error — entry queued for retry:', err.message);
      return { success: false };
    }
  };

  // ─────────────────────────────────────────────────────────────────────
  // HANDLE SAVE AS DRAFT
  // Works online and offline.
  // ─────────────────────────────────────────────────────────────────────
  const handleSave = async (workEntryData) => {
    try {
      setSaving(true);
      setError(null);

      const draftEntry = { ...workEntryData, status: 'draft' };

      // 1. Always write to IndexedDB first
      const { localId } = await saveToIndexedDB(draftEntry);

      // 2. If online, push to Supabase immediately
      if (isOnline) {
        await pushToSupabase(draftEntry, localId);
        console.log('✅ Draft saved and synced');
      } else {
        console.log('📱 Draft saved locally — will sync when online');
      }

      navigate(afterSaveRoute);

    } catch (err) {
      console.error('❌ Error saving draft:', err);
      setError(err.message || 'Failed to save work entry');
    } finally {
      setSaving(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────
  // HANDLE SUBMIT
  // Requires online. WorkEntryForm's DynamicForm submit button is disabled
  // offline, but we guard here too.
  // ─────────────────────────────────────────────────────────────────────
  const handleSubmit = async (workEntryData) => {
    // Offline guard — save as draft instead
    if (!isOnline) {
      console.warn('⚠️  Submit called while offline — saving as draft instead');
      await handleSave({ ...workEntryData, status: 'draft' });
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const submittedEntry = {
        ...workEntryData,
        status:       'submitted',
        submitted_at: new Date().toISOString()
      };

      // 1. Write to IndexedDB first
      const { localId } = await saveToIndexedDB(submittedEntry);

      // 2. Push to Supabase (we know we're online)
      const pushResult = await pushToSupabase(submittedEntry, localId);

      if (pushResult.success) {
        navigate(`/work/${pushResult.remoteId}`);
      } else {
        // Push failed — entry is saved locally and queued
        setError(
          'Entry submitted but could not reach the server. ' +
          'It has been saved locally and will sync automatically. ' +
          'Check your connection and try again.'
        );
        // Navigate anyway — entry is safe
        setTimeout(() => navigate(afterSaveRoute), 3000);
      }

    } catch (err) {
      console.error('❌ Error submitting entry:', err);
      setError(err.message || 'Failed to submit work entry');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (window.confirm('Are you sure? Any unsaved changes will be lost.')) {
      navigate(afterSaveRoute);
    }
  };

  if (saving) {
    return (
      <AppLayout>
        <div className="flex flex-col justify-center items-center min-h-[60vh] gap-4">
          <LoadingSpinner size="lg" />
          <p className="text-sm text-gray-500">
            {isOnline ? 'Saving…' : 'Saving locally…'}
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-gray-900">New Work Entry</h1>
            {!isOnline && (
              <span className="text-xs font-medium bg-amber-100 text-amber-800 px-2 py-1 rounded-full">
                Offline
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600">
            {isOnline
              ? 'Create a new work entry by selecting a contract and filling in the required information'
              : 'You are offline. Select a cached contract to fill in the form. Draft entries save locally and sync when you reconnect.'
            }
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="font-medium text-red-900">Error</p>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        <WorkEntryForm
          mode="create"
          onSave={handleSave}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />

        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">
            📝 How to Create a Work Entry
          </h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
            <li>Select a contract from the dropdown above</li>
            <li>Choose the entry date (defaults to today)</li>
            <li>Fill in all required fields in the form</li>
            <li>
              <strong>Save as Draft</strong> to continue later — works online and offline.{' '}
              <strong>Submit Entry</strong> sends it for approval (requires internet).
            </li>
          </ol>
        </div>
      </div>
    </AppLayout>
  );
}
