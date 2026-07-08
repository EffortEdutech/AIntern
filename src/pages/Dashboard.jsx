/**
 * WorkLedger - Dashboard Page
 *
 * SESSION 10 UPDATE: Org-aware stats via useOrganization().
 *
 * SESSION 15 UPDATE — Permission-aware Dashboard:
 *   Stats cards: only shown if user has permission to VIEW that resource.
 *   Quick Actions: only shown if user has permission to CREATE.
 *   Organizations stat: only for BJ staff / org_owner / org_admin.
 *   technician / worker / subcontractor → see Work Entries + Projects only.
 *
 * SESSION 16 UPDATE — Approval workflow:
 *   - Pending approvals count fetched in loadStats (countOnly=true, cheap query)
 *   - "Review Approvals" quick action added — visible to APPROVE_WORK_ENTRY roles
 *   - Count badge shown on the action card when pendingCount > 0
 *
 * @module pages/Dashboard
 * @created January 29, 2026
 * @updated February 26, 2026 - Session 15: permission-aware stats + quick actions
 * @updated February 27, 2026 - Session 16: pending approvals count + quick action
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useOrganization } from '../context/OrganizationContext';
import { useRole } from '../hooks/useRole';
import AppLayout from '../components/layout/AppLayout';
import StatsCard from '../components/dashboard/StatsCard';
import RecentActivity from '../components/dashboard/RecentActivity';
import OnboardingWizard from '../components/dashboard/OnboardingWizard';
import { projectService } from '../services/api/projectService';
import { contractService } from '../services/api/contractService';
import { workEntryService } from '../services/api/workEntryService';
import { organizationService } from '../services/api/organizationService';
import {
  DocumentTextIcon,
  FolderIcon,
  DocumentDuplicateIcon,
  BuildingOffice2Icon,
  PlusIcon,
  CheckCircleIcon     // Session 16: used for Review Approvals action
} from '@heroicons/react/24/outline';
import { ROUTES } from '../constants/routes';

export function Dashboard() {
  const { user, profile } = useAuth();
  const { orgId, currentOrg, isBinaJayaStaff } = useOrganization();
  const { can } = useRole();

  const [stats, setStats] = useState({
    workEntries:    0,
    projects:       0,
    contracts:      0,
    organizations:  0,
    pendingApprovals: 0   // Session 16
  });
  const [loading, setLoading] = useState(true);

  // ── Load stats ──────────────────────────────────────────────────────
  const loadStats = useCallback(async () => {
    try {
      setLoading(true);

      // Only fetch what the user can actually see
      const fetches = [];

      if (can('VIEW_OWN_WORK_ENTRIES')) {
        fetches.push(workEntryService.getWorkEntriesCount(orgId));
      } else {
        fetches.push(Promise.resolve(null));
      }

      if (can('VIEW_PROJECTS')) {
        fetches.push(projectService.getProjectsCount(orgId));
      } else {
        fetches.push(Promise.resolve(null));
      }

      if (can('VIEW_CONTRACTS')) {
        fetches.push(contractService.getContractsCount(orgId));
      } else {
        fetches.push(Promise.resolve(null));
      }

      if (can('NAV_ORGANIZATIONS')) {
        fetches.push(organizationService.getUserOrganizations());
      } else {
        fetches.push(Promise.resolve(null));
      }

      // Session 16: pending approvals count — cheap countOnly query
      if (can('APPROVE_WORK_ENTRY') && orgId) {
        fetches.push(workEntryService.getPendingApprovals(orgId, true));
      } else {
        fetches.push(Promise.resolve(null));
      }

      const [
        workEntriesResult,
        projectsResult,
        contractsResult,
        orgsResult,
        pendingResult     // Session 16
      ] = await Promise.all(fetches);

      setStats({
        workEntries:      workEntriesResult                          ?? 0,
        projects:         projectsResult                             ?? 0,
        contracts:        contractsResult                            ?? 0,
        organizations:    Array.isArray(orgsResult) ? orgsResult.length : 0,
        pendingApprovals: pendingResult?.count                       ?? 0   // Session 16
      });
    } catch (error) {
      console.error('❌ Dashboard: Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  }, [orgId, can]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // ── Stat card definitions (only include what user can see) ──────────
  const allStatCards = [
    {
      permission:  'VIEW_OWN_WORK_ENTRIES',
      title:       'Work Entries',
      value:       loading ? '…' : stats.workEntries,
      icon:        <DocumentTextIcon className="w-6 h-6" />,
      color:       'blue',
      link:        '/work',
      description: currentOrg ? `In ${currentOrg.name}` : 'Your entries'
    },
    {
      permission:  'VIEW_PROJECTS',
      title:       'Projects',
      value:       loading ? '…' : stats.projects,
      icon:        <FolderIcon className="w-6 h-6" />,
      color:       'green',
      link:        '/projects',
      description: currentOrg ? `In ${currentOrg.name}` : 'Across all orgs'
    },
    {
      permission:  'VIEW_CONTRACTS',
      title:       'Contracts',
      value:       loading ? '…' : stats.contracts,
      icon:        <DocumentDuplicateIcon className="w-6 h-6" />,
      color:       'purple',
      link:        '/contracts',
      description: currentOrg ? `In ${currentOrg.name}` : 'Across all orgs'
    },
    {
      permission:  'NAV_ORGANIZATIONS',
      title:       'Organizations',
      value:       loading ? '…' : stats.organizations,
      icon:        <BuildingOffice2Icon className="w-6 h-6" />,
      color:       'orange',
      link:        '/organizations',
      description: isBinaJayaStaff ? 'All client orgs' : 'Your organization'
    }
  ];

  // Filter to only cards the user has permission to see
  const visibleStatCards = allStatCards.filter(card => can(card.permission));

  // ── Quick action definitions (only include what user can do) ────────
  const allQuickActions = [
    {
      permission: 'CREATE_WORK_ENTRY',
      to:         '/work/new',
      label:      'New Work Entry',
      icon:       <PlusIcon className="w-6 h-6" />,
      hoverColor: 'hover:border-blue-400 hover:bg-blue-50',
      iconHover:  'group-hover:text-blue-500',
      labelHover: 'group-hover:text-blue-600'
    },
    {
      permission: 'CREATE_PROJECT',
      to:         '/projects/new',
      label:      'New Project',
      icon:       <PlusIcon className="w-6 h-6" />,
      hoverColor: 'hover:border-green-400 hover:bg-green-50',
      iconHover:  'group-hover:text-green-500',
      labelHover: 'group-hover:text-green-600'
    },
    {
      permission: 'CREATE_CONTRACT',
      to:         '/contracts/new',
      label:      'New Contract',
      icon:       <PlusIcon className="w-6 h-6" />,
      hoverColor: 'hover:border-purple-400 hover:bg-purple-50',
      iconHover:  'group-hover:text-purple-500',
      labelHover: 'group-hover:text-purple-600'
    },
    {
      permission: 'GENERATE_REPORTS',
      to:         '/reports/generate',
      label:      'Generate Report',
      icon:       <DocumentTextIcon className="w-6 h-6" />,
      hoverColor: 'hover:border-orange-400 hover:bg-orange-50',
      iconHover:  'group-hover:text-orange-500',
      labelHover: 'group-hover:text-orange-600'
    },
    // ── Session 16: Approvals quick action ────────────────────────────────
    {
      permission:   'APPROVE_WORK_ENTRY',
      to:           ROUTES.WORK_ENTRY_APPROVALS,
      label:        loading
        ? 'Review Approvals'
        : stats.pendingApprovals > 0
          ? `Review Approvals (${stats.pendingApprovals})`
          : 'Review Approvals',
      icon:         <CheckCircleIcon className="w-6 h-6" />,
      hoverColor:   'hover:border-teal-400 hover:bg-teal-50',
      iconHover:    'group-hover:text-teal-500',
      labelHover:   'group-hover:text-teal-600',
      // badge is used in the render below to show a dot/number
      badge:        !loading && stats.pendingApprovals > 0 ? stats.pendingApprovals : null
    }
  ];

  const visibleQuickActions = allQuickActions.filter(a => can(a.permission));

  // ── Responsive grid cols based on how many cards are visible ────────
  const statGridCols = visibleStatCards.length === 1 ? 'grid-cols-1 max-w-xs'
    : visibleStatCards.length === 2               ? 'grid-cols-1 sm:grid-cols-2 max-w-xl'
      : visibleStatCards.length === 3               ? 'grid-cols-1 sm:grid-cols-3'
        :                                               'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';

  const actionGridCols = visibleQuickActions.length <= 2
    ? 'grid-cols-2'
    : 'grid-cols-2 sm:grid-cols-4';

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">

        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            {currentOrg
              ? `Viewing: ${currentOrg.name}`
              : `Welcome back, ${profile?.full_name || user?.email}`}
          </p>
        </div>

        {/* No-org onboarding alert */}
        {!loading && stats.organizations === 0 && can('NAV_ORGANIZATIONS') && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <span className="text-amber-500 mt-0.5">⚠️</span>
            <div>
              <p className="text-sm font-medium text-amber-800">
                You&apos;re not part of any organization yet.
              </p>
              <p className="text-sm text-amber-700 mt-0.5">
                Create your first organization to get started.
              </p>
              <Link
                to="/organizations/new"
                className="mt-2 inline-block text-sm font-medium text-amber-700 underline hover:text-amber-900"
              >
                Create Organization →
              </Link>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        {visibleStatCards.length > 0 && (
          <div className={`grid ${statGridCols} gap-6 mb-8`}>
            {visibleStatCards.map(card => (
              <StatsCard
                key={card.title}
                title={card.title}
                value={card.value}
                icon={card.icon}
                color={card.color}
                link={card.link}
                description={card.description}
              />
            ))}
          </div>
        )}

        {/* Onboarding Wizard — shown when org exists but has no contracts yet */}
        {orgId && stats.contracts === 0 && !loading && can('MANAGE_CONTRACTS') && (
          <OnboardingWizard
            contractCount={stats.contracts}
            orgId={orgId}
            can={can}
            loading={loading}
          />
        )}

        {/* Quick Actions */}
        {visibleQuickActions.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className={`grid ${actionGridCols} gap-3`}>
              {visibleQuickActions.map(action => (
                <Link
                  key={action.to}
                  to={action.to}
                  className={`
                    relative flex flex-col items-center justify-center p-4
                    bg-white border-2 border-dashed border-gray-200 rounded-xl
                    transition-colors group ${action.hoverColor}
                  `}
                >
                  {/* Session 16: badge dot for pending approvals */}
                  {action.badge !== null && (
                    <span className="absolute top-2 right-2 inline-flex items-center
                                     justify-center min-w-[1.25rem] h-5 px-1
                                     text-xs font-bold text-white bg-blue-600 rounded-full">
                      {action.badge > 99 ? '99+' : action.badge}
                    </span>
                  )}
                  <span className={`text-gray-400 mb-2 ${action.iconHover}`}>
                    {action.icon}
                  </span>
                  <span className={`text-sm font-medium text-gray-600 text-center ${action.labelHover}`}>
                    {action.label}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Recent Activity */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
          <RecentActivity orgId={orgId} />
        </div>

      </div>
    </AppLayout>
  );
}

export default Dashboard;
