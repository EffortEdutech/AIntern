/**
 * WorkLedger - Contract Detail Page
 *
 * Read-only view of contract information.
 * Templates are shown as chips only — assigned via New/Edit Contract form.
 *
 * SESSION 14 FIX:
 *   - Removed ContractTemplateManager (editing belongs in the form)
 *   - Templates displayed as read-only chips from contract.contract_templates
 *   - useRole() correctly used via can() function
 *   - "New Work Entry" gated — only shown when at least one template assigned
 *   - Fixed org property: project.organization (PostgREST alias, not .organizations)
 *
 * @module pages/contracts/ContractDetail
 * @created January 31, 2026 - Session 10
 * @updated February 22, 2026 - Session 14: clean read-only detail page
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ContractTypeBadge from '../../components/contracts/ContractTypeBadge';
import { contractService } from '../../services/api/contractService';
import { useRole } from '../../hooks/useRole';
import {
  PencilIcon,
  TrashIcon,
  CalendarIcon,
  DocumentTextIcon,
  ClockIcon,
  WrenchScrewdriverIcon,
  DocumentDuplicateIcon
} from '@heroicons/react/24/outline';
import { useToast } from '../../context/ToastContext';

export function ContractDetail() {
  const toast = useToast();
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useRole();

  const canEdit   = can('MANAGE_CONTRACTS');
  const canDelete = can('MANAGE_CONTRACTS');

  const [contract, setContract] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  useEffect(() => {
    loadContract(); 
  }, [id]);

  const loadContract = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await contractService.getContract(id);
      if (!data) {
        setError('Contract not found or you do not have permission to view it.');
        return;
      }
      setContract(data);
      console.log('✅ Loaded contract:', data.contract_number);
    } catch (err) {
      console.error('❌ Error loading contract:', err);
      setError('Failed to load contract. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete contract "${contract.contract_number}"? This cannot be undone.`)) {
      return;
    }
    try {
      await contractService.deleteContract(id);
      navigate('/contracts');
    } catch (err) {
      console.error('❌ Error deleting contract:', err);
      toast.error('Failed to delete contract.');
    }
  };

  const formatDate = (d) => {
    if (!d) {
      return 'N/A';
    }
    return new Date(d).toLocaleDateString('en-MY', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  };

  // ── Loading ────────────────────────────────────────────────
  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center items-center min-h-[60vh]">
          <LoadingSpinner size="lg" />
        </div>
      </AppLayout>
    );
  }

  // ── Error ──────────────────────────────────────────────────
  if (error) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-red-800">{error}</p>
            <button onClick={() => navigate('/contracts')}
              className="mt-3 text-sm text-red-600 hover:text-red-700 font-medium">
              ← Back to Contracts
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Assigned templates from the junction table.
  // getContract() returns contract_templates: [{ id, template_id, is_default, sort_order,
  //   templates: { id, template_name, contract_category, ... } }]
  const assignedTemplates = (contract.contract_templates || [])
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const hasTemplates = assignedTemplates.length > 0;

  // PostgREST alias: project joins as `project:projects(...)` and org as
  // `organization:organizations(...)` inside the project join — so it's singular
  const org  = contract.project?.organization;
  const proj = contract.project;

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">

        {/* ── Header ───────────────────────────────────────── */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl font-bold text-gray-900">
                {contract.contract_number}
              </h1>
              <ContractTypeBadge category={contract.contract_category} />
              {contract.contract_role === 'sub' && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs
                                 font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Subcontract
                </span>
              )}
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs
                              font-medium border
                              ${contract.status === 'active'
      ? 'bg-green-50 text-green-700 border-green-200'
      : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                {contract.status}
              </span>
            </div>
            <p className="text-gray-500">{contract.contract_name}</p>
            {org && (
              <p className="text-sm text-gray-400 mt-0.5">
                {org.name}{proj ? ` · ${proj.project_name}` : ''}
              </p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            {canEdit && (
              <button
                onClick={() => navigate(`/contracts/${id}/edit`)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium
                           text-gray-700 bg-white border border-gray-300 rounded-md
                           shadow-sm hover:bg-gray-50"
              >
                <PencilIcon className="h-4 w-4" />
                Edit
              </button>
            )}
            {canDelete && (
              <button
                onClick={handleDelete}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium
                           text-white bg-red-600 border border-transparent rounded-md
                           shadow-sm hover:bg-red-700"
              >
                <TrashIcon className="h-4 w-4" />
                Delete
              </button>
            )}
          </div>
        </div>

        {/* ── Contract Details ──────────────────────────────── */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <DocumentTextIcon className="h-5 w-5 text-gray-400" />
              Contract Details
            </h2>
          </div>

          <div className="p-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <InfoRow label="Contract Type"  value={contract.contract_type || '—'} />
            <InfoRow label="Category"       value={contract.contract_category || '—'} />
            <InfoRow label="Status"         value={contract.status || '—'} />
            {contract.contract_role === 'sub' && (
              <SubcontractRow org={contract.performing_org} />
            )}

            <InfoRow
              label="Valid From"
              value={formatDate(contract.valid_from)}
              icon={<CalendarIcon className="h-4 w-4" />}
            />
            <InfoRow
              label="Valid Until"
              value={formatDate(contract.valid_until)}
              icon={<CalendarIcon className="h-4 w-4" />}
            />
            {contract.contract_value && (
              <InfoRow
                label="Contract Value"
                value={`RM ${parseFloat(contract.contract_value)
                  .toLocaleString('en-MY', { minimumFractionDigits: 2 })}`}
              />
            )}
            {contract.reporting_frequency && (
              <InfoRow
                label="Reporting Frequency"
                value={contract.reporting_frequency}
                icon={<ClockIcon className="h-4 w-4" />}
              />
            )}
            {contract.maintenance_cycle && (
              <InfoRow
                label="Maintenance Cycle"
                value={contract.maintenance_cycle}
                icon={<WrenchScrewdriverIcon className="h-4 w-4" />}
              />
            )}
            {contract.description && (
              <div className="sm:col-span-2 lg:col-span-3">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Description
                </p>
                <p className="mt-1 text-sm text-gray-700">{contract.description}</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Work Entry Templates (read-only chips) ────────── */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <DocumentDuplicateIcon className="h-5 w-5 text-gray-400" />
              Work Entry Templates
            </h2>
            {canEdit && (
              <button
                onClick={() => navigate(`/contracts/${id}/edit`)}
                className="text-xs font-medium text-primary-600 hover:text-primary-700"
              >
                Edit to change →
              </button>
            )}
          </div>

          <div className="p-6">
            {hasTemplates ? (
              <>
                <p className="text-xs text-gray-500 mb-3">
                  Field workers will see these templates when creating a new work entry for this contract.
                </p>
                <div className="flex flex-wrap gap-2">
                  {assignedTemplates.map(jt => {
                    // getContract returns nested template under `templates` key (junction → template)
                    const tmpl = jt.templates || jt.template || {};
                    return (
                      <span
                        key={jt.id}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full
                                    text-sm font-medium border
                                    ${jt.is_default
                        ? 'bg-primary-50 text-primary-700 border-primary-200'
                        : 'bg-gray-50 text-gray-700 border-gray-200'}`}
                      >
                        {tmpl.template_name || '(Unknown template)'}
                        {jt.is_default && (
                          <span className="text-xs text-primary-400 font-normal ml-0.5">
                            · default
                          </span>
                        )}
                      </span>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="text-center py-6">
                <p className="text-sm font-medium text-gray-500">No templates assigned</p>
                <p className="text-xs text-gray-400 mt-1">
                  Field workers cannot create entries until templates are assigned.
                </p>
                {canEdit && (
                  <button
                    onClick={() => navigate(`/contracts/${id}/edit`)}
                    className="mt-3 text-sm font-medium text-primary-600 hover:text-primary-700"
                  >
                    Click Edit to assign templates
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Quick Actions ─────────────────────────────────── */}
        <div className="flex gap-3 pb-8">
          {hasTemplates ? (
            <button
              onClick={() => navigate(`/work/new?contractId=${id}`)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium
                         text-white bg-primary-600 rounded-md hover:bg-primary-700"
            >
              + New Work Entry
            </button>
          ) : (
            <div className="inline-flex items-center gap-2 px-4 py-2 text-sm
                            text-amber-700 bg-amber-50 border border-amber-200 rounded-md">
              ⚠️ Assign templates via Edit before creating work entries
            </div>
          )}
          <button
            onClick={() => navigate('/contracts')}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium
                       text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            ← All Contracts
          </button>
        </div>

      </div>
    </AppLayout>
  );
}


// ── Small helpers ─────────────────────────────────────────────────────────
function InfoRow({ label, value, icon }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-sm text-gray-900 flex items-center gap-1.5">
        {icon && <span className="text-gray-400">{icon}</span>}
        {value}
      </p>
    </div>
  );
}

function SubcontractRow({ org }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Role</p>
      <p className="mt-1 text-sm text-gray-900 flex items-center gap-1.5">
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full
                         text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
          Subcontract
        </span>
        {org && org.name && (
          <span className="text-gray-500 text-xs">
            performed by <span className="font-medium text-gray-700">{org.name}</span>
          </span>
        )}
      </p>
    </div>
  );
}

export default ContractDetail;
