/**
 * WorkLedger - App Layout Component
 *
 * SESSION 15 UPDATE — Org Switcher for super_admin / bina_jaya_staff
 * SESSION 17 UPDATE — ErrorBoundary wraps <main> content
 * SESSION 18 UPDATE — OfflineIndicator + PWAInstallButton
 * SESSION 19 UPDATE — iOS/Android safe-area fixes + profile link
 *
 * SESSION 19 UPDATE — iOS/Android safe-area fixes:
 *   Header: paddingTop = env(safe-area-inset-top)
 *   BottomNav: safe-area handled INSIDE BottomNav.jsx — not here.
 *
 * SESSION 19 UPDATE — Profile link:
 *   The user name / email in the top-right header is now a clickable
 *   link to /profile. This gives every user a consistent, discoverable
 *   way to access their profile page regardless of role or device.
 *   Mobile users can also reach it via the header (visible on sm+).
 *
 * @module components/layout/AppLayout
 * @created January 29, 2026
 * @updated February 26, 2026 - Session 15
 * @updated March 2, 2026    - Session 17
 * @updated March 4, 2026    - Session 18
 * @updated April 8, 2026    - Session 19: profile link, safe-area insets
 */

import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useOrganization } from '../../context/OrganizationContext';
import { ROUTES } from '../../constants/routes';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import Breadcrumb from '../common/Breadcrumb';
import ErrorBoundary from '../common/ErrorBoundary';
import OfflineIndicator from '../common/OfflineIndicator';
import PWAInstallButton from '../common/PWAInstallButton';

export function AppLayout({ children }) {
  const navigate = useNavigate();
  const { user, profile, logout } = useAuth();
  const { allOrgs, currentOrg, isBinaJayaStaff, switchOrganization } = useOrganization();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOrgDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = async () => {
    const result = await logout();
    if (result.success) {
      navigate(ROUTES.LOGIN);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar isCollapsed={sidebarCollapsed} />

      <div className="flex-1 flex flex-col min-w-0">

        {/*
          ── iOS SAFE AREA: HEADER ──────────────────────────────────────────
          env(safe-area-inset-top) pushes header content below the iPhone
          notch / Dynamic Island in standalone PWA mode.
          Value is 0 on Android and desktop — no visual change.
        */}
        <header
          className="bg-white border-b border-gray-200 sticky top-0 z-30"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex items-center h-16 gap-3">

              {/* Mobile logo */}
              <div className="flex items-center md:hidden">
                <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">W</span>
                </div>
                <span className="ml-2 text-lg font-bold text-gray-900">WorkLedger</span>
              </div>

              {/* Sidebar toggle + home button */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  className="hidden md:flex items-center justify-center w-10 h-10 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                <button
                  onClick={() => navigate(ROUTES.DASHBOARD)}
                  className="flex items-center justify-center w-10 h-10 text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                  title="Dashboard"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                    />
                  </svg>
                </button>
              </div>

              {/* BJ Staff org switcher (centre) */}
              {isBinaJayaStaff ? (
                <div className="flex-1 flex justify-center" ref={dropdownRef}>
                  <div className="relative">
                    <button
                      onClick={() => setOrgDropdownOpen((v) => !v)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border-2 border-amber-400 rounded-xl hover:bg-amber-100 transition-colors"
                    >
                      <svg className="w-4 h-4 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                      <div className="text-left">
                        <p className="text-xs text-amber-600 font-medium leading-none">BJ Staff View</p>
                        <p className="text-sm font-bold text-amber-900 max-w-[200px] truncate">
                          {currentOrg?.name ?? 'No Org Selected'}
                        </p>
                      </div>
                      <svg
                        className={`w-4 h-4 text-amber-500 flex-shrink-0 transition-transform duration-200 ${orgDropdownOpen ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {orgDropdownOpen && (
                      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
                        <div className="px-4 py-3 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
                          <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                          </svg>
                          <div>
                            <p className="text-xs font-bold text-amber-800 uppercase tracking-wide">
                              Switch Organisation View
                            </p>
                            <p className="text-xs text-amber-600">
                              Logged in as {profile?.global_role === 'super_admin' ? 'Super Admin' : 'BJ Staff'} · {profile?.full_name || user?.email}
                            </p>
                          </div>
                        </div>

                        <div className="py-1 max-h-72 overflow-y-auto">
                          {allOrgs.length === 0 && (
                            <p className="px-4 py-6 text-sm text-gray-400 text-center">No organisations found</p>
                          )}
                          {allOrgs.map((org) => {
                            const isActive = org.id === currentOrg?.id;
                            return (
                              <button
                                key={org.id}
                                onClick={() => {
                                  switchOrganization(org.id);
                                  setOrgDropdownOpen(false);
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                                  isActive ? 'bg-primary-50' : 'hover:bg-gray-50'
                                }`}
                              >
                                <div
                                  className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-base font-bold ${
                                    isActive ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-500'
                                  }`}
                                >
                                  {org.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm font-semibold truncate ${isActive ? 'text-primary-700' : 'text-gray-900'}`}>
                                    {org.name}
                                  </p>
                                  {org.subscription_tier && (
                                    <p className="text-xs text-gray-400 capitalize">{org.subscription_tier} tier</p>
                                  )}
                                </div>
                                {isActive && (
                                  <svg className="w-5 h-5 text-primary-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path
                                      fillRule="evenodd"
                                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex-1" />
              )}

              {/* Right side: user info + PWA install + logout */}
              <div className="flex items-center gap-3">

                {/*
                  ── PROFILE LINK ──────────────────────────────────────────
                  Clicking the user name / email navigates to /profile.
                  This is the primary entry point to the profile page for
                  all users on both desktop and mobile.

                  - Shows name if profile loaded, email as fallback
                  - Shows current org name below (for regular users)
                  - Hover shows a subtle underline to signal it's clickable
                  - Hidden on xs (< sm) — mobile users access profile
                    via the BottomNav "More" tab or direct URL
                */}
                <Link
                  to={ROUTES.PROFILE}
                  className="hidden sm:flex flex-col items-end group"
                  title="Edit your profile"
                >
                  <span className="text-sm font-medium text-gray-800 truncate max-w-[160px] group-hover:text-primary-600 group-hover:underline transition-colors">
                    {profile?.full_name || user?.email}
                  </span>
                  {!isBinaJayaStaff && currentOrg && (
                    <span className="text-xs text-gray-400 truncate max-w-[160px]">
                      {currentOrg.name}
                    </span>
                  )}
                </Link>

                <PWAInstallButton />

                <button
                  onClick={handleLogout}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>

          {/* BJ Staff warning banner */}
          {isBinaJayaStaff && currentOrg && (
            <div className="bg-amber-500 px-4 py-1 flex items-center justify-center gap-2">
              <svg className="w-3.5 h-3.5 text-white flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <p className="text-xs text-white font-medium">
                Staff View — Browsing data for <span className="font-bold underline">{currentOrg.name}</span> · Changes here affect this organisation&apos;s real data
              </p>
            </div>
          )}
        </header>

        <ErrorBoundary>
          <main className="flex-1 overflow-y-auto">
            <OfflineIndicator />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 md:pb-6">
              <Breadcrumb />
              {children}
            </div>
          </main>
        </ErrorBoundary>

        <footer className="hidden md:block border-t border-gray-200 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <p className="text-center text-xs text-gray-500">
              © {new Date().getFullYear()} WorkLedger by KL. All rights reserved.
            </p>
          </div>
        </footer>
      </div>

      {/*
        BottomNav is position:fixed — safe-area padding lives inside
        BottomNav.jsx directly on the <nav> element. Do not wrap here.
      */}
      <BottomNav />
    </div>
  );
}

export default AppLayout;
