/**
 * WorkLedger - Edit Project Page
 * 
 * Page for editing an existing project.
 * 
 * @module pages/projects/EditProject
 * @created January 30, 2026 - Session 9
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import ProjectForm from '../../components/projects/ProjectForm';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { projectService } from '../../services/api/projectService';
import { organizationService } from '../../services/api/organizationService';
import { useToast } from '../../context/ToastContext';

export function EditProject() {
  const toast = useToast();
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [project, setProject] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Load project and organizations
  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load project and organizations in parallel
      const [projectData, orgsData] = await Promise.all([
        projectService.getProject(id),
        organizationService.getUserOrganizations()
      ]);

      if (!projectData) {
        setError('Project not found or you do not have permission to edit it.');
        setLoading(false);
        return;
      }

      setProject(projectData);
      setOrganizations(orgsData || []);
      console.log('✅ Loaded project for editing:', projectData.project_name);
    } catch (err) {
      console.error('❌ Error loading project:', err);
      setError('Failed to load project. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle form submit
  const handleSubmit = async (organizationId, data) => {
    try {
      setSubmitting(true);
      console.log('📝 Updating project:', data);

      const updatedProject = await projectService.updateProject(id, data);
      
      if (updatedProject) {
        console.log('✅ Project updated successfully');
        // Redirect to project detail page
        navigate(`/projects/${id}`);
      }
    } catch (error) {
      console.error('❌ Error updating project:', error);
      toast.error('Failed to update project. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    navigate(`/projects/${id}`);
  };

  // Loading state
  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center items-center min-h-[60vh]">
          <LoadingSpinner size="lg" />
        </div>
      </AppLayout>
    );
  }

  // Error state
  if (error || !project) {
    return (
      <AppLayout>
        <div className="max-w-3xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h3 className="text-lg font-medium text-red-900 mb-2">
              Error Loading Project
            </h3>
            <p className="text-red-800 mb-4">
              {error || 'Project not found.'}
            </p>
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
      <div className="max-w-4xl mx-auto">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Edit Project</h1>
          <p className="mt-2 text-sm text-gray-600">
            Update the project details below.
          </p>
        </div>

        {/* Project Form */}
        <ProjectForm
          project={project}
          organizations={organizations}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isLoading={submitting}
        />
      </div>
    </AppLayout>
  );
}

export default EditProject;
