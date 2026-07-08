/**
 * WorkLedger - Contract Card Component
 *
 * SESSION 13 BUGFIX: Added canEdit + canDelete props.
 * SESSION 13 FIX 2: Added amber "No Template" warning badge.
 *
 * SESSION 15 UPDATE — Contract role classification:
 *   Contracts now have two roles: main and sub.
 *   Subcontracts show:
 *     - Orange "Sub Contract" badge (instead of status badge row)
 *     - "Performing for: [Main Contractor Org]" line
 *     - "Client: [owning org name]" info
 *   canEdit / canDelete are derived from contract.performing_org_id:
 *     - If user's org is the OWNER (organization_id) → can edit/delete
 *     - If user's org is the PERFORMER (performing_org_id) → view only
 *     - Callers can still override by passing canEdit/canDelete explicitly.
 *
 * @module components/contracts/ContractCard
 * @created January 31, 2026 - Session 10
 * @updated February 21, 2026 - Session 13
 * @updated February 26, 2026 - Session 15: contract_role + performing_org
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import ContractTypeBadge from './ContractTypeBadge';
import {
  CalendarIcon,
  DocumentTextIcon,
  BuildingOffice2Icon,
  UserGroupIcon
} from '@heroicons/react/24/outline';

export function ContractCard({
  contract,
  onDelete,
  canEdit   = false,
  canDelete = false,
  currentOrgId = null   // ← NEW: current user's org, used to auto-derive permissions
}) {
  const navigate = useNavigate();

  // ── Derive contract role ───────────────────────────────────────────
  // A contract is a "sub contract" if:
  //   1. contract_role = 'sub' (explicit, from new column), OR
  //   2. performing_org_id is set AND different from organization_id
  const isSubContract = contract.contract_role === 'sub'
    || (contract.performing_org_id && contract.performing_org_id !== contract.organization_id);

  // ── Auto-derive edit permission if currentOrgId provided ──────────
  // Owner (org = organization_id) → can edit/delete
  // Performer (org = performing_org_id) → view only, cannot edit/delete
  let effectiveCanEdit   = canEdit;
  let effectiveCanDelete = canDelete;
  if (currentOrgId && !canEdit && !canDelete) {
    effectiveCanEdit   = currentOrgId === contract.organization_id;
    effectiveCanDelete = currentOrgId === contract.organization_id;
  }

  const statusColors = {
    draft:     'bg-gray-100  text-gray-800  border-gray-200',
    active:    'bg-green-100 text-green-800 border-green-200',
    suspended: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    completed: 'bg-blue-100  text-blue-800  border-blue-200',
    cancelled: 'bg-red-100   text-red-800   border-red-200'
  };

  const statusLabels = {
    draft:     'Draft',
    active:    'Active',
    suspended: 'Suspended',
    completed: 'Completed',
    cancelled: 'Cancelled'
  };

  const formatDate = (dateString) => {
    if (!dateString) {
      return 'N/A';
    }
    return new Date(dateString).toLocaleDateString('en-MY', {
      year:  'numeric',
      month: 'short',
      day:   'numeric'
    });
  };

  const handleView   = ()  => navigate(`/contracts/${contract.id}`);
  const handleEdit   = (e) => {
    e.stopPropagation(); navigate(`/contracts/${contract.id}/edit`); 
  };
  const handleDelete = (e) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete contract "${contract.contract_number}"?`)) {
      onDelete(contract.id);
    }
  };

  return (
    <div
      className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow duration-200 cursor-pointer border border-gray-200"
      onClick={handleView}
    >
      {/* Card Header */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">

              {/* Status badge */}
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                statusColors[contract.status] || statusColors.active
              }`}>
                {statusLabels[contract.status] || 'Active'}
              </span>

              {/* Contract type */}
              <ContractTypeBadge category={contract.contract_category} />

              {/* ── SESSION 15: Main / Sub Contract role badge ──── */}
              {isSubContract ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800 border border-orange-300">
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  Sub Contract
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800 border border-indigo-300">
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                  Main Contract
                </span>
              )}

              {/* No-template warning */}
              {!contract.template_id && !(contract.contract_templates?.length > 0) && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 border border-amber-300">
                  <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                  No Template
                </span>
              )}
            </div>

            <h3 className="text-base font-semibold text-gray-900 font-mono truncate">
              {contract.contract_number}
            </h3>
            <p className="text-sm text-gray-600 truncate">{contract.contract_name}</p>
          </div>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-6 space-y-3">

        {/* Project */}
        {contract.project && (
          <div className="flex items-center text-sm text-gray-600">
            <DocumentTextIcon className="h-5 w-5 text-gray-400 mr-2 flex-shrink-0" />
            <span className="truncate">{contract.project.project_name}</span>
          </div>
        )}

        {/* Owning organization (client / main contractor) */}
        {contract.project?.organization && (
          <div className="flex items-center text-sm text-gray-600">
            <BuildingOffice2Icon className="h-5 w-5 text-gray-400 mr-2 flex-shrink-0" />
            <span className="truncate">
              {isSubContract ? (
                <span>
                  Client: <span className="font-medium">{contract.project.organization.name}</span>
                </span>
              ) : (
                contract.project.organization.name
              )}
            </span>
          </div>
        )}

        {/* Performing org — only shown for sub contracts */}
        {isSubContract && contract.performing_org && (
          <div className="flex items-center text-sm text-gray-600">
            <UserGroupIcon className="h-5 w-5 text-orange-400 mr-2 flex-shrink-0" />
            <span className="truncate">
              Performed by: <span className="font-medium text-orange-700">{contract.performing_org.name}</span>
            </span>
          </div>
        )}

        {/* Dates */}
        {(contract.valid_from || contract.valid_until) && (
          <div className="flex items-center text-sm text-gray-600">
            <CalendarIcon className="h-5 w-5 text-gray-400 mr-2 flex-shrink-0" />
            <span>{formatDate(contract.valid_from)} – {formatDate(contract.valid_until)}</span>
          </div>
        )}

        {/* SLA badge */}
        {contract.sla_tier && (
          <div className="pt-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
              SLA {contract.sla_tier} Tier
              {contract.sla_response_time_mins && (
                <span className="ml-1">· {contract.sla_response_time_mins}min response</span>
              )}
            </span>
          </div>
        )}

        {/* Sub-contract view-only notice */}
        {isSubContract && currentOrgId === contract.performing_org_id && (
          <div className="pt-1">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200">
              View only — you are the subcontractor
            </span>
          </div>
        )}
      </div>

      {/* Card Footer */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between rounded-b-lg">
        <button
          onClick={handleView}
          className="text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
        >
          View Details →
        </button>

        {(effectiveCanEdit || effectiveCanDelete) && (
          <div className="flex items-center space-x-3">
            {effectiveCanEdit && (
              <button
                onClick={handleEdit}
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Edit
              </button>
            )}
            {effectiveCanDelete && (
              <button
                onClick={handleDelete}
                className="text-sm font-medium text-red-600 hover:text-red-700 transition-colors"
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ContractCard;
