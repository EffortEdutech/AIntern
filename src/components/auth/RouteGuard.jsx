/**
 * WorkLedger - Route Guard Component
 *
 * Protects entire routes by permission. Unlike PermissionGuard (which hides
 * UI elements), RouteGuard REDIRECTS or shows an "Access Denied" page when
 * the user lacks the required permission.
 *
 * This prevents direct URL access by unauthorized roles.
 *
 * USAGE in Router.jsx:
 *   <ProtectedRoute>
 *     <RouteGuard permission="NAV_USERS">
 *       <UserList />
 *     </RouteGuard>
 *   </ProtectedRoute>
 *
 * SESSION 19 FIX — Infinite redirect loop prevention:
 *   The previous version always redirected to '/' on denied access.
 *   This caused an infinite loop when '/' (dashboard) itself used RouteGuard:
 *     → User navigates to /
 *     → Guard checks can('NAV_DASHBOARD') → false (no role yet)
 *     → Navigate to '/' → same route → same check → loop → blank page
 *
 *   Fix: Dashboard uses Auth wrapper (not Guard) so it's always reachable.
 *   All other guarded routes redirect to '/' which is safe because dashboard
 *   no longer has a permission guard.
 *
 *   Additional safety: if the redirect target equals the current path,
 *   show an "Access Denied" page instead of redirecting (prevents any
 *   remaining loop scenarios).
 *
 * @module components/auth/RouteGuard
 * @created February 23, 2026 - Session 12
 * @updated April 8, 2026    - Session 19: loop prevention + access denied page
 */

import { Navigate, useLocation } from 'react-router-dom';
import { useRole } from '../../hooks/useRole';
import LoadingSpinner from '../common/LoadingSpinner';

/**
 * RouteGuard
 *
 * @param {string}          permission   - Permission key from permissions.js
 * @param {React.ReactNode} children     - Page to render if allowed
 * @param {string}          [redirectTo] - Where to redirect if denied (default: /)
 */
export default function RouteGuard({
  permission,
  children,
  redirectTo = '/'
}) {
  const { can, loading } = useRole();
  const location = useLocation();

  // While role loads, show a spinner — prevents flash of content or
  // premature redirect before permissions are resolved.
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // User has permission — render the page.
  if (can(permission)) {
    return children;
  }

  // ── Access denied ──────────────────────────────────────────────────────────
  // Safety check: if the redirect target is the same as the current path,
  // we would create an infinite redirect loop. Show an access denied page
  // instead. This is a secondary safeguard — the primary fix is that '/'
  // (dashboard) no longer uses RouteGuard at all.
  if (redirectTo === location.pathname) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow p-8 text-center">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-sm text-gray-500 mb-6">
            You don&apos;t have permission to view this page. Contact your organisation
            administrator if you believe this is an error.
          </p>
          <button
            onClick={() => window.history.back()}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Redirect to the fallback destination (dashboard by default).
  return <Navigate to={redirectTo} replace />;
}
