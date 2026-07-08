/**
 * WorkLedger - Project List Component
 *
 * Displays projects in grid layout with filters and search.
 *
 * SESSION 13 BUGFIX: Added canCreate / canEdit / canDelete props.
 * "New Project" button and empty-state "Create First Project" button are
 * now hidden unless canCreate=true.
 * canEdit / canDelete are passed straight down to ProjectCard.
 *
 * @module components/projects/ProjectList
 * @created January 30, 2026 - Session 9
 * @updated February 21, 2026 - Session 13: RBAC props added
 */

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ProjectCard from './ProjectCard';
import Button from '../common/Button';
import LoadingSpinner from '../common/LoadingSpinner';
import {
  PlusIcon,
  FunnelIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';

export function ProjectList({
  projects       = [],
  organizations  = [],
  isLoading      = false,
  onDelete,
  onRefresh,
  canCreate = false,   // ← NEW
  canEdit   = false,   // ← NEW
  canDelete = false   // ← NEW
}) {
  const navigate = useNavigate();

  // ── Filter state ──────────────────────────────────────────
  const [searchTerm,    setSearchTerm]    = useState('');
  const [selectedOrg,   setSelectedOrg]   = useState('all');
  const [selectedStatus,setSelectedStatus]= useState('all');
  const [sortBy,        setSortBy]        = useState('created_at');
  const [sortOrder,     setSortOrder]     = useState('desc');
  const [showFilters,   setShowFilters]   = useState(false);

  // ── Options ───────────────────────────────────────────────
  const statusOptions = [
    { value: 'all',       label: 'All Statuses' },
    { value: 'active',    label: 'Active' },
    { value: 'completed', label: 'Completed' },
    { value: 'on_hold',   label: 'On Hold' },
    { value: 'cancelled', label: 'Cancelled' }
  ];

  const sortOptions = [
    { value: 'created_at',   label: 'Date Created' },
    { value: 'project_name', label: 'Project Name' },
    { value: 'client_name',  label: 'Client Name' },
    { value: 'start_date',   label: 'Start Date' },
    { value: 'status',       label: 'Status' }
  ];

  // ── Filter + sort ─────────────────────────────────────────
  const filteredAndSortedProjects = useMemo(() => {
    let filtered = [...projects];

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(p =>
        p.project_name.toLowerCase().includes(search) ||
        p.client_name.toLowerCase().includes(search) ||
        p.project_code.toLowerCase().includes(search) ||
        (p.site_address && p.site_address.toLowerCase().includes(search))
      );
    }

    if (selectedOrg !== 'all') {
      filtered = filtered.filter(p => p.organization_id === selectedOrg);
    }

    if (selectedStatus !== 'all') {
      filtered = filtered.filter(p => p.status === selectedStatus);
    }

    filtered.sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];
      if (!aValue) {
        return sortOrder === 'asc' ? 1 : -1;
      }
      if (!bValue) {
        return sortOrder === 'asc' ? -1 : 1;
      }
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }
      if (aValue < bValue) {
        return sortOrder === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortOrder === 'asc' ? 1 : -1;
      }
      return 0;
    });

    return filtered;
  }, [projects, searchTerm, selectedOrg, selectedStatus, sortBy, sortOrder]);

  // ── Handlers ──────────────────────────────────────────────
  const handleCreateProject = () => navigate('/projects/new');

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedOrg('all');
    setSelectedStatus('all');
    setSortBy('created_at');
    setSortOrder('desc');
  };

  const hasActiveFilters =
    searchTerm || selectedOrg !== 'all' || selectedStatus !== 'all';

  // ── Loading ───────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          {/* Search */}
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search projects by name, client, code, or location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          <div className="flex gap-2">
            {/* Sort */}
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('-');
                setSortBy(field);
                setSortOrder(order);
              }}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500 text-sm"
            >
              {sortOptions.map(opt => (
                <React.Fragment key={opt.value}>
                  <option value={`${opt.value}-asc`}>{opt.label} ↑</option>
                  <option value={`${opt.value}-desc`}>{opt.label} ↓</option>
                </React.Fragment>
              ))}
            </select>

            {/* Filters toggle */}
            <Button
              variant="secondary"
              onClick={() => setShowFilters(!showFilters)}
              className="whitespace-nowrap"
            >
              <FunnelIcon className="h-5 w-5 mr-2" />
              Filters
              {hasActiveFilters && (
                <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium bg-primary-100 text-primary-800 rounded-full">
                  Active
                </span>
              )}
            </Button>

            {/* New Project — only shown when canCreate=true */}
            {canCreate && (
              <Button
                variant="primary"
                onClick={handleCreateProject}
                className="whitespace-nowrap"
              >
                <PlusIcon className="h-5 w-5 mr-2" />
                New Project
              </Button>
            )}
          </div>
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="border-t border-gray-200 pt-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Organization Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Organization
                </label>
                <select
                  value={selectedOrg}
                  onChange={(e) => setSelectedOrg(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="all">All Organizations</option>
                  {organizations.map(org => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                >
                  {statusOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          {filteredAndSortedProjects.length} project{filteredAndSortedProjects.length !== 1 ? 's' : ''}
          {hasActiveFilters ? ' (filtered)' : ''}
        </p>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Refresh
          </button>
        )}
      </div>

      {/* Project Grid */}
      {filteredAndSortedProjects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAndSortedProjects.map(project => (
            <ProjectCard
              key={project.id}
              project={project}
              onDelete={onDelete}
              canEdit={canEdit}     // ← pass through
              canDelete={canDelete} // ← pass through
            />
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="bg-white rounded-lg shadow">
          <div className="text-center py-12">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              {hasActiveFilters ? 'No projects found' : 'No projects yet'}
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              {hasActiveFilters
                ? 'Try adjusting your filters to find what you\'re looking for.'
                : 'Get started by creating your first project.'}
            </p>
            {hasActiveFilters ? (
              <Button variant="primary" onClick={handleResetFilters} className="mt-6">
                Clear Filters
              </Button>
            ) : (
              /* Empty state CTA — only shown when canCreate=true */
              canCreate && (
                <Button variant="primary" onClick={handleCreateProject} className="mt-6">
                  <PlusIcon className="h-5 w-5 mr-2" />
                  Create First Project
                </Button>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ProjectList;
