/**
 * WorkLedger - Field Renderer Component (Updated for Session 15)
 * 
 * Renders individual form fields based on template field schema.
 * Now includes PhotoUpload and SignatureCanvas for photo/signature fields.
 * 
 * @module components/templates/FieldRenderer
 * @created January 31, 2026 - Session 12
 * @updated February 2, 2026 - Session 15 (Added photo & signature support)
 */

import React, { useState, useContext } from 'react';
import Input from '../common/Input';
// AINTERN ADDITION: optional AI polish for textarea fields (Session 4).
// When no AiPolishProvider is mounted, textareas render exactly as upstream.
import { AiPolishContext } from '../../context/AiPolishContext';
import PhotoUpload from '../attachments/PhotoUpload';
import SignatureCanvas from '../attachments/SignatureCanvas';

/**
 * Field Renderer - Renders individual field based on type
 * 
 * Supported field types:
 * - text, tel, email, url
 * - number, date, datetime, month, time
 * - select, radio, checkbox
 * - textarea
 * - list ✅ (AINTERN Phase A - point-form entries, e.g. daily activities)
 * - repeater ✅ (AINTERN Phase A.2 - repeated groups, e.g. multiple tasks/day)
 * - photo ✅ (Session 15)
 * - signature ✅ (Session 15)
 * - calculated
 */
export function FieldRenderer({
  field,
  section,
  value,
  onChange,
  error,
  contract = null,
  workEntryId = null // Required for photo/signature fields
}) {
  // Build field path for form data storage
  const fieldPath = `${section.section_id}.${field.field_id}`;

  // Handle field change
  const handleChange = (e) => {
    const newValue = e.target.type === 'checkbox' 
      ? e.target.checked 
      : e.target.value;
    
    onChange(fieldPath, newValue);
  };

  // Handle photo/signature change (array of attachment IDs)
  const handleAttachmentChange = (attachmentValue) => {
    onChange(fieldPath, attachmentValue);
  };

  // Get default value
  const getDefaultValue = () => {
    if (value !== undefined && value !== null) {
      return value;
    }
    
    // Handle default_value
    if (field.default_value) {
      if (field.default_value === 'now' && (field.field_type === 'date' || field.field_type === 'datetime')) {
        const now = new Date();
        if (field.field_type === 'date') {
          return now.toISOString().split('T')[0];
        } else {
          return now.toISOString().slice(0, 16);
        }
      }
      return field.default_value;
    }

    // Handle prefill_from contract
    if (field.prefill_from && contract) {
      const path = field.prefill_from.replace('contract.', '');
      return contract[path] || '';
    }

    // Default values by type
    switch (field.field_type) {
      case 'checkbox':
        return false;
      case 'number':
        return '';
      case 'photo':
        return []; // Array of attachment IDs
      case 'signature':
        return null; // Single attachment ID
      case 'list':
        return []; // Array of point-form strings (AINTERN addition)
      case 'repeater':
        return []; // Array of item objects, e.g. [{task_category, task_summary}]
      default:
        return '';
    }
  };

  const fieldValue = getDefaultValue();

  // Render based on field type
  switch (field.field_type) {
    case 'text':
      return (
        <Input
          name={fieldPath}
          value={fieldValue}
          onChange={handleChange}
          placeholder={field.placeholder || ''}
          error={error}
          required={field.required}
          disabled={field.read_only}
        />
      );

    case 'tel':
      return (
        <Input
          name={fieldPath}
          type="tel"
          value={fieldValue}
          onChange={handleChange}
          placeholder={field.placeholder || 'e.g. +60123456789'}
          error={error}
          required={field.required}
          disabled={field.read_only}
        />
      );

    case 'email':
      return (
        <Input
          name={fieldPath}
          type="email"
          value={fieldValue}
          onChange={handleChange}
          placeholder={field.placeholder || 'e.g. user@example.com'}
          error={error}
          required={field.required}
          disabled={field.read_only}
        />
      );

    case 'url':
      return (
        <Input
          name={fieldPath}
          type="url"
          value={fieldValue}
          onChange={handleChange}
          placeholder={field.placeholder || 'e.g. https://example.com'}
          error={error}
          required={field.required}
          disabled={field.read_only}
        />
      );

    case 'number':
      return (
        <Input
          name={fieldPath}
          type="number"
          value={fieldValue}
          onChange={handleChange}
          placeholder={field.placeholder || ''}
          error={error}
          required={field.required}
          disabled={field.read_only}
          min={field.min}
          max={field.max}
          step={field.step || '1'}
        />
      );

    case 'date':
      return (
        <Input
          name={fieldPath}
          type="date"
          value={fieldValue}
          onChange={handleChange}
          error={error}
          required={field.required}
          disabled={field.read_only}
        />
      );

    case 'datetime':
      return (
        <Input
          name={fieldPath}
          type="datetime-local"
          value={fieldValue}
          onChange={handleChange}
          error={error}
          required={field.required}
          disabled={field.read_only}
        />
      );

    case 'month':
      return (
        <Input
          name={fieldPath}
          type="month"
          value={fieldValue}
          onChange={handleChange}
          error={error}
          required={field.required}
          disabled={field.read_only}
        />
      );

    case 'time':
      return (
        <Input
          name={fieldPath}
          type="time"
          value={fieldValue}
          onChange={handleChange}
          error={error}
          required={field.required}
          disabled={field.read_only}
        />
      );

    case 'select':
      return (
        <div>
          <select
            name={fieldPath}
            value={fieldValue}
            onChange={handleChange}
            required={field.required}
            disabled={field.read_only}
            className={`w-full px-3 py-2 border rounded-md focus:ring-primary-500 focus:border-primary-500 ${
              error ? 'border-red-500' : 'border-gray-300'
            } ${field.read_only ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
          >
            <option value="">{field.placeholder || `Select ${field.field_name}...`}</option>
            {field.options && Array.isArray(field.options) && field.options.map((option, index) => (
              <option key={index} value={option}>{option}</option>
            ))}
          </select>
          {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        </div>
      );

    case 'radio':
      return (
        <div className="space-y-2">
          {field.options && field.options.map((option, index) => (
            <label key={index} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name={fieldPath}
                value={option}
                checked={fieldValue === option}
                onChange={handleChange}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                disabled={field.read_only}
              />
              <span className="text-sm text-gray-700">{option}</span>
            </label>
          ))}
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
        </div>
      );

    case 'checkbox':
      return (
        <div className="flex items-center">
          <input
            type="checkbox"
            name={fieldPath}
            id={fieldPath}
            checked={fieldValue}
            onChange={handleChange}
            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            disabled={field.read_only}
          />
          <label htmlFor={fieldPath} className="ml-2 text-sm text-gray-700">
            {field.field_name}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          {error && (
            <p className="ml-2 text-sm text-red-600">{error}</p>
          )}
        </div>
      );

    case 'textarea':
      // AINTERN ADDITION (Session 4): textareas gain a ✨ Polish button when
      // an AiPolishProvider is mounted above the form. Without a provider
      // this renders identically to upstream WorkLedger.
      return (
        <AinternPolishableTextarea
          fieldPath={fieldPath}
          field={field}
          fieldValue={fieldValue}
          handleChange={handleChange}
          onChange={onChange}
          error={error}
        />
      );

    case 'list':
      // AINTERN ADDITION (Phase A - PDF-import Case 1): point-form entries
      // (e.g. daily activities) instead of one freeform paragraph.
      return (
        <AinternListField
          fieldPath={fieldPath}
          field={field}
          fieldValue={Array.isArray(fieldValue) ? fieldValue : []}
          onChange={onChange}
          error={error}
        />
      );

    case 'repeater':
      // AINTERN ADDITION (Phase A.2): repeated groups of sub-fields (e.g.
      // Task category + description) — for days with multiple distinct
      // tasks/categories.
      return (
        <AinternRepeaterField
          fieldPath={fieldPath}
          field={field}
          fieldValue={Array.isArray(fieldValue) ? fieldValue : []}
          onChange={onChange}
          error={error}
        />
      );

    case 'photo':
      // Photo upload component (Session 15)
      if (!workEntryId) {
        return (
          <div className="border-2 border-dashed border-amber-300 rounded-lg p-4 bg-amber-50">
            <p className="text-sm text-amber-800">
              ⚠️ Photos can only be uploaded after saving the work entry as a draft.
            </p>
            <p className="text-xs text-amber-600 mt-1">
              Save this entry first, then you can add photos.
            </p>
          </div>
        );
      }

      return (
        <PhotoUpload
          workEntryId={workEntryId}
          fieldId={fieldPath}
          value={fieldValue} // Array of attachment IDs
          onChange={handleAttachmentChange}
          maxPhotos={field.max_photos || 3}
          disabled={field.read_only}
        />
      );

    case 'signature':
      // Signature canvas component (Session 15)
      if (!workEntryId) {
        return (
          <div className="border-2 border-dashed border-amber-300 rounded-lg p-4 bg-amber-50">
            <p className="text-sm text-amber-800">
              ⚠️ Signature can only be added after saving the work entry as a draft.
            </p>
            <p className="text-xs text-amber-600 mt-1">
              Save this entry first, then you can add your signature.
            </p>
          </div>
        );
      }

      return (
        <SignatureCanvas
          workEntryId={workEntryId}
          fieldId={fieldPath}
          value={fieldValue} // Single attachment ID
          onChange={handleAttachmentChange}
          disabled={field.read_only}
        />
      );

    case 'calculated':
      // Read-only calculated field
      return (
        <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-md">
          <span className="text-sm text-gray-700 font-medium">
            {fieldValue || 'Auto-calculated'}
          </span>
          <p className="text-xs text-gray-500 mt-1">
            This value is calculated automatically
          </p>
        </div>
      );

    default:
      return (
        <div className="px-3 py-2 bg-yellow-50 border border-yellow-300 rounded-md">
          <p className="text-sm text-yellow-800">
            Unsupported field type: {field.field_type}
          </p>
        </div>
      );
  }
}

// ─── AINTERN ADDITION (Session 4) ───────────────────────────────────────────
// Textarea with optional AI polish. Reads AiPolishContext; when absent,
// behaves exactly like the upstream plain textarea.
function AinternPolishableTextarea({ fieldPath, field, fieldValue, handleChange, onChange, error }) {
  const ai = useContext(AiPolishContext);
  const [busy, setBusy] = useState(false);
  const [polishError, setPolishError] = useState(null);
  const [prePolish, setPrePolish] = useState(null); // Session 5: undo

  const doPolish = async () => {
    if (!ai?.polish || !fieldValue?.trim()) return;
    setBusy(true);
    setPolishError(null);
    const original = fieldValue;
    const res = await ai.polish(fieldValue);
    setBusy(false);
    if (res?.success && res.text) {
      setPrePolish(original);
      onChange(fieldPath, res.text.trim());
    } else {
      setPolishError(res?.error || 'Polish failed');
    }
  };

  const undoPolish = () => {
    if (prePolish !== null) {
      onChange(fieldPath, prePolish);
      setPrePolish(null);
    }
  };

  return (
    <div>
      <textarea
        name={fieldPath}
        value={fieldValue}
        onChange={handleChange}
        placeholder={field.placeholder || ''}
        rows={field.rows || 4}
        disabled={field.read_only || busy}
        className={`w-full px-3 py-2 border rounded-md focus:ring-primary-500 focus:border-primary-500 ${
          error ? 'border-red-500' : 'border-gray-300'
        } ${busy ? 'opacity-60' : ''}`}
      />
      {ai?.polish && !field.read_only && (
        <div className="flex items-center gap-2 mt-1">
          <button
            type="button"
            onClick={doPolish}
            disabled={busy || !fieldValue?.trim()}
            className="text-xs font-medium px-2 py-1 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? 'Polishing…' : '✨ Polish with AI'}
          </button>
          {prePolish !== null && (
            <button
              type="button"
              onClick={undoPolish}
              className="text-xs font-medium px-2 py-1 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50"
            >
              ↩ Undo
            </button>
          )}
          {polishError && <span className="text-xs text-red-600">{polishError}</span>}
        </div>
      )}
    </div>
  );
}

// ─── AINTERN ADDITION (Phase A - PDF-import Case 1) ─────────────────────
// "list" field type: point-form entries (e.g. daily activities) instead of
// one freeform paragraph. Each row is its own short input with an optional
// ✨ Polish button, scoped to that single row's text — polishing the whole
// list at once risks the model merging or reordering distinct activities.
function AinternListField({ fieldPath, field, fieldValue, onChange, error }) {
  const ai = useContext(AiPolishContext);
  const [busyIndex, setBusyIndex] = useState(null);
  const [rowErrors, setRowErrors] = useState({});

  // Render at least one (possibly blank) row so there's always somewhere
  // to type; the underlying value only gains an entry once the user
  // actually types something (DynamicForm's required check treats an
  // all-blank array the same as an empty one).
  const items = fieldValue.length > 0 ? fieldValue : [''];

  const updateRow = (i, text) => {
    const next = [...items];
    next[i] = text;
    onChange(fieldPath, next);
  };

  const addRow = () => onChange(fieldPath, [...items, '']);

  const removeRow = (i) => {
    const next = items.filter((_, idx) => idx !== i);
    onChange(fieldPath, next.length > 0 ? next : []);
  };

  const polishRow = async (i) => {
    if (!ai?.polish || !items[i]?.trim()) return;
    setBusyIndex(i);
    setRowErrors((e) => ({ ...e, [i]: null }));
    const res = await ai.polish(items[i]);
    setBusyIndex(null);
    if (res?.success && res.text) {
      updateRow(i, res.text.trim());
    } else {
      setRowErrors((e) => ({ ...e, [i]: res?.error || 'Polish failed' }));
    }
  };

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="space-y-1">
          <div className="flex items-start gap-1.5">
            <span className="text-gray-400 mt-2.5 select-none">•</span>
            <textarea
              name={`${fieldPath}.${i}`}
              value={item}
              onChange={(e) => updateRow(i, e.target.value)}
              placeholder={field.placeholder || 'Add a point...'}
              rows={1}
              disabled={field.read_only || busyIndex === i}
              className={`flex-1 px-3 py-2 border rounded-md focus:ring-primary-500 focus:border-primary-500 resize-y ${
                error ? 'border-red-500' : 'border-gray-300'
              } ${busyIndex === i ? 'opacity-60' : ''}`}
            />
            {!field.read_only && items.length > 1 && (
              <button
                type="button"
                onClick={() => removeRow(i)}
                aria-label="Remove point"
                className="mt-1.5 text-gray-400 hover:text-red-500 px-1"
              >
                ✕
              </button>
            )}
          </div>
          {ai?.polish && !field.read_only && (
            <div className="flex items-center gap-2 pl-5">
              <button
                type="button"
                onClick={() => polishRow(i)}
                disabled={busyIndex === i || !item?.trim()}
                className="text-xs font-medium px-2 py-0.5 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {busyIndex === i ? 'Polishing…' : '✨ Polish'}
              </button>
              {rowErrors[i] && <span className="text-xs text-red-600">{rowErrors[i]}</span>}
            </div>
          )}
        </div>
      ))}
      {!field.read_only && (
        <button
          type="button"
          onClick={addRow}
          className="text-xs font-medium px-2 py-1 rounded-md border border-dashed border-gray-300 text-gray-500 hover:bg-gray-50"
        >
          + Add point
        </button>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

// ─── AINTERN ADDITION (Phase A.2 - repeatable Tasks Performed) ──────────
// "repeater" field type: N repeated groups of sub-fields (item_fields),
// added/removed with a button — for days with multiple distinct tasks or
// categories. Each item is a plain object keyed by the item_fields'
// field_id (these live inside one array value, not as their own top-level
// section.field path). Kept intentionally minimal — only "select" and
// "textarea" sub-fields are supported today (that's all Tasks Performed
// needs); it does not recurse through the full FieldRenderer switch.
// Per-item required flags are informational only: the only thing actually
// enforced is the repeater field itself being non-blank overall (see
// DynamicForm's isBlankArray check), so submission isn't blocked on a
// half-filled task the intern is still typing.
function AinternRepeaterField({ fieldPath, field, fieldValue, onChange, error }) {
  const ai = useContext(AiPolishContext);
  const itemFields = field.item_fields ?? [];
  const items = fieldValue.length > 0 ? fieldValue : [{}];
  const [busyKey, setBusyKey] = useState(null); // `${itemIndex}.${sub field_id}`
  const [rowErrors, setRowErrors] = useState({});

  const updateItem = (i, subFieldId, val) => {
    const next = items.map((it, idx) => (idx === i ? { ...it, [subFieldId]: val } : it));
    onChange(fieldPath, next);
  };

  const addItem = () => onChange(fieldPath, [...items, {}]);

  const removeItem = (i) => onChange(fieldPath, items.filter((_, idx) => idx !== i));

  const polishSubField = async (i, subFieldId) => {
    const key = `${i}.${subFieldId}`;
    const text = items[i]?.[subFieldId];
    if (!ai?.polish || !text?.trim()) return;
    setBusyKey(key);
    setRowErrors((e) => ({ ...e, [key]: null }));
    const res = await ai.polish(text);
    setBusyKey(null);
    if (res?.success && res.text) {
      updateItem(i, subFieldId, res.text.trim());
    } else {
      setRowErrors((e) => ({ ...e, [key]: res?.error || 'Polish failed' }));
    }
  };

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50/60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Task {i + 1}
            </span>
            {!field.read_only && items.length > 1 && (
              <button
                type="button"
                onClick={() => removeItem(i)}
                className="text-xs text-gray-400 hover:text-red-500"
              >
                ✕ Remove
              </button>
            )}
          </div>

          {itemFields.map((sf) => {
            const key = `${i}.${sf.field_id}`;
            const val = item[sf.field_id] ?? '';

            if (sf.field_type === 'select') {
              return (
                <div key={sf.field_id}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    {sf.field_name}{sf.required && <span className="text-red-500"> *</span>}
                  </label>
                  <select
                    value={val}
                    onChange={(e) => updateItem(i, sf.field_id, e.target.value)}
                    disabled={field.read_only}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-primary-500 focus:border-primary-500 bg-white"
                  >
                    <option value="">{sf.placeholder || `Select ${sf.field_name}...`}</option>
                    {(sf.options ?? []).map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              );
            }

            // textarea (the only other sub-field kind Tasks Performed needs)
            return (
              <div key={sf.field_id}>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {sf.field_name}{sf.required && <span className="text-red-500"> *</span>}
                </label>
                <textarea
                  value={val}
                  onChange={(e) => updateItem(i, sf.field_id, e.target.value)}
                  placeholder={sf.placeholder || ''}
                  rows={sf.rows || 3}
                  disabled={field.read_only || busyKey === key}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-primary-500 focus:border-primary-500 ${busyKey === key ? 'opacity-60' : ''}`}
                />
                {ai?.polish && !field.read_only && (
                  <div className="flex items-center gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => polishSubField(i, sf.field_id)}
                      disabled={busyKey === key || !val?.trim()}
                      className="text-xs font-medium px-2 py-1 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {busyKey === key ? 'Polishing…' : '✨ Polish with AI'}
                    </button>
                    {rowErrors[key] && <span className="text-xs text-red-600">{rowErrors[key]}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {!field.read_only && (
        <button
          type="button"
          onClick={addItem}
          className="text-xs font-medium px-3 py-1.5 rounded-md border border-dashed border-gray-300 text-gray-500 hover:bg-gray-50"
        >
          + Add task
        </button>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

export default FieldRenderer;
