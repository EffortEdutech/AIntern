/**
 * WorkLedger - Role Guard Component
 * 
 * Wrapper component that checks if user has required role/permissions.
 * Redirects to dashboard or shows error if insufficient permissions.
 * 
 * @module components/auth/RoleGuard
 * @created January 29, 2026
 */

import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ROUTES } from '../../constants/routes';
import { hasRolePrivilege } from '../../constants/roles';
import { supabase } from '../../services/supabase/client';

/**
 * RoleGuard Component
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - Child components to render if authorized
 * @param {string|string[]} props.allowedRoles - Role(s) allowed to access this route
 * @param {string} props.redirectTo - Where to redirect if unauthorized (default: dashboard)
 * @param {boolean} props.showError - Show error message instead of redirect
 * 
 * @example
 * <RoleGuard allowedRoles={['org_admin', 'manager']}>
 *   <AdminPanel />
 * </RoleGuard>
 */
export function RoleGuard({ 
  children, 
  allowedRoles = [], 
  redirectTo = ROUTES.DASHBOARD,
  showError = false 
}) {
  const { user } = useAuth();
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  /**
   * Get user's role from database
   */
  useEffect(() => {
    const getUserRole = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // Get user's role from org_members table
        // For now, we'll get the first organization they belong to
        const { data, error } = await supabase
          .from('org_members')
          .select('role, organization_id')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .limit(1)
          .single();

        if (error) {
          console.error('❌ RoleGuard: Error fetching role:', error);
          setUserRole(null);
        } else if (data) {
          console.log('✅ RoleGuard: User role:', data.role);
          setUserRole(data.role);
        }
      } catch (error) {
        console.error('❌ RoleGuard: Exception:', error);
        setUserRole(null);
      } finally {
        setLoading(false);
      }
    };

    getUserRole();
  }, [user]);

  // Show loading while fetching role
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="spinner mb-4" style={{ width: '40px', height: '40px' }}></div>
          <p className="text-gray-600">Checking permissions...</p>
        </div>
      </div>
    );
  }

  // Check if user has required role
  const allowedRolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  
  // If no role found or role not in allowed roles
  const hasAccess = userRole && allowedRolesArray.some(role => 
    hasRolePrivilege(userRole, role)
  );

  if (!hasAccess) {
    console.log(`🔐 RoleGuard: Access denied. User role: ${userRole}, Required: ${allowedRolesArray.join(', ')}`);
    
    if (showError) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
          <div className="max-w-md p-8 bg-white rounded-lg shadow-sm border border-gray-200 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Access Denied
            </h2>
            <p className="text-gray-600 mb-6">
              You don't have permission to access this page. Please contact your organization administrator.
            </p>
            <button
              onClick={() => window.history.back()}
              className="btn btn-primary"
            >
              Go Back
            </button>
          </div>
        </div>
      );
    }

    // Redirect to dashboard
    return <Navigate to={redirectTo} replace />;
  }

  // User has access, render children
  console.log('✅ RoleGuard: Access granted');
  return children;
}

export default RoleGuard;
