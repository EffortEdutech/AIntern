/**
 * WorkLedger - Root Application Component
 *
 * Main application component that provides routing and global context.
 *
 * Provider order (CRITICAL — inner depends on outer):
 *   AuthProvider           → provides user, session, profile (including global_role)
 *     OrganizationProvider → depends on profile.global_role from AuthProvider
 *       RouterProvider     → all pages can use useOrganization() and useAuth()
 *
 * NOTE:
 *   Offline UI is now fully handled by:
 *     - <OfflineProvider> in main.jsx
 *     - <OfflineIndicator> inside AppLayout.jsx
 *   This file should NOT render its own inline offline banner anymore.
 *
 * @file src/App.jsx
 * @created January 29, 2026
 * @updated March 4, 2026 - Session 18 cleanup: removed old inline offline banner
 */

import React, { Suspense, useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { AuthProvider } from './context/AuthContext';
import { OrganizationProvider } from './context/OrganizationContext';

/**
 * Full-screen loading spinner shown while lazy page chunks are loading.
 */
const PageLoadingFallback = () => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
  </div>
);

/**
 * Root App Component
 */
function App() {
  useEffect(() => {
    console.log('✅ App component mounted');
    console.log('📱 WorkLedger - Contract-Aware Work Reporting Platform');
    console.log('🏢 Bina Jaya / Effort Edutech');
    console.log('📅 Build Date:', new Date().toISOString());

    const features = {
      offlineSync: import.meta.env.VITE_ENABLE_OFFLINE_SYNC === 'true',
      slaTracking: import.meta.env.VITE_ENABLE_SLA_TRACKING === 'true',
      photoUploads: import.meta.env.VITE_ENABLE_PHOTO_UPLOADS === 'true',
      pdfGeneration: import.meta.env.VITE_ENABLE_PDF_GENERATION === 'true'
    };
    console.log('🎛️ Feature Flags:', features);

    return () => {
      console.log('🔄 App component unmounting');
    };
  }, []);

  return (
    <AuthProvider>
      {/* OrganizationProvider must be INSIDE AuthProvider
          so it can read profile.global_role to identify Bina Jaya staff */}
      <OrganizationProvider>
        <Suspense fallback={<PageLoadingFallback />}>
          <RouterProvider router={router} />
        </Suspense>
      </OrganizationProvider>
    </AuthProvider>
  );
}

export default App;
