/**
 * WorkLedger - Organisation Settings Page
 *
 * Manages organisation details (name, org_type) and member list.
 *
 * @module pages/organizations/OrganizationSettings
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Info, Users, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { organizationService } from '../../services/api/organizationService';
import { ORG_TYPE_OPTIONS, ORG_TYPES, getOrgTypeConfig } from '../../constants/orgTypes';

export function OrganizationSettings() {
  const { id }   = useParams();
  const navigate = useNavigate();

  const [organization, setOrganization] = useState(null);
  const [members,      setMembers]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [activeTab,    setActiveTab]    = useState('general');
  const [saveSuccess,  setSaveSuccess]  = useState(false);
  const [formData,     setFormData]     = useState({ name: '', org_type: ORG_TYPES.CLIENT });
  const [errors,       setErrors]       = useState({});
  // Remove-member state
  const [removingId,   setRemovingId]   = useState(null);
  const [removeError,  setRemoveError]  = useState('');

  useEffect(() => {
    loadOrganization();
    loadMembers();
  }, [id]);

  const loadOrganization = async () => {
    setLoading(true);
    const org = await organizationService.getOrganization(id);
    if (org) {
      setOrganization(org);
      setFormData({ name: org.name, org_type: org.org_type || ORG_TYPES.CLIENT });
    } else {
      navigate('/organizations');
    }
    setLoading(false);
  };

  const loadMembers = async () => {
    const list = await organizationService.getOrgMembers(id);
    setMembers(list);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
    setSaveSuccess(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || formData.name.trim().length < 3) {
      setErrors({ name: 'Organisation name must be at least 3 characters' });
      return;
    }
    setSaving(true);
    try {
      const result = await organizationService.updateOrganization(id, {
        name:     formData.name.trim(),
        org_type: formData.org_type
      });
      if (result.success) {
        setOrganization(result.data);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        setErrors({ submit: result.error || 'Failed to update organisation' });
      }
    } catch (err) {
      setErrors({ submit: 'An unexpected error occurred' });
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveMember = async (member) => {
    const displayName = member.user_profile?.full_name || member.user_profile?.email || 'this member';
    if (!window.confirm(`Remove ${displayName} from ${organization.name}? They will lose access immediately.`)) {
      return;
    }
    setRemovingId(member.user_id);
    setRemoveError('');
    try {
      const result = await organizationService.removeMember(id, member.user_id);
      if (result.success) {
        // Optimistic update — remove from local list without a full reload
        setMembers(prev => prev.filter(m => m.user_id !== member.user_id));
      } else {
        setRemoveError(result.error || 'Failed to remove member. Please try again.');
      }
    } catch (err) {
      setRemoveError('An unexpected error occurred.');
    } finally {
      setRemovingId(null);
    }
  };

  if (loading) {
    return <AppLayout><LoadingSpinner size="lg" text="Loading..." /></AppLayout>;
  }
  if (!organization) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">Organisation not found</p>
        </div>
      </AppLayout>
    );
  }

  const selectedType   = ORG_TYPE_OPTIONS.find(o => o.value === formData.org_type);
  const currentOrgType = getOrgTypeConfig(organization.org_type);

  const roleBadge = (role) => {
    if (role === 'org_admin') {
      return 'bg-purple-100 text-purple-800';
    }
    if (role === 'manager') {
      return 'bg-blue-100 text-blue-800';
    }
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <AppLayout>
      <div className="space-y-6">

        <div>
          <h1 className="text-2xl font-bold text-gray-900">Organisation Settings</h1>
          <p className="mt-1 text-sm text-gray-600">Manage {organization.name} settings and members</p>
        </div>

        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {['general', 'members'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm capitalize ${
                  activeTab === tab
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab === 'members' ? `Members (${members.length})` : tab}
              </button>
            ))}
          </nav>
        </div>

        {activeTab === 'general' && (
          <div className="bg-white rounded-lg shadow p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900">Organisation Details</h3>

              <Input
                label="Organisation Name" id="name" name="name" type="text"
                value={formData.name} onChange={handleChange} error={errors.name} required
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Organisation Type</label>
                <select
                  name="org_type" value={formData.org_type} onChange={handleChange}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                >
                  {ORG_TYPE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.icon}  {opt.label}</option>
                  ))}
                </select>
                {selectedType && (
                  <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-md">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium text-gray-800">{selectedType.icon} {selectedType.label}:</span>{' '}
                      {selectedType.description}
                    </p>
                  </div>
                )}
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Organisation Information</h4>
                <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2 text-sm">
                  <div>
                    <dt className="text-gray-500">Organisation ID</dt>
                    <dd className="text-gray-900 font-mono text-xs">{organization.id}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Slug</dt>
                    <dd className="text-gray-900">{organization.slug}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Created</dt>
                    <dd className="text-gray-900">{new Date(organization.created_at).toLocaleDateString()}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Current Type</dt>
                    <dd>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${currentOrgType.badge}`}>
                        {currentOrgType.icon} {currentOrgType.label}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Subscription</dt>
                    <dd className="text-gray-900 capitalize">{organization.subscription_tier || 'free'}</dd>
                  </div>
                </dl>
              </div>

              {saveSuccess && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                  <p className="text-sm text-green-700 font-medium">Organisation settings saved successfully.</p>
                </div>
              )}
              {errors.submit && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center">
                  <AlertCircle className="h-5 w-5 text-red-400 mr-2 flex-shrink-0" />
                  <p className="text-sm text-red-700">{errors.submit}</p>
                </div>
              )}

              <div className="flex justify-end space-x-3">
                <Button type="button" variant="outline" onClick={() => navigate('/organizations')} disabled={saving}>
                  Back to Organisations
                </Button>
                <Button type="submit" variant="primary" loading={saving} disabled={saving}>
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        )}

        {activeTab === 'members' && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-medium text-gray-900">Team Members</h3>
              <Button variant="primary" size="sm" disabled title="Coming soon">
                + Invite Member
              </Button>
            </div>

            {removeError && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center">
                <AlertCircle className="h-4 w-4 text-red-400 mr-2 flex-shrink-0" />
                <p className="text-sm text-red-700">{removeError}</p>
              </div>
            )}

            {members.length === 0 ? (
              <div className="text-center py-8">
                <Users className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-4 text-sm font-medium text-gray-900">No members yet</h3>
                <p className="mt-2 text-sm text-gray-500">Invite your first team member to get started</p>
              </div>
            ) : (
              <div className="space-y-4">
                {members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-primary-600 font-medium">
                          {member.user_profile?.full_name?.[0]?.toUpperCase() || '?'}
                        </span>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">
                          {member.user_profile?.full_name || 'Unknown User'}
                        </h4>
                        <p className="text-sm text-gray-500">{member.user_profile?.email || member.user_id}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${roleBadge(member.role)}`}>
                        {member.role.replace('_', ' ')}
                      </span>
                      {member.role !== 'org_admin' && (
                        <button
                          className="text-sm text-red-600 hover:text-red-700 disabled:opacity-40 flex items-center gap-1"
                          disabled={removingId === member.user_id}
                          onClick={() => handleRemoveMember(member)}
                        >
                          {removingId === member.user_id
                            ? <><Loader className="h-3 w-3 animate-spin" /> Removing…</>
                            : 'Remove'
                          }
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex">
                <Info className="h-5 w-5 text-blue-400 mr-3 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-700">
                  <p className="font-medium mb-1">Member invitations coming soon</p>
                  <p>Email invitation system will be available in a future update.</p>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </AppLayout>
  );
}

export default OrganizationSettings;
