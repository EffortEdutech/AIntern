/**
 * WorkLedger - Template List Page (Production)
 * 
 * Replaces /demo/templates with proper template management.
 * 
 * Features:
 *   - Template table with search & filters
 *   - Category and industry filters
 *   - Contract usage count per template
 *   - Actions: View, Edit, Clone, Delete
 *   - Create new template button
 *   - Locked template indicator
 * 
 * @module pages/templates/TemplateListPage
 * @created February 7, 2026 - Session 20
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { templateService, TEMPLATE_CATEGORIES, TEMPLATE_INDUSTRIES } from '../../services/api/templateService';
import AppLayout from '../../components/layout/AppLayout';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { useToast } from '../../context/ToastContext';

export default function TemplateListPage() {
  const toast = useToast();
  const navigate = useNavigate();

  // Data
  const [templates, setTemplates] = useState([]);
  const [contractCounts, setContractCounts] = useState({}); // { templateId: count }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [industryFilter, setIndustryFilter] = useState('');

  // Modals
  const [cloneModal, setCloneModal] = useState(null); // template to clone
  const [cloneName, setCloneName] = useState('');
  const [deleteModal, setDeleteModal] = useState(null); // template to delete
  const [actionLoading, setActionLoading] = useState(false);

  // ============================================
  // DATA LOADING
  // ============================================

  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const filters = {};
      if (categoryFilter) {
        filters.contract_category = categoryFilter;
      }
      if (industryFilter) {
        filters.industry = industryFilter;
      }

      const data = await templateService.getTemplates(filters);
      setTemplates(data);

      // Load contract counts for each template
      const counts = {};
      await Promise.all(
        data.map(async (t) => {
          try {
            const contracts = await templateService.getContractsUsingTemplate(t.id);
            counts[t.id] = contracts.length;
          } catch {
            counts[t.id] = 0;
          }
        })
      );
      setContractCounts(counts);

    } catch (err) {
      console.error('❌ Failed to load templates:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, industryFilter]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // ============================================
  // FILTERED DATA
  // ============================================

  const filteredTemplates = templates.filter(t => {
    if (!search) {
      return true;
    }
    const q = search.toLowerCase();
    return (
      t.template_name?.toLowerCase().includes(q) ||
      t.template_id?.toLowerCase().includes(q) ||
      t.contract_category?.toLowerCase().includes(q) ||
      t.industry?.toLowerCase().includes(q)
    );
  });

  // ============================================
  // ACTIONS
  // ============================================

  const handleClone = async () => {
    if (!cloneModal || !cloneName.trim()) {
      return;
    }
    try {
      setActionLoading(true);
      const result = await templateService.cloneTemplate(cloneModal.id, cloneName.trim());
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setCloneModal(null);
      setCloneName('');
      await loadTemplates();
    } catch (err) {
      toast.error('Failed to clone: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal) {
      return;
    }
    try {
      setActionLoading(true);
      const result = await templateService.deleteTemplate(deleteModal.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setDeleteModal(null);
      await loadTemplates();
    } catch (err) {
      toast.error('Failed to delete: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleLock = async (template) => {
    try {
      const result = await templateService.toggleLock(template.id);
      if (result.success) {
        setTemplates(prev =>
          prev.map(t => t.id === template.id ? { ...t, is_locked: !t.is_locked } : t)
        );
      }
    } catch (err) {
      console.error('Failed to toggle lock:', err);
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
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <AppLayout>
      <div className="space-y-6">

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Templates</h1>
            <p className="text-sm text-gray-600 mt-1">
              Manage work entry templates — {templates.length} template{templates.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => navigate('/templates/new')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Template
          </button>
        </div>

        {/* Filters Bar */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search templates..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              {TEMPLATE_CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>

            {/* Industry Filter */}
            <select
              value={industryFilter}
              onChange={(e) => setIndustryFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Industries</option>
              {TEMPLATE_INDUSTRIES.map(i => (
                <option key={i.value} value={i.value}>{i.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : filteredTemplates.length === 0 ? (
          /* Empty State */
          <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <h3 className="mt-3 text-sm font-medium text-gray-900">
              {search || categoryFilter || industryFilter ? 'No templates match your filters' : 'No templates yet'}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {search || categoryFilter || industryFilter
                ? 'Try adjusting your search or filters.'
                : 'Create your first template to get started.'}
            </p>
            {!search && !categoryFilter && !industryFilter && (
              <button
                onClick={() => navigate('/templates/new')}
                className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
              >
                Create Template
              </button>
            )}
          </div>
        ) : (
          /* Template Table */
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Template</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Industry</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Fields</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Contracts</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">Version</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredTemplates.map(template => {
                    const fieldCount = templateService.getFieldCount(template);
                    const sectionCount = templateService.getSectionCount(template);
                    const usageCount = contractCounts[template.id] || 0;

                    return (
                      <tr
                        key={template.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => navigate(`/templates/${template.id}`)}
                      >
                        {/* Template Name */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {template.is_locked && (
                              <span title="Locked" className="text-amber-500">🔒</span>
                            )}
                            <div>
                              <div className="text-sm font-medium text-gray-900">{template.template_name}</div>
                              <div className="text-xs text-gray-500 font-mono">{template.template_id}</div>
                            </div>
                          </div>
                        </td>

                        {/* Category */}
                        <td className="px-4 py-3">
                          <span className="inline-flex px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-full">
                            {template.contract_category?.toUpperCase() || '-'}
                          </span>
                        </td>

                        {/* Industry */}
                        <td className="px-4 py-3 hidden md:table-cell text-sm text-gray-600">
                          {getIndustryLabel(template.industry)}
                        </td>

                        {/* Fields */}
                        <td className="px-4 py-3 text-center">
                          <div className="text-sm font-medium text-gray-900">{fieldCount}</div>
                          <div className="text-xs text-gray-500">{sectionCount} sec</div>
                        </td>

                        {/* Contracts Using */}
                        <td className="px-4 py-3 text-center hidden sm:table-cell">
                          <span className={`text-sm font-medium ${usageCount > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                            {usageCount}
                          </span>
                        </td>

                        {/* Version */}
                        <td className="px-4 py-3 text-center hidden lg:table-cell">
                          <span className="text-xs text-gray-500">v{template.version || '1.0'}</span>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            {/* Edit */}
                            <button
                              onClick={() => navigate(`/templates/${template.id}/edit`)}
                              disabled={template.is_locked}
                              title={template.is_locked ? 'Locked — clone instead' : 'Edit'}
                              className={`p-1.5 rounded hover:bg-gray-100 ${template.is_locked ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:text-blue-600'}`}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>

                            {/* Clone */}
                            <button
                              onClick={() => {
                                setCloneModal(template);
                                setCloneName(`${template.template_name} (Copy)`);
                              }}
                              title="Clone"
                              className="p-1.5 rounded text-gray-500 hover:text-green-600 hover:bg-gray-100"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </button>

                            {/* Lock/Unlock */}
                            <button
                              onClick={() => handleToggleLock(template)}
                              title={template.is_locked ? 'Unlock' : 'Lock'}
                              className="p-1.5 rounded text-gray-500 hover:text-amber-600 hover:bg-gray-100"
                            >
                              {template.is_locked ? '🔒' : '🔓'}
                            </button>

                            {/* Delete */}
                            <button
                              onClick={() => setDeleteModal(template)}
                              disabled={template.is_locked}
                              title={template.is_locked ? 'Unlock first' : 'Delete'}
                              className={`p-1.5 rounded hover:bg-gray-100 ${template.is_locked ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:text-red-600'}`}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ===== CLONE MODAL ===== */}
      {cloneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Clone Template</h3>
            <p className="text-sm text-gray-600 mb-4">
              Creating a copy of <span className="font-medium">{cloneModal.template_name}</span>
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
                onClick={() => {
                  setCloneModal(null); setCloneName(''); 
                }}
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
              Are you sure you want to delete <span className="font-medium">{deleteModal.template_name}</span>?
              This action can be undone by an admin.
            </p>
            {(contractCounts[deleteModal.id] || 0) > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4 text-sm text-yellow-800">
                ⚠️ This template is used by {contractCounts[deleteModal.id]} contract(s).
                Active contracts must be reassigned first.
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteModal(null)}
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
