/**
 * WorkLedger - Section Editor Panel
 * 
 * Displays editable properties for the selected section.
 * Allows editing section_id, content, options, and binding rules.
 * 
 * @component
 * @created February 12, 2026 - Session 7
 */

import { useState, useEffect } from 'react';

export default function SectionEditorPanel({ 
  section, 
  sectionIndex,
  onUpdate,
  onClose 
}) {
  const [localSection, setLocalSection] = useState(section);

  // Update local state when section changes
  useEffect(() => {
    setLocalSection(section);
  }, [section]);

  /**
   * Update section field
   */
  const updateField = (field, value) => {
    const updated = {
      ...localSection,
      [field]: value
    };
    setLocalSection(updated);
    onUpdate(updated);
  };

  /**
   * Update nested field (content, options, binding_rules)
   */
  const updateNestedField = (parent, key, value) => {
    const updated = {
      ...localSection,
      [parent]: {
        ...localSection[parent],
        [key]: value
      }
    };
    setLocalSection(updated);
    onUpdate(updated);
  };

  /**
   * Remove nested field
   */
  const removeNestedField = (parent, key) => {
    const updated = { ...localSection };
    const parentObj = { ...updated[parent] };
    delete parentObj[key];
    updated[parent] = parentObj;
    setLocalSection(updated);
    onUpdate(updated);
  };

  return (
    <div className="w-80 bg-white border-l border-gray-200 p-4 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Section Properties</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600"
        >
          ✕
        </button>
      </div>

      {/* Section Number */}
      <div className="mb-4 p-3 bg-blue-50 rounded-lg">
        <div className="text-sm text-blue-800">
          Section {sectionIndex + 1}
        </div>
      </div>

      {/* Section ID */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Section ID
        </label>
        <input
          type="text"
          value={localSection.section_id}
          onChange={(e) => updateField('section_id', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
        />
        <p className="text-xs text-gray-500 mt-1">
          Unique identifier for this section
        </p>
      </div>

      {/* Block Type (Read-only) */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Block Type
        </label>
        <div className="px-3 py-2 bg-gray-100 rounded-lg text-sm text-gray-900">
          {localSection.block_type}
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Cannot be changed after creation
        </p>
      </div>

      {/* Content */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">
            Content
          </label>
          <button
            onClick={() => {
              const key = prompt('Content key:');
              if (key) {
                updateNestedField('content', key, '');
              }
            }}
            className="text-xs text-blue-600 hover:text-blue-700"
          >
            + Add
          </button>
        </div>

        <KeyValueEditor
          data={localSection.content}
          onUpdate={(key, value) => updateNestedField('content', key, value)}
          onRemove={(key) => removeNestedField('content', key)}
        />
      </div>

      {/* Options */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">
            Options
          </label>
          <button
            onClick={() => {
              const key = prompt('Option key:');
              if (key) {
                updateNestedField('options', key, '');
              }
            }}
            className="text-xs text-blue-600 hover:text-blue-700"
          >
            + Add
          </button>
        </div>

        <KeyValueEditor
          data={localSection.options}
          onUpdate={(key, value) => updateNestedField('options', key, value)}
          onRemove={(key) => removeNestedField('options', key)}
        />

        {/* Common Options Shortcuts */}
        <CommonOptions
          blockType={localSection.block_type}
          options={localSection.options}
          onUpdate={(key, value) => updateNestedField('options', key, value)}
        />
      </div>

      {/* Binding Rules */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">
            Binding Rules
          </label>
          <button
            onClick={() => {
              const key = prompt('Rule key:');
              if (key) {
                updateNestedField('binding_rules', key, '');
              }
            }}
            className="text-xs text-blue-600 hover:text-blue-700"
          >
            + Add
          </button>
        </div>

        <KeyValueEditor
          data={localSection.binding_rules}
          onUpdate={(key, value) => updateNestedField('binding_rules', key, value)}
          onRemove={(key) => removeNestedField('binding_rules', key)}
        />

        <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
          💡 Binding rules map data from work entries to this section
        </div>
      </div>
    </div>
  );
}

/**
 * Key-Value Editor Component
 */
function KeyValueEditor({ data, onUpdate, onRemove }) {
  const entries = Object.entries(data || {});

  if (entries.length === 0) {
    return (
      <div className="text-sm text-gray-500 italic p-2 bg-gray-50 rounded">
        No fields yet
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map(([key, value]) => (
        <div key={key} className="flex items-start gap-2">
          <div className="flex-1">
            <div className="text-xs text-gray-600 mb-1">{key}</div>
            <input
              type="text"
              value={typeof value === 'object' ? JSON.stringify(value) : value}
              onChange={(e) => {
                let newValue = e.target.value;
                // Try to parse as JSON
                try {
                  newValue = JSON.parse(newValue);
                } catch (e) {
                  // Keep as string
                }
                onUpdate(key, newValue);
              }}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={() => onRemove(key)}
            className="mt-6 p-1 text-red-600 hover:bg-red-50 rounded"
            title="Remove"
          >
            🗑️
          </button>
        </div>
      ))}
    </div>
  );
}

/**
 * Common Options Shortcuts
 */
function CommonOptions({ blockType, options, onUpdate }) {
  // Options based on block type
  const commonOptions = {
    detail_entry: [
      { key: 'columns', label: 'Columns', type: 'number', default: 2 },
      { key: 'layout', label: 'Layout', type: 'select', options: ['two_column', 'single_column'] }
    ],
    photo_grid: [
      { key: 'columns', label: 'Columns', type: 'number', default: 2 },
      { key: 'showTimestamps', label: 'Show Timestamps', type: 'checkbox', default: true },
      { key: 'showCaptions', label: 'Show Captions', type: 'checkbox', default: true }
    ],
    table: [
      { key: 'showHeaders', label: 'Show Headers', type: 'checkbox', default: true }
    ],
    checklist: [
      { key: 'showStatus', label: 'Show Status', type: 'checkbox', default: true }
    ],
    metrics_cards: [
      { key: 'columns', label: 'Columns', type: 'number', default: 3 }
    ]
  };

  const opts = commonOptions[blockType];

  if (!opts) {
    return null;
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-200">
      <div className="text-xs font-medium text-gray-700 mb-2">
        Quick Options
      </div>
      <div className="space-y-2">
        {opts.map((opt) => (
          <div key={opt.key}>
            {opt.type === 'number' && (
              <div>
                <label className="text-xs text-gray-600">{opt.label}</label>
                <input
                  type="number"
                  value={options[opt.key] || opt.default || ''}
                  onChange={(e) => onUpdate(opt.key, parseInt(e.target.value, 10))}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                />
              </div>
            )}

            {opt.type === 'checkbox' && (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={options[opt.key] !== undefined ? options[opt.key] : opt.default}
                  onChange={(e) => onUpdate(opt.key, e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-gray-700">{opt.label}</span>
              </label>
            )}

            {opt.type === 'select' && (
              <div>
                <label className="text-xs text-gray-600">{opt.label}</label>
                <select
                  value={options[opt.key] || opt.default || ''}
                  onChange={(e) => onUpdate(opt.key, e.target.value)}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                >
                  {opt.options.map(val => (
                    <option key={val} value={val}>{val}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
