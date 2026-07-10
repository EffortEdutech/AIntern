/**
 * AIntern - Router Configuration
 *
 * Session 2: WorkLedger business routes (organizations, projects,
 * contracts, work entries, reports, layouts, users, subcontractors,
 * quick entry) are UNROUTED — the page files remain parked in src/pages
 * for engine reuse but are not reachable. See docs/AINTERN_PROJECT_PLAN.md §6.
 *
 * SECURITY MODEL:
 *   ProtectedRoute — is the intern logged in? If not → /login.
 *   Role guards are gone: AIntern has a single authenticated persona
 *   (the intern). Supervisors never log in — they act through
 *   single-purpose token links (Phase 2), which never touch this router
 *   beyond a public /review/:token page.
 *
 * @file src/router.jsx
 * @updated July 9, 2026 - Session 2: intern-only routing
 */

import { lazy } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { ROUTES } from './constants/routes';

// Auth guard (eager — needed immediately)
import ProtectedRoute from './components/auth/ProtectedRoute';

// Public pages
const Login          = lazy(() => import('./pages/auth/Login'));
const Register       = lazy(() => import('./pages/auth/Register'));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'));

// Intern pages
const InternHome    = lazy(() => import('./pages/intern/InternHome'));
const InternProfile = lazy(() => import('./pages/intern/InternProfile'));
const Onboarding    = lazy(() => import('./pages/onboarding/Onboarding'));
const DailyLogPage  = lazy(() => import('./pages/log/DailyLogPage'));
const LogHistory    = lazy(() => import('./pages/log/LogHistory'));
const LogbookPage   = lazy(() => import('./pages/logbook/LogbookPage'));
const TemplateStudioPage = lazy(() => import('./pages/studio/TemplateStudioPage'));

// Public supervisor page — token-gated inside the page/Edge Function,
// deliberately NOT wrapped in <Auth> (supervisors have no accounts).
const SupervisorReview = lazy(() => import('./pages/review/SupervisorReview'));

// 404
const NotFoundPage = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50">
    <div className="text-center">
      <h1 className="text-4xl font-bold text-gray-900 mb-4">404 - Page Not Found</h1>
      <p className="text-gray-600">The page you are looking for does not exist.</p>
    </div>
  </div>
);

// Authenticated wrapper
const Auth = ({ children }) => <ProtectedRoute>{children}</ProtectedRoute>;

export const router = createBrowserRouter([

  // ── Public ──────────────────────────────────────────────────────────
  { path: ROUTES.LOGIN,           element: <Login /> },
  { path: ROUTES.REGISTER,        element: <Register /> },
  { path: ROUTES.FORGOT_PASSWORD, element: <ForgotPassword /> },
  { path: '/review',              element: <SupervisorReview /> },

  // ── Intern (authenticated) ──────────────────────────────────────────
  { path: '/',           element: <Auth><InternHome /></Auth> },
  { path: '/onboarding', element: <Auth><Onboarding /></Auth> },
  { path: '/profile',    element: <Auth><InternProfile /></Auth> },

  // Daily logging (Session 4)
  { path: '/log',     element: <Auth><DailyLogPage /></Auth> },
  { path: '/history', element: <Auth><LogHistory /></Auth> },
  { path: '/logbook', element: <Auth><LogbookPage /></Auth> },
  { path: '/template-studio', element: <Auth><TemplateStudioPage /></Auth> },

  // ── 404 ─────────────────────────────────────────────────────────────
  { path: '*', element: <NotFoundPage /> }

], {
  future: { v7_startTransition: true }
});

export default router;
