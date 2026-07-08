/**
 * WorkLedger - Template Preview Component
 * 
 * Displays a visual preview of template structure without rendering as a form.
 * Useful for template selection and review.
 * 
 * @module components/templates/TemplatePreview
 * @created January 31, 2026 - Session 12
 */

import React from 'react';
import { 
  DocumentTextIcon,
  CheckCircleIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline';

/**
 * Template Preview - Shows template structure
 */
export function TemplatePreview({ template, showMetadata = true }) {
  if (!template) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
        <p className="text-gray-500">No template selected</p>
      </div>
    );
  }

  // Field type icons and colors
  const getFieldTypeInfo = (fieldType) => {
    const types = {
      text: { icon: '📝', color: 'text-blue-600', label: 'Text' },
      number: { icon: '🔢', color: 'text-indigo-600', label: 'Number' },
      date: { icon: '📅', color: 'text-green-600', label: 'Date' },
      datetime: { icon: '⏰', color: 'text-green-600', label: 'Date & Time' },
      select: { icon: '📋', color: 'text-purple-600', label: 'Dropdown' },
      radio: { icon: '⭕', color: 'text-purple-600', label: 'Radio' },
      checkbox: { icon: '☑️', color: 'text-orange-600', label: 'Checkbox' },
      textarea: { icon: '📄', color: 'text-blue-600', label: 'Text Area' },
      photo: { icon: '📷', color: 'text-pink-600', label: 'Photo' },
      signature: { icon: '✍️', color: 'text-gray-600', label: 'Signature' },
      calculated: { icon: '🔢', color: 'text-yellow-600', label: 'Auto-calculated' }
    };

    return types[fieldType] || { icon: '❓', color: 'text-gray-600', label: fieldType };
  };

  return (
    <div className="space-y-4">
      {/* Template Header */}
      <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <DocumentTextIcon className="h-6 w-6 text-primary-600" />
              <h3 className="text-lg font-semibold text-primary-900">
                {template.template_name}
              </h3>
            </div>
            {template.description && (
              <p className="mt-2 text-sm text-primary-700">
                {template.description}
              </p>
            )}
          </div>

          <div className="flex flex-col items-end gap-1">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-primary-100 text-primary-800">
              v{template.version || '1.0'}
            </span>
            {template.is_locked && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-800">
                🔒 Locked
              </span>
            )}
          </div>
        </div>

        {/* Metadata */}
        {showMetadata && template.metadata && (
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            {template.metadata.estimated_completion_time && (
              <div>
                <span className="text-primary-600 font-medium">⏱️ Time:</span>
                <span className="ml-1 text-primary-700">
                  {template.metadata.estimated_completion_time}
                </span>
              </div>
            )}
            {template.metadata.approval_required !== undefined && (
              <div>
                <span className="text-primary-600 font-medium">✓ Approval:</span>
                <span className="ml-1 text-primary-700">
                  {template.metadata.approval_required ? 'Required' : 'Not required'}
                </span>
              </div>
            )}
            {template.metadata.offline_capable !== undefined && (
              <div>
                <span className="text-primary-600 font-medium">📱 Offline:</span>
                <span className="ml-1 text-primary-700">
                  {template.metadata.offline_capable ? 'Yes' : 'No'}
                </span>
              </div>
            )}
            <div>
              <span className="text-primary-600 font-medium">📝 Fields:</span>
              <span className="ml-1 text-primary-700">
                {template.fields_schema?.sections?.reduce((count, s) => count + (s.fields?.length || 0), 0) || 0}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Sections Preview */}
      {template.fields_schema?.sections && (
        <div className="space-y-3">
          {template.fields_schema.sections.map((section, sectionIndex) => (
            <div
              key={section.section_id || sectionIndex}
              className="bg-white border border-gray-200 rounded-lg p-4"
            >
              {/* Section Header */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="text-sm font-semibold text-gray-900">
                    {section.section_name}
                    {section.required && (
                      <span className="text-red-500 ml-1">*</span>
                    )}
                  </h4>
                  {section.description && (
                    <p className="mt-1 text-xs text-gray-600">
                      {section.description}
                    </p>
                  )}
                </div>
                <span className="text-xs text-gray-500">
                  {section.fields?.length || 0} fields
                </span>
              </div>

              {/* Fields List */}
              <div className="space-y-2">
                {section.fields?.map((field, fieldIndex) => {
                  const typeInfo = getFieldTypeInfo(field.field_type);
                  
                  return (
                    <div
                      key={field.field_id || fieldIndex}
                      className="flex items-center gap-2 text-xs bg-gray-50 rounded px-3 py-2"
                    >
                      <span className="text-base">{typeInfo.icon}</span>
                      <span className="flex-1 font-medium text-gray-900">
                        {field.field_name}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className={`${typeInfo.color} font-medium`}>
                          {typeInfo.label}
                        </span>
                        {field.required && (
                          <CheckCircleIcon className="h-4 w-4 text-green-600" title="Required" />
                        )}
                        {field.show_if && (
                          <ExclamationCircleIcon className="h-4 w-4 text-yellow-600" title="Conditional" />
                        )}
                        {field.auto_calculate && (
                          <span className="text-yellow-600" title="Auto-calculated">
                            🔢
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Section Layout Info */}
              {section.layout && section.layout !== 'single_column' && (
                <div className="mt-2 text-xs text-gray-500">
                  Layout: {section.layout.replace('_', ' ')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Template Info */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-600">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div>
            <span className="font-medium">Industry:</span>
            <span className="ml-1">{template.industry || 'N/A'}</span>
          </div>
          <div>
            <span className="font-medium">Category:</span>
            <span className="ml-1">{template.contract_category || 'N/A'}</span>
          </div>
          <div>
            <span className="font-medium">Template ID:</span>
            <span className="ml-1 font-mono">{template.template_id}</span>
          </div>
          <div>
            <span className="font-medium">Public:</span>
            <span className="ml-1">{template.is_public ? 'Yes' : 'No'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TemplatePreview;
