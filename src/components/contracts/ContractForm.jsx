/**
 * WorkLedger - Contract Form Component
 *
 * Reusable form for creating and editing contracts.
 *
 * SESSION 14 CHANGE: Template assignment removed from this form.
 * Templates are now managed via ContractTemplateManager on the
 * ContractDetail page (many-to-many junction table).
 *
 * After creating a contract, the user is redirected to ContractDetail
 * where they can assign one or more templates.
 *
 * @module components/contracts/ContractForm
 * @created January 31, 2026 - Session 10
 * @updated February 22, 2026 - Session 14: remove template section
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// ─────────────────────────────────────────────────────────────
// OPTIONS — values must match database column constraints exactly
// ─────────────────────────────────────────────────────────────

const CONTRACT_CATEGORY_OPTIONS = [
  { value: '',                          label: 'Select Category' },
  { value: 'preventive-maintenance',    label: 'Preventive Maintenance (PMC)' },
  { value: 'comprehensive-maintenance', label: 'Comprehensive Maintenance (CMC)' },
  { value: 'corrective-maintenance',    label: 'Corrective Maintenance' },
  { value: 'annual-maintenance',        label: 'Annual Maintenance (AMC)' },
  { value: 'sla-based-maintenance',     label: 'SLA-Based Maintenance' },
  { value: 'emergency-on-call',         label: 'Emergency / 24-7 Callout' },
  { value: 'time-and-material',         label: 'Time & Material (T&M)' },
  { value: 'construction-daily-diary',  label: 'Construction Daily Diary' },
  { value: 'custom',                    label: 'Custom' }
];

const REPORTING_FREQUENCY_OPTIONS = [
  { value: '',          label: 'Select Frequency' },
  { value: 'daily',     label: 'Daily' },
  { value: 'weekly',    label: 'Weekly' },
  { value: 'biweekly',  label: 'Bi-Weekly (Every 2 Weeks)' },
  { value: 'monthly',   label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly (Every 3 Months)' },
  { value: 'annually',  label: 'Annually' },
  { value: 'adhoc',     label: 'Ad-Hoc / As Required' },
  { value: 'per-visit', label: 'Per Visit / Per Incident' }
];

const MAINTENANCE_CYCLE_OPTIONS = [
  { value: '',           label: 'Select Cycle' },
  { value: 'daily',      label: 'Daily' },
  { value: 'weekly',     label: 'Weekly' },
  { value: 'biweekly',   label: 'Bi-Weekly (Every 2 Weeks)' },
  { value: 'monthly',    label: 'Monthly' },
  { value: 'bimonthly',  label: 'Bi-Monthly (Every 2 Months)' },
  { value: 'quarterly',  label: 'Quarterly (Every 3 Months)' },
  { value: 'biannually', label: 'Bi-Annually (Every 6 Months)' },
  { value: 'annually',   label: 'Annually' },
  { value: 'as-needed',  label: 'As Needed / Ad-Hoc' }
];

const STATUS_OPTIONS = [
  { value: 'active',    label: 'Active' },
  { value: 'draft',     label: 'Draft' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' }
];

// ─────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────

export default function ContractForm({
  initialData        = null,
  projects           = [],
  templates          = [],            // all available templates passed from parent
  subcontractorOrgs  = [],            // orgs this main contractor can assign work to
  mode               = 'create',
  onSubmit,
  onCancel,
  isSubmitting       = false
}) {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    project_id:          '',
    contract_number:     '',
    contract_name:       '',
    contract_category:   '',
    contract_type:       '',
    status:              'active',
    valid_from:          '',
    valid_until:         '',
    contract_value:      '',
    reporting_frequency: '',
    maintenance_cycle:   '',
    description:         '',
    // Subcontract fields
    contract_role:       'main',
    performing_org_id:   ''
  });

  // Whether the "assign to subcontractor" toggle is on
  const [isSubcontract, setIsSubcontract] = useState(false);

  // IDs of templates the user has selected for this contract
  const [selectedTemplateIds, setSelectedTemplateIds] = useState([]);
  const [errors, setErrors] = useState({});

  // Pre-fill in edit mode
  useEffect(() => {
    if (mode === 'edit' && initialData) {
      const isSub = initialData.contract_role === 'sub';
      setIsSubcontract(isSub);
      setFormData({
        project_id:          initialData.project_id          || '',
        contract_number:     initialData.contract_number     || '',
        contract_name:       initialData.contract_name       || '',
        contract_category:   initialData.contract_category   || '',
        contract_type:       initialData.contract_type       || '',
        status:              initialData.status              || 'active',
        valid_from:          initialData.valid_from          || '',
        valid_until:         initialData.valid_until         || '',
        contract_value:      initialData.contract_value      || '',
        reporting_frequency: initialData.reporting_frequency || '',
        maintenance_cycle:   initialData.maintenance_cycle   || '',
        description:         initialData.description         || '',
        contract_role:       initialData.contract_role       || 'main',
        performing_org_id:   initialData.performing_org_id   || ''
      });

      // Pre-check templates already assigned to this contract.
      // getContract() joins contract_templates which nests the template row
      // as `templates` (singular) — each junction row looks like:
      //   { id, template_id, is_default, templates: { id, template_name, ... } }
      const existingIds = (initialData.contract_templates || [])
        .map(jt => jt.template_id)
        .filter(Boolean);
      setSelectedTemplateIds(existingIds);
    }
  }, [mode, initialData]);

  const handleTemplateToggle = (templateId) => {
    setSelectedTemplateIds(prev =>
      prev.includes(templateId)
        ? prev.filter(id => id !== templateId)
        : [...prev, templateId]
    );
    // Clear template error if user picks one
    if (errors.template_ids) {
      setErrors(prev => {
        const e = { ...prev }; delete e.template_ids; return e; 
      });
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const e = { ...prev }; delete e[field]; return e; 
      });
    }
  };

  const validate = () => {
    const e = {};
    if (!formData.project_id)              {
      e.project_id          = 'Project is required';
    }
    if (!formData.contract_number?.trim()) {
      e.contract_number     = 'Contract number is required';
    }
    if (!formData.contract_name?.trim())   {
      e.contract_name       = 'Contract name is required';
    }
    if (!formData.contract_category)       {
      e.contract_category   = 'Category is required';
    }
    if (!formData.status)                  {
      e.status              = 'Status is required';
    }
    if (!formData.valid_from)              {
      e.valid_from          = 'Start date is required';
    }
    if (!formData.valid_until)             {
      e.valid_until         = 'End date is required';
    }
    if (formData.valid_from && formData.valid_until && formData.valid_until < formData.valid_from) {
      e.valid_until         = 'End date must be after start date';
    }
    if (!formData.reporting_frequency)     {
      e.reporting_frequency = 'Reporting frequency is required';
    }
    if (selectedTemplateIds.length === 0)  {
      e.template_ids        = 'At least one template must be assigned';
    }
    if (isSubcontract && !formData.performing_org_id) {
      e.performing_org_id   = 'Please select a subcontractor to perform this work';
    }
    return e;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const e2 = validate();
    if (Object.keys(e2).length > 0) {
      setErrors(e2);
      const firstKey = Object.keys(e2)[0];
      document.getElementById(firstKey)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const payload = {
      project_id:          formData.project_id,
      contract_number:     formData.contract_number.trim(),
      contract_name:       formData.contract_name.trim(),
      contract_category:   formData.contract_category   || null,
      contract_type:       formData.contract_type?.trim()|| null,
      status:              formData.status,
      valid_from:          formData.valid_from           || null,
      valid_until:         formData.valid_until          || null,
      contract_value:      formData.contract_value ? parseFloat(formData.contract_value) : null,
      reporting_frequency: formData.reporting_frequency  || null,
      maintenance_cycle:   formData.maintenance_cycle    || null,
      description:         formData.description?.trim()  || null,
      // Subcontract fields
      contract_role:       isSubcontract ? 'sub' : 'main',
      performing_org_id:   isSubcontract && formData.performing_org_id ? formData.performing_org_id : null,
      // template IDs — parent (New/EditContract) handles junction table writes
      template_ids:        selectedTemplateIds
    };

    onSubmit(formData.project_id, payload);
  };

  // Style helpers
  const fc = (name) =>
    `mt-1 block w-full rounded-md shadow-sm text-sm
     ${errors[name]
    ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
    : 'border-gray-300 focus:ring-primary-500 focus:border-primary-500'}`;

  const lc = 'block text-sm font-medium text-gray-700';

  // ─────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="space-y-8">

      {/* ── Section 1: Contract Identity ──────────────────── */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Contract Details</h2>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">

          {/* Project */}
          <div className="sm:col-span-2">
            <label htmlFor="project_id" className={lc}>
              Project <span className="text-red-500">*</span>
            </label>
            <select id="project_id" value={formData.project_id}
              onChange={e => handleChange('project_id', e.target.value)}
              className={fc('project_id')}>
              <option value="">— Select a Project —</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.project_name}
                  {p.organizations?.name ? ` (${p.organizations.name})` : ''}
                </option>
              ))}
            </select>
            {errors.project_id && <p className="mt-1 text-xs text-red-600">{errors.project_id}</p>}
            {projects.length === 0 && (
              <p className="mt-1 text-xs text-amber-600">
                No projects found.{' '}
                <button type="button" onClick={() => navigate('/projects/new')}
                  className="underline">Create one first.</button>
              </p>
            )}
          </div>

          {/* Contract Number */}
          <div>
            <label htmlFor="contract_number" className={lc}>
              Contract Number <span className="text-red-500">*</span>
            </label>
            <input id="contract_number" type="text" value={formData.contract_number}
              onChange={e => handleChange('contract_number', e.target.value)}
              placeholder="e.g. PMC-KLCC-2024-001"
              className={fc('contract_number')} />
            {errors.contract_number && <p className="mt-1 text-xs text-red-600">{errors.contract_number}</p>}
          </div>

          {/* Status */}
          <div>
            <label htmlFor="status" className={lc}>
              Status <span className="text-red-500">*</span>
            </label>
            <select id="status" value={formData.status}
              onChange={e => handleChange('status', e.target.value)}
              className={fc('status')}>
              {STATUS_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Contract Name */}
          <div className="sm:col-span-2">
            <label htmlFor="contract_name" className={lc}>
              Contract Name <span className="text-red-500">*</span>
            </label>
            <input id="contract_name" type="text" value={formData.contract_name}
              onChange={e => handleChange('contract_name', e.target.value)}
              placeholder="e.g. KLCC Tower HVAC Preventive Maintenance"
              className={fc('contract_name')} />
            {errors.contract_name && <p className="mt-1 text-xs text-red-600">{errors.contract_name}</p>}
          </div>

          {/* Category */}
          <div>
            <label htmlFor="contract_category" className={lc}>
              Contract Category <span className="text-red-500">*</span>
            </label>
            <select id="contract_category" value={formData.contract_category}
              onChange={e => handleChange('contract_category', e.target.value)}
              className={fc('contract_category')}>
              {CONTRACT_CATEGORY_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {errors.contract_category && <p className="mt-1 text-xs text-red-600">{errors.contract_category}</p>}
          </div>

          {/* Contract Type (free text) */}
          <div>
            <label htmlFor="contract_type" className={lc}>
              Contract Type
              <span className="ml-1 text-xs text-gray-400">(optional)</span>
            </label>
            <input id="contract_type" type="text" value={formData.contract_type}
              onChange={e => handleChange('contract_type', e.target.value)}
              placeholder="e.g. Monthly HVAC service"
              className={fc('contract_type')} />
          </div>

        </div>
      </div>

      {/* ── Section 2: Work Entry Templates ───────────────── */}
      <div className="bg-white rounded-lg shadow p-6" id="template_ids">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          Work Entry Templates <span className="text-red-500">*</span>
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Select one or more templates for this contract. Field workers will
          only see the templates assigned here when creating a new entry.
        </p>

        {templates.length === 0 ? (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
            No templates available.{' '}
            <button type="button" onClick={() => navigate('/templates/new')}
              className="underline font-medium">Create a template first.</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {templates.map(tmpl => {
              const checked = selectedTemplateIds.includes(tmpl.id);
              return (
                <label
                  key={tmpl.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer
                              transition-colors select-none
                              ${checked
                  ? 'bg-primary-50 border-primary-400'
                  : 'bg-white border-gray-200 hover:border-gray-300'}`}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded text-primary-600
                               focus:ring-primary-500 border-gray-300 cursor-pointer"
                    checked={checked}
                    onChange={() => handleTemplateToggle(tmpl.id)}
                  />
                  <div className="min-w-0">
                    <p className={`text-sm font-medium leading-tight
                                   ${checked ? 'text-primary-900' : 'text-gray-800'}`}>
                      {tmpl.template_name}
                    </p>
                    {tmpl.contract_category && (
                      <p className="text-xs text-gray-400 mt-0.5 capitalize">
                        {tmpl.contract_category.replace(/-/g, ' ')}
                      </p>
                    )}
                  </div>
                  {checked && selectedTemplateIds[0] === tmpl.id && (
                    <span className="ml-auto text-xs font-medium text-primary-600
                                     bg-primary-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                      Default
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        )}

        {selectedTemplateIds.length > 0 && (
          <p className="mt-3 text-xs text-gray-500">
            {selectedTemplateIds.length} template{selectedTemplateIds.length > 1 ? 's' : ''} selected.
            {selectedTemplateIds.length > 1 && ' The first selected will be set as default.'}
          </p>
        )}
        {errors.template_ids && (
          <p className="mt-2 text-xs text-red-600">{errors.template_ids}</p>
        )}
      </div>

      {/* ── Section 3: Subcontract Assignment (main contractors only) ── */}
      {subcontractorOrgs.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Subcontract Assignment</h2>
          <p className="text-sm text-gray-500 mb-4">
            Optionally delegate this contract&apos;s work to one of your linked subcontractors.
          </p>

          <label className="flex items-center gap-3 cursor-pointer select-none mb-4">
            <input
              type="checkbox"
              className="h-4 w-4 rounded text-primary-600 focus:ring-primary-500 border-gray-300"
              checked={isSubcontract}
              onChange={e => {
                setIsSubcontract(e.target.checked);
                if (!e.target.checked) {
                  handleChange('performing_org_id', '');
                }
                if (errors.performing_org_id) {
                  setErrors(prev => {
                    const err = { ...prev }; delete err.performing_org_id; return err; 
                  });
                }
              }}
            />
            <span className="text-sm font-medium text-gray-700">
              Assign work to a subcontractor
            </span>
          </label>

          {isSubcontract && (
            <div>
              <label htmlFor="performing_org_id" className={lc}>
                Performing Organisation <span className="text-red-500">*</span>
              </label>
              <select
                id="performing_org_id"
                value={formData.performing_org_id}
                onChange={e => handleChange('performing_org_id', e.target.value)}
                className={fc('performing_org_id')}
              >
                <option value="">— Select Subcontractor —</option>
                {subcontractorOrgs.map(org => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
              {errors.performing_org_id && (
                <p className="mt-1 text-xs text-red-600">{errors.performing_org_id}</p>
              )}
              <p className="mt-2 text-xs text-gray-500">
                The selected organisation will see this contract and can submit work entries against it.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Section 4: Duration & Value ───────────────────── */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Duration & Value</h2>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <div>
            <label htmlFor="valid_from" className={lc}>Valid From <span className="text-red-500">*</span></label>
            <input id="valid_from" type="date" value={formData.valid_from}
              onChange={e => handleChange('valid_from', e.target.value)}
              className={fc('valid_from')} />
            {errors.valid_from && <p className="mt-1 text-xs text-red-600">{errors.valid_from}</p>}
          </div>
          <div>
            <label htmlFor="valid_until" className={lc}>Valid Until <span className="text-red-500">*</span></label>
            <input id="valid_until" type="date" value={formData.valid_until}
              onChange={e => handleChange('valid_until', e.target.value)}
              className={fc('valid_until')} />
            {errors.valid_until && <p className="mt-1 text-xs text-red-600">{errors.valid_until}</p>}
          </div>
          <div>
            <label htmlFor="contract_value" className={lc}>Contract Value (RM)</label>
            <input id="contract_value" type="number" min="0" step="0.01"
              value={formData.contract_value}
              onChange={e => handleChange('contract_value', e.target.value)}
              placeholder="0.00"
              className={fc('contract_value')} />
          </div>
        </div>
      </div>

      {/* ── Section 5: Reporting Configuration ────────────── */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Reporting Configuration</h2>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="reporting_frequency" className={lc}>Reporting Frequency <span className="text-red-500">*</span></label>
            <select id="reporting_frequency" value={formData.reporting_frequency}
              onChange={e => handleChange('reporting_frequency', e.target.value)}
              className={fc('reporting_frequency')}>
              {REPORTING_FREQUENCY_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {errors.reporting_frequency && <p className="mt-1 text-xs text-red-600">{errors.reporting_frequency}</p>}
          </div>
          <div>
            <label htmlFor="maintenance_cycle" className={lc}>Maintenance Cycle</label>
            <select id="maintenance_cycle" value={formData.maintenance_cycle}
              onChange={e => handleChange('maintenance_cycle', e.target.value)}
              className={fc('maintenance_cycle')}>
              {MAINTENANCE_CYCLE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="description" className={lc}>Description</label>
            <textarea id="description" rows={3} value={formData.description}
              onChange={e => handleChange('description', e.target.value)}
              placeholder="Additional notes about this contract..."
              className={fc('description')} />
          </div>
        </div>
      </div>

      {/* ── Action Buttons ────────────────────────────────── */}
      <div className="flex items-center justify-end gap-3 pb-8">
        <button type="button" onClick={onCancel} disabled={isSubmitting}
          className="px-5 py-2 text-sm font-medium text-gray-700 bg-white border
                     border-gray-300 rounded-md shadow-sm hover:bg-gray-50 disabled:opacity-50">
          Cancel
        </button>
        <button type="submit" disabled={isSubmitting}
          className="px-6 py-2 text-sm font-medium text-white bg-primary-600
                     border border-transparent rounded-md shadow-sm hover:bg-primary-700
                     disabled:opacity-50 flex items-center gap-2">
          {isSubmitting ? (
            <>
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10"
                  stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Saving…
            </>
          ) : (
            mode === 'edit' ? 'Update Contract' : 'Create Contract'
          )}
        </button>
      </div>

    </form>
  );
}

   