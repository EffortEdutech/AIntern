/**
 * WorkLedger - Template System Demo Page
 * 
 * Demo page for testing the template system with real templates.
 * Shows template selection, preview, and dynamic form rendering.
 * 
 * @module pages/demo/TemplateDemoPage
 * @created January 31, 2026 - Session 12
 */

import React, { useState, useEffect } from 'react';
import AppLayout from '../../components/layout/AppLayout';
import TemplatePreview from '../../components/templates/TemplatePreview';
import DynamicForm from '../../components/templates/DynamicForm';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Button from '../../components/common/Button';
import { templateService } from '../../services/api/templateService';
import { contractService } from '../../services/api/contractService';
import { useToast } from '../../context/ToastContext';

export function TemplateDemoPage() {
  const toast = useToast();
  const [templates, setTemplates] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedContract, setSelectedContract] = useState(null);
  const [view, setView] = useState('select'); // 'select', 'preview', 'form'
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({});

  // Load templates and contracts on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      const [templatesData, contractsData] = await Promise.all([
        templateService.getTemplates(),
        contractService.getUserContracts()
      ]);

      setTemplates(templatesData || []);
      setContracts(contractsData || []);

      console.log('✅ Loaded templates:', templatesData?.length);
      console.log('✅ Loaded contracts:', contractsData?.length);
    } catch (error) {
      console.error('❌ Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle template selection
  const handleSelectTemplate = async (template) => {
    setSelectedTemplate(template);
    setView('preview');
    setFormData({});
  };

  // Handle contract selection
  const handleSelectContract = (contract) => {
    setSelectedContract(contract);
    // Clear form data when contract changes
    setFormData({});
  };

  // Handle view form
  const handleViewForm = () => {
    setView('form');
  };

  // Handle form submission
  const handleFormSubmit = async (data) => {
    console.log('📝 Form submitted:', data);
    setFormData(data);
    
    toast.info('Form submitted successfully! Check console for data.');
  };

  // Handle form cancel
  const handleFormCancel = () => {
    setView('preview');
  };

  // Loading state
  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center items-center min-h-[60vh]">
          <LoadingSpinner size="lg" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            Template System Demo
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Test the dynamic form system with real templates from your database.
          </p>
        </div>

        {/* View Selector */}
        <div className="mb-6 flex items-center gap-2">
          <Button
            variant={view === 'select' ? 'primary' : 'secondary'}
            onClick={() => setView('select')}
            size="sm"
          >
            Select Template
          </Button>
          <Button
            variant={view === 'preview' ? 'primary' : 'secondary'}
            onClick={() => setView('preview')}
            size="sm"
            disabled={!selectedTemplate}
          >
            Preview Template
          </Button>
          <Button
            variant={view === 'form' ? 'primary' : 'secondary'}
            onClick={() => setView('form')}
            size="sm"
            disabled={!selectedTemplate}
          >
            Fill Form
          </Button>
        </div>

        {/* Content based on view */}
        {view === 'select' && (
          <div className="space-y-6">
            {/* Contract Selection */}
            {contracts.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Select Contract (Optional)
                </h2>
                <p className="text-sm text-gray-600 mb-4">
                  Select a contract to prefill form data from contract information.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {contracts.map((contract) => (
                    <button
                      key={contract.id}
                      onClick={() => handleSelectContract(contract)}
                      className={`text-left p-4 border rounded-lg transition-colors ${
                        selectedContract?.id === contract.id
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 hover:border-primary-300'
                      }`}
                    >
                      <div className="font-medium text-gray-900">
                        {contract.contract_number}
                      </div>
                      <div className="text-sm text-gray-600">
                        {contract.contract_name}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {contract.project?.project_name}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Template Selection */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Select Template
              </h2>
              
              {templates.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">No templates found in database.</p>
                  <p className="text-sm text-gray-400 mt-2">
                    Please insert templates using database seeds.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {templates.map((template) => {
                    const summary = templateService.getTemplateSummary(template);
                    
                    return (
                      <button
                        key={template.id}
                        onClick={() => handleSelectTemplate(template)}
                        className={`text-left p-4 border rounded-lg transition-all hover:shadow-md ${
                          selectedTemplate?.id === template.id
                            ? 'border-primary-500 bg-primary-50'
                            : 'border-gray-200 hover:border-primary-300'
                        }`}
                      >
                        <div className="font-semibold text-gray-900 mb-1">
                          {template.template_name}
                        </div>
                        <div className="text-xs text-gray-500 mb-3">
                          {template.contract_category?.toUpperCase()} · v{template.version}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-gray-600">Sections:</span>
                            <span className="ml-1 font-medium">{summary.sectionCount}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Fields:</span>
                            <span className="ml-1 font-medium">{summary.fieldCount}</span>
                          </div>
                        </div>
                        {summary.estimatedTime && (
                          <div className="mt-2 text-xs text-gray-500">
                            ⏱️ {summary.estimatedTime}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'preview' && selectedTemplate && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">
                Template Preview
              </h2>
              <Button onClick={handleViewForm} variant="primary">
                Fill This Form →
              </Button>
            </div>

            <TemplatePreview template={selectedTemplate} showMetadata={true} />
          </div>
        )}

        {view === 'form' && selectedTemplate && (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-blue-900 mb-1">
                Demo Mode
              </h3>
              <p className="text-sm text-blue-700">
                This form is fully functional. Fill it out and click Submit to see the collected data in the console.
                {selectedContract && (
                  <span className="block mt-1">
                    Contract data will be prefilled where configured in template.
                  </span>
                )}
              </p>
            </div>

            <DynamicForm
              template={selectedTemplate}
              contract={selectedContract}
              initialData={formData}
              onSubmit={handleFormSubmit}
              onCancel={handleFormCancel}
              submitLabel="Submit Demo Form"
              showCancel={true}
            />

            {/* Show submitted data */}
            {Object.keys(formData).length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="text-sm font-medium text-green-900 mb-2">
                  ✅ Form Data Submitted
                </h3>
                <pre className="text-xs text-green-800 overflow-auto bg-white p-3 rounded border border-green-200">
                  {JSON.stringify(formData, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export default TemplateDemoPage;
