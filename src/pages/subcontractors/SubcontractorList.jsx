/**
 * WorkLedger - Subcontractor List Page
 *
 * Displays all subcontractor relationships for the current org
 * (when the org is a main contractor like MTSB).
 *
 * Only meaningful for orgs with org_type = 'main_contractor',
 * but accessible to any org_owner/org_admin/manager via NAV_SUBCONTRACTORS.
 * Shows a friendly empty state for orgs with no relationships yet.
 *
 * Features:
 *   - Groups relationships by project
 *   - Status tabs: Active / All
 *   - "Link Subcontractor" button (MANAGE_SUBCONTRACTORS only)
 *   - Terminate / Reactivate actions
 *
 * @module pages/subcontractors/SubcontractorList
 * @created February 24, 2026 — Session 15
 */

import React, { useState, useEffect, useCallback } from 'react';
import AppLayout from '../../components/layout/AppLayout';
import { AddSubcontractorModal } from '../../components/subcontractors/AddSubcontractorModal';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { PermissionGuard } from '../../components/auth/PermissionGuard';
import { subcontractorService } from '../../services/api/subcontractorService';
import { useOrganization } from '../../context/OrganizationContext';
import { useRole } from '../../hooks/useRole';
import { useToast } from '../../context/ToastContext';

// ── Status badge ────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    active:     'bg-green-100 text-green-700',
    completed:  'bg-blue-100 text-blue-700',
    terminated: 'bg-red-100 text-red-700'
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${map[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ── Org type badge ───────────────────────────────────────────────────
function OrgTypeBadge({ orgType }) {
  const map = {
    client:          'bg-gray-100 text-gray-600',
    main_contractor: 'bg-purple-100 text-purple-700',
    subcontractor:   'bg-orange-100 text-orange-700',
    freelancer:      'bg-yellow-100 text-yellow-700'
  };
  const labels = {
    client:          'Client',
    main_contractor: 'Main Contractor',
    subcontractor:   'Subcontractor',
    freelancer:      'Freelancer'
  };
  if (!orgType || orgType === 'client') {
    return null;
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${map[orgType] ?? 'bg-gray-100 text-gray-600'}`}>
      {labels[orgType] ?? orgType}
    </span>
  );
}

export default function SubcontractorList() {
  const toast = useToast();
  const { currentOrg }       = useOrganization();
  const { can }              = useRole();

  const [relationships, setRelationships] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);
  const [activeTab, setActiveTab]         = useState('active'); // 'active' | 'all'
  const [showAddModal, setShowAddModal]   = useState(false);
  const [actionLoading, setActionLoading] = useState(null); // relationship id being actioned

  const canManage = can('MANAGE_SUBCONTRACTORS');

  // ── Load relationships ──────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!currentOrg?.id) {
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await subcontractorService.getSubcontractorRelationships(currentOrg.id);
      setRelationships(data);
      console.log('✅ Loaded subcontractor relationships:', data.length);
    } catch (err) {
      console.error('❌ Error loading subcontractor relationships:', err);
      setError('Failed to load subcontractor relationships. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [currentOrg?.id]);

  useEffect(() => {
    loadData(); 
  }, [loadData]);

  // ── Terminate / Reactivate ──────────────────────────────────────────
  const handleStatusChange = async (id, newStatus) => {
    setActionLoading(id);
    try {
      const result = await subcontractorService.updateRelationshipStatus(id, newStatus);
      if (result.success) {
        // Optimistic update
        setRelationships(prev =>
          prev.map(r => r.id === id ? { ...r, status: newStatus } : r)
        );
        console.log('✅ Status changed to:', newStatus);
      } else {
        toast.error(`Failed to update status: ${result.error}`);
      }
    } catch (err) {
      console.error('❌ Error changing status:', err);
      toast.error('Failed to update relationship status.');
    } finally {
      setActionLoading(null);
    }
  };

  // ── Filter by tab ────────────────────────────────────────────────────
  const filtered = activeTab === 'active'
    ? relationships.filter(r => r.status === 'active')
    : relationships;

  // ── Group by project ────────────────────────────────────────────────
  const byProject = filtered.reduce((acc, r) => {
    const key = r.project_id;
    if (!acc[key]) {
      acc[key] = { project: r.project, items: [] };
    }
    acc[key].items.push(r);
    return acc;
  }, {});

  // ── Counts ───────────────────────────────────────────────────────────
  const activeCount = relationships.filter(r => r.status === 'active').length;
  const allCount    = relationships.length;

  // ── Loading ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center items-center min-h-[60vh]">
          <LoadingSpinner size="lg" />
        </div>
      </AppLayout>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────
  if (error) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
            <button onClick={loadData} className="mt-2 text-sm text-red-600 hover:text-red-700 font-medium">
              Try Again
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-4 py-6 pb-24">

        {/* ── Page Header ────────────────────────────────────────────── */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Subcontractors</h1>
            <p className="mt-1 text-sm text-gray-500">
              {activeCount} active relationship{activeCount !== 1 ? 's' : ''}
              {currentOrg && (
                <span className="ml-2 font-medium text-primary-700">— {currentOrg.name}</span>
              )}
            </p>
          </div>

          <PermissionGuard permission="MANAGE_SUBCONTRACTORS">
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Link Subcontractor
            </button>
          </PermissionGuard>
        </div>

        {/* ── Status Tabs ─────────────────────────────────────────────── */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg mb-6 w-fit">
          {[
            { key: 'active', label: 'Active', count: activeCount },
            { key: 'all',    label: 'All',    count: allCount    }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors
                ${activeTab === tab.key
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'}
              `}
            >
              {tab.label}
              <span className={`
                inline-flex items-center justify-center w-5 h-5 rounded-full text-xs
                ${activeTab === tab.key ? 'bg-primary-100 text-primary-700' : 'bg-gray-200 text-gray-500'}
              `}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* ── Empty State ─────────────────────────────────────────────── */}
        {filtered.length === 0 && (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
            <div className="text-5xl mb-4">🏗️</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {activeTab === 'active' ? 'No active subcontractors' : 'No subcontractor relationships yet'}
            </h3>
            <p className="text-sm text-gray-500 max-w-sm mx-auto mb-6">
              {activeTab === 'active'
                ? 'All relationships are completed or terminated. Switch to "All" to see the full history.'
                : `Link a subcontractor organization to one of ${currentOrg?.name ?? 'your'}'s projects to track their work here.`
              }
            </p>
            {activeTab === 'all' && canManage && (
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
              >
                Link First Subcontractor
              </button>
            )}
          </div>
        )}

        {/* ── Grouped by Project ──────────────────────────────────────── */}
        <div className="space-y-6">
          {Object.values(byProject).map(({ project, items }) => (
            <div key={items[0].project_id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">

              {/* Project header */}
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-3">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <span className="text-sm font-semibold text-gray-700">
                  {project?.project_name ?? 'Unknown Project'}
                </span>
                {project?.project_code && (
                  <span className="text-xs text-gray-400">({project.project_code})</span>
                )}
                <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
                  project?.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {project?.status ?? '—'}
                </span>
              </div>

              {/* Subcontractor rows */}
              <div className="divide-y divide-gray-100">
                {items.map(rel => (
                  <div key={rel.id} className="px-5 py-4 flex items-center gap-4">

                    {/* Org avatar */}
                    <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold text-sm flex-shrink-0">
                      {rel.subcontractor_org?.name?.charAt(0)?.toUpperCase() ?? '?'}
                    </div>

                    {/* Org details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900 text-sm">
                          {rel.subcontractor_org?.name ?? 'Unknown Organization'}
                        </span>
                        <OrgTypeBadge orgType={rel.subcontractor_org?.org_type} />
                        <StatusBadge status={rel.status} />
                      </div>
                      {rel.notes && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{rel.notes}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">
                        Linked {rel.invited_at
                          ? new Date(rel.invited_at).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })
                          : '—'}
                      </p>
                    </div>

                    {/* Actions */}
                    <PermissionGuard permission="MANAGE_SUBCONTRACTORS">
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {rel.status === 'active' && (
                          <button
                            disabled={actionLoading === rel.id}
                            onClick={() => handleStatusChange(rel.id, 'terminated')}
                            className="text-xs px-3 py-1.5 rounded-md border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                          >
                            {actionLoading === rel.id ? '…' : 'Terminate'}
                          </button>
                        )}
                        {rel.status === 'terminated' && (
                          <button
                            disabled={actionLoading === rel.id}
                            onClick={() => handleStatusChange(rel.id, 'active')}
                            className="text-xs px-3 py-1.5 rounded-md border border-green-200 text-green-600 hover:bg-green-50 disabled:opacity-50 transition-colors"
                          >
                            {actionLoading === rel.id ? '…' : 'Reactivate'}
                          </button>
                        )}
                        {rel.status === 'completed' && (
                          <span className="text-xs text-gray-400 italic">Completed</span>
                        )}
                      </div>
                    </PermissionGuard>

                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* ── Info banner for non-main-contractor orgs ─────────────────── */}
        {currentOrg && !['main_contractor'].includes(currentOrg.org_type) && relationships.length === 0 && (
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
            <strong>Note:</strong> Subcontractor management is designed for main contractor organizations.
            If {currentOrg.name} needs to manage subcontractors, update its org_type to{' '}
            <code className="bg-blue-100 px-1 rounded">main_contractor</code> in the database.
          </div>
        )}

      </div>

      {/* ── Add Subcontractor Modal ─────────────────────────────────── */}
      {showAddModal && (
        <AddSubcontractorModal
          mainOrgId={currentOrg?.id}
          mainOrgName={currentOrg?.name}
          onSuccess={() => {
            setShowAddModal(false);
            loadData();
          }}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </AppLayout>
  );
}
