/**
 * WorkLedger - New Organisation Page
 *
 * Creates a new organisation with a name and org_type.
 *
 * @module pages/organizations/NewOrganization
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Info, AlertCircle } from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { organizationService } from '../../services/api/organizationService';
import { ORG_TYPE_OPTIONS, ORG_TYPES } from '../../constants/orgTypes';

export function NewOrganization() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({ name: '', org_type: ORG_TYPES.CLIENT });
  const [errors,  setErrors]  = useState({});
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validate = () => {
    const errs = {};
    if (!formData.name || formData.name.trim().length < 3) {
      errs.name = 'Organisation name must be at least 3 characters';
    }
    if (!formData.org_type) {
      errs.org_type = 'Please select an organisation type';
    }
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs); return; 
    }
    setLoading(true);
    try {
      const result = await organizationService.createOrganization({
        name: formData.name.trim(),
        org_type: formData.org_type
      });
      if (result.success) {
        navigate('/organizations');
      } else {
        setErrors({ submit: result.error || 'Failed to create organisation' });
      }
    } catch (err) {
      setErrors({ submit: 'An unexpected error occurred' });
    } finally {
      setLoading(false);
    }
  };

  const selectedType = ORG_TYPE_OPTIONS.find(o => o.value === formData.org_type);

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Create New Organisation</h1>
          <p className="mt-1 text-sm text-gray-600">
            Set up your organisation so WorkLedger knows how to configure your workflows, roles, and reporting.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <form onSubmit={handleSubmit} className="space-y-6">

            <Input
              label="Organisation Name" id="name" name="name" type="text"
              value={formData.name} onChange={handleChange}
              placeholder="e.g., MTSB Sdn Bhd, FEST ENT"
              error={errors.name} required
              helpText="Visible to all members of this organisation"
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Organisation Type <span className="text-red-500">*</span>
              </label>
              <select
                name="org_type" value={formData.org_type} onChange={handleChange}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              >
                {ORG_TYPE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.icon}  {opt.label}
                  </option>
                ))}
              </select>
              {errors.org_type && <p className="mt-1 text-sm text-red-600">{errors.org_type}</p>}
              {selectedType && (
                <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-md">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium text-gray-800">{selectedType.icon} {selectedType.label}:</span>{' '}
                    {selectedType.description}
                  </p>
                </div>
              )}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex">
                <Info className="h-5 w-5 text-blue-400 mr-3 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-700">
                  <p className="font-medium mb-1">What happens next?</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>You will be added as the organisation admin</li>
                    <li>Invite team members after creation</li>
                    <li>Create projects and contracts to get started</li>
                  </ul>
                </div>
              </div>
            </div>

            {errors.submit && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex">
                  <AlertCircle className="h-5 w-5 text-red-400 mr-3 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{errors.submit}</p>
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <Button type="button" variant="outline" onClick={() => navigate('/organizations')} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={loading} disabled={loading}>
                Create Organisation
              </Button>
            </div>

          </form>
        </div>
      </div>
    </AppLayout>
  );
}

export default NewOrganization;
