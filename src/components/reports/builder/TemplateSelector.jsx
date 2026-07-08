/**
 * WorkLedger - Template Selector Modal
 * 
 * Modal to select a template for auto-generating a layout.
 * Shows templates with preview of what will be generated.
 * 
 * @component
 * @created February 17, 2026 - Session 8
 */

import { useState, useEffect } from 'react';
import { templateService } from '../../../services/api/templateService';
import { previewLayoutGeneration } from '../../../services/api/layoutGenerator';
import LoadingSpinner from '../../common/LoadingSpinner';

export default function TemplateSelector({ onSelect, onClose }) {
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  useEffect(() => {
    console.log('🔍 TemplateSelector: templates state changed, length =', templates.length);
    console.log('🔍 TemplateSelector: templates =', templates);
  }, [templates]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      console.log('🔍 TemplateSelector: Calling templateService.getTemplates()...');
      const result = await templateService.getTemplates();
      
      console.log('🔍 TemplateSelector: Service returned:', result);
      console.log('🔍 TemplateSelector: typeof result =', typeof result);
      console.log('🔍 TemplateSelector: Array.isArray(result) =', Array.isArray(result));
      
      // Handle different response formats
      let templatesData = [];
      
      if (Array.isArray(result)) {
        // Direct array response
        console.log('✅ TemplateSelector: Direct array format, length =', result.length);
        templatesData = result;
      } else if (result && typeof result === 'object') {
        // Object with success/data properties
        if (result.success && result.data) {
          console.log('✅ TemplateSelector: Object format with success=true, data.length =', result.data.length);
          templatesData = result.data;
        } else if (result.data) {
          console.log('✅ TemplateSelector: Object format with data, length =', result.data.length);
          templatesData = result.data;
        } else if (result.error) {
          console.error('❌ TemplateSelector: Service returned error:', result.error);
          setError(result.error);
          return;
        }
      }
      
      console.log('✅ TemplateSelector: Setting', templatesData.length, 'templates to state');
      setTemplates(templatesData || []);
      
    } catch (err) {
      console.error('❌ TemplateSelector: Exception:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateClick = async (template) => {
    setSelectedTemplate(template);
    
    try {
      // Generate preview
      const previewData = previewLayoutGeneration(template);
      setPreview(previewData);
    } catch (err) {
      setError('Failed to generate preview: ' + err.message);
    }
  };

  const handleConfirm = () => {
    if (selectedTemplate && preview) {
      onSelect({
        template: selectedTemplate,
        layoutData: preview
      });
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-5xl max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Create Layout from Template
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Select a template to auto-generate a matching report layout
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          
          {/* Left: Template List */}
          <div className="w-1/2 border-r border-gray-200 overflow-y-auto p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Available Templates
            </h3>

            {/* DEBUG PANEL */}
            <div className="bg-yellow-50 border border-yellow-300 rounded p-2 mb-3 text-xs font-mono">
              <div>loading: {String(loading)}</div>
              <div>error: {String(error)}</div>
              <div>templates.length: {templates.length}</div>
              <div>Array.isArray(templates): {String(Array.isArray(templates))}</div>
              <div>First template: {templates[0]?.template_name || 'N/A'}</div>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner />
              </div>
            ) : error ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">
                ⚠️ {error}
              </div>
            ) : null}
            
            {/* FORCE RENDER if we have templates */}
            {templates.length > 0 && (
              <div className="space-y-2">
                <div className="bg-green-100 border border-green-300 rounded p-2 text-xs text-green-900 mb-2">
                  🔍 DEBUG: Forcing render - {templates.length} templates
                </div>
                {templates.map(template => (
                  <button
                    key={template.id}
                    onClick={() => handleTemplateClick(template)}
                    className={`
                      w-full text-left p-3 rounded-lg border transition-colors
                      ${selectedTemplate?.id === template.id
                    ? 'bg-blue-50 border-blue-500'
                    : 'bg-white border-gray-200 hover:border-blue-300'
                  }
                    `}
                  >
                    <div className="font-medium text-gray-900 text-sm">
                      {template.template_name}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {template.contract_category || 'Custom'} • {template.fields_schema?.sections?.length || 0} sections
                    </div>
                  </button>
                ))}
              </div>
            )}
            
            {/* Empty state when truly no templates */}
            {!loading && !error && templates.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                No templates found
              </div>
            )}
          </div>

          {/* Right: Preview */}
          <div className="w-1/2 overflow-y-auto p-4">
            {!selectedTemplate ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <div className="text-5xl mb-4">📋</div>
                <p className="text-sm">Select a template to preview</p>
              </div>
            ) : preview ? (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">
                    Layout Preview
                  </h3>
                  
                  {/* Suggested Name */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                    <div className="text-xs text-blue-600 font-medium mb-1">
                      Suggested Layout Name
                    </div>
                    <div className="font-medium text-blue-900">
                      {preview.suggestedName}
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="bg-gray-50 rounded-lg p-3 mb-4">
                    <div className="text-xs text-gray-600 font-medium mb-2">
                      What will be created:
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-gray-600">Total Sections:</span>
                        <span className="ml-2 font-medium">{preview.summary.totalSections}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Detail Blocks:</span>
                        <span className="ml-2 font-medium">{preview.summary.detailSections}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Photo Sections:</span>
                        <span className="ml-2 font-medium">{preview.summary.photoSections}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Signatures:</span>
                        <span className="ml-2 font-medium">{preview.summary.hasSignatures ? 'Yes' : 'No'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section List */}
                <div>
                  <div className="text-xs text-gray-600 font-medium mb-2">
                    Sections to be created:
                  </div>
                  <div className="space-y-2">
                    {preview.sections.map((section, idx) => (
                      <div
                        key={idx}
                        className="bg-white border border-gray-200 rounded p-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">
                            {section.block_type === 'header' && '📄'}
                            {section.block_type === 'detail_entry' && '📝'}
                            {section.block_type === 'photo_grid' && '📸'}
                            {section.block_type === 'signature_box' && '✍️'}
                          </span>
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-900">
                              {section.content?.title || section.section_id}
                            </div>
                            <div className="text-xs text-gray-600">
                              {section.block_type}
                              {section.binding_rules?.template_section && 
                                ` → ${section.binding_rules.template_section}`
                              }
                              {section.binding_rules?.filter_by_field && 
                                ` → filter: ${section.binding_rules.filter_by_field}`
                              }
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex justify-center py-12">
                <LoadingSpinner />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {selectedTemplate ? (
              <span>✓ Template selected: <strong>{selectedTemplate.template_name}</strong></span>
            ) : (
              <span>Select a template to continue</span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selectedTemplate || !preview}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Generate Layout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
