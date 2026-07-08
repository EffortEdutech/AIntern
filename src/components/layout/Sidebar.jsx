/**
 * WorkLedger - Sidebar Component
 *
 * Desktop sidebar navigation with active states and icons.
 * Hidden on mobile, visible on md+ screens.
 *
 * SESSION 11 UPDATE: Role-filtered navigation.
 * SESSION 13 UPDATE: Quick Entry nav item added.
 * SESSION 16 UPDATE: Approvals nav item + pending badge.
 * SESSION 17 UPDATE: Consolidated Report + Rejection Analytics nav items.
 *
 * SESSION 19 UPDATE — No-org fallback state:
 *   When a user is authenticated but has no org_members record (just
 *   registered, not yet added to an org), all can() calls return false ->
 *   navItems is empty -> sidebar nav area is completely blank.
 *   Fix: detect this state and render a friendly "Pending access" block.
 *
 * SESSION 16 UPDATE (May 2026) — Sectioned navigation:
 *   Flat list replaced with 4 labelled groups:
 *     Field Work    : Work Entries, Approvals, Quick Entry
 *     Management    : Projects, Contracts, Templates, Subcontractors
 *     Reports       : Reports, Consolidated, Rejections, Layouts
 *     Administration: Organizations, Users
 *   Sections with zero visible items are hidden automatically.
 *   Collapsed sidebar shows dividers instead of labels.
 *
 * Role visibility summary:
 *   super_admin / bina_jaya_staff  -> all items (incl. Quick Entry)
 *   org_owner / org_admin          -> all standard items + Approvals
 *   manager                        -> work, approvals, projects, contracts, reports, templates
 *   technician / worker            -> dashboard, work entries, projects, contracts
 *   subcontractor                  -> dashboard, work entries, projects, contracts
 *   (no role)                      -> "Pending access" fallback state
 *
 * @module components/layout/Sidebar
 * @created January 29, 2026
 * @updated May 16, 2026 - Session 16: sectioned navigation
 */

import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import { useRole } from '../../hooks/useRole';
import { useAuth } from '../../context/AuthContext';
import { useOrganization } from '../../context/OrganizationContext';
import { workEntryService } from '../../services/api/workEntryService';

// ── Inline SVG icons ──────────────────────────────────────────────────────────
const Icon = {
  dashboard: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  workEntries: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  approvals: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  quickEntry: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  ),
  projects: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  ),
  contracts: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  templates: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
    </svg>
  ),
  subcontractors: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  reports: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  consolidated: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  ),
  rejections: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  layouts: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM14 5a1 1 0 011-1h4a1 1 0 011 1v12a1 1 0 01-1 1h-4a1 1 0 01-1-1V5z" />
    </svg>
  ),
  aiTemplates: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9.813 15.904L9 18.75l-.813-2.846a4 4 0 00-2.779-2.779L2.563 12l2.845-.813a4 4 0 002.779-2.779L9 5.563l.813 2.845a4 4 0 002.779 2.779L15.438 12l-2.846.813a4 4 0 00-2.779 2.779zM18 8.25l-.49 1.715a2.4 2.4 0 01-1.67 1.67l-1.715.49 1.715.49a2.4 2.4 0 011.67 1.67L18 16l.49-1.715a2.4 2.4 0 011.67-1.67l1.715-.49-1.715-.49a2.4 2.4 0 01-1.67-1.67L18 8.25z" />
    </svg>
  ),
  organizations: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  users: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  logout: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  )
};

// ── Sectioned nav definition ──────────────────────────────────────────────────
// Each section has an optional label (null = no header) and an items array.
// Items that the current user cannot see are filtered out at render time.
// Sections where all items are filtered out are hidden entirely.
const NAV_SECTIONS = [
  {
    label: null,
    items: [
      { label: 'Dashboard', path: ROUTES.DASHBOARD, permission: 'NAV_DASHBOARD', icon: Icon.dashboard }
    ]
  },
  {
    label: 'Field Work',
    items: [
      { label: 'Work Entries', path: ROUTES.WORK_ENTRIES,         permission: 'NAV_WORK_ENTRIES', icon: Icon.workEntries },
      { label: 'Approvals',   path: ROUTES.WORK_ENTRY_APPROVALS,  permission: 'APPROVE_WORK_ENTRY', icon: Icon.approvals, hasBadge: true },
      { label: 'Quick Entry', path: ROUTES.QUICK_ENTRY,           permission: 'NAV_QUICK_ENTRY', icon: Icon.quickEntry }
    ]
  },
  {
    label: 'Management',
    items: [
      { label: 'Projects',       path: ROUTES.PROJECTS,       permission: 'NAV_PROJECTS',       icon: Icon.projects },
      { label: 'Contracts',      path: ROUTES.CONTRACTS,      permission: 'NAV_CONTRACTS',      icon: Icon.contracts },
      { label: 'Templates',      path: ROUTES.TEMPLATES,      permission: 'NAV_TEMPLATES',      icon: Icon.templates },
      { label: 'Subcontractors', path: ROUTES.SUBCONTRACTORS, permission: 'NAV_SUBCONTRACTORS', icon: Icon.subcontractors }
    ]
  },
  {
    label: 'Reports',
    items: [
      { label: 'Reports',      path: ROUTES.REPORTS,             permission: 'NAV_REPORTS',        icon: Icon.reports },
      { label: 'Consolidated', path: ROUTES.REPORT_CONSOLIDATED, permission: 'NAV_SUBCONTRACTORS', icon: Icon.consolidated },
      { label: 'Rejections',   path: ROUTES.REPORT_REJECTIONS,   permission: 'APPROVE_WORK_ENTRY', icon: Icon.rejections },
      { label: 'AI Templates', path: ROUTES.REPORT_TEMPLATE_IMPORT, permission: 'NAV_AI_TEMPLATE_STUDIO', icon: Icon.aiTemplates },
      { label: 'Layouts',      path: ROUTES.REPORT_LAYOUTS,      permission: 'NAV_LAYOUTS',        icon: Icon.layouts }
    ]
  },
  {
    label: 'Administration',
    items: [
      { label: 'Organizations', path: ROUTES.ORGANIZATIONS, permission: 'NAV_ORGANIZATIONS', icon: Icon.organizations },
      { label: 'Users',         path: ROUTES.USERS,         permission: 'NAV_USERS',         icon: Icon.users }
    ]
  }
];

export function Sidebar({ isCollapsed = false }) {
  const location  = useLocation();
  const navigate  = useNavigate();
  const { can, loading: roleLoading } = useRole();
  const { profile, logout } = useAuth();
  const { currentOrg } = useOrganization();

  // ── Pending approval count badge ──────────────────────────────────────────
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const canApprove = can('APPROVE_WORK_ENTRY');
    if (!canApprove || !currentOrg?.id) {
      setPendingCount(0); return;
    }

    let cancelled = false;
    const fetchCount = async () => {
      try {
        const result = await workEntryService.getPendingApprovals(currentOrg.id, true);
        if (!cancelled && result.success) {
          setPendingCount(result.count || 0);
        }
      } catch { /* non-fatal */ }
    };

    fetchCount();
    const interval = setInterval(fetchCount, 30_000);
    return () => {
      cancelled = true; clearInterval(interval); 
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg?.id]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const isActive = (path) =>
    path === '/'
      ? location.pathname === '/'
      : location.pathname.startsWith(path);

  // Filter each section down to items the user can see; drop empty sections.
  const visibleSections = NAV_SECTIONS
    .map(section => ({
      ...section,
      items: section.items.filter(item => can(item.permission))
    }))
    .filter(section => section.items.length > 0);

  const totalVisible = visibleSections.reduce((n, s) => n + s.items.length, 0);
  const isNoOrgState = !roleLoading && !!profile && totalVisible === 0;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <aside className={`
      hidden md:flex flex-col
      bg-white border-r border-gray-200
      transition-all duration-300 ease-in-out
      ${isCollapsed ? 'w-16' : 'w-60'}
    `}>

      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-gray-200 flex-shrink-0">
        <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-sm">W</span>
        </div>
        {!isCollapsed && (
          <div className="ml-3 min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate leading-tight">
              {currentOrg?.slug
                ? currentOrg.slug.toUpperCase()
                : 'WorkLedger'}
            </p>
            <p className="text-xs text-gray-400 leading-none mt-0.5">WorkLedger</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3">

        {isNoOrgState ? (
          /* ── No-org fallback ── */
          <div className="px-3 py-2">
            {!isCollapsed ? (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
                  <p className="text-xs font-semibold text-amber-800">No organisation yet</p>
                </div>
                <p className="text-xs text-amber-700 leading-relaxed">
                  Your account is set up but hasn&apos;t been added to an
                  organisation. Contact your administrator to get access.
                </p>
                <button
                  onClick={async () => {
                    await logout(); navigate(ROUTES.LOGIN); 
                  }}
                  className="w-full mt-1 flex items-center justify-center gap-1.5 px-3 py-1.5
                             text-xs font-medium text-gray-600 bg-white border border-gray-200
                             rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {Icon.logout}
                  Logout
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <button
                  onClick={async () => {
                    await logout(); navigate(ROUTES.LOGIN); 
                  }}
                  className="flex items-center justify-center w-9 h-9 rounded-lg text-gray-500
                             hover:bg-gray-100 transition-colors"
                  title="Logout"
                >
                  {Icon.logout}
                </button>
              </div>
            )}
          </div>
        ) : (
          /* ── Sectioned nav ── */
          <div className="space-y-1">
            {visibleSections.map((section, sIdx) => (
              <div key={section.label ?? '__home'}>

                {/* Section divider — collapsed: thin rule; expanded: label */}
                {section.label && (
                  isCollapsed ? (
                    sIdx > 0 && (
                      <div className="mx-3 my-2 border-t border-gray-100" />
                    )
                  ) : (
                    <p className="px-4 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400 select-none">
                      {section.label}
                    </p>
                  )
                )}

                {/* Items */}
                <div className="px-2 space-y-0.5">
                  {section.items.map((item) => {
                    const active = isActive(item.path);
                    const badge  = item.hasBadge && pendingCount > 0 ? pendingCount : null;
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        title={isCollapsed ? item.label : undefined}
                        className={`
                          flex items-center px-2 py-2 rounded-lg
                          text-sm font-medium transition-colors duration-150
                          ${active
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}
                        `}
                      >
                        <span className={`flex-shrink-0 ${active ? 'text-primary-600' : 'text-gray-400'}`}>
                          {item.icon}
                        </span>

                        {!isCollapsed && (
                          <span className="ml-3 flex-1 flex items-center justify-between min-w-0">
                            <span className="truncate">{item.label}</span>
                            {badge !== null && (
                              <span className="ml-2 flex-shrink-0 inline-flex items-center justify-center
                                               min-w-[1.25rem] h-5 px-1 text-xs font-bold
                                               text-white bg-blue-600 rounded-full">
                                {badge > 99 ? '99+' : badge}
                              </span>
                            )}
                          </span>
                        )}

                        {isCollapsed && badge !== null && (
                          <span className="absolute top-1 right-1 w-2 h-2 bg-blue-600 rounded-full" />
                        )}
                      </Link>
                    );
                  })}
                </div>

              </div>
            ))}
          </div>
        )}
      </nav>

      <div className="h-4 flex-shrink-0" />
    </aside>
  );
}

export default Sidebar;
