/**
 * WorkLedger - Section Renderer Component (Updated for Session 15)
 * 
 * Renders a section of the template with its fields.
 * Now passes workEntryId to FieldRenderer for photo/signature support.
 * 
 * @module components/templates/SectionRenderer
 * @created January 31, 2026 - Session 12
 * @updated February 2, 2026 - Session 15 (Added workEntryId support)
 */

import React from 'react';
import FieldRenderer from './FieldRenderer';

/**
 * Section Renderer - Renders a section and its fields
 * 
 * Features:
 * - Section header with description
 * - Field layout (single/two column/checklist)
 * - Conditional field visibility (show_if)
 * - Field validation
 */
export function SectionRenderer({
  section,
  formData,
  errors,
  onChange,
  contract = null,
  workEntryId = null // ← NEW: For photo/signature fields
}) {
  /**
   * Check if field should be displayed based on show_if condition
   */
  const shouldShowField = (field) => {
    if (!field.show_if) {
      return true;
    }

    const { field: conditionField, equals } = field.show_if;

    // Get the value of the conditional field
    const fieldValue = getFieldValue(conditionField);

    // Check if condition is met
    return fieldValue === equals;
  };

  /**
   * Get field value from formData
   * Handles different path formats
   */
  const getFieldValue = (fieldPath) => {
    // Try direct path first
    if (formData[fieldPath] !== undefined) {
      return formData[fieldPath];
    }

    // Try with section prefix if not already exists
    const cleanPath = fieldPath.replace(`${section.section_id}.`, '');
    const fullPath = `${section.section_id}.${cleanPath}`;
    return formData[fullPath] || formData[cleanPath] || '';
  };

  /**
   * Get layout class based on section layout type
   */
  const getLayoutClass = () => {
    const layout = section.layout || 'single_column';

    switch (layout) {
      case 'two_column':
        return 'grid grid-cols-1 md:grid-cols-2 gap-4';
      case 'checklist':
        return 'grid grid-cols-1 md:grid-cols-2 gap-3';
      case 'single_column':
      default:
        return 'space-y-4';
    }
  };

  /**
   * Check if field should show label separately
   */
  const shouldShowLabel = (field) => {
    // Checkboxes and radios include their own labels
    return field.field_type !== 'checkbox' && field.field_type !== 'radio';
  };

  // Filter fields that should be shown
  const visibleFields = section.fields.filter(shouldShowField);

  // Don't render section if no visible fields
  if (visibleFields.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      {/* Section Header */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900">
          {section.section_name}
          {section.required && (
            <span className="text-red-500 ml-1">*</span>
          )}
        </h3>
        {section.description && (
          <p className="mt-1 text-sm text-gray-600">
            {section.description}
          </p>
        )}
      </div>

      {/* Section Fields */}
      <div className={getLayoutClass()}>
        {visibleFields.map((field, index) => {
          const fieldPath = `${section.section_id}.${field.field_id}`;
          const fieldValue = getFieldValue(fieldPath);
          const fieldError = errors[fieldPath];

          return (
            <div key={field.field_id || index} className="space-y-1">
              {/* Field Label */}
              {shouldShowLabel(field) && (
                <label
                  htmlFor={fieldPath}
                  className="block text-sm font-medium text-gray-700"
                >
                  {field.field_name}
                  {field.required && (
                    <span className="text-red-500 ml-1">*</span>
                  )}
                  {field.help_text && (
                    <span className="ml-2 text-xs text-gray-500 font-normal">
                      ({field.help_text})
                    </span>
                  )}
                </label>
              )}

              {/* Field Input */}
              <FieldRenderer
                field={field}
                section={section}
                value={fieldValue}
                onChange={onChange}
                error={fieldError}
                contract={contract}
                workEntryId={workEntryId} // ← Pass workEntryId to field renderer
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default SectionRenderer;
