/**
 * WorkLedger - New Project Page
 * 
 * Page for creating a new project.
 * 
 * @module pages/projects/NewProject
 * @created January 30, 2026 - Session 9
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import ProjectForm from '../../components/projects/ProjectForm';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { projectService } from '../../services/api/projectService';
import { organizationService } from '../../services/api/organizationService';
import { useToast } from '../../context/ToastContext';

export function NewProject() {
  const toast = useToast();
  const navigate = useNavigate();
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Load user's organizations
  useEffect(() => {
    loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
    try {
      setLoading(true);
      const orgs = await organizationService.getUserOrganizations();
      setOrganizations(orgs || []);
      console.log('✅ Loaded organizations:', orgs?.length || 0);
    } catch (error) {
      console.error('❌ Error loading organizations:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle form submit
  const handleSubmit = async (organizationId, data) => {
    try {
      setSubmitting(true);
      console.log('📝 Creating project:', data);

      const project = await projectService.createProject(organizationId, data);
      
      if (project) {
        console.log('✅ Project created successfully:', project.id);
        // Redirect to project detail page
        navigate(`/projects/${project.id}`);
      }
    } catch (error) {
      console.error('❌ Error creating project:', error);
      toast.error('Failed to create project. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    navigate('/projects');
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

  // No organizations warning
  if (organizations.length === 0) {
    return (
      <AppLayout>
        <div className="max-w-3xl mx-auto">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <h3 className="text-lg font-medium text-yellow-900 mb-2">
              No Organizations Found
            </h3>
            <p className="text-yellow-800 mb-4">
              You need to create or join an organization before you can create projects.
            </p>
            <button
              onClick={() => navigate('/organizations/new')}
              className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors"
            >
              Create Organization
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
          <h1 className="text-3xl font-bold text-gray-900">Create New Project</h1>
          <p className="mt-2 text-sm text-gray-600">
            Fill in the details to create a new project.
          </p>
        </div>

        {/* Project Form */}
        <ProjectForm
          organizations={organizations}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isLoading={submitting}
        />
      </div>
    </AppLayout>
  );
}

export default NewProject;
