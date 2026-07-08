/**
 * WorkLedger - Template Detail Page
 * 
 * View a template with full preview, metadata, and contract usage.
 * 
 * Features:
 *   - Template metadata (name, category, industry, version)
 *   - Full TemplatePreview component (Section 12 - reused)
 *   - Contracts using this template
 *   - Actions: Edit, Clone, Lock/Unlock, Delete
 *   - Test Form button (opens DynamicForm)
 * 
 * Route: /templates/:id
 * 
 * @module pages/templates/TemplateDetail
 * @created February 7, 2026 - Session 20
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { templateService, TEMPLATE_CATEGORIES, TEMPLATE_INDUSTRIES } from '../../services/api/templateService';
import AppLayout from '../../components/layout/AppLayout';
import TemplatePreview from '../../components/templates/TemplatePreview';
import DynamicForm from '../../components/templates/DynamicForm';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { useToast } from '../../context/ToastContext';

export default function TemplateDetail() {
  const toast = useToast();
  const navigate = useNavigate();
  const { id } = useParams();

  // Data
  const [template, setTemplate] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // UI
  const [activeTab, setActiveTab] = useState('preview'); // 'preview', 'contracts', 'test', 'json'
  const [cloneModal, setCloneModal] = useState(false);
  const [cloneName, setCloneName] = useState('');
  const [deleteModal, setDeleteModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // ============================================
  // LOAD DATA
  // ============================================

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [templateData, contractsData] = await Promise.all([
        templateService.getTemplate(id),
        templateService.getContractsUsingTemplate(id)
      ]);

      if (!templateData) {
        setError('Template not found');
        return;
      }

      setTemplate(templateData);
      setContracts(contractsData);
      setCloneName(`${templateData.template_name} (Copy)`);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // ACTIONS
  // ============================================

  const handleClone = async () => {
    if (!cloneName.trim()) {
      return;
    }
    try {
      setActionLoading(true);
      const result = await templateService.cloneTemplate(id, cloneName.trim());
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      navigate(`/templates/${result.data.id}`);
    } catch (err) {
      toast.error('Clone failed: ' + err.message);
    } finally {
      setActionLoading(false);
      setCloneModal(false);
    }
  };

  const handleDelete = async () => {
    try {
      setActionLoading(true);
      const result = await templateService.deleteTemplate(id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      navigate('/templates');
    } catch (err) {
      toast.error('Delete failed: ' + err.message);
    } finally {
      setActionLoading(false);
      setDeleteModal(false);
    }
  };

  const handleToggleLock = async () => {
    try {
      const result = await templateService.toggleLock(id);
      if (result.success) {
        setTemplate(prev => ({ ...prev, is_locked: !prev.is_locked }));
      }
    } catch (err) {
      console.error('Toggle lock failed:', err);
    }
  };

  // ============================================
  // HELPERS
  // ============================================

  const getCategoryLabel = (val) =>
    TEMPLATE_CATEGORIES.find(c => c.value === val)?.label || val || '-';

  const getIndustryLabel = (val) =>
    TEMPLATE_INDUSTRIES.find(i => i.value === val)?.label || val || '-';

  const formatDate = (d) => {
    if (!d) {
      return '-';
    }
    return new Date(d).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
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

  if (error || !template) {
    return (
      <AppLayout>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-700 mb-3">{error || 'Template not found'}</p>
          <button onClick={() => navigate('/templates')} className="text-sm text-blue-600 hover:underline">
            ← Back to Templates
          </button>
        </div>
      </AppLayout>
    );
  }

  const fieldCount = templateService.getFieldCount(template);
  const sectionCount = templateService.getSectionCount(template);

  return (
    <AppLayout>
      <div className="space-y-6">

        {/* Back + Header */}
        <div>
          <button
            onClick={() => navigate('/templates')}
            className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Templates
          </button>

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900">{template.template_name}</h1>
                {template.is_locked && <span title="Locked">🔒</span>}
              </div>
              <p className="text-sm text-gray-500 font-mono mt-0.5">{template.template_id}</p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => navigate(`/templates/${id}/edit`)}
                disabled={template.is_locked}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border ${
                  template.is_locked
                    ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                    : 'border-blue-200 text-blue-700 hover:bg-blue-50'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </button>

              <button
                onClick={() => setCloneModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-green-200 text-green-700 hover:bg-green-50"
              >
                📋 Clone
              </button>

              <button
                onClick={handleToggleLock}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50"
              >
                {template.is_locked ? '🔓 Unlock' : '🔒 Lock'}
              </button>

              <button
                onClick={() => setDeleteModal(true)}
                disabled={template.is_locked}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border ${
                  template.is_locked
                    ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                    : 'border-red-200 text-red-700 hover:bg-red-50'
                }`}
              >
                🗑️ Delete
              </button>
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-white border border-gray-200 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-gray-900">{sectionCount}</div>
            <div className="text-xs text-gray-500">Sections</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-gray-900">{fieldCount}</div>
            <div className="text-xs text-gray-500">Fields</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-gray-900">{contracts.length}</div>
            <div className="text-xs text-gray-500">Contracts</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-3 text-center">
            <span className="inline-flex px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-full">
              {template.contract_category?.toUpperCase() || '-'}
            </span>
            <div className="text-xs text-gray-500 mt-1">Category</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-3 text-center">
            <span className="text-sm font-medium text-gray-700">v{template.version || '1.0'}</span>
            <div className="text-xs text-gray-500 mt-1">Version</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <div className="flex gap-0">
            {[
              { id: 'preview', label: 'Preview', icon: '👁️' },
              { id: 'contracts', label: `Contracts (${contracts.length})`, icon: '📄' },
              { id: 'test', label: 'Test Form', icon: '🧪' },
              { id: 'json', label: 'JSON', icon: '{ }' }
            ].map(tab => (
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

        {/* ===== TAB: PREVIEW ===== */}
        {activeTab === 'preview' && (
          <div className="space-y-4">
            {/* Metadata */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Industry:</span>
                  <span className="ml-1 font-medium">{getIndustryLabel(template.industry)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Category:</span>
                  <span className="ml-1 font-medium">{getCategoryLabel(template.contract_category)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Public:</span>
                  <span className="ml-1 font-medium">{template.is_public ? 'Yes' : 'No'}</span>
                </div>
                <div>
                  <span className="text-gray-500">Created:</span>
                  <span className="ml-1 font-medium">{formatDate(template.created_at)}</span>
                </div>
              </div>
            </div>

            {/* TemplatePreview (reused from Session 12) */}
            <TemplatePreview template={template} showMetadata={false} />
          </div>
        )}

        {/* ===== TAB: CONTRACTS ===== */}
        {activeTab === 'contracts' && (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            {contracts.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p className="text-sm">No contracts are using this template yet.</p>
                <p className="text-xs mt-1 text-gray-400">
                  Assign this template when creating a new contract.
                </p>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contract</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Project / Client</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {contracts.map(contract => (
                    <tr
                      key={contract.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => navigate(`/contracts/${contract.id}`)}
                    >
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">
                          {contract.contract_name || contract.contract_number}
                        </div>
                        {contract.contract_number && contract.contract_name && (
                          <div className="text-xs text-gray-500">{contract.contract_number}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <div className="text-sm text-gray-700">
                          {contract.project?.project_name || '-'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {contract.project?.client_name || ''}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-600">{contract.contract_type || '-'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                          contract.status === 'active'
                            ? 'bg-green-50 text-green-700'
                            : contract.status === 'completed'
                              ? 'bg-gray-100 text-gray-600'
                              : 'bg-yellow-50 text-yellow-700'
                        }`}>
                          {contract.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ===== TAB: TEST FORM ===== */}
        {activeTab === 'test' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-blue-900 mb-1">Test Mode</h3>
              <p className="text-sm text-blue-700">
                This renders the template as a live form. Fill it out to verify field rendering, validation, and data collection.
                Submissions are logged to console only — no data is saved.
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <DynamicForm
                template={template}
                onSubmit={(data) => {
                  console.log('🧪 Test form submitted:', data);
                  toast.info('Form submitted successfully! Check console for collected data.');
                }}
              />
            </div>
          </div>
        )}

        {/* ===== TAB: JSON ===== */}
        {activeTab === 'json' && (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
              <span className="text-sm font-medium text-gray-700">fields_schema</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(template.fields_schema, null, 2));
                  toast.success('Copied to clipboard!');
                }}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                📋 Copy JSON
              </button>
            </div>
            <pre className="p-4 text-xs font-mono text-gray-700 overflow-x-auto max-h-[600px] overflow-y-auto">
              {JSON.stringify(template.fields_schema, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* ===== CLONE MODAL ===== */}
      {cloneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Clone Template</h3>
            <p className="text-sm text-gray-600 mb-4">
              Creating a copy of <span className="font-medium">{template.template_name}</span>
            </p>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Template Name</label>
            <input
              type="text"
              value={cloneName}
              onChange={(e) => setCloneName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-4 focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setCloneModal(false)}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleClone}
                disabled={!cloneName.trim() || actionLoading}
                className="px-4 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {actionLoading ? 'Cloning...' : 'Clone'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== DELETE MODAL ===== */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-red-700 mb-2">Delete Template</h3>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to delete <span className="font-medium">{template.template_name}</span>?
            </p>
            {contracts.filter(c => c.status === 'active').length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4 text-sm text-yellow-800">
                ⚠️ This template is used by {contracts.filter(c => c.status === 'active').length} active contract(s).
                Active contracts must be reassigned first.
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteModal(false)}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={actionLoading}
                className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
