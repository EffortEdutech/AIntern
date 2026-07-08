/**
 * WorkLedger - Protected Route Component
 * 
 * Wrapper component that redirects to login if user is not authenticated.
 * Used to protect routes that require authentication.
 * 
 * @module components/auth/ProtectedRoute
 * @created January 29, 2026
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ROUTES } from '../../constants/routes';

/**
 * ProtectedRoute Component
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - Child components to render if authenticated
 * @param {string} props.redirectTo - Where to redirect if not authenticated (default: /login)
 * 
 * @example
 * <ProtectedRoute>
 *   <Dashboard />
 * </ProtectedRoute>
 */
export function ProtectedRoute({ children, redirectTo = ROUTES.LOGIN }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  console.log('🛡️ ProtectedRoute: Checking auth...', { 
    loading, 
    hasUser: !!user, 
    path: location.pathname 
  });

  // Show loading spinner while checking auth
  if (loading) {
    console.log('⏳ ProtectedRoute: Still loading, showing spinner...');
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="spinner mb-4" style={{ width: '40px', height: '40px' }}></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    console.log('🔐 ProtectedRoute: No user, redirecting to login');
    
    // Save the location they were trying to access
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // User is authenticated, render children
  console.log('✅ ProtectedRoute: User authenticated, rendering protected content');
  return children;
}

export default ProtectedRoute;
