/**
 * WorkLedger - Organization Switcher
 *
 * Shown in the app header ONLY for Bina Jaya staff (super_admin, bina_jaya_staff).
 * Allows switching the "active org context" — all app data filters to this org.
 * Regular client users: renders nothing (null). No impact on their experience.
 *
 * Placement: AppLayout.jsx header (center section, between nav and user info)
 *
 * @file src/components/organizations/OrganizationSwitcher.jsx
 * @created February 20, 2026
 * @session Session 9 - Multi-Tenancy Foundation
 */

import { useState, useRef, useEffect } from 'react';
import { useOrganization } from '../../context/OrganizationContext';

// Subscription tier badge styles
const TIER_BADGE = {
  enterprise:   'bg-purple-100 text-purple-700',
  professional: 'bg-blue-100 text-blue-700',
  basic:        'bg-green-100 text-green-700',
  free:         'bg-gray-100 text-gray-500'
};

export default function OrganizationSwitcher() {
  const { currentOrg, allOrgs, isBinaJayaStaff, switchOrganization, loading } = useOrganization();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // ── Close on outside click ──
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Only render for Bina Jaya staff ──
  if (!isBinaJayaStaff) {
    return null;
  }
  if (loading) {
    return <SwitcherSkeleton />;
  }

  const handleSelect = (orgId) => {
    switchOrganization(orgId);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>

      {/* ── Staff badge ── */}
      <span className="absolute -top-2 -right-1 z-10 text-[10px] font-bold bg-amber-500 text-white rounded-full px-1.5 py-0.5 leading-none pointer-events-none">
        BJ Staff
      </span>

      {/* ── Trigger button ── */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors max-w-[220px]"
        title="Switch client organization"
      >
        {/* Building icon */}
        <svg className="w-4 h-4 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>

        <span className="text-sm font-medium text-amber-800 truncate">
          {currentOrg?.name || 'Select Organization'}
        </span>

        {/* Chevron */}
        <svg
          className={`w-3.5 h-3.5 text-amber-600 flex-shrink-0 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* ── Dropdown ── */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">

          {/* Header */}
          <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-100">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
              Switch Organization
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              {allOrgs.length} organization{allOrgs.length !== 1 ? 's' : ''} available
            </p>
          </div>

          {/* List */}
          <div className="max-h-72 overflow-y-auto py-1">
            {allOrgs.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-gray-400">
                No organizations found
              </div>
            ) : (
              allOrgs.map(org => {
                const isActive = org.id === currentOrg?.id;
                const tierStyle = TIER_BADGE[org.subscription_tier] || TIER_BADGE.free;

                return (
                  <button
                    key={org.id}
                    onClick={() => handleSelect(org.id)}
                    className={`w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50 transition-colors ${
                      isActive ? 'bg-blue-50 border-l-2 border-l-blue-500' : 'border-l-2 border-l-transparent'
                    }`}
                  >
                    {/* Avatar */}
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-bold ${
                      isActive ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {org.name.charAt(0).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-sm font-medium truncate ${isActive ? 'text-blue-700' : 'text-gray-900'}`}>
                          {org.name}
                        </span>
                        {isActive && (
                          <svg className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${tierStyle}`}>
                          {org.subscription_tier}
                        </span>
                        <span className="text-xs text-gray-400 truncate">
                          {org.slug}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
            <p className="text-[11px] text-gray-400 text-center">
              🔒 Viewing as Bina Jaya Staff
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Skeleton while loading ──
function SwitcherSkeleton() {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 border border-gray-200 rounded-lg w-44 animate-pulse">
      <div className="w-4 h-4 bg-gray-300 rounded flex-shrink-0" />
      <div className="h-4 bg-gray-300 rounded flex-1" />
      <div className="w-3.5 h-3.5 bg-gray-300 rounded flex-shrink-0" />
    </div>
  );
}
