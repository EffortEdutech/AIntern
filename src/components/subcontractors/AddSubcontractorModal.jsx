/**
 * WorkLedger - Add Subcontractor Modal
 *
 * Two-step modal to link a subcontractor organization to a project.
 *
 * Step 1: Search for org by name + select project
 * Step 2: Confirm details → create relationship
 *
 * Uses debounced search against organizations table.
 * Guards against linking same org twice for the same project.
 *
 * @module components/subcontractors/AddSubcontractorModal
 * @created February 24, 2026 — Session 15
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { subcontractorService } from '../../services/api/subcontractorService';
import { projectService }        from '../../services/api/projectService';
import { useOrganization }       from '../../context/OrganizationContext';

// ── Step indicator ────────────────────────────────────────────────────
function StepDot({ step, current }) {
  const done    = current > step;
  const active  = current === step;
  return (
    <div className="flex items-center gap-1">
      <div className={`
        w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors
        ${done    ? 'bg-green-500 text-white'
      : active ? 'bg-primary-600 text-white'
        :          'bg-gray-200 text-gray-500'}
      `}>
        {done ? '✓' : step}
      </div>
    </div>
  );
}

export function AddSubcontractorModal({ mainOrgId, mainOrgName, onSuccess, onClose }) {
  const { currentOrg } = useOrganization();

  const [step, setStep] = useState(1); // 1 | 2

  // ── Step 1 state ────────────────────────────────────────────────────
  const [query,         setQuery]         = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching,     setSearching]     = useState(false);
  const [selectedOrg,   setSelectedOrg]   = useState(null);
  const [projects,      setProjects]      = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [notes,         setNotes]         = useState('');
  const [loadingProjects, setLoadingProjects] = useState(false);
  const debounceRef = useRef(null);

  // ── Step 2 state ────────────────────────────────────────────────────
  const [saving,       setSaving]       = useState(false);
  const [saveError,    setSaveError]    = useState('');

  // ── Load current org's projects ─────────────────────────────────────
  useEffect(() => {
    const loadProjects = async () => {
      if (!mainOrgId) {
        return;
      }
      setLoadingProjects(true);
      try {
        const data = await projectService.getUserProjects(mainOrgId);
        const active = (data || []).filter(p => p.status === 'active');
        setProjects(active);
      } catch (err) {
        console.error('❌ Failed to load projects:', err);
      } finally {
        setLoadingProjects(false);
      }
    };
    loadProjects();
  }, [mainOrgId]);

  // ── Debounced org search ─────────────────────────────────────────────
  const handleQueryChange = useCallback((value) => {
    setQuery(value);
    setSelectedOrg(null);
    clearTimeout(debounceRef.current);

    if (value.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await subcontractorService.searchOrganizations(value, mainOrgId);
        setSearchResults(results);
      } finally {
        setSearching(false);
      }
    }, 300);
  }, [mainOrgId]);

  // ── Step 1 validation ────────────────────────────────────────────────
  const step1Valid = selectedOrg && selectedProject;

  // ── Proceed to confirmation ──────────────────────────────────────────
  const handleProceed = () => {
    if (!step1Valid) {
      return;
    }
    setSaveError('');
    setStep(2);
  };

  // ── Save ─────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!selectedOrg || !selectedProject) {
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      const result = await subcontractorService.addSubcontractor(
        mainOrgId,
        selectedOrg.id,
        selectedProject.id,
        notes
      );
      if (result.success) {
        console.log('✅ Subcontractor linked:', selectedOrg.name);
        onSuccess();
      } else {
        setSaveError(result.error ?? 'Failed to create relationship.');
        setStep(1);
      }
    } catch (err) {
      setSaveError('An unexpected error occurred.');
      setStep(1);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Link Subcontractor</h2>
            <p className="text-xs text-gray-500 mt-0.5">{mainOrgName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Step progress ────────────────────────────────────────────── */}
        <div className="flex items-center justify-center gap-3 py-4 border-b border-gray-100">
          <StepDot step={1} current={step} />
          <div className="w-12 h-px bg-gray-300" />
          <StepDot step={2} current={step} />
        </div>

        {/* ─────────────────────────────────────────────────────────────
            STEP 1: Select org + project
        ───────────────────────────────────────────────────────────── */}
        {step === 1 && (
          <div className="px-6 py-5 space-y-4">

            {/* Error */}
            {saveError && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                {saveError}
              </div>
            )}

            {/* Org search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Subcontractor Organization <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={query}
                  onChange={e => handleQueryChange(e.target.value)}
                  placeholder="Search by company name…"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                {searching && (
                  <div className="absolute right-3 top-2.5">
                    <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>

              {/* Search results dropdown */}
              {searchResults.length > 0 && !selectedOrg && (
                <div className="mt-1 border border-gray-200 rounded-lg overflow-hidden shadow-md">
                  {searchResults.map(org => (
                    <button
                      key={org.id}
                      onClick={() => {
                        setSelectedOrg(org); setSearchResults([]); setQuery(org.name); 
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 text-sm transition-colors flex items-center gap-3 border-b border-gray-100 last:border-0"
                    >
                      <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold text-xs flex-shrink-0">
                        {org.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{org.name}</div>
                        <div className="text-xs text-gray-400">{org.slug}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {query.length >= 2 && searchResults.length === 0 && !searching && !selectedOrg && (
                <p className="text-xs text-gray-400 mt-2 ml-1">
                  No organizations found. The subcontractor must already have a WorkLedger account.
                </p>
              )}

              {/* Selected org chip */}
              {selectedOrg && (
                <div className="mt-2 flex items-center gap-2 bg-primary-50 border border-primary-200 rounded-lg px-3 py-2">
                  <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold text-xs">
                    {selectedOrg.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-primary-800 flex-1">{selectedOrg.name}</span>
                  <button
                    onClick={() => {
                      setSelectedOrg(null); setQuery(''); 
                    }}
                    className="text-primary-400 hover:text-primary-600 text-xs"
                  >
                    ✕ change
                  </button>
                </div>
              )}
            </div>

            {/* Project selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Project <span className="text-red-500">*</span>
              </label>
              {loadingProjects ? (
                <div className="text-sm text-gray-400 py-2">Loading projects…</div>
              ) : projects.length === 0 ? (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  No active projects found. Create a project first before linking a subcontractor.
                </p>
              ) : (
                <select
                  value={selectedProject?.id ?? ''}
                  onChange={e => {
                    const found = projects.find(p => p.id === e.target.value);
                    setSelectedProject(found ?? null);
                  }}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">Select a project…</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.project_code ? `[${p.project_code}] ` : ''}{p.project_name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Notes (optional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g. Scope: fire suppression systems only"
                rows={2}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
              />
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            STEP 2: Confirmation
        ───────────────────────────────────────────────────────────── */}
        {step === 2 && (
          <div className="px-6 py-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Please confirm the relationship details:</h3>

            <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-3">
              <Row label="Main Contractor" value={mainOrgName} />
              <Row label="Subcontractor"   value={selectedOrg?.name} />
              <Row label="Project"         value={selectedProject?.project_name} />
              {notes && <Row label="Notes" value={notes} />}
            </div>

            <p className="text-xs text-gray-500 mt-4">
              After linking, {selectedOrg?.name ?? 'the subcontractor'} work entries for this project
              will be visible to {mainOrgName} in the Work Entries page.
            </p>

            {saveError && (
              <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                {saveError}
              </div>
            )}
          </div>
        )}

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          {step === 1 ? (
            <>
              <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700 font-medium">
                Cancel
              </button>
              <button
                onClick={handleProceed}
                disabled={!step1Valid}
                className="px-5 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Review →
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setStep(1)} className="text-sm text-gray-500 hover:text-gray-700 font-medium">
                ← Back
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {saving ? 'Linking…' : 'Confirm & Link'}
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}

// ── Helper component ────────────────────────────────────────────────
function Row({ label, value }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-xs text-gray-500 w-32 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value ?? '—'}</span>
    </div>
  );
}
