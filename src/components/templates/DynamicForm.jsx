/**
 * WorkLedger - Dynamic Form Component
 *
 * Main form component that renders an entire template dynamically.
 * Now passes workEntryId to support photo/signature fields.
 *
 * @module components/templates/DynamicForm
 * @created January 31, 2026 - Session 12
 * @updated February 2, 2026 - Session 15: workEntryId support
 * @updated February 4, 2026 - FIXED: Added onChange callback to parent
 * @updated February 27, 2026 - Session 16: Fixed initialData sync for edit mode
 */

import React, { useState, useEffect } from 'react';
import SectionRenderer from './SectionRenderer';
import Button from '../common/Button';

/**
 * Dynamic Form - Renders complete form from template schema
 * 
 * Features:
 * - Dynamic rendering from template.fields_schema
 * - Form state management
 * - Validation against template.validation_rules
 * - Conditional field visibility
 * - Auto-prefilling from contract data
 * - Photo/signature support (Session 15)
 * - Parent notification via onChange (FIXED!)
 */
export function DynamicForm({
  template,
  contract = null,
  initialData = {},
  onChange,           // ✅ NEW: Callback to notify parent of data changes
  onSubmit,
  onCancel,
  submitLabel = 'Submit',
  showCancel = true,
  workEntryId = null  // Required for photo/signature fields
}) {
  const [formData, setFormData] = useState(initialData || {});
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ─── Sync initialData → formData whenever initialData reference changes ───
  // useState(initialData) only captures the value at first render.
  // In edit mode, EditWorkEntry renders DynamicForm AFTER workEntry loads,
  // but React may still mount DynamicForm with a stale initialData = {}.
  // This effect ensures formData always reflects the latest initialData.
  useEffect(() => {
    if (initialData && Object.keys(initialData).length > 0) {
      setFormData(prev => ({
        ...initialData,   // loaded entry data takes precedence
        ...prev          // keep any in-progress user edits on top
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData]);
  // Note: intentionally not including `prev` — we want a one-time sync per
  // initialData reference change, not every keystroke.

  // Initialize form with default values on mount
  useEffect(() => {
    if (template && Object.keys(formData).length === 0) {
      const defaultData = {};
      
      // Process each section
      template.fields_schema?.sections?.forEach(section => {
        section.fields?.forEach(field => {
          const fieldPath = `${section.section_id}.${field.field_id}`;
          
          // Skip if value already exists
          if (formData[fieldPath] !== undefined) {
            return;
          }

          // Handle default_value
          if (field.default_value) {
            if (field.default_value === 'now') {
              const now = new Date();
              if (field.field_type === 'date') {
                defaultData[fieldPath] = now.toISOString().split('T')[0];
              } else if (field.field_type === 'datetime') {
                defaultData[fieldPath] = now.toISOString().slice(0, 16);
              }
            } else {
              defaultData[fieldPath] = field.default_value;
            }
          }

          // Handle prefill_from contract
          if (field.prefill_from && contract) {
            const contractPath = field.prefill_from.replace('contract.', '');
            const value = getNestedValue(contract, contractPath);
            if (value) {
              defaultData[fieldPath] = value;
            }
          }

          // Set checkbox default to false if not set
          if (field.field_type === 'checkbox' && defaultData[fieldPath] === undefined) {
            defaultData[fieldPath] = false;
          }

          // Set photo field default to empty array
          if (field.field_type === 'photo' && defaultData[fieldPath] === undefined) {
            defaultData[fieldPath] = [];
          }

          // Set signature field default to null
          if (field.field_type === 'signature' && defaultData[fieldPath] === undefined) {
            defaultData[fieldPath] = null;
          }
        });
      });

      if (Object.keys(defaultData).length > 0) {
        const newData = { ...formData, ...defaultData };
        setFormData(newData);
        
        // ✅ Notify parent of initial default data
        if (onChange) {
          onChange(newData);
        }
      }
    }
  }, [template, contract]);

  /**
   * Get nested value from object using dot notation
   */
  const getNestedValue = (obj, path) => {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  };

  /**
   * Handle field change.
   *
   * SESSION 15 FIX: compute newData OUTSIDE the setFormData updater,
   * then call setFormData and onChange separately.
   *
   * The previous pattern called onChange(newData) INSIDE setFormData(prev => {...}),
   * which triggered WorkEntryForm's setFormData while DynamicForm was still
   * rendering — causing React's "Cannot update a component while rendering a
   * different component" warning and potential double-render loops.
   */
  const handleFieldChange = (fieldPath, value) => {
    // Compute new state outside the setter — safe, no stale-closure risk
    // because field changes are always user-triggered (never during render).
    const newData = { ...formData, [fieldPath]: value };

    // Update local state
    setFormData(newData);

    // Notify parent AFTER updating local state — not inside the setter
    if (onChange) {
      onChange(newData);
    }

    console.log('📝 Form data updated:', fieldPath, '=', value);

    // Clear error for this field
    if (errors[fieldPath]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldPath];
        return newErrors;
      });
    }
  };

  /**
   * Validate form data
   */
  const validateForm = () => {
    const newErrors = {};

    template.fields_schema?.sections?.forEach(section => {
      section.fields?.forEach(field => {
        const fieldPath = `${section.section_id}.${field.field_id}`;
        const value = formData[fieldPath];

        // Required validation
        if (field.required) {
          // AINTERN: an array with nothing meaningful in it counts as empty
          // too — a superset of the original length===0 check. Covers both
          // "list" fields (array of blank strings, e.g. an untouched single
          // row) and "repeater" fields (array of objects whose values are
          // all blank, e.g. an untouched task card). Photo/signature
          // attachment-id arrays are never blank strings/objects, so this
          // is a strict superset with no behavior change there.
          const isBlankEntry = (v) => {
            if (v && typeof v === 'object' && !Array.isArray(v)) {
              return Object.values(v).every((sub) => String(sub ?? '').trim() === '');
            }
            return String(v ?? '').trim() === '';
          };
          const isBlankArray = Array.isArray(value) && value.every(isBlankEntry);
          if (value === undefined || value === null || value === '' || isBlankArray) {
            newErrors[fieldPath] = `${field.field_name} is required`;
          }
        }

        // Field-specific validation
        if (value && field.field_type === 'email') {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) {
            newErrors[fieldPath] = 'Invalid email format';
          }
        }

        if (value && field.field_type === 'url') {
          try {
            new URL(value);
          } catch {
            newErrors[fieldPath] = 'Invalid URL format';
          }
        }

        if (value && field.field_type === 'number') {
          if (field.min !== undefined && parseFloat(value) < field.min) {
            newErrors[fieldPath] = `Must be at least ${field.min}`;
          }
          if (field.max !== undefined && parseFloat(value) > field.max) {
            newErrors[fieldPath] = `Must be at most ${field.max}`;
          }
        }
      });
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate
    if (!validateForm()) {
      console.error('❌ Form validation failed');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit(formData);
    } catch (error) {
      console.error('❌ Form submission failed:', error);
      setErrors({ _form: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!template || !template.fields_schema) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-yellow-900">Invalid template: Missing fields_schema</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Form Errors */}
      {errors._form && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-900">{errors._form}</p>
        </div>
      )}

      {/* Warning if no workEntryId (for photo/signature fields) */}
      {!workEntryId && template.fields_schema.sections?.some(s => 
        s.fields?.some(f => f.field_type === 'photo' || f.field_type === 'signature')
      ) && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-900">
            ⚠️ This form contains photo or signature fields. Save as draft first to enable these fields.
          </p>
        </div>
      )}

      {/* Render Sections */}
      {template.fields_schema.sections?.map((section, index) => (
        <SectionRenderer
          key={section.section_id || index}
          section={section}
          formData={formData}
          errors={errors}
          onChange={handleFieldChange}
          contract={contract}
          workEntryId={workEntryId}
        />
      ))}

      {/* Form Actions */}
      <div className="flex gap-3 pt-6 border-t">
        {showCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Submitting...' : submitLabel}
        </Button>
      </div>
    </form>
  );
}

export default DynamicForm;