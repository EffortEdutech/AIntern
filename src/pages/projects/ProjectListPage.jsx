/**
 * WorkLedger - Project List Page
 *
 * Main page for displaying all projects with filters and search.
 *
 * SESSION 10 WIRING (restored):
 *   - useOrganization() provides currentOrg from the org switcher
 *   - loadData wrapped in useCallback([currentOrg?.id]) so it re-runs
 *     automatically whenever the active org changes
 *   - currentOrg?.id passed to service so the query filters correctly
 *     (null = all orgs for super_admin)
 *
 * SESSION 13 RBAC: canCreate/canEdit/canDelete passed to ProjectList
 *
 * @module pages/projects/ProjectListPage
 * @created January 30, 2026 - Session 9
 * @updated February 21, 2026 - Session 13: RBAC props
 * @updated February 21, 2026 - Session 13 fix: org wiring restored
 */

import React, { useState, useEffect, useCallback } from 'react';
import AppLayout from '../../components/layout/AppLayout';
import ProjectList from '../../components/projects/ProjectList';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { projectService } from '../../services/api/projectService';
import { organizationService } from '../../services/api/organizationService';
import { useOrganization } from '../../context/OrganizationContext';
import { useRole } from '../../hooks/useRole';
import { useToast } from '../../context/ToastContext';

export function ProjectListPage() {
  const toast = useToast();
  const { currentOrg } = useOrganization();
  const { can } = useRole();

  const [projects, setProjects]           = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);

  // ── Permission flags ───────────────────────────────────────────────
  const canCreate = can('CREATE_PROJECT');
  const canEdit   = can('EDIT_PROJECT');
  const canDelete = can('DELETE_PROJECT');

  // ── Load data — re-runs when org switcher changes ──────────────────
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const orgId = currentOrg?.id ?? null;

      const [projectsData, orgsData] = await Promise.all([
        projectService.getUserProjects(orgId),
        organizationService.getUserOrganizations()
      ]);

      setProjects(projectsData      || []);
      setOrganizations(orgsData     || []);

      console.log('✅ Loaded projects:', projectsData?.length || 0);
    } catch (err) {
      console.error('❌ Error loading data:', err);
      setError('Failed to load projects. Please try again.');
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
      await projectService.deleteProject(id);
      await loadData();
      console.log('✅ Project deleted successfully');
    } catch (err) {
      console.error('❌ Error deleting project:', err);
      toast.error('Failed to delete project. Please try again.');
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
          <h1 className="text-3xl font-bold text-gray-900">Projects</h1>
          <p className="mt-2 text-sm text-gray-600">
            Manage your projects, contracts, and work entries.
            {currentOrg && (
              <span className="ml-2 font-medium text-primary-700">
                — {currentOrg.name}
              </span>
            )}
          </p>
        </div>

        {/* Project List Component */}
        <ProjectList
          projects={projects}
          organizations={organizations}
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

export default ProjectListPage;
