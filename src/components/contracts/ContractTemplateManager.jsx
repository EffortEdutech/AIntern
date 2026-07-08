/**
 * WorkLedger - Contract Template Manager
 *
 * Reusable component for assigning/removing/labelling templates on a contract.
 * Used in ContractDetail (and optionally EditContract).
 *
 * Features:
 *  - List of assigned templates with label, default badge, remove button
 *  - "Set as Default" button (single-click, clears others)
 *  - Inline editable label (click to rename, e.g. "HVAC Checklist")
 *  - Add template via dropdown — shows all available templates
 *    (already-assigned ones are disabled in the dropdown)
 *  - Auto-selects first template as default when list is empty
 *
 * @module components/contracts/ContractTemplateManager
 * @created February 22, 2026 - Session 14
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  PlusIcon,
  TrashIcon,
  StarIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolid } from '@heroicons/react/24/solid';
import { contractService } from '../../services/api/contractService';
import { templateService }  from '../../services/api/templateService';

export default function ContractTemplateManager({ contractId, readOnly = false }) {

  const [assignments, setAssignments]       = useState([]);   // contract_templates rows
  const [allTemplates, setAllTemplates]     = useState([]);   // full templates list
  const [loading, setLoading]               = useState(true);
  const [adding, setAdding]                 = useState(false);
  const [selectedNewId, setSelectedNewId]   = useState('');   // template to add
  const [newLabel, setNewLabel]             = useState('');   // optional label for new
  const [error, setError]                   = useState(null);

  // Per-row edit state: { [assignmentId]: { editing: bool, label: string } }
  const [editState, setEditState] = useState({});

  // ── Load data ──────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!contractId) {
      return;
    }
    try {
      setLoading(true);
      const [assigned, templates] = await Promise.all([
        contractService.getContractTemplates(contractId),
        templateService.getTemplates()
      ]);
      setAssignments(assigned);
      setAllTemplates(templates);
      console.log('✅ ContractTemplateManager loaded:', assigned.length, 'assignments');
    } catch (err) {
      console.error('❌ ContractTemplateManager load error:', err);
      setError('Failed to load templates.');
    } finally {
      setLoading(false);
    }
  }, [contractId]);

  useEffect(() => {
    load(); 
  }, [load]);

  // ── Derived ────────────────────────────────────────────────
  const assignedIds = new Set(assignments.map(a => a.template_id));

  const availableToAdd = allTemplates.filter(t => !assignedIds.has(t.id));

  // ── Add template ───────────────────────────────────────────
  const handleAdd = async () => {
    if (!selectedNewId) {
      return;
    }
    setError(null);
    const result = await contractService.addContractTemplate(
      contractId,
      selectedNewId,
      { label: newLabel.trim() || null }
    );
    if (!result.success) {
      setError(result.error);
      return;
    }
    setSelectedNewId('');
    setNewLabel('');
    setAdding(false);
    load();
  };

  // ── Remove ─────────────────────────────────────────────────
  const handleRemove = async (assignmentId) => {
    if (!window.confirm('Remove this template from the contract?')) {
      return;
    }
    setError(null);
    const result = await contractService.removeContractTemplate(assignmentId, contractId);
    if (!result.success) {
      setError(result.error); return; 
    }
    load();
  };

  // ── Set default ────────────────────────────────────────────
  const handleSetDefault = async (assignmentId) => {
    setError(null);
    const result = await contractService.setDefaultContractTemplate(contractId, assignmentId);
    if (!result.success) {
      setError(result.error); return; 
    }
    load();
  };

  // ── Edit label ─────────────────────────────────────────────
  const startEdit = (a) => {
    setEditState(prev => ({
      ...prev,
      [a.id]: { editing: true, label: a.label || '' }
    }));
  };

  const cancelEdit = (id) => {
    setEditState(prev => {
      const s = { ...prev }; delete s[id]; return s; 
    });
  };

  const saveLabel = async (assignmentId) => {
    const label = editState[assignmentId]?.label ?? '';
    setError(null);
    const result = await contractService.updateContractTemplateLabel(assignmentId, label.trim() || null);
    if (!result.success) {
      setError(result.error); return; 
    }
    cancelEdit(assignmentId);
    load();
  };

  // ── Render ─────────────────────────────────────────────────

  if (!contractId) {
    return (
      <div className="rounded-lg bg-gray-50 border border-gray-200 px-5 py-8 text-center">
        <DocumentTextIcon className="mx-auto h-8 w-8 text-gray-400 mb-2" />
        <p className="text-sm text-gray-500">Save the contract first, then assign templates here.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="py-6 text-center text-sm text-gray-400">Loading templates…</div>
    );
  }

  return (
    <div className="space-y-4">

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
          <ExclamationTriangleIcon className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {assignments.length === 0 && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-5 py-6 text-center">
          <ExclamationTriangleIcon className="mx-auto h-8 w-8 text-amber-400 mb-2" />
          <p className="text-sm font-medium text-amber-900">No templates assigned</p>
          <p className="text-xs text-amber-700 mt-1">
            Workers cannot create entries until at least one template is assigned.
          </p>
        </div>
      )}

      {/* Assignment list */}
      {assignments.length > 0 && (
        <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white overflow-hidden">
          {assignments.map((a) => {
            const tmpl  = a.templates;
            const es    = editState[a.id];
            const label = a.label || tmpl?.template_name || '—';

            return (
              <div
                key={a.id}
                className="flex items-center gap-3 px-4 py-3"
              >
                {/* Default star */}
                <button
                  type="button"
                  title={a.is_default ? 'Default template' : 'Set as default'}
                  onClick={() => !readOnly && !a.is_default && handleSetDefault(a.id)}
                  className={`flex-shrink-0 ${a.is_default ? 'cursor-default' : 'hover:text-yellow-500'}`}
                  disabled={readOnly || a.is_default}
                >
                  {a.is_default
                    ? <StarSolid className="h-5 w-5 text-yellow-400" />
                    : <StarIcon className="h-5 w-5 text-gray-300" />
                  }
                </button>

                {/* Label / template name */}
                <div className="flex-1 min-w-0">
                  {es?.editing ? (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        type="text"
                        value={es.label}
                        onChange={e => setEditState(prev => ({
                          ...prev,
                          [a.id]: { ...prev[a.id], label: e.target.value }
                        }))}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            saveLabel(a.id);
                          } if (e.key === 'Escape') {
                            cancelEdit(a.id);
                          } 
                        }}
                        className="flex-1 text-sm border border-gray-300 rounded px-2 py-1 focus:ring-primary-500 focus:border-primary-500"
                        placeholder={tmpl?.template_name}
                      />
                      <button type="button" onClick={() => saveLabel(a.id)}
                        className="text-green-600 hover:text-green-700">
                        <CheckIcon className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => cancelEdit(a.id)}
                        className="text-gray-400 hover:text-gray-600">
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {label}
                      </span>
                      {a.label && (
                        <span className="text-xs text-gray-400 truncate hidden sm:block">
                          ({tmpl?.template_name})
                        </span>
                      )}
                      {a.is_default && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs
                                         font-medium bg-yellow-50 text-yellow-700 border border-yellow-200 flex-shrink-0">
                          Default
                        </span>
                      )}
                    </div>
                  )}

                  {/* Category pill */}
                  {!es?.editing && tmpl?.contract_category && (
                    <p className="text-xs text-gray-400 mt-0.5">{tmpl.contract_category}</p>
                  )}
                </div>

                {/* Actions */}
                {!readOnly && !es?.editing && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      title="Edit label"
                      onClick={() => startEdit(a)}
                      className="p-1 text-gray-400 hover:text-gray-600 rounded"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      title="Remove template"
                      onClick={() => handleRemove(a.id)}
                      className="p-1 text-gray-400 hover:text-red-600 rounded"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Template UI */}
      {!readOnly && (
        <div>
          {!adding ? (
            <button
              type="button"
              onClick={() => setAdding(true)}
              disabled={availableToAdd.length === 0}
              className="inline-flex items-center gap-2 text-sm font-medium text-primary-600
                         hover:text-primary-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <PlusIcon className="h-4 w-4" />
              {availableToAdd.length === 0
                ? 'All templates assigned'
                : 'Add Template'}
            </button>
          ) : (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
              <p className="text-sm font-medium text-gray-700">Add a template to this contract</p>

              {/* Template picker */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Template</label>
                <select
                  value={selectedNewId}
                  onChange={e => setSelectedNewId(e.target.value)}
                  className="block w-full text-sm border-gray-300 rounded-md shadow-sm
                             focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">— Select template —</option>
                  {availableToAdd.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.template_name}
                      {t.contract_category ? ` · ${t.contract_category}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Optional custom label */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Custom label <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={newLabel}
                  onChange={e => setNewLabel(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      handleAdd();
                    } 
                  }}
                  placeholder="e.g. HVAC Checklist, Lift Inspection, Pump Service"
                  className="block w-full text-sm border-gray-300 rounded-md shadow-sm
                             focus:ring-primary-500 focus:border-primary-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  The label is shown to workers when they pick a template — make it descriptive.
                </p>
              </div>

              {/* Buttons */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={!selectedNewId}
                  className="px-4 py-1.5 text-sm font-medium text-white bg-primary-600 rounded-md
                             hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAdding(false); setSelectedNewId(''); setNewLabel(''); 
                  }}
                  className="px-4 py-1.5 text-sm font-medium text-gray-700 bg-white border
                             border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Help text */}
      {!readOnly && assignments.length > 0 && (
        <p className="text-xs text-gray-400">
          ⭐ Click the star to set which template pre-selects when a worker starts a new entry.
          Click ✏ to rename a template for this contract (e.g. "HVAC Unit A Checklist").
        </p>
      )}
    </div>
  );
}
