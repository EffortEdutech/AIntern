/**
 * WorkLedger - Field Renderer Component
 * 
 * Renders individual form fields based on template field schema.
 * Supports 10+ field types with validation and conditional rendering.
 * 
 * @module components/templates/FieldRenderer
 * @created January 31, 2026 - Session 12
 * @updated January 31, 2026 - Fixed select dropdown using native HTML
 */

import React from 'react';
import Input from '../common/Input';
// NOT USING Select component - using native HTML select instead!
// import Select from '../common/Select';

/**
 * Field Renderer - Renders individual field based on type
 * 
 * Supported field types:
 * - text, number, date, datetime, time
 * - select, radio, checkbox
 * - textarea
 * - photo (placeholder for Session 15)
 * - signature (placeholder for future)
 */
export function FieldRenderer({
  field,
  section,
  value,
  onChange,
  error,
  contract = null
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
      // FIX: Use native HTML select instead of custom Select component!
      // Debug log
      if (!field.options || !Array.isArray(field.options)) {
        console.warn(`⚠️ Field ${field.field_id} has no options array:`, field);
      } else {
        console.log(`✅ Field ${field.field_id} has ${field.options.length} options:`, field.options);
      }
      
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
            <option value="">
              {field.placeholder || `Select ${field.field_name}...`}
            </option>
            {field.options && Array.isArray(field.options) && field.options.map((option, index) => (
              <option key={index} value={option}>
                {option}
              </option>
            ))}
          </select>
          {error && (
            <p className="mt-1 text-sm text-red-600">{error}</p>
          )}
        </div>
      );

    case 'radio':
      // Debug log
      if (!field.options || !Array.isArray(field.options)) {
        console.warn(`⚠️ Field ${field.field_id} has no options array:`, field);
      }
      
      return (
        <div className="space-y-2">
          {field.options && Array.isArray(field.options) && field.options.map((option, index) => (
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
          {(!field.options || !Array.isArray(field.options) || field.options.length === 0) && (
            <p className="text-sm text-red-600">No options available for this field</p>
          )}
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
      return (
        <textarea
          name={fieldPath}
          value={fieldValue}
          onChange={handleChange}
          placeholder={field.placeholder || ''}
          rows={field.rows || 4}
          disabled={field.read_only}
          className={`w-full px-3 py-2 border rounded-md focus:ring-primary-500 focus:border-primary-500 ${
            error ? 'border-red-500' : 'border-gray-300'
          }`}
        />
      );

    case 'photo':
      // Placeholder - will be implemented in Session 15 (Attachments)
      return (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
          <div className="text-gray-400">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="mt-2 text-sm text-gray-500">
            Photo upload (Session 15)
          </p>
          <p className="text-xs text-gray-400">
            Click to upload or drag and drop
          </p>
        </div>
      );

    case 'signature':
      // Placeholder - will be implemented in future session
      return (
        <div className="border-2 border-gray-300 rounded-lg p-6 text-center bg-gray-50">
          <p className="text-sm text-gray-500">
            Signature capture (Future session)
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Draw or upload signature
          </p>
        </div>
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

export default FieldRenderer;
