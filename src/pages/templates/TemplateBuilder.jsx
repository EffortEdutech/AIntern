/**
 * WorkLedger - Template Builder Page
 * 
 * Visual form builder for creating and editing templates.
 * 
 * Tabs:
 *   1. Template Info — name, category, industry, version, public/private
 *   2. Form Builder — add/remove/reorder sections & fields, configure properties
 *   3. Preview — live preview using existing TemplatePreview component
 * 
 * Used for:
 *   /templates/new  — create mode
 *   /templates/:id/edit — edit mode
 * 
 * @module pages/templates/TemplateBuilder
 * @created February 7, 2026 - Session 20
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  templateService,
  FIELD_TYPES,
  TEMPLATE_CATEGORIES,
  TEMPLATE_INDUSTRIES,
  SECTION_LAYOUTS
} from '../../services/api/templateService';
import AppLayout from '../../components/layout/AppLayout';
import TemplatePreview from '../../components/templates/TemplatePreview';
import LoadingSpinner from '../../components/common/LoadingSpinner';

// ============================================
// CONSTANTS
// ============================================

const TABS = [
  { id: 'info', label: 'Template Info', icon: '📋' },
  { id: 'builder', label: 'Form Builder', icon: '🔧' },
  { id: 'preview', label: 'Preview', icon: '👁️' }
];

const PREFILL_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'contract.contract_number', label: 'Contract Number' },
  { value: 'contract.contract_name', label: 'Contract Name' },
  { value: 'contract.client_name', label: 'Client Name' },
  { value: 'contract.site_name', label: 'Site Name' },
  { value: 'contract.period', label: 'Contract Period' }
];

// ============================================
// MAIN COMPONENT
// ============================================

export default function TemplateBuilder() {
  const navigate = useNavigate();
  const { id } = useParams(); // undefined = create mode
  const isEdit = Boolean(id);

  // ============================================
  // STATE
  // ============================================

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [activeTab, setActiveTab] = useState('info');

  // Template data
  const [templateInfo, setTemplateInfo] = useState({
    template_name: '',
    industry: 'maintenance',
    contract_category: 'custom',
    report_type: '',
    version: '1.0',
    is_public: true
  });

  const [sections, setSections] = useState([
    templateService.createBlankSection(0)
  ]);

  // UI state
  const [expandedSections, setExpandedSections] = useState({ 0: true });
  const [editingField, setEditingField] = useState(null); // { sectionIdx, fieldIdx }

  // ============================================
  // LOAD EXISTING (Edit mode)
  // ============================================

  useEffect(() => {
    if (isEdit) {
      loadTemplate();
    }
  }, [id]);

  const loadTemplate = async () => {
    try {
      setLoading(true);
      const template = await templateService.getTemplate(id);

      if (!template) {
        setError('Template not found');
        return;
      }

      if (template.is_locked) {
        setError('This template is locked. Clone it to make changes.');
        return;
      }

      setTemplateInfo({
        template_name: template.template_name || '',
        industry: template.industry || 'maintenance',
        contract_category: template.contract_category || 'custom',
        report_type: template.report_type || '',
        version: template.version || '1.0',
        is_public: template.is_public !== false
      });

      const loadedSections = template.fields_schema?.sections || [];
      setSections(loadedSections.length > 0 ? loadedSections : [templateService.createBlankSection(0)]);

      // Expand first section
      setExpandedSections({ 0: true });

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // SAVE
  // ============================================

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const templateData = {
        ...templateInfo,
        fields_schema: { sections },
        validation_rules: {},
        pdf_layout: {}
      };

      // Validate
      const tempId = isEdit ? id : templateService.generateTemplateId(templateData);
      const validation = templateService.validateTemplateSchema({
        template_id: tempId,
        template_name: templateData.template_name,
        fields_schema: templateData.fields_schema
      });

      if (!validation.isValid) {
        setError(validation.errors.join('\n'));
        return;
      }

      let result;
      if (isEdit) {
        result = await templateService.updateTemplate(id, templateData);
      } else {
        result = await templateService.createTemplate(templateData);
      }

      if (!result.success) {
        setError(result.error);
        return;
      }

      setSuccess(isEdit ? 'Template updated!' : 'Template created!');

      // Navigate to template list after short delay
      setTimeout(() => {
        navigate('/templates');
      }, 1000);

    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ============================================
  // SECTION OPERATIONS
  // ============================================

  const addSection = () => {
    const newSection = templateService.createBlankSection(sections.length);
    setSections(prev => [...prev, newSection]);
    setExpandedSections(prev => ({ ...prev, [sections.length]: true }));
  };

  const removeSection = (idx) => {
    if (sections.length <= 1) {
      return;
    }
    setSections(prev => prev.filter((_, i) => i !== idx));
    setEditingField(null);
  };

  const moveSection = (idx, direction) => {
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= sections.length) {
      return;
    }
    setSections(prev => {
      const copy = [...prev];
      [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
      return copy;
    });
  };

  const updateSection = (idx, updates) => {
    setSections(prev => prev.map((s, i) => i === idx ? { ...s, ...updates } : s));
  };

  const toggleSectionExpand = (idx) => {
    setExpandedSections(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  // ============================================
  // FIELD OPERATIONS
  // ============================================

  const addField = (sectionIdx) => {
    const section = sections[sectionIdx];
    const newField = templateService.createBlankField(section.fields.length);
    setSections(prev => prev.map((s, i) =>
      i === sectionIdx ? { ...s, fields: [...s.fields, newField] } : s
    ));
    // Auto-open field editor
    setEditingField({ sectionIdx, fieldIdx: section.fields.length });
  };

  const removeField = (sectionIdx, fieldIdx) => {
    setSections(prev => prev.map((s, i) =>
      i === sectionIdx
        ? { ...s, fields: s.fields.filter((_, fi) => fi !== fieldIdx) }
        : s
    ));
    if (editingField?.sectionIdx === sectionIdx && editingField?.fieldIdx === fieldIdx) {
      setEditingField(null);
    }
  };

  const moveField = (sectionIdx, fieldIdx, direction) => {
    const newIdx = fieldIdx + direction;
    const section = sections[sectionIdx];
    if (newIdx < 0 || newIdx >= section.fields.length) {
      return;
    }
    setSections(prev => prev.map((s, i) => {
      if (i !== sectionIdx) {
        return s;
      }
      const fields = [...s.fields];
      [fields[fieldIdx], fields[newIdx]] = [fields[newIdx], fields[fieldIdx]];
      return { ...s, fields };
    }));
    // Update editing reference
    if (editingField?.sectionIdx === sectionIdx && editingField?.fieldIdx === fieldIdx) {
      setEditingField({ sectionIdx, fieldIdx: newIdx });
    }
  };

  const updateField = (sectionIdx, fieldIdx, updates) => {
    setSections(prev => prev.map((s, i) => {
      if (i !== sectionIdx) {
        return s;
      }
      return {
        ...s,
        fields: s.fields.map((f, fi) => fi === fieldIdx ? { ...f, ...updates } : f)
      };
    }));
  };

  // ============================================
  // FIELD OPTIONS (for select/radio)
  // ============================================

  const addOption = (sectionIdx, fieldIdx) => {
    const field = sections[sectionIdx].fields[fieldIdx];
    updateField(sectionIdx, fieldIdx, {
      options: [...(field.options || []), '']
    });
  };

  const updateOption = (sectionIdx, fieldIdx, optIdx, value) => {
    const field = sections[sectionIdx].fields[fieldIdx];
    const options = [...(field.options || [])];
    options[optIdx] = value;
    updateField(sectionIdx, fieldIdx, { options });
  };

  const removeOption = (sectionIdx, fieldIdx, optIdx) => {
    const field = sections[sectionIdx].fields[fieldIdx];
    updateField(sectionIdx, fieldIdx, {
      options: (field.options || []).filter((_, i) => i !== optIdx)
    });
  };

  // ============================================
  // COMPUTED
  // ============================================

  const totalFields = sections.reduce((sum, s) => sum + (s.fields?.length || 0), 0);

  const previewTemplate = {
    ...templateInfo,
    template_id: templateService.generateTemplateId(templateInfo),
    fields_schema: { sections }
  };

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isEdit ? 'Edit Template' : 'New Template'}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">
              {sections.length} section{sections.length !== 1 ? 's' : ''} · {totalFields} field{totalFields !== 1 ? 's' : ''}
            </span>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : isEdit ? 'Update Template' : 'Create Template'}
            </button>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 whitespace-pre-line">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
            ✅ {success}
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <div className="flex gap-0">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ===== TAB 1: TEMPLATE INFO ===== */}
        {activeTab === 'info' && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Template Information</h2>

            {/* Template Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Template Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={templateInfo.template_name}
                onChange={(e) => setTemplateInfo(prev => ({ ...prev, template_name: e.target.value }))}
                placeholder="e.g., Preventive Maintenance Daily Report"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contract Category</label>
                <select
                  value={templateInfo.contract_category}
                  onChange={(e) => setTemplateInfo(prev => ({ ...prev, contract_category: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  {TEMPLATE_CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              {/* Industry */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
                <select
                  value={templateInfo.industry}
                  onChange={(e) => setTemplateInfo(prev => ({ ...prev, industry: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  {TEMPLATE_INDUSTRIES.map(i => (
                    <option key={i.value} value={i.value}>{i.label}</option>
                  ))}
                </select>
              </div>

              {/* Report Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Report Type</label>
                <input
                  type="text"
                  value={templateInfo.report_type}
                  onChange={(e) => setTemplateInfo(prev => ({ ...prev, report_type: e.target.value }))}
                  placeholder="e.g., daily_checklist, monthly_summary"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              {/* Version */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Version</label>
                <input
                  type="text"
                  value={templateInfo.version}
                  onChange={(e) => setTemplateInfo(prev => ({ ...prev, version: e.target.value }))}
                  placeholder="1.0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>

            {/* Public toggle */}
            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={templateInfo.is_public}
                  onChange={(e) => setTemplateInfo(prev => ({ ...prev, is_public: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
              <div>
                <span className="text-sm font-medium text-gray-700">Public Template</span>
                <p className="text-xs text-gray-500">Visible to all organizations</p>
              </div>
            </div>

            {/* Generated Template ID preview */}
            <div className="bg-gray-50 rounded-lg p-3">
              <span className="text-xs text-gray-500">Generated ID: </span>
              <span className="text-xs font-mono text-gray-700">
                {templateService.generateTemplateId(templateInfo) || '—'}
              </span>
            </div>
          </div>
        )}

        {/* ===== TAB 2: FORM BUILDER ===== */}
        {activeTab === 'builder' && (
          <div className="space-y-4">

            {/* Sections */}
            {sections.map((section, sIdx) => (
              <div key={section.section_id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">

                {/* Section Header */}
                <div
                  className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200 cursor-pointer"
                  onClick={() => toggleSectionExpand(sIdx)}
                >
                  {/* Expand/Collapse */}
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform ${expandedSections[sIdx] ? 'rotate-90' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>

                  {/* Section Name (inline edit) */}
                  <input
                    type="text"
                    value={section.section_name}
                    onChange={(e) => updateSection(sIdx, { section_name: e.target.value })}
                    onClick={(e) => e.stopPropagation()}
                    placeholder={`Section ${sIdx + 1} Name`}
                    className="flex-1 bg-transparent text-sm font-semibold text-gray-900 border-none focus:ring-0 p-0 placeholder-gray-400"
                  />

                  {/* Section badges */}
                  <span className="text-xs text-gray-400">
                    {section.fields?.length || 0} fields
                  </span>

                  {/* Section actions */}
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => moveSection(sIdx, -1)}
                      disabled={sIdx === 0}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                      title="Move up"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => moveSection(sIdx, 1)}
                      disabled={sIdx === sections.length - 1}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                      title="Move down"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => removeSection(sIdx)}
                      disabled={sections.length <= 1}
                      className="p-1 text-gray-400 hover:text-red-500 disabled:opacity-30"
                      title="Remove section"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Section Body (expanded) */}
                {expandedSections[sIdx] && (
                  <div className="p-4 space-y-3">
                    {/* Section properties row */}
                    <div className="flex flex-wrap gap-3 text-sm">
                      <div className="flex items-center gap-1">
                        <label className="text-xs text-gray-500">Layout:</label>
                        <select
                          value={section.layout || 'single_column'}
                          onChange={(e) => updateSection(sIdx, { layout: e.target.value })}
                          className="text-xs border border-gray-200 rounded px-2 py-1"
                        >
                          {SECTION_LAYOUTS.map(l => (
                            <option key={l.value} value={l.value}>{l.label}</option>
                          ))}
                        </select>
                      </div>
                      <label className="flex items-center gap-1 text-xs text-gray-500">
                        <input
                          type="checkbox"
                          checked={section.required || false}
                          onChange={(e) => updateSection(sIdx, { required: e.target.checked })}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        Required section
                      </label>
                      <div className="flex-1">
                        <input
                          type="text"
                          value={section.description || ''}
                          onChange={(e) => updateSection(sIdx, { description: e.target.value })}
                          placeholder="Section description (optional)"
                          className="w-full text-xs border border-gray-200 rounded px-2 py-1"
                        />
                      </div>
                    </div>

                    {/* Fields List */}
                    {section.fields?.length === 0 ? (
                      <div className="text-center py-6 text-sm text-gray-400 border border-dashed border-gray-200 rounded-lg">
                        No fields yet. Click "Add Field" below.
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {section.fields.map((field, fIdx) => {
                          const typeInfo = FIELD_TYPES.find(t => t.value === field.field_type);
                          const isEditing = editingField?.sectionIdx === sIdx && editingField?.fieldIdx === fIdx;

                          return (
                            <div key={field.field_id}>
                              {/* Field row */}
                              <div
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                                  isEditing ? 'border-blue-300 bg-blue-50' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                                }`}
                                onClick={() => setEditingField(isEditing ? null : { sectionIdx: sIdx, fieldIdx: fIdx })}
                              >
                                <span className="text-base" title={typeInfo?.label}>{typeInfo?.icon || '📝'}</span>

                                <input
                                  type="text"
                                  value={field.field_name}
                                  onChange={(e) => updateField(sIdx, fIdx, { field_name: e.target.value })}
                                  onClick={(e) => e.stopPropagation()}
                                  placeholder="Field name"
                                  className="flex-1 bg-transparent text-sm text-gray-900 border-none focus:ring-0 p-0 placeholder-gray-400"
                                />

                                <span className="text-xs text-gray-400 hidden sm:inline">{typeInfo?.label || field.field_type}</span>

                                {field.required && (
                                  <span className="text-xs text-red-500 font-medium">*</span>
                                )}

                                {/* Field actions */}
                                <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={() => moveField(sIdx, fIdx, -1)}
                                    disabled={fIdx === 0}
                                    className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs"
                                  >↑</button>
                                  <button
                                    onClick={() => moveField(sIdx, fIdx, 1)}
                                    disabled={fIdx === section.fields.length - 1}
                                    className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs"
                                  >↓</button>
                                  <button
                                    onClick={() => removeField(sIdx, fIdx)}
                                    className="p-0.5 text-gray-400 hover:text-red-500 text-xs"
                                  >✕</button>
                                </div>
                              </div>

                              {/* Field Property Editor (inline expand) */}
                              {isEditing && (
                                <div className="ml-8 mt-1 mb-2 p-3 bg-white border border-blue-200 rounded-lg space-y-3">
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {/* Field Type */}
                                    <div>
                                      <label className="block text-xs font-medium text-gray-600 mb-1">Field Type</label>
                                      <select
                                        value={field.field_type}
                                        onChange={(e) => updateField(sIdx, fIdx, { field_type: e.target.value })}
                                        className="w-full text-sm border border-gray-300 rounded px-2 py-1.5"
                                      >
                                        {FIELD_TYPES.map(t => (
                                          <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                                        ))}
                                      </select>
                                    </div>

                                    {/* Field ID */}
                                    <div>
                                      <label className="block text-xs font-medium text-gray-600 mb-1">Field ID</label>
                                      <input
                                        type="text"
                                        value={field.field_id}
                                        onChange={(e) => updateField(sIdx, fIdx, { field_id: e.target.value.replace(/[^a-z0-9_]/gi, '_').toLowerCase() })}
                                        className="w-full text-sm font-mono border border-gray-300 rounded px-2 py-1.5"
                                      />
                                    </div>

                                    {/* Placeholder */}
                                    <div>
                                      <label className="block text-xs font-medium text-gray-600 mb-1">Placeholder</label>
                                      <input
                                        type="text"
                                        value={field.placeholder || ''}
                                        onChange={(e) => updateField(sIdx, fIdx, { placeholder: e.target.value })}
                                        className="w-full text-sm border border-gray-300 rounded px-2 py-1.5"
                                      />
                                    </div>

                                    {/* Default Value */}
                                    <div>
                                      <label className="block text-xs font-medium text-gray-600 mb-1">Default Value</label>
                                      <input
                                        type="text"
                                        value={field.default_value || ''}
                                        onChange={(e) => updateField(sIdx, fIdx, { default_value: e.target.value })}
                                        placeholder='e.g., "now", "current_month"'
                                        className="w-full text-sm border border-gray-300 rounded px-2 py-1.5"
                                      />
                                    </div>

                                    {/* Prefill From */}
                                    <div>
                                      <label className="block text-xs font-medium text-gray-600 mb-1">Prefill From Contract</label>
                                      <select
                                        value={field.prefill_from || ''}
                                        onChange={(e) => updateField(sIdx, fIdx, { prefill_from: e.target.value })}
                                        className="w-full text-sm border border-gray-300 rounded px-2 py-1.5"
                                      >
                                        {PREFILL_OPTIONS.map(p => (
                                          <option key={p.value} value={p.value}>{p.label}</option>
                                        ))}
                                      </select>
                                    </div>

                                    {/* Description */}
                                    <div>
                                      <label className="block text-xs font-medium text-gray-600 mb-1">Help Text</label>
                                      <input
                                        type="text"
                                        value={field.description || ''}
                                        onChange={(e) => updateField(sIdx, fIdx, { description: e.target.value })}
                                        className="w-full text-sm border border-gray-300 rounded px-2 py-1.5"
                                      />
                                    </div>
                                  </div>

                                  {/* Checkboxes row */}
                                  <div className="flex flex-wrap gap-4">
                                    <label className="flex items-center gap-1.5 text-sm">
                                      <input
                                        type="checkbox"
                                        checked={field.required || false}
                                        onChange={(e) => updateField(sIdx, fIdx, { required: e.target.checked })}
                                        className="rounded border-gray-300 text-blue-600"
                                      />
                                      Required
                                    </label>
                                    <label className="flex items-center gap-1.5 text-sm">
                                      <input
                                        type="checkbox"
                                        checked={field.auto_calculate || false}
                                        onChange={(e) => updateField(sIdx, fIdx, { auto_calculate: e.target.checked })}
                                        className="rounded border-gray-300 text-blue-600"
                                      />
                                      Auto-calculate
                                    </label>
                                  </div>

                                  {/* Formula (if auto_calculate) */}
                                  {field.auto_calculate && (
                                    <div>
                                      <label className="block text-xs font-medium text-gray-600 mb-1">Formula</label>
                                      <input
                                        type="text"
                                        value={field.formula || ''}
                                        onChange={(e) => updateField(sIdx, fIdx, { formula: e.target.value })}
                                        placeholder="e.g., field_a + field_b"
                                        className="w-full text-sm font-mono border border-gray-300 rounded px-2 py-1.5"
                                      />
                                    </div>
                                  )}

                                  {/* Options editor (for select/radio) */}
                                  {['select', 'radio'].includes(field.field_type) && (
                                    <div>
                                      <label className="block text-xs font-medium text-gray-600 mb-1">
                                        Options ({(field.options || []).length})
                                      </label>
                                      <div className="space-y-1">
                                        {(field.options || []).map((opt, optIdx) => (
                                          <div key={optIdx} className="flex items-center gap-1">
                                            <span className="text-xs text-gray-400 w-5">{optIdx + 1}.</span>
                                            <input
                                              type="text"
                                              value={opt}
                                              onChange={(e) => updateOption(sIdx, fIdx, optIdx, e.target.value)}
                                              placeholder={`Option ${optIdx + 1}`}
                                              className="flex-1 text-sm border border-gray-200 rounded px-2 py-1"
                                            />
                                            <button
                                              onClick={() => removeOption(sIdx, fIdx, optIdx)}
                                              className="text-xs text-gray-400 hover:text-red-500 p-1"
                                            >✕</button>
                                          </div>
                                        ))}
                                        <button
                                          onClick={() => addOption(sIdx, fIdx)}
                                          className="text-xs text-blue-600 hover:text-blue-800 mt-1"
                                        >
                                          + Add Option
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                  {/* Conditional visibility */}
                                  <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                      Show If (Conditional)
                                    </label>
                                    <div className="flex gap-2">
                                      <input
                                        type="text"
                                        value={field.show_if?.field || ''}
                                        onChange={(e) => updateField(sIdx, fIdx, {
                                          show_if: e.target.value
                                            ? { field: e.target.value, value: field.show_if?.value || '' }
                                            : null
                                        })}
                                        placeholder="field_id (e.g., section_id.field_id)"
                                        className="flex-1 text-sm font-mono border border-gray-200 rounded px-2 py-1"
                                      />
                                      {field.show_if?.field && (
                                        <input
                                          type="text"
                                          value={field.show_if?.value || ''}
                                          onChange={(e) => updateField(sIdx, fIdx, {
                                            show_if: { ...field.show_if, value: e.target.value }
                                          })}
                                          placeholder="equals value"
                                          className="flex-1 text-sm border border-gray-200 rounded px-2 py-1"
                                        />
                                      )}
                                    </div>
                                    <p className="text-xs text-gray-400 mt-0.5">Only show this field when another field has a specific value</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Add Field button */}
                    <button
                      onClick={() => addField(sIdx)}
                      className="w-full py-2 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-500 hover:border-blue-300 hover:text-blue-600 transition-colors"
                    >
                      + Add Field
                    </button>
                  </div>
                )}
              </div>
            ))}

            {/* Add Section button */}
            <button
              onClick={addSection}
              className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-sm font-medium text-gray-500 hover:border-blue-300 hover:text-blue-600 transition-colors"
            >
              + Add Section
            </button>
          </div>
        )}

        {/* ===== TAB 3: PREVIEW ===== */}
        {activeTab === 'preview' && (
          <div className="space-y-4">
            {templateInfo.template_name ? (
              <TemplatePreview template={previewTemplate} showMetadata={true} />
            ) : (
              <div className="bg-white border border-gray-200 rounded-lg p-12 text-center text-gray-500">
                Enter a template name to see preview.
              </div>
            )}
          </div>
        )}

        {/* Bottom Save Button (always visible) */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <button
            onClick={() => navigate('/templates')}
            className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : isEdit ? 'Update Template' : 'Create Template'}
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
