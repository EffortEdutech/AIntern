/**
 * WorkLedger - Quick Entry Page
 *
 * Enables Bina Jaya staff to rapidly log work entries on behalf of clients
 * (e.g. Mr. Roz) by pasting a WhatsApp message and filling minimal fields.
 *
 * TARGET: Entry saved in under 30 seconds.
 *
 * WORKFLOW:
 *   1. Paste WhatsApp message → parser auto-fills date, location, description
 *   2. Confirm/adjust org + contract (pre-filled from org switcher)
 *   3. Confirm/adjust date
 *   4. Add any missing fields
 *   5. Save as Draft or Save & Submit
 *
 * ACCESS: bina_jaya_staff and super_admin only (PermissionGuard in render)
 *
 * @file src/pages/admin/QuickEntry.jsx
 * @created February 21, 2026 - Session 13
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { useOrganization } from '../../context/OrganizationContext';
import { useAuth } from '../../context/AuthContext';
import { useRole } from '../../hooks/useRole';
import { parseWhatsAppMessage, toWorkEntryData } from '../../utils/whatsappParser';
import { contractService } from '../../services/api/contractService';
import { templateService } from '../../services/api/templateService';
import { workEntryService } from '../../services/api/workEntryService';
import { organizationService } from '../../services/api/organizationService';
import { useToast } from '../../context/ToastContext';

// ── Yesterday's date as YYYY-MM-DD ────────────────────────
const yesterday = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
};

export default function QuickEntry() {
  const toast = useToast();
  const navigate = useNavigate();
  const { orgId, currentOrg, allOrgs } = useOrganization();
  const { user } = useAuth();
  const { isBinaJayaStaff, can } = useRole();

  // ── Form state ────────────────────────────────────────────
  const [waText, setWaText]               = useState('');
  const [parsed, setParsed]               = useState(null);
  const [selectedOrgId, setSelectedOrgId] = useState(orgId || '');
  const [contracts, setContracts]         = useState([]);
  const [templates, setTemplates]         = useState([]);
  const [contractId, setContractId]       = useState('');
  const [templateId, setTemplateId]       = useState('');
  const [entryDate, setEntryDate]         = useState(yesterday());
  const [location, setLocation]           = useState('');
  const [description, setDescription]     = useState('');
  const [equipmentType, setEquipmentType] = useState('');
  const [remarks, setRemarks]             = useState('');
  const [saving, setSaving]               = useState(false);
  const [saved, setSaved]                 = useState(null); // { id, status }

  const [loadingContracts, setLoadingContracts] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // ── Access guard ─────────────────────────────────────────
  // Only bina_jaya_staff and super_admin should reach this page
  const hasAccess = isBinaJayaStaff || can('MANAGE_ORG_SETTINGS');

  // ── Load contracts when org changes ──────────────────────
  const loadContracts = useCallback(async (oId) => {
    if (!oId) {
      return;
    }
    try {
      setLoadingContracts(true);
      const data = await contractService.getUserContracts(oId);
      setContracts(data || []);
      // Pre-select first active contract
      const active = (data || []).find(c => c.status === 'active');
      if (active) {
        setContractId(active.id);
      }
    } catch (err) {
      console.error('❌ Error loading contracts:', err);
    } finally {
      setLoadingContracts(false);
    }
  }, []);

  // ── Load templates ────────────────────────────────────────
  const loadTemplates = useCallback(async () => {
    try {
      setLoadingTemplates(true);
      const data = await templateService.getTemplates();
      setTemplates(data || []);
      // Pre-select first template if only one
      if (data?.length === 1) {
        setTemplateId(data[0].id);
      }
    } catch (err) {
      console.error('❌ Error loading templates:', err);
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  useEffect(() => {
    loadContracts(selectedOrgId);
    loadTemplates();
  }, [selectedOrgId, loadContracts, loadTemplates]);

  // Sync with global org switcher
  useEffect(() => {
    if (orgId) {
      setSelectedOrgId(orgId);
    }
  }, [orgId]);

  // ── Parse WhatsApp message ────────────────────────────────
  const handleParse = () => {
    if (!waText.trim()) {
      return;
    }
    const result = parseWhatsAppMessage(waText);
    setParsed(result);
    // Pre-fill fields from parse result
    if (result.entry_date) {
      setEntryDate(result.entry_date);
    }
    if (result.location)   {
      setLocation(result.location);
    }
    if (result.job_description) {
      setDescription(result.job_description);
    }
    if (result.equipment_type)  {
      setEquipmentType(result.equipment_type);
    }
  };

  const handleClearWA = () => {
    setWaText('');
    setParsed(null);
  };

  // ── Get selected contract's linked template ───────────────
  const selectedContract = contracts.find(c => c.id === contractId);
  const suggestedTemplate = templates.find(t =>
    selectedContract && t.contract_category === selectedContract.contract_category
  );

  // Auto-select template matching contract category
  useEffect(() => {
    if (suggestedTemplate && !templateId) {
      setTemplateId(suggestedTemplate.id);
    }
  }, [suggestedTemplate, templateId]);

  // ── Save ──────────────────────────────────────────────────
  const handleSave = async (status = 'draft') => {
    if (!contractId) {
      toast.warning('Please select a contract.'); return; 
    }
    if (!templateId) {
      toast.warning('Please select a template.'); return; 
    }
    if (!entryDate)  {
      toast.warning('Please set an entry date.'); return; 
    }

    setSaving(true);
    try {
      const data = toWorkEntryData(
        parsed || {},
        { location, job_description: description, equipment_type: equipmentType, remarks }
      );

      const result = await workEntryService.createWorkEntry({
        contract_id:     contractId,
        template_id:     templateId,
        entry_date:      entryDate,
        organization_id: currentOrg?.id ?? null,
        data,
        status
      });

      if (result.success) {
        console.log('✅ Quick entry saved:', result.data?.id);
        setSaved({ id: result.data?.id, status });
      } else {
        toast.error(`Failed to save: ${result.error}`);
      }
    } catch (err) {
      console.error('❌ Save error:', err);
      toast.error('Failed to save entry. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Access denied ─────────────────────────────────────────
  if (!hasAccess) {
    return (
      <AppLayout>
        <div className="max-w-lg mx-auto mt-16 text-center">
          <div className="text-5xl mb-4">🔒</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-500 text-sm">Quick Entry is only available to Bina Jaya staff.</p>
          <button onClick={() => navigate('/')} className="mt-4 text-sm text-primary-600 hover:text-primary-700">
            Go to Dashboard
          </button>
        </div>
      </AppLayout>
    );
  }

  // ── Saved confirmation ────────────────────────────────────
  if (saved) {
    return (
      <AppLayout>
        <div className="max-w-lg mx-auto mt-16 text-center">
          <div className="text-5xl mb-4">{saved.status === 'submitted' ? '✅' : '📋'}</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Entry {saved.status === 'submitted' ? 'Submitted!' : 'Saved as Draft'}
          </h1>
          <p className="text-gray-500 text-sm mb-6">
            {saved.status === 'submitted'
              ? 'Work entry has been submitted for the client.'
              : 'Draft saved — you can review and submit later.'}
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => {
                setSaved(null); setWaText(''); setParsed(null); setDescription(''); setLocation(''); setEquipmentType(''); setRemarks(''); setEntryDate(yesterday()); 
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700"
            >
              + Add Another Entry
            </button>
            <button
              onClick={() => navigate('/work')}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              View All Entries
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ── Main form ─────────────────────────────────────────────
  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto">

        {/* Page Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center text-lg">📱</div>
            <h1 className="text-3xl font-bold text-gray-900">Quick Entry</h1>
          </div>
          <p className="text-sm text-gray-500 ml-11">
            Log a job in under 30 seconds. Paste WhatsApp message to auto-fill.
          </p>
        </div>

        <div className="space-y-4">

          {/* ── STEP 1: WhatsApp Paste ─────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center">1</span>
                <span className="text-sm font-semibold text-gray-800">WhatsApp Message <span className="font-normal text-gray-400">(optional)</span></span>
              </div>
              {parsed && (
                <button onClick={handleClearWA} className="text-xs text-gray-400 hover:text-gray-600">Clear</button>
              )}
            </div>
            <div className="p-5">
              <textarea
                rows={4}
                value={waText}
                onChange={e => setWaText(e.target.value)}
                placeholder={'Paste Mr. Roz\'s WhatsApp message here...\n\nE.g.:\nJumaat, 21 Feb 2026\nUnit 12A Sri Damansara\nAircond outdoor bocor, gas leak'}
                className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none bg-gray-50 font-mono"
              />
              <div className="flex items-center justify-between mt-3">
                <button
                  onClick={handleParse}
                  disabled={!waText.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  📲 Parse Message
                </button>
                {/* Parse confidence badge */}
                {parsed && (
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                    parsed.confidence === 'high'   ? 'bg-green-100 text-green-700' :
                      parsed.confidence === 'medium' ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                  }`}>
                    {parsed.confidence === 'high' ? '✅ High confidence' :
                      parsed.confidence === 'medium' ? '⚠️ Medium confidence' :
                        '❌ Low confidence'} parse
                  </span>
                )}
              </div>

              {/* Warnings from parser */}
              {parsed?.warnings?.length > 0 && (
                <div className="mt-3 space-y-1">
                  {parsed.warnings.map((w, i) => (
                    <p key={i} className="text-xs text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg">⚠️ {w}</p>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── STEP 2: Org + Contract ─────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center">2</span>
              <span className="text-sm font-semibold text-gray-800">Client & Contract</span>
            </div>
            <div className="p-5 space-y-4">

              {/* Organization */}
              {allOrgs && allOrgs.length > 1 && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Client Organization</label>
                  <select
                    value={selectedOrgId}
                    onChange={e => {
                      setSelectedOrgId(e.target.value); setContractId(''); 
                    }}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white"
                  >
                    <option value="">— Select org —</option>
                    {allOrgs.map(org => (
                      <option key={org.id} value={org.id}>{org.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Contract */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Contract <span className="text-red-400">*</span>
                </label>
                {loadingContracts ? (
                  <div className="flex items-center gap-2 py-2">
                    <LoadingSpinner size="sm" />
                    <span className="text-xs text-gray-400">Loading contracts…</span>
                  </div>
                ) : contracts.length === 0 ? (
                  <p className="text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
                    No contracts found for this org.{' '}
                    <button onClick={() => navigate('/contracts/new')} className="underline">Create one?</button>
                  </p>
                ) : (
                  <select
                    value={contractId}
                    onChange={e => setContractId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white"
                  >
                    <option value="">— Select contract —</option>
                    {contracts.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.contract_number} — {c.contract_name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Template */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Template <span className="text-red-400">*</span>
                  {suggestedTemplate && (
                    <span className="ml-2 text-green-600 font-normal">✅ auto-matched</span>
                  )}
                </label>
                {loadingTemplates ? (
                  <div className="flex items-center gap-2 py-2">
                    <LoadingSpinner size="sm" />
                    <span className="text-xs text-gray-400">Loading templates…</span>
                  </div>
                ) : (
                  <select
                    value={templateId}
                    onChange={e => setTemplateId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white"
                  >
                    <option value="">— Select template —</option>
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.template_name} ({t.contract_category})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>

          {/* ── STEP 3: Entry Details ──────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center">3</span>
              <span className="text-sm font-semibold text-gray-800">Job Details</span>
            </div>
            <div className="p-5 space-y-4">

              {/* Date */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Entry Date <span className="text-red-400">*</span>
                  {parsed?.entry_date && (
                    <span className="ml-2 text-green-600 font-normal">✅ parsed</span>
                  )}
                </label>
                <input
                  type="date"
                  value={entryDate}
                  onChange={e => setEntryDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
              </div>

              {/* Location */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Location / Unit
                  {parsed?.location && (
                    <span className="ml-2 text-green-600 font-normal">✅ parsed</span>
                  )}
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  placeholder="e.g. Unit 12A, Sri Damansara"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
              </div>

              {/* Equipment Type */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Equipment Type
                  {parsed?.equipment_type && (
                    <span className="ml-2 text-green-600 font-normal">✅ parsed</span>
                  )}
                </label>
                <select
                  value={equipmentType}
                  onChange={e => setEquipmentType(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white"
                >
                  <option value="">— Select or leave blank —</option>
                  <option value="air_conditioner">Air Conditioner</option>
                  <option value="pump">Pump</option>
                  <option value="chiller">Chiller</option>
                  <option value="lift">Lift / Elevator</option>
                  <option value="generator">Generator</option>
                  <option value="water_heater">Water Heater</option>
                  <option value="water_tank">Water Tank</option>
                  <option value="plumbing">Plumbing</option>
                  <option value="electrical">Electrical</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Job Description */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Job Description <span className="text-red-400">*</span>
                  {parsed?.job_description && (
                    <span className="ml-2 text-green-600 font-normal">✅ parsed</span>
                  )}
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="What was done / what was found…"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"
                />
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Remarks / Notes</label>
                <input
                  type="text"
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  placeholder="Any additional notes…"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
              </div>
            </div>
          </div>

          {/* ── SAVE BUTTONS ──────────────────────────────── */}
          <div className="flex gap-3 pb-8">
            <button
              onClick={() => handleSave('draft')}
              disabled={saving || !contractId || !templateId || !entryDate}
              className="flex-1 py-3 text-sm font-semibold text-gray-700 bg-white border-2 border-gray-200 rounded-xl hover:border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? '⏳ Saving…' : '📋 Save Draft'}
            </button>
            <button
              onClick={() => handleSave('submitted')}
              disabled={saving || !contractId || !templateId || !entryDate || !description.trim()}
              className="flex-1 py-3 text-sm font-semibold text-white bg-primary-600 rounded-xl hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? '⏳ Saving…' : '✅ Save & Submit'}
            </button>
          </div>

        </div>
      </div>
    </AppLayout>
  );
}
