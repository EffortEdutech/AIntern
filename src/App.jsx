/**
 * AIntern - Root Application Component
 *
 * Provider order:
 *   AuthProvider   → user, session, profile
 *     RouterProvider
 *
 * Session 2: OrganizationProvider removed — AIntern has no org tenancy.
 * The intern is the sole authenticated persona; supervisors act through
 * token links that never require app context.
 *
 * @file src/App.jsx
 * @updated July 9, 2026 - Session 2
 */

import React, { Suspense, useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { AuthProvider } from './context/AuthContext';
import { PLATFORM } from './config/platform';

const PageLoadingFallback = () => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
  </div>
);

function App() {
  useEffect(() => {
    console.log(`✅ ${PLATFORM.name} mounted — ${PLATFORM.tagline}`);
    console.log(`🏢 ${PLATFORM.company}`);
    console.log('📅 Build Date:', new Date().toISOString());
  }, []);

  return (
    <AuthProvider>
      <Suspense fallback={<PageLoadingFallback />}>
        <RouterProvider router={router} />
      </Suspense>
    </AuthProvider>
  );
}

export default App;
