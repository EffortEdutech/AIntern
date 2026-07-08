/**
 * WorkLedger - Edit Contract Page
 *
 * Page for editing an existing contract.
 *
 * SESSION 13 FIX: Templates now loaded via templateService.getTemplates()
 * instead of a direct supabase query. The direct query was silently returning
 * [] due to RLS on the templates table. templateService already works
 * correctly (used on the Templates page) and respects auth context.
 *
 * SESSION 16 UPDATE: subcontractorOrgs now loaded and passed to ContractForm
 * so that performing_org_id / contract_role are preserved on edit.
 *
 * @module pages/contracts/EditContract
 * @created January 31, 2026 - Session 10
 * @updated February 21, 2026 - Session 13: use templateService for templates
 * @updated May 16, 2026 - Session 16: subcontract fields on edit
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import ContractForm from '../../components/contracts/ContractForm';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { contractService } from '../../services/api/contractService';
import { projectService } from '../../services/api/projectService';
import { templateService } from '../../services/api/templateService';
import { subcontractorService } from '../../services/api/subcontractorService';
import { useOrganization } from '../../context/OrganizationContext';
import { ORG_TYPES } from '../../constants/orgTypes';
import { useToast } from '../../context/ToastContext';

export function EditContract() {
  const toast = useToast();
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentOrg } = useOrganization();

  const [contract,          setContract]          = useState(null);
  const [projects,          setProjects]          = useState([]);
  const [templates,         setTemplates]         = useState([]);
  const [subcontractorOrgs, setSubcontractorOrgs] = useState([]);
  const [loading,           setLoading]           = useState(true);
  const [submitting,        setSubmitting]        = useState(false);
  const [error,             setError]             = useState(null);

  useEffect(() => {
    loadData();
  }, [id, currentOrg?.id]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const orgId = currentOrg?.id ?? null;

      // ── Load contract, projects, templates in parallel ────────────────
      const [contractData, projectsData, templatesData] = await Promise.all([
        contractService.getContract(id),
        projectService.getUserProjects(orgId),
        templateService.getTemplates()
      ]);

      if (!contractData) {
        setError('Contract not found or you do not have permission to edit it.');
        setLoading(false);
        return;
      }

      setContract(contractData);
      setProjects(projectsData   || []);
      setTemplates(templatesData || []);

      console.log('✅ Loaded contract for editing:', contractData.contract_number);
      console.log('✅ Templates loaded:', templatesData?.length || 0);

      // ── Load subcontractor orgs (main contractors only) ───────────────
      if (orgId && currentOrg?.org_type === ORG_TYPES.MAIN_CONTRACTOR) {
        const relationships = await subcontractorService.getSubcontractorRelationships(orgId);

        // Deduplicate across multiple project relationships
        const seen = new Set();
        const orgs = [];
        relationships.forEach(r => {
          if (r.subcontractor_org && !seen.has(r.subcontractor_org.id)) {
            seen.add(r.subcontractor_org.id);
            orgs.push(r.subcontractor_org);
          }
        });

        // If the contract already has a performing_org that is no longer in
        // an active relationship (e.g. relationship terminated), still include
        // it so the form can display the current value without losing it.
        if (contractData.performing_org_id && !seen.has(contractData.performing_org_id)) {
          const performingOrg = contractData.performing_org;
          if (performingOrg) {
            orgs.push(performingOrg);
          }
        }

        setSubcontractorOrgs(orgs);
        console.log('✅ Loaded subcontractor orgs:', orgs.length);
      }
    } catch (err) {
      console.error('❌ Error loading contract:', err);
      setError('Failed to load contract. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (projectId, data) => {
    try {
      setSubmitting(true);

      // 1. Extract template_ids from payload (not a DB column)
      const { template_ids = [], ...contractData } = data;

      console.log('📝 Updating contract:', contractData);
      const result = await contractService.updateContract(id, contractData);

      if (!result.success) {
        toast.error(result.error || 'Failed to update contract. Please try again.');
        return;
      }
      console.log('✅ Contract updated');

      // 2. Sync templates — diff current vs selected
      const currentTemplates = contract?.contract_templates || [];
      const currentIds  = currentTemplates.map(jt => jt.template_id);

      const toAdd    = template_ids.filter(tid => !currentIds.includes(tid));
      const toRemove = currentTemplates.filter(jt => !template_ids.includes(jt.template_id));

      // Remove deselected
      for (const jt of toRemove) {
        await contractService.removeContractTemplate(jt.id, id);
      }

      // Add newly selected — first new entry becomes default if none existed
      for (let i = 0; i < toAdd.length; i++) {
        const isDefault = currentIds.length === 0 && i === 0;
        await contractService.addContractTemplate(id, toAdd[i], { isDefault });
      }

      // If the default was removed, promote the first remaining
      const remainingDefault = currentTemplates.find(
        jt => jt.is_default && template_ids.includes(jt.template_id)
      );
      if (!remainingDefault && template_ids.length > 0 && toAdd.length === 0) {
        const firstKept = currentTemplates.find(jt => template_ids.includes(jt.template_id));
        if (firstKept) {
          await contractService.setDefaultContractTemplate(id, firstKept.id);
        }
      }

      console.log('✅ Templates synced — added:', toAdd.length, 'removed:', toRemove.length);
      navigate(`/contracts/${id}`);
    } catch (err) {
      console.error('❌ Error updating contract:', err);
      toast.error('Failed to update contract. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => navigate(`/contracts/${id}`);

  // ── Loading state ─────────────────────────────────────────────────
  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center items-center min-h-[60vh]">
          <LoadingSpinner size="lg" />
        </div>
      </AppLayout>
    );
  }

  // ── Error state ───────────────────────────────────────────────────
  if (error) {
    return (
      <AppLayout>
        <div className="max-w-3xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-red-800">{error}</p>
            <button
              onClick={() => navigate('/contracts')}
              className="mt-3 text-sm text-red-600 hover:text-red-700 font-medium"
            >
              ← Back to Contracts
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Edit Contract</h1>
          <p className="mt-1 text-sm text-gray-500">
            {contract?.contract_number} — {contract?.contract_name}
          </p>
        </div>

        <ContractForm
          initialData={contract}
          projects={projects}
          templates={templates}
          subcontractorOrgs={subcontractorOrgs}
          mode="edit"
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isSubmitting={submitting}
        />
      </div>
    </AppLayout>
  );
}

export default EditContract;
