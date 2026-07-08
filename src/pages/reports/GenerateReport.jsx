/**
 * WorkLedger - Generate Report Page
 *
 * Page for generating custom PDF reports from selected work entries.
 *
 * Session 19 Changes:
 *   - Reads ?contractId=xxx from URL (from ReportHistory navigation)
 *   - Saves generated reports to history (generated_reports table)
 *   - "Back to Reports" navigation
 *
 * SESSION 17 CHANGES:
 *   - Added "Approved entries only" filter toggle (approvedOnly state)
 *   - Filter checkbox appears in the Options panel above <ReportGenerator>
 *   - approvedOnly prop passed to <ReportGenerator> so it filters the
 *     entry list BEFORE passing IDs to reportService.generateReport()
 *   - Info banner explains the filter so managers understand its effect
 *
 * @module pages/reports/GenerateReport
 * @created February 5, 2026 - Session 18
 * @updated February 6, 2026 - Session 19: URL params + history saving
 * @updated March 2, 2026   - Session 17: approvedOnly filter
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { reportService } from '../../services/api/reportService';
import { contractService } from '../../services/api/contractService';
import { useOrganization } from '../../context/OrganizationContext';
import ReportGenerator from '../../components/reports/ReportGenerator';
import AppLayout from '../../components/layout/AppLayout';
import LoadingSpinner from '../../components/common/LoadingSpinner';

export default function GenerateReport() {
  const navigate     = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentOrg } = useOrganization();

  // Pre-selected contract from ReportHistory navigation (?contractId=xxx)
  const urlContractId = searchParams.get('contractId');

  // ─── State ────────────────────────────────────────────────────────────────
  const [loading,          setLoading]          = useState(true);
  const [contracts,        setContracts]        = useState([]);
  const [selectedContract, setSelectedContract] = useState(null);
  const [contractInfo,     setContractInfo]     = useState(null);

  /**
   * SESSION 17: "Approved entries only" filter.
   *
   * When true, <ReportGenerator> will only display and allow selection of
   * entries with status === 'approved'. Draft / submitted / rejected entries
   * are hidden from the list and cannot be included in the PDF.
   *
   * Default: false — all entries visible (backward-compatible behaviour).
   */
  const [approvedOnly, setApprovedOnly] = useState(false);

  // ─── Load Contracts ───────────────────────────────────────────────────────
  const loadContracts = useCallback(async () => {
    try {
      console.log('📋 GenerateReport: Loading contracts...');
      setLoading(true);

      const orgId  = currentOrg?.id ?? null;
      const data   = await contractService.getUserContracts(orgId);
      const active = (data || []).filter(c => c.status === 'active');

      console.log('✅ Loaded contracts:', active.length);
      setContracts(active);

      if (urlContractId) {
        const found = active.find(c => c.id === urlContractId);
        if (found) {
          setSelectedContract(urlContractId);
          setContractInfo(found);
        } else if (active.length > 0) {
          setSelectedContract(active[0].id);
          setContractInfo(active[0]);
        }
      } else if (active.length > 0) {
        setSelectedContract(active[0].id);
        setContractInfo(active[0]);
      } else {
        setSelectedContract(null);
        setContractInfo(null);
      }
    } catch (error) {
      console.error('❌ Failed to load contracts:', error);
    } finally {
      setLoading(false);
    }
  }, [currentOrg?.id, urlContractId]);

  useEffect(() => {
    loadContracts();
  }, [loadContracts]);

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const handleContractChange = (contractId) => {
    setSelectedContract(contractId);
    const found = contracts.find(c => c.id === contractId);
    setContractInfo(found || null);
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center items-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      </AppLayout>
    );
  }

  if (contracts.length === 0) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <button
            onClick={() => navigate('/reports')}
            className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Reports
          </button>

          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Generate Report</h1>
            <p className="text-gray-600 mt-1">Select a contract to generate PDF reports</p>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <div className="flex">
              <svg className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">No Active Contracts Found</h3>
                <p className="mt-1 text-sm text-yellow-700">
                  You need at least one active contract before generating reports.
                </p>
                <button
                  onClick={() => navigate('/contracts/new')}
                  className="mt-3 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-yellow-700 bg-yellow-100 hover:bg-yellow-200"
                >
                  Create New Contract
                </button>
              </div>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">

        {/* Back button */}
        <button
          onClick={() => navigate('/reports')}
          className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Reports
        </button>

        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Generate Report</h1>
          <p className="text-gray-600 mt-1">
            Select work entries and customize your PDF report
          </p>
        </div>

        {/* Contract Selector */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          {urlContractId && contractInfo ? (
            /* Pre-selected from ReportHistory — compact display */
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">Contract</label>
                <button
                  onClick={() => {
                    navigate('/reports/generate', { replace: true });
                    window.location.reload();
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Change contract
                </button>
              </div>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm font-medium text-blue-900">
                  {contractInfo.contract_number} — {contractInfo.contract_name}
                </p>
                <p className="text-xs text-blue-700 mt-0.5">
                  {contractInfo.project?.client_name} · {contractInfo.project?.project_name} · {contractInfo.contract_category?.replace(/-/g, ' ').toUpperCase()}
                </p>
              </div>
            </div>
          ) : (
            /* Standard dropdown */
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">Select Contract</label>
                {currentOrg && (
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    📁 {currentOrg.name}
                  </span>
                )}
              </div>
              <select
                value={selectedContract || ''}
                onChange={(e) => handleContractChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="">-- Select Contract --</option>
                {contracts.map(contract => (
                  <option key={contract.id} value={contract.id}>
                    {contract.contract_number} — {contract.project?.client_name || 'Unknown'} — {contract.contract_name}
                  </option>
                ))}
              </select>

              {contractInfo && (
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
                  <span className="px-2 py-1 bg-gray-100 rounded">
                    {contractInfo.contract_category?.replace(/-/g, ' ').toUpperCase() || 'N/A'}
                  </span>
                  <span className="px-2 py-1 bg-gray-100 rounded">
                    {contractInfo.project?.project_name}
                  </span>
                  <span className="px-2 py-1 bg-gray-100 rounded">
                    {contractInfo.valid_from} to {contractInfo.valid_until}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── SESSION 17: Report Options Panel ────────────────────────────── */}
        {selectedContract && (
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Report Options</h3>

            {/* Approved-Only Filter */}
            <label className="flex items-start gap-3 cursor-pointer group">
              <div className="flex items-center h-5 mt-0.5">
                <input
                  type="checkbox"
                  checked={approvedOnly}
                  onChange={(e) => setApprovedOnly(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                />
              </div>
              <div>
                <span className="text-sm font-medium text-gray-800 group-hover:text-gray-900">
                  Approved entries only
                </span>
                <p className="text-xs text-gray-500 mt-0.5">
                  When enabled, only entries with status <strong>Approved</strong> will appear
                  in the list and can be included in the PDF. Draft, submitted, and rejected
                  entries will be hidden.
                </p>
              </div>
            </label>

            {/* Info banner when filter is active */}
            {approvedOnly && (
              <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs text-green-800">
                  Filter active — only <strong>approved</strong> entries are shown. The PDF will include an
                  approval stamp on each entry.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Report Generator Component */}
        {selectedContract ? (
          <ReportGenerator
            key={`${selectedContract}-${approvedOnly}`}
            contractId={selectedContract}
            approvedOnly={approvedOnly}
            onReportGenerated={async (entryIds, options) => {
              // Save to report history after successful generation (non-blocking)
              try {
                await reportService.saveReportHistory({
                  contractId:  selectedContract,
                  reportType:  'custom',
                  reportTitle: `Custom Report — ${new Date().toLocaleDateString('en-GB', {
                    day: '2-digit', month: 'short', year: 'numeric'
                  })}${approvedOnly ? ' (Approved Only)' : ''}`,
                  entryIds,
                  options,
                  periodStart: null,
                  periodEnd:   null
                });
                console.log('✅ Report saved to history');
              } catch (err) {
                console.warn('⚠️ Failed to save report to history (non-blocking):', err);
              }
            }}
          />
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="mt-3 text-sm font-medium text-gray-900">No Contract Selected</h3>
            <p className="mt-1 text-sm text-gray-500">Select a contract above to generate reports</p>
          </div>
        )}

      </div>
    </AppLayout>
  );
}
