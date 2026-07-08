/**
 * WorkLedger - Contract List Component
 *
 * Displays contracts in grid layout with filters and search.
 *
 * SESSION 13 BUGFIX: Added canCreate / canEdit / canDelete props.
 * "New Contract" and empty-state "Create First Contract" buttons are
 * hidden unless canCreate=true.
 * canEdit / canDelete are passed straight down to ContractCard.
 *
 * @module components/contracts/ContractList
 * @created January 31, 2026 - Session 10
 * @updated February 21, 2026 - Session 13: RBAC props added
 */

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ContractCard from './ContractCard';
import { getContractTypeOptions } from './ContractTypeBadge';
import Button from '../common/Button';
import LoadingSpinner from '../common/LoadingSpinner';
import {
  PlusIcon,
  FunnelIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';

export function ContractList({
  contracts  = [],
  projects   = [],
  isLoading  = false,
  onDelete,
  onRefresh,
  canCreate  = false,
  canEdit    = false,
  canDelete  = false,
  currentOrgId = null   // ← SESSION 15: used to derive per-card edit perms
}) {
  const navigate = useNavigate();

  // ── Filter state ──────────────────────────────────────────
  const [searchTerm,      setSearchTerm]      = useState('');
  const [selectedProject, setSelectedProject] = useState('all');
  const [selectedCategory,setSelectedCategory]= useState('all');
  const [selectedStatus,  setSelectedStatus]  = useState('all');
  const [sortBy,          setSortBy]          = useState('created_at');
  const [sortOrder,       setSortOrder]       = useState('desc');
  const [showFilters,     setShowFilters]     = useState(false);

  // ── Options ───────────────────────────────────────────────
  const categoryOptions = [
    { value: 'all', label: 'All Categories' },
    ...getContractTypeOptions()
  ];

  const statusOptions = [
    { value: 'all',       label: 'All Statuses' },
    { value: 'draft',     label: 'Draft' },
    { value: 'active',    label: 'Active' },
    { value: 'suspended', label: 'Suspended' },
    { value: 'completed', label: 'Completed' }
  ];

  const sortOptions = [
    { value: 'created_at',    label: 'Date Created' },
    { value: 'contract_number', label: 'Contract Number' },
    { value: 'contract_name', label: 'Contract Name' },
    { value: 'valid_from',    label: 'Valid From Date' },
    { value: 'status',        label: 'Status' }
  ];

  // ── Filter + sort ─────────────────────────────────────────
  const filteredAndSortedContracts = useMemo(() => {
    let filtered = [...contracts];

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(c =>
        c.contract_number.toLowerCase().includes(search) ||
        c.contract_name.toLowerCase().includes(search) ||
        (c.project?.project_name && c.project.project_name.toLowerCase().includes(search))
      );
    }

    if (selectedProject !== 'all') {
      filtered = filtered.filter(c => c.project_id === selectedProject);
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(c => c.contract_category === selectedCategory);
    }

    if (selectedStatus !== 'all') {
      filtered = filtered.filter(c => c.status === selectedStatus);
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
  }, [contracts, searchTerm, selectedProject, selectedCategory, selectedStatus, sortBy, sortOrder]);

  // ── Handlers ──────────────────────────────────────────────
  const handleCreateContract = () => navigate('/contracts/new');

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedProject('all');
    setSelectedCategory('all');
    setSelectedStatus('all');
    setSortBy('created_at');
    setSortOrder('desc');
  };

  const hasActiveFilters =
    searchTerm ||
    selectedProject  !== 'all' ||
    selectedCategory !== 'all' ||
    selectedStatus   !== 'all';

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
              placeholder="Search contracts by number, name, or project..."
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
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-primary-500 focus:border-primary-500"
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

            {/* New Contract — only shown when canCreate=true */}
            {canCreate && (
              <Button
                variant="primary"
                onClick={handleCreateContract}
                className="whitespace-nowrap"
              >
                <PlusIcon className="h-5 w-5 mr-2" />
                New Contract
              </Button>
            )}
          </div>
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="border-t border-gray-200 pt-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Project Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project
                </label>
                <select
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="all">All Projects</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.project_name}</option>
                  ))}
                </select>
              </div>

              {/* Category Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                >
                  {categoryOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
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
          {filteredAndSortedContracts.length} contract{filteredAndSortedContracts.length !== 1 ? 's' : ''}
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

      {/* Contract Grid */}
      {filteredAndSortedContracts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAndSortedContracts.map(contract => (
            <ContractCard
              key={contract.id}
              contract={contract}
              onDelete={onDelete}
              canEdit={canEdit}
              canDelete={canDelete}
              currentOrgId={currentOrgId}   // ← SESSION 15: auto-derives subcon vs owner perms
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
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              {hasActiveFilters ? 'No contracts found' : 'No contracts yet'}
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              {hasActiveFilters
                ? 'Try adjusting your filters to find what you\'re looking for.'
                : 'Get started by creating your first contract.'}
            </p>
            {hasActiveFilters ? (
              <Button variant="primary" onClick={handleResetFilters} className="mt-6">
                Clear Filters
              </Button>
            ) : (
              /* Empty state CTA — only shown when canCreate=true */
              canCreate && (
                <Button variant="primary" onClick={handleCreateContract} className="mt-6">
                  <PlusIcon className="h-5 w-5 mr-2" />
                  Create First Contract
                </Button>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ContractList;
