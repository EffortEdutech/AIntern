/**
 * WorkLedger - Contract List Page
 *
 * Main page for displaying all contracts with filters and search.
 *
 * SESSION 10 WIRING (restored):
 *   - useOrganization() provides currentOrg from the org switcher
 *   - loadData wrapped in useCallback([currentOrg?.id]) so it re-runs
 *     automatically whenever the active org changes
 *   - currentOrg?.id passed to both service calls so the query
 *     filters correctly (null = all orgs for super_admin)
 *
 * SESSION 13 RBAC: canCreate/canEdit/canDelete passed to ContractList
 *
 * @module pages/contracts/ContractListPage
 * @created January 31, 2026 - Session 10
 * @updated February 21, 2026 - Session 13: RBAC props
 * @updated February 21, 2026 - Session 13 fix: org wiring restored
 */

import React, { useState, useEffect, useCallback } from 'react';
import AppLayout from '../../components/layout/AppLayout';
import ContractList from '../../components/contracts/ContractList';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { contractService } from '../../services/api/contractService';
import { projectService } from '../../services/api/projectService';
import { useOrganization } from '../../context/OrganizationContext';
import { useRole } from '../../hooks/useRole';
import { useToast } from '../../context/ToastContext';

export function ContractListPage() {
  const toast = useToast();
  const { currentOrg } = useOrganization();
  const { can } = useRole();

  const [contracts, setContracts] = useState([]);
  const [projects, setProjects]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  // ── Permission flags (passed down to ContractList → ContractCard) ──
  const canCreate = can('CREATE_CONTRACT');
  const canEdit   = can('EDIT_CONTRACT');
  const canDelete = can('DELETE_CONTRACT');

  // ── Load data — re-runs when org switcher changes ──────────────────
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const orgId = currentOrg?.id ?? null;

      const [contractsData, projectsData] = await Promise.all([
        contractService.getUserContracts(orgId),
        projectService.getUserProjects(orgId)
      ]);

      setContracts(contractsData || []);
      setProjects(projectsData  || []);

      console.log('✅ Loaded contracts:', contractsData?.length || 0);
    } catch (err) {
      console.error('❌ Error loading data:', err);
      setError('Failed to load contracts. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [currentOrg?.id]); // ← re-runs on every org switch

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Delete handler ─────────────────────────────────────────────────
  const handleDelete = async (id) => {
    try {
      await contractService.deleteContract(id);
      await loadData();
      console.log('✅ Contract deleted successfully');
    } catch (err) {
      console.error('❌ Error deleting contract:', err);
      toast.error('Failed to delete contract. Please try again.');
    }
  };

  // ── Loading state ──────────────────────────────────────────────────
  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center items-center min-h-[60vh]">
          <LoadingSpinner size="lg" />
        </div>
      </AppLayout>
    );
  }

  // ── Error state ────────────────────────────────────────────────────
  if (error) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
            <button
              onClick={loadData}
              className="mt-2 text-sm text-red-600 hover:text-red-700 font-medium"
            >
              Try Again
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ── Main render ────────────────────────────────────────────────────
  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">

        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Contracts</h1>
          <p className="mt-2 text-sm text-gray-600">
            Manage your contracts, templates, and work entry requirements.
            {currentOrg && (
              <span className="ml-2 font-medium text-primary-700">
                — {currentOrg.name}
              </span>
            )}
          </p>
        </div>

        {/* Contract List Component */}
        <ContractList
          contracts={contracts}
          projects={projects}
          isLoading={loading}
          canCreate={canCreate}
          canEdit={canEdit}
          canDelete={canDelete}
          onDelete={handleDelete}
          onRefresh={loadData}
        />
      </div>
    </AppLayout>
  );
}

export default ContractListPage;
