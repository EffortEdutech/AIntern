/**
 * WorkLedger - Report Generator Component (Per-Entry Field Selection)
 * 
 * When a work entry is ticked, it expands to show every field as an
 * individual checkbox. Users choose exactly which fields to include
 * per entry. The PDF only renders selected fields.
 * 
 * Layout:
 *   1. Select Work Entries (checkbox per entry)
 *      └─ Entry Details (expandable per entry)
 *         ☐ Include Logo
 *         ☐ Field Name: value
 *         ☐ Photos before:
 *         ☐ Worker signature
 *         ...
 *   2. Select Report Layout (NEW)
 *   3. Report Options (Orientation, Page Size, Output)
 *   4. Preview + Generate PDF buttons (NEW)
 * 
 * SESSION 17 CHANGES:
 *   - Accepts approvedOnly prop from GenerateReport page
 *   - loadData() now selects approved_by, approved_at, rejected_by, rejection_reason
 *     so that approval metadata is available for display and stamp generation
 *   - After loading, entries are filtered to status === 'approved' when
 *     approvedOnly is true. Draft/submitted/rejected entries are hidden.
 *   - Approval stamp row renders below the template name in each entry card:
 *       ✅ Approved by Roslan — 1 Mar 2026
 *   - Empty state message adapts when the filter is active but no approved
 *     entries exist for the contract
 *
 * @module components/reports/ReportGenerator
 * @created February 5, 2026 - Session 18
 * @updated February 6, 2026 - Per-entry granular field selection
 * @updated February 12, 2026 - Report System Upgrade - Layout Selection + Preview
 * @updated March 2, 2026   - Session 17: approvedOnly filter + approval stamp
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase/client';
import { reportService } from '../../services/api/reportService';
import { contractService } from '../../services/api/contractService';
import Button from '../common/Button';
import LoadingSpinner from '../common/LoadingSpinner';
import ReportPreview from './ReportPreview';
import LayoutSelector from './LayoutSelector';
import PrintPreview from './PrintPreview';

export default function ReportGenerator({ contractId, approvedOnly = false, onReportGenerated }) {
  // ============================================
  // STATE
  // ============================================
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  const [contract, setContract] = useState(null);
  const [workEntries, setWorkEntries] = useState([]);

  // NEW: Layout selection and preview state
  const [selectedLayoutId, setSelectedLayoutId] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  
  /**
   * Per-entry selections map
   * {
   *   'entry-uuid': {
   *     selected: true,
   *     expanded: true,
   *     includeLogo: true,
   *     fields: {
   *       'section_id.field_id': true/false,
   *       ...
   *     }
   *   }
   * }
   */
  const [entrySelections, setEntrySelections] = useState({});

  // Page options (how the report looks)
  const [pageOptions, setPageOptions] = useState({
    orientation: 'portrait',
    pageSize: 'a4',
    output: 'download'
  });
  
  const [pdfBlob, setPdfBlob] = useState(null);
  const [pdfFilename, setPdfFilename] = useState('');

  // ============================================
  // DERIVED STATE
  // ============================================
  const selectedEntryIds = Object.keys(entrySelections).filter(
    id => entrySelections[id]?.selected
  );
  const hasSelection = selectedEntryIds.length > 0;
  
  // ============================================
  // DATA LOADING
  // ============================================
  useEffect(() => {
    loadData();
  }, [contractId]);
  
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load contract via service — correctly joins contract_templates junction table
      // (direct template:templates FK was removed in Session 14 schema migration)
      const contractData = await contractService.getContract(contractId);
      if (!contractData) {
        throw new Error('Contract not found or access denied');
      }

      // Flatten the default template onto contract.template for backwards compatibility
      // with any downstream code that reads contract.template.template_name etc.
      const defaultJunction =
        (contractData.contract_templates || []).find(jt => jt.is_default) ||
        contractData.contract_templates?.[0];
      contractData.template = defaultJunction?.templates ?? null;

      setContract(contractData);
      
      // Load work entries WITH template (for field labels) and approval metadata
      // work_entries.template_id is a direct FK — this join is still valid.
      //
      // SESSION 17: Added approved_by, approved_at, rejected_by, rejection_reason
      // so each entry card can display an approval stamp and so the approvedOnly
      // filter can operate correctly in JS after the fetch.
      // NOTE: We query ALL statuses including 'rejected' so the list is complete
      // when approvedOnly=false. The JS filter below then narrows it.
      const { data: entriesData, error: entriesError } = await supabase
        .from('work_entries')
        .select(`
          *,
          approved_by,
          approved_at,
          approval_remarks,
          rejected_by,
          rejected_at,
          rejection_reason,
          template:templates(id, template_name, fields_schema, pdf_layout, default_layout_id)
        `)
        .eq('contract_id', contractId)
        .in('status', ['draft', 'submitted', 'approved', 'rejected'])
        .order('entry_date', { ascending: false })
        .limit(50);
      
      if (entriesError) {
        throw entriesError;
      }

      // Resolve approver names from user_profiles in one second-pass query.
      // We NEVER join auth.users directly — user_profiles is the correct source.
      const allEntries = entriesData || [];
      const approverIds = [
        ...new Set(
          allEntries.flatMap(e => [e.approved_by, e.rejected_by].filter(Boolean))
        )
      ];

      if (approverIds.length > 0) {
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, full_name')
          .in('id', approverIds);

        const profileMap = {};
        (profiles || []).forEach(p => {
          profileMap[p.id] = p; 
        });

        allEntries.forEach(entry => {
          entry._approved_by_name = entry.approved_by
            ? (profileMap[entry.approved_by]?.full_name || 'Unknown')
            : null;
          entry._rejected_by_name = entry.rejected_by
            ? (profileMap[entry.rejected_by]?.full_name || 'Unknown')
            : null;
        });
      }

      // SESSION 17: Apply approvedOnly filter in JS so the prop from
      // GenerateReport controls what entries appear in this component.
      const filtered = approvedOnly
        ? allEntries.filter(e => e.status === 'approved')
        : allEntries;

      setWorkEntries(filtered);
      
    } catch (err) {
      console.error('❌ Failed to load data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // FIELD EXTRACTION FROM ENTRY
  // ============================================

  /**
   * Get displayable fields for an entry
   * Uses template fields_schema for labels, falls back to raw data keys
   * 
   * Returns: [{ key, label, value, type, section }]
   */
  const getFieldsForEntry = (entry) => {
    const fields = [];
    const data = entry.data || {};
    const template = entry.template;

    if (template?.fields_schema?.sections) {
      // Template-driven: use field labels from schema
      template.fields_schema.sections.forEach(section => {
        section.fields?.forEach(field => {
          const key = `${section.section_id}.${field.field_id}`;
          const value = data[key];
          fields.push({
            key,
            label: field.field_name,
            value,
            type: field.field_type || 'text',
            section: section.section_name
          });
        });
      });
    } else {
      // Fallback: use raw data keys, format as labels
      Object.entries(data).forEach(([key, value]) => {
        const label = key.split('.').pop()
          .replace(/_/g, ' ')
          .replace(/\b\w/g, c => c.toUpperCase());
        
        fields.push({
          key,
          label,
          value,
          type: guessFieldType(key, value),
          section: null
        });
      });
    }

    return fields;
  };

  /**
   * Guess field type from key name and value
   */
  const guessFieldType = (key, value) => {
    const lowerKey = key.toLowerCase();
    if (lowerKey.includes('photo') || lowerKey.includes('image')) {
      return 'photo';
    }
    if (lowerKey.includes('signature')) {
      return 'signature';
    }
    if (typeof value === 'boolean') {
      return 'checkbox';
    }
    if (typeof value === 'number') {
      return 'number';
    }
    return 'text';
  };

  // ============================================
  // ENTRY SELECTION HANDLERS
  // ============================================

  /**
   * Toggle entry selection — when checked, auto-expand and select all fields
   */
  const toggleEntry = (entryId) => {
    setEntrySelections(prev => {
      const current = prev[entryId];
      if (current?.selected) {
        // Deselecting: remove entry
        const updated = { ...prev };
        delete updated[entryId];
        return updated;
      } else {
        // Selecting: auto-expand and select all fields
        const entry = workEntries.find(e => e.id === entryId);
        const entryFields = getFieldsForEntry(entry);
        
        // Create fields map with all fields checked
        const fieldsMap = {};
        entryFields.forEach(f => {
          fieldsMap[f.key] = true;
        });
        
        return {
          ...prev,
          [entryId]: {
            selected: true,
            expanded: true,
            includeLogo: true,
            fields: fieldsMap
          }
        };
      }
    });
  };

  /**
   * Toggle expand/collapse for an entry's fields
   */
  const toggleExpand = (entryId) => {
    setEntrySelections(prev => ({
      ...prev,
      [entryId]: {
        ...prev[entryId],
        expanded: !prev[entryId]?.expanded
      }
    }));
  };

  /**
   * Toggle logo inclusion for an entry
   */
  const toggleLogo = (entryId) => {
    setEntrySelections(prev => ({
      ...prev,
      [entryId]: {
        ...prev[entryId],
        includeLogo: !prev[entryId]?.includeLogo
      }
    }));
  };

  /**
   * Toggle a single field in an entry
   */
  const toggleField = (entryId, fieldKey) => {
    setEntrySelections(prev => ({
      ...prev,
      [entryId]: {
        ...prev[entryId],
        fields: {
          ...prev[entryId]?.fields,
          [fieldKey]: !prev[entryId]?.fields?.[fieldKey]
        }
      }
    }));
  };

  /**
   * Select all fields for an entry
   */
  const selectAllFields = (entryId) => {
    const entry = workEntries.find(e => e.id === entryId);
    const entryFields = getFieldsForEntry(entry);
    
    const fieldsMap = {};
    entryFields.forEach(f => {
      fieldsMap[f.key] = true;
    });
    
    setEntrySelections(prev => ({
      ...prev,
      [entryId]: {
        ...prev[entryId],
        fields: fieldsMap
      }
    }));
  };

  /**
   * Deselect all fields for an entry
   */
  const deselectAllFields = (entryId) => {
    setEntrySelections(prev => ({
      ...prev,
      [entryId]: {
        ...prev[entryId],
        fields: {}
      }
    }));
  };

  // ============================================
  // FIELD DISPLAY HELPERS
  // ============================================

  /**
   * Format field value for display
   */
  const formatFieldDisplay = (value, type) => {
    if (!value) {
      return null;
    }
    
    if (type === 'photo' || type === 'signature') {
      return `📎 ${Array.isArray(value) ? value.length : 1} ${Array.isArray(value) && value.length !== 1 ? 'files' : 'file'}`;
    }
    
    if (type === 'checkbox') {
      return value ? '✓ Yes' : '✗ No';
    }
    
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    
    const str = String(value);
    return str.length > 50 ? str.substring(0, 50) + '...' : str;
  };

  /**
   * Get type indicator icon
   */
  const getFieldTypeIndicator = (type) => {
    const indicators = {
      photo: '📷',
      signature: '✍️',
      checkbox: '☑️',
      number: '#️⃣'
    };
    return indicators[type] || null;
  };

  // ============================================
  // REPORT GENERATION HANDLERS
  // ============================================

  /**
   * Handle preview button click (NEW)
   */
  const handlePreview = () => {
    if (selectedEntryIds.length === 0) {
      setError('Please select at least one entry');
      return;
    }
    
    if (!selectedLayoutId) {
      setError('Please select a report layout');
      return;
    }
    
    setShowPreview(true);
  };

  /**
   * Handle Generate PDF button
   */
  const handleGenerate = async () => {
    if (selectedEntryIds.length === 0) {
      setError('Please select at least one entry');
      return;
    }
    
    if (!selectedLayoutId) {
      setError('Please select a report layout');
      return;
    }
    
    try {
      setGenerating(true);
      setError(null);
      setSuccess(null);
      
      // Close preview if open
      setShowPreview(false);
      
      console.log('📄 Generating PDF for', selectedEntryIds.length, 'entries');
      console.log('📋 Layout:', selectedLayoutId);
      console.log('📋 Options:', pageOptions);
      
      const result = await reportService.generateReport(selectedEntryIds, {
        layoutId: selectedLayoutId,  // NEW: Pass layout ID
        outputFormat: 'pdf',
        orientation: pageOptions.orientation,
        pageSize: pageOptions.pageSize,
        entrySelections
      });
      
      if (!result.success) {
        throw new Error(result.error || 'PDF generation failed');
      }
      
      console.log('✅ PDF generated:', result.filename);
      
      // Handle output based on user preference
      if (pageOptions.output === 'download') {
        reportService.downloadPDF(result.blob, result.filename);
        setSuccess(`PDF downloaded: ${result.filename}`);
      } else if (pageOptions.output === 'newtab') {
        reportService.openPDFInNewTab(result.blob);
        setSuccess('PDF opened in new tab');
      } else if (pageOptions.output === 'preview') {
        setPdfBlob(result.blob);
        setPdfFilename(result.filename);
        setShowPreview(true);
        setSuccess('PDF ready for preview');
      }
      
      // Notify parent
      if (onReportGenerated) {
        onReportGenerated(result);
      }
      
    } catch (err) {
      console.error('❌ PDF generation failed:', err);
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  /**
   * Handle download from preview modal
   */
  const handleDownload = () => {
    if (pdfBlob && pdfFilename) {
      reportService.downloadPDF(pdfBlob, pdfFilename);
      setSuccess(`PDF downloaded: ${pdfFilename}`);
    }
  };

  // ============================================
  // RENDER
  // ============================================
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
        <span className="ml-3 text-gray-600">Loading contract data...</span>
      </div>
    );
  }
  
  if (!contract) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">Contract not found</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">Error</p>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-600 hover:text-red-800"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
      
      {/* Success Message */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-green-800">Success</p>
              <p className="text-sm text-green-700 mt-1">{success}</p>
            </div>
            <button
              onClick={() => setSuccess(null)}
              className="text-green-600 hover:text-green-800"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
      
      {/* Contract Info Header */}
      <div className="bg-gradient-to-r from-primary-50 to-primary-100 border border-primary-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {contract.contract_name}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {contract.project?.client_name} • {contract.contract_number}
            </p>
          </div>
          <div className="text-right">
            <div className="inline-flex items-center px-3 py-1 bg-primary-600 text-white text-sm font-medium rounded-full">
              {contract.contract_category || 'Contract'}
            </div>
          </div>
        </div>
      </div>
      
      {/* ============================================ */}
      {/* SECTION 1: Work Entry Selection              */}
      {/* ============================================ */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          Select Work Entries
        </h3>
        
        {workEntries.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {approvedOnly ? (
              <>
                <p className="font-medium">No approved entries found</p>
                <p className="text-sm mt-1">
                  There are no approved work entries for this contract yet.
                  Turn off the "Approved entries only" filter to see all entries.
                </p>
              </>
            ) : (
              <>
                <p className="font-medium">No work entries found</p>
                <p className="text-sm mt-1">Create work entries for this contract to generate reports.</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {workEntries.map(entry => {
              const selection = entrySelections[entry.id];
              const isSelected = selection?.selected ?? false;
              const isExpanded = selection?.expanded ?? false;
              const entryFields = isSelected ? getFieldsForEntry(entry) : [];
              const selectedFieldsCount = entryFields.filter(f => selection?.fields?.[f.key]).length;
              
              return (
                <div
                  key={entry.id}
                  className={`border rounded-lg transition-all ${
                    isSelected
                      ? 'border-primary-300 bg-primary-50 shadow-sm'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {/* Entry Header */}
                  <div className="flex items-center gap-3 p-4">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleEntry(entry.id)}
                      disabled={generating}
                      className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                    />
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">
                          {new Date(entry.entry_date).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </span>
                        {entry.shift && (
                          <span className="text-sm text-gray-500">
                            • {entry.shift}
                          </span>
                        )}
                        <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          entry.status === 'approved' ? 'bg-green-100 text-green-800' :
                            entry.status === 'submitted' ? 'bg-blue-100 text-blue-800' :
                              entry.status === 'rejected'  ? 'bg-red-100 text-red-800' :
                                'bg-gray-100 text-gray-800'
                        }`}>
                          {entry.status}
                        </span>
                      </div>
                      {entry.template && (
                        <p className="text-sm text-gray-600 mt-0.5">
                          {entry.template.template_name}
                        </p>
                      )}
                      {/* SESSION 17: Approval stamp — shown when entry is approved */}
                      {entry.status === 'approved' && entry._approved_by_name && (
                        <p className="text-xs text-green-700 font-medium mt-1">
                          ✅ Approved by {entry._approved_by_name}
                          {entry.approved_at
                            ? ` — ${new Date(entry.approved_at).toLocaleDateString('en-GB', {
                              day: '2-digit', month: 'short', year: 'numeric'
                            })}`
                            : ''
                          }
                        </p>
                      )}
                      {/* Rejection note — shown when entry was previously rejected (now resubmitted or re-approved) */}
                      {entry.rejection_reason && entry.status !== 'rejected' && (
                        <p className="text-xs text-amber-600 mt-0.5">
                          ⚠️ Previously rejected: {entry.rejection_reason.length > 60
                            ? entry.rejection_reason.substring(0, 60) + '…'
                            : entry.rejection_reason}
                        </p>
                      )}
                    </div>
                    
                    {isSelected && (
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-600">
                          {selectedFieldsCount}/{entryFields.length} fields
                        </span>
                        <button
                          onClick={() => toggleExpand(entry.id)}
                          disabled={generating}
                          className="p-1 hover:bg-white rounded transition-colors"
                        >
                          <svg
                            className={`w-5 h-5 text-gray-500 transition-transform ${
                              isExpanded ? 'rotate-180' : ''
                            }`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {/* Expanded Field Selection */}
                  {isSelected && (
                    <div className={`border-t border-gray-200 bg-white overflow-hidden transition-all ${
                      isExpanded ? 'max-h-[600px] overflow-y-auto' : 'max-h-0'
                    }`}>
                      {isExpanded && (
                        <div className="px-4 py-3 space-y-1">
                          {/* Select All / Deselect All Fields */}
                          <div className="flex gap-2 mb-3">
                            <button
                              onClick={() => selectAllFields(entry.id)}
                              disabled={generating}
                              className="text-xs text-primary-600 hover:text-primary-800 font-medium"
                            >
                              Select All
                            </button>
                            <span className="text-xs text-gray-300">|</span>
                            <button
                              onClick={() => deselectAllFields(entry.id)}
                              disabled={generating}
                              className="text-xs text-gray-500 hover:text-gray-700 font-medium"
                            >
                              Deselect All
                            </button>
                          </div>
                          
                          {/* Include Logo */}
                          <label className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors ${
                            selection?.includeLogo ? 'bg-primary-50' : 'hover:bg-gray-50'
                          }`}>
                            <input
                              type="checkbox"
                              checked={!!selection?.includeLogo}
                              onChange={() => toggleLogo(entry.id)}
                              disabled={generating}
                              className="w-3.5 h-3.5 text-primary-600 rounded focus:ring-primary-500"
                            />
                            <span className="text-sm text-gray-800 font-medium">Include Logo</span>
                          </label>
                          
                          {/* Divider */}
                          <div className="border-t border-gray-100 my-2" />
                          
                          {/* Entry Fields */}
                          {entryFields.map(field => {
                            const isFieldSelected = selection?.fields?.[field.key] ?? true;
                            const displayValue = formatFieldDisplay(field.value, field.type);
                            const typeIndicator = getFieldTypeIndicator(field.type);
                            
                            return (
                              <label
                                key={field.key}
                                className={`flex items-start gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors ${
                                  isFieldSelected ? 'bg-primary-50' : 'hover:bg-gray-50'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isFieldSelected}
                                  onChange={() => toggleField(entry.id, field.key)}
                                  disabled={generating}
                                  className="w-3.5 h-3.5 text-primary-600 rounded focus:ring-primary-500 mt-0.5 flex-shrink-0"
                                />
                                <span className="text-sm text-gray-800 break-words">
                                  {typeIndicator && (
                                    <span className="mr-1">{typeIndicator}</span>
                                  )}
                                  <span className="font-medium">{field.label}</span>
                                  {displayValue && (
                                    <span className="text-gray-500">: {displayValue}</span>
                                  )}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        
        {/* Selection Summary */}
        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm text-gray-600">
            {selectedEntryIds.length} of {workEntries.length}{approvedOnly ? ' approved' : ''} entries selected
          </span>
          {hasSelection && (
            <span className="text-xs text-primary-600 font-medium">
              ✓ Ready to configure
            </span>
          )}
        </div>
      </div>
      
      {/* ============================================ */}
      {/* SECTION 2: Layout Selector (NEW)             */}
      {/* ============================================ */}
      {hasSelection && contract && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <LayoutSelector
            templateType={contract.contract_category || 'PMC'}
            defaultLayoutId={contract.template?.default_layout_id}
            onSelect={setSelectedLayoutId}
          />
        </div>
      )}
      
      {/* ============================================ */}
      {/* SECTION 3: Action Buttons (UPDATED)          */}
      {/* ============================================ */}
      {hasSelection && selectedLayoutId && (
        <div className="flex gap-3">
          {/* Preview Button */}
          <button
            onClick={handlePreview}
            disabled={generating}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors shadow-sm"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Preview Report
          </button>
          
          {/* Generate PDF Button */}
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white font-medium rounded-lg transition-colors shadow-sm"
          >
            {generating ? (
              <>
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating PDF...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Generate PDF ({selectedEntryIds.length})
              </>
            )}
          </button>
        </div>
      )}
      
      {/* ============================================ */}
      {/* Print Preview Modal (NEW)                    */}
      {/* ============================================ */}
      {showPreview && (
        <PrintPreview
          entryIds={selectedEntryIds}
          layoutId={selectedLayoutId}
          onClose={() => setShowPreview(false)}
          onGenerate={handleGenerate}
        />
      )}
    </div>
  );
}
