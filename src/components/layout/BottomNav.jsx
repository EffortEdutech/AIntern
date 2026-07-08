/**
 * WorkLedger - Bottom Navigation Component
 *
 * Mobile bottom navigation bar (max 5 tabs for good UX).
 * Hidden on md+ screens.
 *
 * SESSION 11 UPDATE: Role-filtered tabs.
 * SESSION 19 UPDATE: iOS/Android safe-area inset on <nav> element directly.
 * SESSION 19 UPDATE: No-org fallback state for new/pending users.
 * SESSION 20 UPDATE: Approvals tab with badge, Profile tab replaces More.
 *
 * NO-ORG STATE:
 *   When a user is authenticated but has no org_members record yet
 *   (just registered, not yet invited to an org), effectiveRole is null →
 *   all can() calls return false → zero tabs → blank white space.
 *
 *   Fix: detect this state (profile exists + role loading done + tabs = 0)
 *   and render a "Awaiting organisation access" bar with a Logout button.
 *   This gives the user clear feedback and a way out instead of a broken UI.
 *
 * @module components/layout/BottomNav
 * @created January 29, 2026
 * @updated February 21, 2026 - Session 11: Role-filtered tabs
 * @updated April 7, 2026    - Session 19: safe-area inset + no-org fallback
 * @updated May 17, 2026     - Session 20: Approvals badge + Profile tab
 */

import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import { useRole } from '../../hooks/useRole';
import { useAuth } from '../../context/AuthContext';
import { useOrganization } from '../../context/OrganizationContext';
import { workEntryService } from '../../services/api/workEntryService';

export function BottomNav() {
  const location  = useLocation();
  const navigate  = useNavigate();
  const { can, loading: roleLoading } = useRole();
  const { profile, logout } = useAuth();
  const { orgId } = useOrganization();

  const [pendingCount, setPendingCount] = useState(0);

  // Fetch pending approvals count only for users who can approve work entries
  useEffect(() => {
    if (!can('APPROVE_WORK_ENTRY') || !orgId) {
      return;
    }

    let cancelled = false;
    workEntryService.getPendingApprovals(orgId, true)
      .then((count) => {
        if (!cancelled) {
          setPendingCount(typeof count === 'number' ? count : 0);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [orgId, can]);

  const allTabs = [
    {
      label:      'Work',
      path:       ROUTES.WORK_ENTRIES,
      permission: 'NAV_WORK_ENTRIES',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    },
    {
      label:      'Projects',
      path:       ROUTES.PROJECTS,
      permission: 'NAV_PROJECTS',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      )
    },
    {
      label:      'Reports',
      path:       ROUTES.REPORTS,
      permission: 'NAV_REPORTS',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    },
    {
      label:      'Users',
      path:       '/users',
      permission: 'NAV_USERS',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      )
    },
    {
      label:      'Approvals',
      path:       ROUTES.WORK_ENTRY_APPROVALS,
      permission: 'APPROVE_WORK_ENTRY',
      badge:      pendingCount > 0,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      )
    },
    {
      label:      'Profile',
      path:       ROUTES.PROFILE,
      permission: 'NAV_DASHBOARD',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    }
  ];

  const tabs = allTabs.filter(tab => can(tab.permission)).slice(0, 5);

  const isActive = (path) =>
    path === '/'
      ? location.pathname === '/'
      : location.pathname === path || location.pathname.startsWith(path + '/');

  // ── No-Org Fallback ───────────────────────────────────────────────────────
  // Conditions: role loading has finished + user has a profile + zero tabs.
  // This means the user is authenticated but has no org membership and no
  // platform role. Show a clear pending state instead of blank white space.
  const isNoOrgState = !roleLoading && !!profile && tabs.length === 0;

  if (isNoOrgState) {
    return (
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-amber-200 z-40"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-between px-4 h-16 gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0 animate-pulse" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-700 truncate">No organisation yet</p>
              <p className="text-xs text-gray-400 truncate">Contact your administrator</p>
            </div>
          </div>
          <button
            onClick={async () => {
              await logout(); navigate(ROUTES.LOGIN); 
            }}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>
      </nav>
    );
  }

  // ── Normal render ─────────────────────────────────────────────────────────
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex justify-around items-center h-16">
        {tabs.map((tab) => {
          const active = isActive(tab.path);
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={`
                flex flex-col items-center justify-center
                flex-1 h-full gap-1
                transition-colors duration-200
                ${active ? 'text-primary-600' : 'text-gray-500 hover:text-gray-700'}
              `}
            >
              <span className="relative">
                {tab.icon}
                {tab.badge && (
                  <span className="absolute top-1 right-1/4 w-2 h-2 rounded-full bg-red-500" />
                )}
              </span>
              <span className="text-xs font-medium">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default BottomNav;
