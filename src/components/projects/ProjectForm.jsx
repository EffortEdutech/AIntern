/**
 * WorkLedger - Project Form Component
 * 
 * Form for creating and editing projects with validation.
 * 
 * @module components/projects/ProjectForm
 * @created January 30, 2026 - Session 9
 */

import React, { useState } from 'react';
import Input from '../common/Input';
import Select from '../common/Select';
import Button from '../common/Button';
import { XMarkIcon, PlusIcon } from '@heroicons/react/24/outline';

export function ProjectForm({ 
  project = null, 
  organizations = [], 
  onSubmit, 
  onCancel,
  isLoading = false 
}) {
  // Form state
  const [formData, setFormData] = useState({
    organization_id: project?.organization_id || '',
    project_name: project?.project_name || '',
    project_code: project?.project_code || '',
    client_name: project?.client_name || '',
    site_address: project?.site_address || '',
    start_date: project?.start_date || '',
    end_date: project?.end_date || '',
    status: project?.status || 'active',
    tags: project?.metadata?.tags || [],
    notes: project?.metadata?.notes || '',
    contacts: project?.metadata?.contacts || []
  });

  // UI state
  const [errors, setErrors] = useState({});
  const [tagInput, setTagInput] = useState('');
  const [contactForm, setContactForm] = useState({ name: '', role: '', phone: '' });

  // Status options
  const statusOptions = [
    { value: 'active', label: 'Active' },
    { value: 'completed', label: 'Completed' },
    { value: 'on_hold', label: 'On Hold' },
    { value: 'cancelled', label: 'Cancelled' }
  ];

  // Handle input change
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};

    // Required fields
    if (!formData.organization_id) {
      newErrors.organization_id = 'Organization is required';
    }
    if (!formData.project_name || formData.project_name.trim().length < 3) {
      newErrors.project_name = 'Project name must be at least 3 characters';
    }
    if (!formData.client_name || formData.client_name.trim().length < 2) {
      newErrors.client_name = 'Client name is required';
    }

    // Date validation
    if (formData.start_date && formData.end_date) {
      const startDate = new Date(formData.start_date);
      const endDate = new Date(formData.end_date);
      if (endDate < startDate) {
        newErrors.end_date = 'End date must be after start date';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submit
  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // Prepare submission data
    const submitData = {
      project_name: formData.project_name.trim(),
      project_code: formData.project_code.trim() || null,
      client_name: formData.client_name.trim(),
      site_address: formData.site_address.trim() || null,
      start_date: formData.start_date || null,
      end_date: formData.end_date || null,
      status: formData.status,
      tags: formData.tags,
      notes: formData.notes.trim(),
      contacts: formData.contacts
    };

    onSubmit(formData.organization_id, submitData);
  };

  // Handle tag add
  const handleAddTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !formData.tags.includes(tag)) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tag]
      }));
      setTagInput('');
    }
  };

  // Handle tag remove
  const handleRemoveTag = (tagToRemove) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  // Handle tag input key press
  const handleTagKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  // Handle contact add
  const handleAddContact = () => {
    if (contactForm.name.trim() && contactForm.role.trim()) {
      setFormData(prev => ({
        ...prev,
        contacts: [...prev.contacts, { ...contactForm }]
      }));
      setContactForm({ name: '', role: '', phone: '' });
    }
  };

  // Handle contact remove
  const handleRemoveContact = (index) => {
    setFormData(prev => ({
      ...prev,
      contacts: prev.contacts.filter((_, i) => i !== index)
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information Section */}
      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>

        {/* Organization Select */}
        <Select
          label="Organization"
          name="organization_id"
          value={formData.organization_id}
          onChange={handleChange}
          error={errors.organization_id}
          required
          disabled={!!project}
        >
          <option value="">Select organization...</option>
          {organizations.map(org => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </Select>

        {/* Project Name */}
        <Input
          label="Project Name"
          name="project_name"
          value={formData.project_name}
          onChange={handleChange}
          error={errors.project_name}
          placeholder="e.g., KLCC Facilities Management"
          required
        />

        {/* Project Code */}
        <Input
          label="Project Code"
          name="project_code"
          value={formData.project_code}
          onChange={handleChange}
          error={errors.project_code}
          placeholder="e.g., PRJ-2024-001 (auto-generated if empty)"
          helpText="Leave empty to auto-generate"
        />

        {/* Client Name */}
        <Input
          label="Client Name"
          name="client_name"
          value={formData.client_name}
          onChange={handleChange}
          error={errors.client_name}
          placeholder="e.g., Petronas Twin Towers Management"
          required
        />

        {/* Status */}
        <Select
          label="Status"
          name="status"
          value={formData.status}
          onChange={handleChange}
          error={errors.status}
        >
          {statusOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>

      {/* Location & Dates Section */}
      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Location & Timeline</h3>

        {/* Site Address */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Site Address
          </label>
          <textarea
            name="site_address"
            value={formData.site_address}
            onChange={handleChange}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
            placeholder="e.g., Kuala Lumpur City Centre, 50088 Kuala Lumpur"
          />
        </div>

        {/* Date Range */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Start Date"
            name="start_date"
            type="date"
            value={formData.start_date}
            onChange={handleChange}
            error={errors.start_date}
          />

          <Input
            label="End Date"
            name="end_date"
            type="date"
            value={formData.end_date}
            onChange={handleChange}
            error={errors.end_date}
          />
        </div>
      </div>

      {/* Tags Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Tags</h3>

        {/* Tag Input */}
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyPress={handleTagKeyPress}
            placeholder="Add tag (e.g., facilities, hvac, high-rise)"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
          />
          <Button
            type="button"
            variant="secondary"
            onClick={handleAddTag}
            disabled={!tagInput.trim()}
          >
            <PlusIcon className="h-5 w-5" />
          </Button>
        </div>

        {/* Tag List */}
        {formData.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {formData.tags.map((tag, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-primary-50 text-primary-700"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="hover:text-primary-900"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Notes Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Notes</h3>
        <textarea
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
          placeholder="Project-specific notes, requirements, or important information..."
        />
      </div>

      {/* Contacts Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Contacts</h3>

        {/* Contact Form */}
        <div className="space-y-3 mb-4 p-4 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="Name"
              value={contactForm.name}
              onChange={(e) => setContactForm(prev => ({ ...prev, name: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
            />
            <input
              type="text"
              placeholder="Role"
              value={contactForm.role}
              onChange={(e) => setContactForm(prev => ({ ...prev, role: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
            />
            <input
              type="tel"
              placeholder="Phone"
              value={contactForm.phone}
              onChange={(e) => setContactForm(prev => ({ ...prev, phone: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={handleAddContact}
            disabled={!contactForm.name.trim() || !contactForm.role.trim()}
            className="w-full"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Add Contact
          </Button>
        </div>

        {/* Contact List */}
        {formData.contacts.length > 0 && (
          <div className="space-y-2">
            {formData.contacts.map((contact, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <p className="font-medium text-gray-900">{contact.name}</p>
                  <p className="text-sm text-gray-600">
                    {contact.role}
                    {contact.phone && ` • ${contact.phone}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveContact(index)}
                  className="text-red-600 hover:text-red-700"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Form Actions */}
      <div className="flex items-center justify-end gap-3 pt-4">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={isLoading}
        >
          {isLoading ? 'Saving...' : project ? 'Update Project' : 'Create Project'}
        </Button>
      </div>

      {/* General Error Message */}
      {Object.keys(errors).length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">
            Please fix the errors above before submitting.
          </p>
        </div>
      )}
    </form>
  );
}

export default ProjectForm;
