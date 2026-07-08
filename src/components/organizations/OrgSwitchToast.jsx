/**
 * WorkLedger - Organization Switch Toast
 *
 * A lightweight, self-dismissing notification that appears whenever
 * a Bina Jaya staff member switches the active organization.
 *
 * HOW TO USE:
 *   Import and place inside OrganizationSwitcher.jsx (already done),
 *   OR place in AppLayout.jsx near the header.
 *
 *   It subscribes to OrganizationContext and fires automatically on switch.
 *   No props needed. No wiring in pages needed.
 *
 * @file src/components/organizations/OrgSwitchToast.jsx
 * @created February 20, 2026 - Session 10
 */

import { useState, useEffect, useRef } from 'react';
import { useOrganization } from '../../context/OrganizationContext';

export default function OrgSwitchToast() {
  const { currentOrg } = useOrganization();
  const [toast, setToast] = useState(null);        // { message, orgName }
  const [visible, setVisible] = useState(false);
  const prevOrgRef = useRef(null);                  // Track previous org
  const timerRef   = useRef(null);

  useEffect(() => {
    // Don't fire on first render (initial load isn't a "switch")
    if (prevOrgRef.current === null) {
      prevOrgRef.current = currentOrg?.id ?? null;
      return;
    }

    // Only fire if the org actually changed
    if (currentOrg?.id && currentOrg.id !== prevOrgRef.current) {
      prevOrgRef.current = currentOrg.id;

      // Clear any existing timer
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      setToast({ orgName: currentOrg.name });
      setVisible(true);

      // Auto-dismiss after 2.5 seconds
      timerRef.current = setTimeout(() => {
        setVisible(false);
      }, 2500);
    }
  }, [currentOrg]);

  // Cleanup timer on unmount
  useEffect(() => () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  }, []);

  if (!toast) {
    return null;
  }

  return (
    <div
      className={`
        fixed bottom-6 left-1/2 -translate-x-1/2 z-50
        transition-all duration-300 ease-in-out
        ${visible
      ? 'opacity-100 translate-y-0'
      : 'opacity-0 translate-y-4 pointer-events-none'
    }
      `}
    >
      <div className="flex items-center gap-2.5 bg-gray-900 text-white text-sm font-medium
                      px-4 py-3 rounded-xl shadow-2xl border border-white/10">
        {/* Building icon */}
        <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
        <span>
          Now viewing&nbsp;
          <span className="text-amber-400">{toast.orgName}</span>
        </span>
      </div>
    </div>
  );
}
