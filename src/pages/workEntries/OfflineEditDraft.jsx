/**
 * WorkLedger — Offline Edit Draft
 *
 * Edit a local (unsynced) work entry draft from IndexedDB.
 * Supports editing form fields AND capturing photos offline (stored as base64).
 *
 * Flow:
 *   1. Load entry from db.workEntries by localId (integer)
 *   2. Load contract + template from IndexedDB (no network)
 *   3. Render DynamicForm with existing field data
 *   4. Photo capture: file picker → FileReader → base64 → db.attachments
 *   5. Save: update db.workEntries with new data
 *   6. Navigate back to /work/offline
 *
 * Photos are stored in db.attachments with entry_local_id=localId.
 * They will be uploaded to Supabase Storage when the entry syncs.
 *
 * @file src/pages/workEntries/OfflineEditDraft.jsx
 * @created April 5, 2026 — Session 19
 */

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { DynamicForm } from '../../components/templates/DynamicForm';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { db } from '../../services/offline/db';
import { offlineDataService } from '../../services/offline/offlineDataService';
import { useToast } from '../../context/ToastContext';

// ── Offline photo component ───────────────────────────────────────────────────

function OfflinePhotoCapture({ localId, fieldId, fieldName }) {
  const toast = useToast();
  const [photos,    setPhotos]    = useState([]);
  const [capturing, setCapturing] = useState(false);
  const fileInputRef = useRef(null);

  // Load existing photos for this field from db.attachments
  useEffect(() => {
    const load = async () => {
      try {
        const existing = await db.attachments
          .where('entry_local_id').equals(localId)
          .filter(a => a.field_id === fieldId)
          .toArray();
        setPhotos(existing);
      } catch (err) {
        console.error('❌ Load offline photos:', err);
      }
    };
    load();
  }, [localId, fieldId]);

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) {
      return;
    }

    setCapturing(true);
    try {
      for (const file of files) {
        // Compress / convert to base64
        const base64 = await fileToBase64(file);
        const attachmentId = await db.attachments.add({
          remoteId:        null,
          entry_local_id:  localId,
          entry_remote_id: null,
          field_id:        fieldId,
          attachment_type: 'photo',
          file_name:       file.name,
          mime_type:       file.type,
          file_size:       file.size,
          data:            base64,
          sync_status:     'pending',
          created_at:      new Date().toISOString()
        });
        setPhotos(prev => [...prev, { localId: attachmentId, field_id: fieldId, data: base64, file_name: file.name }]);
      }
    } catch (err) {
      console.error('❌ Photo capture failed:', err);
      toast.error('Failed to capture photo. Please try again.');
    } finally {
      setCapturing(false);
      // Reset file input so same file can be re-selected
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeletePhoto = async (attachmentLocalId) => {
    try {
      await db.attachments.delete(attachmentLocalId);
      setPhotos(prev => prev.filter(p => p.localId !== attachmentLocalId));
    } catch (err) {
      console.error('❌ Delete photo failed:', err);
    }
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        {fieldName}
        <span className="ml-2 text-xs font-normal text-amber-600">(stored locally, uploads when synced)</span>
      </label>

      {/* Photo thumbnails */}
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map(photo => (
            <div key={photo.localId} className="relative group rounded-lg overflow-hidden aspect-square bg-gray-100">
              <img
                src={photo.data}
                alt={photo.file_name}
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => handleDeletePhoto(photo.localId)}
                className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Capture button */}
      <div className="flex gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"  // opens camera on mobile
          multiple
          onChange={handleFileSelect}
          className="hidden"
          id={`photo-${fieldId}`}
        />
        <label
          htmlFor={`photo-${fieldId}`}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 border-2 border-dashed border-gray-300 rounded-xl text-sm font-medium text-gray-600 cursor-pointer hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors ${capturing ? 'opacity-50 pointer-events-none' : ''}`}
        >
          {capturing ? (
            <>
              <span className="animate-spin">⏳</span> Processing…
            </>
          ) : (
            <>📷 {photos.length > 0 ? 'Add More Photos' : 'Take / Choose Photo'}</>
          )}
        </label>
      </div>
    </div>
  );
}

// Base64 conversion helper
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('FileReader failed'));
    reader.readAsDataURL(file);
  });
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function OfflineEditDraft() {
  const { localId } = useParams(); // integer local ID from route /work/offline/:localId/edit
  const navigate = useNavigate();

  const [entry,    setEntry]    = useState(null);
  const [contract, setContract] = useState(null);
  const [template, setTemplate] = useState(null);
  const [formData, setFormData] = useState({});
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState(null);

  const localIdInt = parseInt(localId, 10);

  // ── Load everything from IndexedDB ────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        // Load entry
        const localEntry = await db.workEntries.get(localIdInt);
        if (!localEntry) {
          setError('Entry not found. It may have been deleted or already synced.');
          setLoading(false);
          return;
        }
        if (localEntry.remoteId) {
          // Already synced — redirect to server detail
          navigate(`/work/${localEntry.remoteId}`, { replace: true });
          return;
        }

        setEntry(localEntry);
        setFormData(localEntry.data || {});

        // Load contract
        const c = await offlineDataService.getContractById(localEntry.contract_id);
        setContract(c);

        // Load template via junction table
        const jRows = await offlineDataService.getContractJunctionRows(localEntry.contract_id);
        let tpl = null;

        if (jRows.length > 0) {
          // Find the template matching the entry's template_id (UUID or slug)
          const matchingRow = jRows.find(
            jr => jr.template_id === localEntry.template_id ||
                  jr.templates?.template_id === localEntry.template_id ||
                  jr.templates?.id === localEntry.template_id
          ) ?? jRows.find(jr => jr.is_default) ?? jRows[0];

          tpl = matchingRow?.templates ?? null;
        }

        if (!tpl) {
          // Fallback: try by UUID/slug directly
          tpl = await offlineDataService.getTemplateById(localEntry.template_id);
        }

        setTemplate(tpl);

      } catch (err) {
        console.error('❌ OfflineEditDraft load:', err);
        setError('Failed to load entry. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [localIdInt, navigate]);

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      await db.workEntries.update(localIdInt, {
        data:       formData,
        updated_at: new Date().toISOString(),
        sync_status: 'pending' // ensure it stays pending for sync
      });

      console.log(`✅ Local draft updated (localId: ${localIdInt})`);
      navigate('/work/offline');
    } catch (err) {
      console.error('❌ Save local draft failed:', err);
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleFormDataChange = (newData) => {
    setFormData(newData);
  };

  // ── Extract photo fields from template ────────────────────────────────────
  const photoFields = [];
  if (template?.fields_schema?.sections) {
    for (const section of template.fields_schema.sections) {
      for (const field of section.fields || []) {
        if (field.field_type === 'photo') {
          photoFields.push({
            fieldId:   `${section.section_id}.${field.field_id}`,
            fieldName: field.field_name
          });
        }
      }
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center items-center min-h-[60vh]">
          <LoadingSpinner size="lg" />
        </div>
      </AppLayout>
    );
  }

  if (error || !entry) {
    return (
      <AppLayout>
        <div className="max-w-lg mx-auto px-4 pt-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <p className="text-red-800 font-medium mb-4">{error || 'Entry not found'}</p>
            <button
              onClick={() => navigate('/work/offline')}
              className="text-sm text-blue-600 underline"
            >
              ← Back to local drafts
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  const contractDisplay = contract
    ? `${contract.contract_number} — ${contract.contract_name}`
    : entry.contract_id?.slice(0, 8) + '…';

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-4 pb-24 pt-2">

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate('/work/offline')}
            className="text-gray-500 hover:text-gray-700 text-xl"
          >
            ←
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-gray-900 truncate">Edit Draft</h1>
            <p className="text-xs text-gray-500 truncate">{contractDisplay}</p>
          </div>
          <span className="text-xs font-medium bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full flex-shrink-0">
            Not synced
          </span>
        </div>

        {/* Offline badge */}
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
          <span className="text-sm mt-0.5">📡</span>
          <p className="text-xs text-amber-700">
            Editing local draft. Changes save to this device only. Entry syncs to server when you go online.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Basic info (read-only) */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Date</p>
              <p className="text-sm font-medium text-gray-900">
                {new Date(entry.entry_date + 'T00:00:00').toLocaleDateString('en-MY', {
                  weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
                })}
              </p>
            </div>
            {entry.shift && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Shift</p>
                <p className="text-sm font-medium text-gray-900 capitalize">{entry.shift}</p>
              </div>
            )}
            {template && (
              <div className="col-span-2">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Template</p>
                <p className="text-sm font-medium text-gray-900">{template.template_name}</p>
              </div>
            )}
          </div>
        </div>

        {/* Form fields */}
        {template ? (
          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Form Fields</h3>
            <DynamicForm
              template={template}
              contract={contract}
              initialData={formData}
              onChange={handleFormDataChange}
              onSubmit={handleSave}
              submitLabel={saving ? 'Saving…' : '💾 Save Draft'}
              showCancel={false}
              workEntryId={null} // no remoteId — disables online photo upload
            />
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
            <p className="text-sm text-amber-800">
              ⚠️ Template not cached. Form fields cannot be displayed.
              Connect to the internet, open WorkLedger, and navigate to your contracts to cache templates.
            </p>
          </div>
        )}

        {/* Photo capture section (offline) */}
        {photoFields.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Photos</h3>
            {photoFields.map(({ fieldId, fieldName }) => (
              <OfflinePhotoCapture
                key={fieldId}
                localId={localIdInt}
                fieldId={fieldId}
                fieldName={fieldName}
              />
            ))}
          </div>
        )}

        {/* Save button at bottom */}
        <div className="sticky bottom-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-2xl text-sm shadow-lg disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : '💾 Save Draft'}
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
