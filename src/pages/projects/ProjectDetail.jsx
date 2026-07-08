/**
 * WorkLedger - Project Detail Page
 *
 * Page for viewing project details with edit and delete options.
 *
 * SESSION 13 UPDATE: Button Guards
 *   - Edit button wrapped in PermissionGuard (EDIT_PROJECT)
 *   - Delete button wrapped in PermissionGuard (DELETE_PROJECT)
 *   - Technicians/subcontractors see read-only view, no action buttons
 *
 * @module pages/projects/ProjectDetail
 * @created January 30, 2026 - Session 9
 * @updated February 21, 2026 - Session 13: Permission guards on action buttons
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Button from '../../components/common/Button';
import PermissionGuard from '../../components/auth/PermissionGuard';
import { projectService } from '../../services/api/projectService';
import {
  PencilIcon,
  TrashIcon,
  BuildingOffice2Icon,
  CalendarIcon,
  MapPinIcon,
  UserGroupIcon,
  PhoneIcon
} from '@heroicons/react/24/outline';
import { useRole } from '../../hooks/useRole';
import { useToast } from '../../context/ToastContext';

export function ProjectDetail() {
  const toast = useToast();
  const { id }     = useParams();
  const navigate   = useNavigate();

  const { can } = useRole();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    loadProject(); 
  }, [id]);

  const loadProject = async () => {
    try {
      setLoading(true);
      setError(null);
      const projectData = await projectService.getProject(id);
      if (!projectData) {
        setError('Project not found or you do not have permission to view it.');
        return;
      }
      setProject(projectData);
      console.log('✅ Loaded project:', projectData.project_name);
    } catch (err) {
      console.error('❌ Error loading project:', err);
      setError('Failed to load project. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => navigate(`/projects/${id}/edit`);

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete "${project.project_name}"?`)) {
      return;
    }
    try {
      await projectService.deleteProject(id);
      console.log('✅ Project deleted');
      navigate('/projects');
    } catch (err) {
      console.error('❌ Error deleting project:', err);
      toast.error('Failed to delete project. Please try again.');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) {
      return 'N/A';
    }
    return new Date(dateString).toLocaleDateString('en-MY', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) {
      return 'N/A';
    }
    return new Date(dateString).toLocaleString('en-MY', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const statusColors = {
    active:    'bg-green-100 text-green-800 border-green-200',
    completed: 'bg-blue-100 text-blue-800 border-blue-200',
    on_hold:   'bg-yellow-100 text-yellow-800 border-yellow-200',
    cancelled: 'bg-gray-100 text-gray-800 border-gray-200'
  };
  const statusLabels = {
    active: 'Active', completed: 'Completed', on_hold: 'On Hold', cancelled: 'Cancelled'
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center items-center min-h-[60vh]">
          <LoadingSpinner size="lg" />
        </div>
      </AppLayout>
    );
  }

  if (error || !project) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h3 className="text-lg font-medium text-red-900 mb-2">Error Loading Project</h3>
            <p className="text-red-800 mb-4">{error || 'Project not found.'}</p>
            <button
              onClick={() => navigate('/projects')}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
            Back to Projects
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto">

        {/* ── Page Header ─────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-gray-900">
                  {project.project_name}
                </h1>
                <span className={`inline-flex items-center px-3 py-1 rounded-md text-sm font-medium border ${statusColors[project.status] || statusColors.active}`}>
                  {statusLabels[project.status] || 'Active'}
                </span>
              </div>
              <p className="text-sm text-gray-500">
                Project Code: <span className="font-mono font-medium text-gray-700">{project.project_code}</span>
              </p>
            </div>

            {/* ── GUARDED action buttons ───────────────────── */}
            <div className="flex items-center gap-2">
              <PermissionGuard permission="EDIT_PROJECT">
                <Button variant="secondary" onClick={handleEdit}>
                  <PencilIcon className="h-5 w-5 mr-2" />
                  Edit
                </Button>
              </PermissionGuard>

              <PermissionGuard permission="DELETE_PROJECT">
                <Button variant="danger" onClick={handleDelete}>
                  <TrashIcon className="h-5 w-5 mr-2" />
                  Delete
                </Button>
              </PermissionGuard>
            </div>
          </div>
        </div>

        {/* ── Main Content Grid ────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left Column — Main Info */}
          <div className="lg:col-span-2 space-y-6">

            {/* Project Information */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Project Information</h2>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500 mb-1">Project Name</dt>
                  <dd className="text-sm text-gray-900 font-medium">{project.project_name}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 mb-1">Project Code</dt>
                  <dd className="text-sm font-mono text-gray-900">{project.project_code}</dd>
                </div>
                {project.description && (
                  <div className="sm:col-span-2">
                    <dt className="text-sm font-medium text-gray-500 mb-1">Description</dt>
                    <dd className="text-sm text-gray-900">{project.description}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-sm font-medium text-gray-500 mb-1">Start Date</dt>
                  <dd className="text-sm text-gray-900">{formatDate(project.start_date)}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 mb-1">End Date</dt>
                  <dd className="text-sm text-gray-900">{formatDate(project.end_date)}</dd>
                </div>
                {project.location && (
                  <div className="sm:col-span-2">
                    <dt className="text-sm font-medium text-gray-500 mb-1 flex items-center gap-1">
                      <MapPinIcon className="h-4 w-4" /> Location
                    </dt>
                    <dd className="text-sm text-gray-900">{project.location}</dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Client Information */}
            {(project.client_name || project.client_contact) && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <UserGroupIcon className="h-5 w-5 text-gray-400" /> Client Information
                </h2>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {project.client_name && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 mb-1">Client Name</dt>
                      <dd className="text-sm text-gray-900">{project.client_name}</dd>
                    </div>
                  )}
                  {project.client_contact && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 mb-1 flex items-center gap-1">
                        <PhoneIcon className="h-4 w-4" /> Contact
                      </dt>
                      <dd className="text-sm text-gray-900">{project.client_contact}</dd>
                    </div>
                  )}
                </dl>
              </div>
            )}
          </div>

          {/* Right Column — Metadata */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <BuildingOffice2Icon className="h-5 w-5 text-gray-400" /> Organization
              </h2>
              <p className="text-sm text-gray-900">
                {project.organization?.name || '—'}
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-gray-400" /> Record Info
              </h2>
              <dl className="space-y-3">
                <div>
                  <dt className="text-xs font-medium text-gray-500">Created</dt>
                  <dd className="text-sm text-gray-900">{formatDateTime(project.created_at)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500">Last Updated</dt>
                  <dd className="text-sm text-gray-900">{formatDateTime(project.updated_at)}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>

      </div>
    </AppLayout>
  );
}

export default ProjectDetail;
