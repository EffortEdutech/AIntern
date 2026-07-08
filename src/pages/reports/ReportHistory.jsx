/**
 * WorkLedger - Report History Page (Reports Landing)
 * 
 * Main reports hub — select a contract, view history, generate new reports.
 * 
 * Layout:
 *   1. Contract Selector (persistent top bar)
 *   2. Quick Actions: [+ Generate Report] [📅 Monthly] [📅 Weekly]
 *   3. Stats Bar (total reports, entries, last generated)
 *   4. Report History Table (filtered by contract)
 *      Actions per row: View | Export | Archive | Print
 *   5. Monthly/Weekly picker modals
 * 
 * @module pages/reports/ReportHistory
 * @created February 6, 2026 - Session 19
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { reportService } from '../../services/api/reportService';
import { contractService } from '../../services/api/contractService';
import { useOrganization } from '../../context/OrganizationContext';
import AppLayout from '../../components/layout/AppLayout';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ReportPreview from '../../components/reports/ReportPreview';
import { useToast } from '../../context/ToastContext';

// ============================================
// HELPER: Format date for display
// ============================================
function formatDate(dateStr) {
  if (!dateStr) {
    return '-';
  }
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  } catch {
    return dateStr; 
  }
}

function formatDateTime(dateStr) {
  if (!dateStr) {
    return '-';
  }
  try {
    return new Date(dateStr).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch {
    return dateStr; 
  }
}

function timeAgo(dateStr) {
  if (!dateStr) {
    return '';
  }
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) {
    return 'just now';
  }
  if (mins < 60) {
    return `${mins}m ago`;
  }
  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }
  return formatDate(dateStr);
}

// ============================================
// HELPER: Get week boundaries (Mon–Sun)
// ============================================
function getWeekBounds(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMon);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const fmt = (dt) => dt.toISOString().split('T')[0];
  return { start: fmt(monday), end: fmt(sunday) };
}

// ============================================
// REPORT TYPE BADGES
// ============================================
const TYPE_STYLES = {
  custom: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Custom' },
  monthly: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Monthly' },
  weekly: { bg: 'bg-green-100', text: 'text-green-800', label: 'Weekly' }
};

const STATUS_STYLES = {
  active: { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'Active' },
  archived: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Archived' }
};

// ============================================
// MAIN COMPONENT
// ============================================
export default function ReportHistory() {
  const toast = useToast();
  const navigate = useNavigate();
  const { currentOrg } = useOrganization();

  // --- State ---
  const [contracts, setContracts] = useState([]);
  const [selectedContractId, setSelectedContractId] = useState('');
  const [selectedContract, setSelectedContract] = useState(null);
  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState({ totalReports: 0, totalEntries: 0, lastGenerated: null, byType: {} });
  const [loading, setLoading] = useState(true);
  const [loadingReports, setLoadingReports] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showFilter, setShowFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  // Monthly/Weekly picker state
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showWeekPicker, setShowWeekPicker] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedWeekDate, setSelectedWeekDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Preview modal state
  const [previewBlob, setPreviewBlob] = useState(null);
  const [previewFilename, setPreviewFilename] = useState('');

  // ============================================
  // LOAD CONTRACTS — org-aware (SESSION 14 FIX)
  // ============================================
  const loadContracts = useCallback(async () => {
    try {
      setLoading(true);
      setSelectedContractId('');
      setSelectedContract(null);
      setReports([]);

      // Use contractService so RLS + org filter is respected for all roles
      const orgId = currentOrg?.id ?? null;
      const data  = await contractService.getUserContracts(orgId);

      // Only show active contracts in the report selector
      const active = (data || []).filter(c => c.status === 'active');
      setContracts(active);

      // Auto-select first
      if (active.length > 0) {
        setSelectedContractId(active[0].id);
      }
    } catch (error) {
      console.error('❌ Failed to load contracts:', error);
    } finally {
      setLoading(false);
    }
  }, [currentOrg?.id]); // ← re-runs when org switcher changes

  useEffect(() => {
    loadContracts();
  }, [loadContracts]);

  // ============================================
  // LOAD REPORTS WHEN CONTRACT CHANGES
  // ============================================
  useEffect(() => {
    if (selectedContractId) {
      const contract = contracts.find(c => c.id === selectedContractId);
      setSelectedContract(contract || null);
      loadReports(selectedContractId);
      loadStats(selectedContractId);
    } else {
      setSelectedContract(null);
      setReports([]);
      setStats({ totalReports: 0, totalEntries: 0, lastGenerated: null, byType: {} });
    }
  }, [selectedContractId, contracts]);

  const loadReports = async (contractId) => {
    try {
      setLoadingReports(true);
      
      // Build filters object
      const filters = { contractId };
      if (showFilter !== 'all') {
        filters.status = showFilter;
      }
      if (typeFilter !== 'all') {
        filters.reportType = typeFilter;
      }

      // reportService.getReportHistory returns array directly, not {success, data}
      const reports = await reportService.getReportHistory(filters);
      setReports(reports || []);
      
      console.log('✅ Loaded reports:', reports?.length || 0);
    } catch (error) {
      console.error('❌ Failed to load reports:', error);
      setReports([]); // Clear on error
    } finally {
      setLoadingReports(false);
    }
  };

  const loadStats = async (contractId) => {
    try {
      // reportService.getReportStats expects filters object
      const stats = await reportService.getReportStats({ contractId });
      setStats(stats);
      console.log('✅ Loaded stats:', stats);
    } catch (error) {
      console.error('❌ Failed to load stats:', error);
      setStats({ totalReports: 0, totalEntries: 0, lastGenerated: null, byType: {} });
    }
  };

  // Reload when filters change
  useEffect(() => {
    if (selectedContractId) {
      loadReports(selectedContractId);
    }
  }, [showFilter, typeFilter]);

  // ============================================
  // ACTIONS
  // ============================================

  const handleGenerateNew = () => {
    navigate(`/reports/generate?contractId=${selectedContractId}`);
  };

  const handleGenerateMonthly = async () => {
    if (!selectedContractId || !selectedMonth) {
      return;
    }

    const [yearStr, monthStr] = selectedMonth.split('-');
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);

    setGenerating(true);
    setShowMonthPicker(false);

    try {
      const result = await reportService.generateMonthlyReport(selectedContractId, year, month);

      if (!result.success) {
        toast.error(result.error || 'Failed to generate monthly report');
        return;
      }

      // Show preview
      setPreviewBlob(result.blob);
      setPreviewFilename(result.filename);

      // Reload history
      await loadReports(selectedContractId);
      await loadStats(selectedContractId);

    } catch (error) {
      console.error('❌ Monthly report error:', error);
      toast.error('Failed to generate monthly report: ' + error.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateWeekly = async () => {
    if (!selectedContractId || !selectedWeekDate) {
      return;
    }

    const { start, end } = getWeekBounds(selectedWeekDate);

    setGenerating(true);
    setShowWeekPicker(false);

    try {
      const result = await reportService.generateWeeklyReport(selectedContractId, start, end);

      if (!result.success) {
        toast.error(result.error || 'Failed to generate weekly report');
        return;
      }

      setPreviewBlob(result.blob);
      setPreviewFilename(result.filename);

      await loadReports(selectedContractId);
      await loadStats(selectedContractId);

    } catch (error) {
      console.error('❌ Weekly report error:', error);
      toast.error('Failed to generate weekly report: ' + error.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleViewReport = async (report) => {
    setGenerating(true);
    try {
      const result = await reportService.regenerateReport(report);
      if (!result.success) {
        toast.error(result.error || 'Failed to regenerate report');
        return;
      }
      setPreviewBlob(result.blob);
      setPreviewFilename(result.filename);
    } catch (error) {
      toast.error('Failed to view report: ' + error.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleExportReport = async (report) => {
    setGenerating(true);
    try {
      const result = await reportService.regenerateReport(report);
      if (!result.success) {
        toast.error(result.error || 'Failed to export report');
        return;
      }
      reportService.downloadPDF(result.blob, result.filename);
    } catch (error) {
      toast.error('Failed to export report: ' + error.message);
    } finally {
      setGenerating(false);
    }
  };

  const handlePrintReport = async (report) => {
    setGenerating(true);
    try {
      const result = await reportService.regenerateReport(report);
      if (!result.success) {
        toast.error(result.error || 'Failed to print report');
        return;
      }
      reportService.openPDFInNewTab(result.blob);
    } catch (error) {
      toast.error('Failed to print report: ' + error.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleArchiveReport = async (report) => {
    const action = report.status === 'archived' ? 'restore' : 'archive';
    if (!confirm(`${action === 'archive' ? 'Archive' : 'Restore'} "${report.report_title}"?`)) {
      return;
    }

    const result = action === 'archive'
      ? await reportService.archiveReport(report.id)
      : await reportService.restoreReport(report.id);

    if (result.success) {
      await loadReports(selectedContractId);
      await loadStats(selectedContractId);
    } else {
      toast.error(`Failed to ${action} report`);
    }
  };

  const handleDeleteReport = async (report) => {
    if (!confirm(`Permanently delete "${report.report_title}"? This cannot be undone.`)) {
      return;
    }

    const result = await reportService.deleteReport(report.id);
    if (result.success) {
      await loadReports(selectedContractId);
      await loadStats(selectedContractId);
    } else {
      toast.error('Failed to delete report');
    }
  };

  // ============================================
  // RENDER: Loading state
  // ============================================
  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center items-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      </AppLayout>
    );
  }

  // ============================================
  // RENDER: No contracts
  // ============================================
  if (contracts.length === 0) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
            <p className="text-gray-600 mt-1">Generate and manage work reports</p>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
            <p className="text-yellow-800 font-medium">No Active Contracts Found</p>
            <p className="text-yellow-700 text-sm mt-1">Create an active contract to start generating reports.</p>
            <button
              onClick={() => navigate('/contracts/new')}
              className="mt-4 px-4 py-2 bg-yellow-100 text-yellow-800 rounded-lg hover:bg-yellow-200 text-sm font-medium"
            >
              Create Contract
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ============================================
  // RENDER: Main page
  // ============================================
  return (
    <AppLayout>
      <div className="space-y-6">

        {/* ===== PAGE HEADER ===== */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-600 mt-1">Generate, view, and manage work reports</p>
        </div>

        {/* ===== CONTRACT SELECTOR ===== */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">Select Contract</label>
            {currentOrg && (
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                📁 {currentOrg.name}
              </span>
            )}
          </div>
          <select
            value={selectedContractId}
            onChange={(e) => setSelectedContractId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          >
            <option value="">-- Select Contract --</option>
            {contracts.map(c => (
              <option key={c.id} value={c.id}>
                {c.contract_number} — {c.project?.client_name || 'Unknown'} — {c.contract_name}
              </option>
            ))}
          </select>

          {/* Contract info summary */}
          {selectedContract && (
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
              <span className="px-2 py-1 bg-gray-100 rounded">
                {selectedContract.contract_category?.replace(/-/g, ' ').toUpperCase() || 'N/A'}
              </span>
              <span className="px-2 py-1 bg-gray-100 rounded">
                {selectedContract.project?.project_name}
              </span>
              <span className="px-2 py-1 bg-gray-100 rounded">
                {formatDate(selectedContract.valid_from)} → {formatDate(selectedContract.valid_until)}
              </span>
            </div>
          )}
        </div>

        {/* ===== QUICK ACTIONS (only when contract selected) ===== */}
        {selectedContractId && (
          <div className="flex flex-wrap gap-3">
            {/* Generate Custom Report */}
            <button
              onClick={handleGenerateNew}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Generate Report
            </button>

            {/* Monthly Report */}
            <button
              onClick={() => setShowMonthPicker(true)}
              disabled={generating}
              className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium shadow-sm disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Monthly Report
            </button>

            {/* Weekly Report */}
            <button
              onClick={() => setShowWeekPicker(true)}
              disabled={generating}
              className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium shadow-sm disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Weekly Report
            </button>
          </div>
        )}

        {/* ===== STATS BAR ===== */}
        {selectedContractId && stats.totalReports > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.totalReports}</p>
                <p className="text-xs text-gray-500">Total Reports</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.totalEntries}</p>
                <p className="text-xs text-gray-500">Entries Reported</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.lastGenerated ? timeAgo(stats.lastGenerated) : '-'}</p>
                <p className="text-xs text-gray-500">Last Generated</p>
              </div>
              <div className="flex gap-2">
                {stats.byType?.custom > 0 && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">{stats.byType.custom} custom</span>
                )}
                {stats.byType?.monthly > 0 && (
                  <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">{stats.byType.monthly} monthly</span>
                )}
                {stats.byType?.weekly > 0 && (
                  <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">{stats.byType.weekly} weekly</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ===== FILTERS ===== */}
        {selectedContractId && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500 font-medium">Filter:</span>

            {/* Status filter */}
            {['all', 'active', 'archived'].map(f => (
              <button
                key={f}
                onClick={() => setShowFilter(f)}
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                  showFilter === f
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}

            <span className="text-gray-300 mx-1">|</span>

            {/* Type filter */}
            {['all', 'custom', 'monthly', 'weekly'].map(f => (
              <button
                key={f}
                onClick={() => setTypeFilter(f)}
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                  typeFilter === f
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {f === 'all' ? 'All Types' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        )}

        {/* ===== REPORT HISTORY TABLE ===== */}
        {selectedContractId && (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            {loadingReports ? (
              <div className="flex justify-center items-center py-12">
                <LoadingSpinner />
              </div>
            ) : reports.length === 0 ? (
              <div className="p-12 text-center">
                <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="mt-3 text-sm font-medium text-gray-900">No Reports Yet</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Generate your first report using the buttons above.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Report</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Period</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Entries</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Generated</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">Status</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {reports.map(report => {
                      const typeStyle = TYPE_STYLES[report.report_type] || TYPE_STYLES.custom;
                      const statusStyle = STATUS_STYLES[report.status] || STATUS_STYLES.active;

                      return (
                        <tr key={report.id} className={`hover:bg-gray-50 ${report.status === 'archived' ? 'opacity-60' : ''}`}>
                          {/* Title */}
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium text-gray-900 truncate max-w-[200px]">
                              {report.report_title}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              by {report.generated_by_name}
                            </p>
                          </td>

                          {/* Type badge */}
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${typeStyle.bg} ${typeStyle.text}`}>
                              {typeStyle.label}
                            </span>
                          </td>

                          {/* Period */}
                          <td className="px-4 py-3 hidden sm:table-cell">
                            {report.period_start && report.period_end ? (
                              <span className="text-xs text-gray-600">
                                {formatDate(report.period_start)} – {formatDate(report.period_end)}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">Custom range</span>
                            )}
                          </td>

                          {/* Entry count */}
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center justify-center w-8 h-8 bg-gray-100 text-gray-700 text-sm font-medium rounded-full">
                              {report.entry_count}
                            </span>
                          </td>

                          {/* Generated date */}
                          <td className="px-4 py-3 hidden md:table-cell">
                            <p className="text-xs text-gray-600">{formatDateTime(report.generated_at)}</p>
                            <p className="text-xs text-gray-400">{timeAgo(report.generated_at)}</p>
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3 hidden lg:table-cell">
                            <span className={`inline-flex px-2 py-0.5 text-xs rounded-full ${statusStyle.bg} ${statusStyle.text}`}>
                              {statusStyle.label}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {/* View */}
                              <button
                                onClick={() => handleViewReport(report)}
                                disabled={generating}
                                className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-50"
                                title="View / Preview"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              </button>

                              {/* Export/Download */}
                              <button
                                onClick={() => handleExportReport(report)}
                                disabled={generating}
                                className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
                                title="Export / Download PDF"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              </button>

                              {/* Archive/Restore */}
                              <button
                                onClick={() => handleArchiveReport(report)}
                                className={`p-1.5 rounded transition-colors ${
                                  report.status === 'archived'
                                    ? 'text-gray-500 hover:text-emerald-600 hover:bg-emerald-50'
                                    : 'text-gray-500 hover:text-amber-600 hover:bg-amber-50'
                                }`}
                                title={report.status === 'archived' ? 'Restore' : 'Archive'}
                              >
                                {report.status === 'archived' ? (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                  </svg>
                                ) : (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                                  </svg>
                                )}
                              </button>

                              {/* Print */}
                              <button
                                onClick={() => handlePrintReport(report)}
                                disabled={generating}
                                className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors disabled:opacity-50"
                                title="Print (opens in new tab)"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                </svg>
                              </button>

                              {/* Delete (only on archived) */}
                              {report.status === 'archived' && (
                                <button
                                  onClick={() => handleDeleteReport(report)}
                                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                  title="Delete permanently"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* No contract selected message */}
        {!selectedContractId && (
          <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-3 text-sm font-medium text-gray-900">Select a Contract</h3>
            <p className="mt-1 text-sm text-gray-500">Choose a contract above to view and generate reports</p>
          </div>
        )}
      </div>

      {/* ===== MONTH PICKER MODAL ===== */}
      {showMonthPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Generate Monthly Report</h3>
            <p className="text-sm text-gray-600 mb-4">
              Select a month to auto-generate a report for all work entries in that period.
            </p>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent mb-4"
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowMonthPicker(false)}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateMonthly}
                disabled={!selectedMonth}
                className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                Generate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== WEEK PICKER MODAL ===== */}
      {showWeekPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Generate Weekly Report</h3>
            <p className="text-sm text-gray-600 mb-4">
              Pick any date — the report will cover Monday to Sunday of that week.
            </p>
            <input
              type="date"
              value={selectedWeekDate}
              onChange={(e) => setSelectedWeekDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent mb-2"
            />
            {selectedWeekDate && (
              <p className="text-xs text-gray-500 mb-4">
                Week: {formatDate(getWeekBounds(selectedWeekDate).start)} — {formatDate(getWeekBounds(selectedWeekDate).end)}
              </p>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowWeekPicker(false)}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateWeekly}
                disabled={!selectedWeekDate}
                className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                Generate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== GENERATING OVERLAY ===== */}
      {generating && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black bg-opacity-30">
          <div className="bg-white rounded-lg shadow-lg p-6 flex items-center gap-3">
            <LoadingSpinner size="sm" />
            <span className="text-sm text-gray-700">Generating report...</span>
          </div>
        </div>
      )}

      {/* ===== PDF PREVIEW MODAL ===== */}
      {previewBlob && (
        <ReportPreview
          blob={previewBlob}
          filename={previewFilename}
          onClose={() => {
            setPreviewBlob(null); setPreviewFilename(''); 
          }}
          onDownload={() => {
            reportService.downloadPDF(previewBlob, previewFilename);
          }}
        />
      )}

    </AppLayout>
  );
}
