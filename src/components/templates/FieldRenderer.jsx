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

export default FieldRenderer;
