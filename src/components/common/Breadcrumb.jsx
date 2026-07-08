/**
 * WorkLedger - Breadcrumb Component
 * 
 * Displays navigation breadcrumb trail showing current location hierarchy.
 * Automatically generates breadcrumbs based on current route and fetches entity names.
 * 
 * @module components/common/Breadcrumb
 * @created January 31, 2026
 */

import React, { useState, useEffect } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ChevronRightIcon, HomeIcon } from '@heroicons/react/24/outline';
import { projectService } from '../../services/api/projectService';
import { organizationService } from '../../services/api/organizationService';
import { supabase } from '../../services/supabase/client';

export function Breadcrumb() {
  const location = useLocation();
  const params = useParams();
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    generateBreadcrumbs();
  }, [location.pathname]);

  const generateBreadcrumbs = async () => {
    try {
      setLoading(true);
      const crumbs = await buildBreadcrumbTrail(location.pathname, params);
      setBreadcrumbs(crumbs);
    } catch (error) {
      console.error('❌ Error generating breadcrumbs:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Build breadcrumb trail based on current path
   */
  const buildBreadcrumbTrail = async (pathname, params) => {
    const segments = pathname.split('/').filter(Boolean);
    const crumbs = [
      { label: 'Dashboard', path: '/', icon: <HomeIcon className="w-4 h-4" /> }
    ];

    // Handle different route patterns
    if (segments.length === 0) {
      // Just dashboard
      return crumbs;
    }

    // First segment determines the main section
    const section = segments[0];

    switch (section) {
      case 'organizations':
        await handleOrganizationBreadcrumbs(crumbs, segments, params);
        break;
      
      case 'projects':
        await handleProjectBreadcrumbs(crumbs, segments, params);
        break;
      
      case 'contracts':
        await handleContractBreadcrumbs(crumbs, segments, params);
        break;
      
      case 'work':
        await handleWorkEntriesBreadcrumbs(crumbs, segments, params);
        break;
      
      case 'templates':
        handleTemplatesBreadcrumbs(crumbs, segments);
        break;
      
      case 'reports':
        handleReportsBreadcrumbs(crumbs, segments);
        break;
      
      case 'profile':
      case 'settings':
        handleSettingsBreadcrumbs(crumbs, segments);
        break;
      
      default:
        // Generic handling for unknown routes
        handleGenericBreadcrumbs(crumbs, segments);
    }

    return crumbs;
  };

  /**
   * Handle organization breadcrumbs
   */
  const handleOrganizationBreadcrumbs = async (crumbs, segments, params) => {
    crumbs.push({ label: 'Organizations', path: '/organizations' });

    if (segments[1] === 'new') {
      crumbs.push({ label: 'Create New', path: '/organizations/new', current: true });
    } else if (segments[1] && params.id) {
      // Fetch organization name
      try {
        const org = await organizationService.getOrganization(params.id);
        if (org) {
          crumbs.push({ 
            label: org.name, 
            path: `/organizations/${params.id}/settings` 
          });
          
          if (segments[2] === 'settings') {
            crumbs.push({ label: 'Settings', path: `/organizations/${params.id}/settings`, current: true });
          }
        }
      } catch (error) {
        crumbs.push({ label: 'Organization', path: `/organizations/${params.id}/settings` });
      }
    }
  };

  /**
   * Handle project breadcrumbs
   */
  const handleProjectBreadcrumbs = async (crumbs, segments, params) => {
    crumbs.push({ label: 'Projects', path: '/projects' });

    if (segments[1] === 'new') {
      crumbs.push({ label: 'Create New Project', path: '/projects/new', current: true });
    } else if (segments[1] && params.id) {
      // Fetch project code (shorter than project name for breadcrumb)
      try {
        const project = await projectService.getProject(params.id);
        if (project) {
          crumbs.push({ 
            label: project.project_code, // Use code instead of name (e.g., BIN-2024-001)
            path: `/projects/${params.id}` 
          });
          
          if (segments[2] === 'edit') {
            crumbs.push({ label: 'Edit', path: `/projects/${params.id}/edit`, current: true });
          } else {
            // Project detail is current page
            crumbs[crumbs.length - 1].current = true;
          }
        }
      } catch (error) {
        crumbs.push({ label: 'Project', path: `/projects/${params.id}`, current: !segments[2] });
        if (segments[2] === 'edit') {
          crumbs.push({ label: 'Edit', path: `/projects/${params.id}/edit`, current: true });
        }
      }
    }
  };

  /**
     * Handle contract breadcrumbs
     */
  const handleContractBreadcrumbs = async (crumbs, segments, params) => {
    crumbs.push({ label: 'Contracts', path: '/contracts' });

    if (segments[1] === 'new') {
      crumbs.push({ label: 'Create New Contract', path: '/contracts/new', current: true });
    } else if (segments[1] && params.id) {
      // Fetch contract number (shorter than contract name)
      try {
        const { data: contract, error } = await supabase
          .from('contracts')
          .select('contract_number')
          .eq('id', params.id)
          .is('deleted_at', null)
          .single();
          
        if (contract && contract.contract_number) {
          crumbs.push({ 
            label: contract.contract_number, // Use contract number (e.g., SLA-EDU-2024-001)
            path: `/contracts/${params.id}` 
          });
            
          if (segments[2] === 'edit') {
            crumbs.push({ label: 'Edit', path: `/contracts/${params.id}/edit`, current: true });
          } else {
            // Contract detail is current page
            crumbs[crumbs.length - 1].current = true;
          }
        } else {
          // Fallback if contract not found
          crumbs.push({ label: 'Contract', path: `/contracts/${params.id}`, current: !segments[2] });
          if (segments[2] === 'edit') {
            crumbs.push({ label: 'Edit', path: `/contracts/${params.id}/edit`, current: true });
          }
        }
      } catch (error) {
        console.error('Error fetching contract for breadcrumb:', error);
        crumbs.push({ label: 'Contract', path: `/contracts/${params.id}`, current: !segments[2] });
        if (segments[2] === 'edit') {
          crumbs.push({ label: 'Edit', path: `/contracts/${params.id}/edit`, current: true });
        }
      }
    }
  };

  /**
   * Handle work entries breadcrumbs
   * Routes: /work, /work/new, /work/:id, /work/:id/edit
   */
  const handleWorkEntriesBreadcrumbs = async (crumbs, segments, params) => {
    crumbs.push({ label: 'Work Entries', path: '/work' });

    if (segments[1] === 'new') {
      crumbs.push({ label: 'New Entry', path: '/work/new', current: true });
    } else if (segments[1] && params.id) {
      crumbs.push({ label: 'Entry Details', path: `/work/${params.id}` });
      
      if (segments[2] === 'edit') {
        crumbs.push({ label: 'Edit', path: `/work/${params.id}/edit`, current: true });
      } else {
        crumbs[crumbs.length - 1].current = true;
      }
    } else {
      // /work list page is current
      crumbs[crumbs.length - 1].current = true;
    }
  };

  /**
   * Handle templates breadcrumbs
   */
  const handleTemplatesBreadcrumbs = (crumbs, segments) => {
    crumbs.push({ label: 'Templates', path: '/templates', current: segments.length === 1 });
    
    if (segments[1] === 'new') {
      crumbs.push({ label: 'Create Template', path: '/templates/new', current: true });
    } else if (segments[1] && params.id) {
      crumbs.push({ label: 'Edit', path: `/templates/${params.id}/edit`, current: true });

    } else {
      // list page is current
      crumbs[crumbs.length - 1].current = true;
    }    
  };

  /**
   * Handle reports breadcrumbs
   */
  const handleReportsBreadcrumbs = (crumbs, segments) => {
    crumbs.push({ label: 'Reports', path: '/reports', current: segments.length === 1 });
    
    if (segments[1] === 'generate') {
      crumbs.push({ label: 'Generate Report', path: '/reports/generate', current: true });
    } else if (segments[1] === 'layouts') {
      // /reports/layouts route handling
      crumbs.push({ label: 'Layouts', path: '/reports/layouts', current: segments.length === 2 });
      
      if (segments[2] === 'new') {
        crumbs.push({ label: 'Create New', path: '/reports/layouts/new', current: true });
      } else if (segments[2] && params.id) {
        crumbs.push({ label: 'Edit Layout', path: `/reports/layouts/${params.id}`, current: true });
      }
    } else if (segments.length === 1) {
      // /reports landing page
      crumbs[crumbs.length - 1].current = true;
    }
  };

  /**
   * Handle settings breadcrumbs
   */
  const handleSettingsBreadcrumbs = (crumbs, segments) => {
    const section = segments[0];
    const label = section.charAt(0).toUpperCase() + section.slice(1);
    crumbs.push({ label: label, path: `/${section}`, current: true });
  };

  /**
   * Generic breadcrumb handling
   */
  const handleGenericBreadcrumbs = (crumbs, segments) => {
    let currentPath = '';
    segments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      
      // Skip UUID-like segments (entity IDs)
      if (/^[a-f0-9-]{36}$/i.test(segment)) {
        return;
      }
      
      // Format label (capitalize, replace hyphens with spaces)
      const label = segment
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      
      crumbs.push({
        label,
        path: currentPath,
        current: index === segments.length - 1
      });
    });
  };



  // Don't render if only dashboard
  if (breadcrumbs.length <= 1) {
    return null;
  }

  // Loading state
  if (loading) {
    return (
      <nav className="flex mb-4 animate-pulse">
        <div className="h-5 bg-gray-200 rounded w-64"></div>
      </nav>
    );
  }

  return (
    <nav className="flex mb-4" aria-label="Breadcrumb">
      <ol className="inline-flex items-center space-x-1 md:space-x-3">
        {breadcrumbs.map((crumb, index) => (
          <li key={index} className="inline-flex items-center">
            {/* Separator */}
            {index > 0 && (
              <ChevronRightIcon className="w-4 h-4 text-gray-400 mx-1" />
            )}

            {/* Breadcrumb Item */}
            {crumb.current ? (
              // Current page (not clickable)
              <span className="inline-flex items-center text-sm font-medium text-gray-500">
                {crumb.icon && <span className="mr-2">{crumb.icon}</span>}
                {crumb.label}
              </span>
            ) : (
              // Clickable link
              <Link
                to={crumb.path}
                className="inline-flex items-center text-sm font-medium text-gray-700 hover:text-primary-600 transition-colors"
              >
                {crumb.icon && <span className="mr-2">{crumb.icon}</span>}
                {crumb.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export default Breadcrumb;
