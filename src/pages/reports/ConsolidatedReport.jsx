/**
 * WorkLedger - Consolidated Report Page
 *
 * For main contractors (e.g. MTSB) to generate a combined PDF report
 * that covers both their own internal work entries AND entries from
 * linked subcontractor organisations (e.g. FEST ENT).
 *
 * Access:
 *   Permission: NAV_REPORTS (same as GenerateReport)
 *   But: if the current org has NO active subcontractor relationships,
 *        an informative empty state is shown — FEST ENT managers who
 *        navigate here directly see this, not an error.
 *
 * Data flow:
 *   1. On mount → getSubcontractorRelationships(orgId) to find linked subcons
 *   2. If empty → show "main contractors only" message
 *   3. User selects date range + subcon toggle → loadEntries()
 *   4. Two parallel queries:
 *        a. organization_id = currentOrg.id        (internal entries)
 *        b. organization_id IN [subconOrgId, ...]  (subcontractor entries)
 *   5. Display two collapsible sections + summary stat cards
 *   6. Generate PDF → jsPDF + AutoTable summary report
 *
 * PDF layout:
 *   WORKLEDGER — MTSB Maintenance Sdn Bhd
 *   Consolidated Work Report — 1 Feb 2026 to 1 Mar 2026
 *   Generated: 2 Mar 2026
 *   ─────────────────────────────────────────
 *   SECTION 1: MTSB Internal Entries (n entries)
 *   [AutoTable: date | contract | template | status | created_by]
 *   ─────────────────────────────────────────
 *   SECTION 2: FEST ENT Subcontractor Entries (n entries)
 *   [AutoTable: same columns]
 *   ─────────────────────────────────────────
 *   SUMMARY
 *   Total: X  |  Approved: X  |  Pending: X  |  Rejected: X
 *   MTSB Internal: X  |  FEST ENT: X
 *
 * @module pages/reports/ConsolidatedReport
 * @created March 2, 2026 - Session 17
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { supabase } from '../../services/supabase/client';
import { subcontractorService } from '../../services/api/subcontractorService';
import { useOrganization } from '../../context/OrganizationContext';
import AppLayout from '../../components/layout/AppLayout';
import LoadingSpinner from '../../components/common/LoadingSpinner';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (isoDate) =>
  isoDate
    ? new Date(isoDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

const today = () => new Date().toISOString().split('T')[0];
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
};

const STATUS_LABEL = {
  approved:  { label: 'Approved',  color: 'bg-green-100 text-green-800' },
  submitted: { label: 'Submitted', color: 'bg-blue-100 text-blue-800'  },
  rejected:  { label: 'Rejected',  color: 'bg-red-100 text-red-800'    },
  draft:     { label: 'Draft',     color: 'bg-gray-100 text-gray-700'  }
};

// ─── Entry Supabase query (reused for both orgs) ──────────────────────────────

const fetchEntriesForOrg = async (orgId, dateFrom, dateTo) => {
  const { data, error } = await supabase
    .from('work_entries')
    .select(`
      id,
      entry_date,
      status,
      organization_id,
      created_by,
      approved_at,
      approved_by,
      rejected_at,
      contract:contracts!work_entries_contract_id_fkey(
        id, contract_number, contract_name
      ),
      template:templates!work_entries_template_id_fkey(
        id, template_name
      )
    `)
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .gte('entry_date', dateFrom)
    .lte('entry_date', dateTo)
    .order('entry_date', { ascending: false });

  if (error) {
    throw error;
  }
  return data || [];
};

// ─── Stat card component ──────────────────────────────────────────────────────

function StatCard({ label, value, color = 'text-gray-900' }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  );
}

// ─── Entry table component ────────────────────────────────────────────────────

function EntryTable({ entries, creatorNames }) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-gray-500 py-4 text-center">No entries in this period.</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
            <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Contract</th>
            <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Template</th>
            <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
            <th className="text-left py-2    text-xs font-semibold text-gray-500 uppercase tracking-wide">By</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(entry => {
            const statusStyle = STATUS_LABEL[entry.status] || STATUS_LABEL.draft;
            return (
              <tr key={entry.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-2 pr-4 text-gray-700 whitespace-nowrap">{fmt(entry.entry_date)}</td>
                <td className="py-2 pr-4 text-gray-700">
                  <span className="font-medium">{entry.contract?.contract_number || '—'}</span>
                  <span className="text-gray-400 text-xs ml-1 hidden sm:inline">
                    {entry.contract?.contract_name?.substring(0, 30)}
                  </span>
                </td>
                <td className="py-2 pr-4 text-gray-600">{entry.template?.template_name || '—'}</td>
                <td className="py-2 pr-4">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusStyle.color}`}>
                    {statusStyle.label}
                  </span>
                </td>
                <td className="py-2 text-gray-600 text-xs">
                  {creatorNames[entry.created_by] || '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ConsolidatedReport() {
  const navigate     = useNavigate();
  const { currentOrg } = useOrganization();

  // ── State ──────────────────────────────────────────────────────────────────
  const [initLoading,      setInitLoading]      = useState(true);
  const [subconRelations,  setSubconRelations]  = useState([]);   // active subcontractors
  const [dateFrom,         setDateFrom]         = useState(daysAgo(30));
  const [dateTo,           setDateTo]           = useState(today());
  const [includeSubcon,    setIncludeSubcon]    = useState(true);
  const [loading,          setLoading]          = useState(false);
  const [generating,       setGenerating]       = useState(false);
  const [error,            setError]            = useState(null);

  // Entry data
  const [internalEntries,  setInternalEntries]  = useState([]);
  const [subconEntries,    setSubconEntries]    = useState([]);  // all subcons combined
  const [subconBreakdown,  setSubconBreakdown]  = useState({}); // { subconOrgId: [entries] }
  const [creatorNames,     setCreatorNames]     = useState({}); // { userId: fullName }
  const [dataLoaded,       setDataLoaded]       = useState(false);

  // ── Init: load subcontractor relationships ─────────────────────────────────
  useEffect(() => {
    const init = async () => {
      if (!currentOrg?.id) {
        return;
      }
      try {
        const rels = await subcontractorService.getSubcontractorRelationships(currentOrg.id);
        const active = rels.filter(r => r.status === 'active');
        setSubconRelations(active);
      } catch (err) {
        console.error('❌ Failed to load subcontractor relationships:', err);
      } finally {
        setInitLoading(false);
      }
    };
    init();
  }, [currentOrg?.id]);

  // ── Load Entries ───────────────────────────────────────────────────────────
  const loadEntries = useCallback(async () => {
    if (!currentOrg?.id) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setDataLoaded(false);

      console.log('📊 ConsolidatedReport: Loading entries...');

      // Unique subcontractor org IDs from active relationships
      const subconOrgIds = [...new Set(subconRelations.map(r => r.subcontractor_org_id))];

      // Parallel fetch: internal + each subcon org
      const fetchPromises = [
        fetchEntriesForOrg(currentOrg.id, dateFrom, dateTo),
        ...(includeSubcon
          ? subconOrgIds.map(orgId => fetchEntriesForOrg(orgId, dateFrom, dateTo))
          : [])
      ];

      const results = await Promise.all(fetchPromises);

      const internal  = results[0];
      const allSubcon = includeSubcon ? results.slice(1).flat() : [];

      // Build per-subcon breakdown for display
      const breakdown = {};
      if (includeSubcon) {
        subconOrgIds.forEach((orgId, idx) => {
          breakdown[orgId] = results[idx + 1] || [];
        });
      }

      // Resolve creator names in one query
      const allEntries  = [...internal, ...allSubcon];
      const allUserIds  = [...new Set(allEntries.map(e => e.created_by).filter(Boolean))];

      const nameMap = {};
      if (allUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, full_name')
          .in('id', allUserIds);
        (profiles || []).forEach(p => {
          nameMap[p.id] = p.full_name; 
        });
      }

      setInternalEntries(internal);
      setSubconEntries(allSubcon);
      setSubconBreakdown(breakdown);
      setCreatorNames(nameMap);
      setDataLoaded(true);

      console.log(`✅ Loaded ${internal.length} internal + ${allSubcon.length} subcon entries`);

    } catch (err) {
      console.error('❌ Failed to load entries:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [currentOrg?.id, dateFrom, dateTo, includeSubcon, subconRelations]);

  // ── Summary stats ──────────────────────────────────────────────────────────
  const allEntries = [...internalEntries, ...subconEntries];
  const countByStatus = (entries, status) => entries.filter(e => e.status === status).length;

  const summary = {
    total:    allEntries.length,
    approved: countByStatus(allEntries, 'approved'),
    pending:  countByStatus(allEntries, 'submitted'),
    rejected: countByStatus(allEntries, 'rejected'),
    draft:    countByStatus(allEntries, 'draft'),
    internal: internalEntries.length,
    subcon:   subconEntries.length
  };

  // ── PDF Generation ─────────────────────────────────────────────────────────
  const handleGeneratePDF = async () => {
    if (!dataLoaded || allEntries.length === 0) {
      return;
    }

    try {
      setGenerating(true);
      console.log('📄 Generating consolidated PDF...');

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const margin = 15;
      const pageW  = pdf.internal.pageSize.width;
      let   yPos   = 20;

      // ── Header ────────────────────────────────────────────────────────────
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(30, 64, 175); // blue-800
      pdf.text('WORKLEDGER', margin, yPos);

      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Generated: ${fmt(new Date().toISOString())}`, pageW - margin, yPos, { align: 'right' });

      yPos += 7;
      pdf.setFontSize(13);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(30, 30, 30);
      pdf.text('Consolidated Work Report', margin, yPos);

      yPos += 6;
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(80, 80, 80);
      pdf.text(`${currentOrg?.name || 'Organisation'}`, margin, yPos);
      pdf.text(`Period: ${fmt(dateFrom)} — ${fmt(dateTo)}`, pageW - margin, yPos, { align: 'right' });

      yPos += 4;
      pdf.setDrawColor(200, 200, 200);
      pdf.line(margin, yPos, pageW - margin, yPos);
      yPos += 8;

      // ── Summary block ─────────────────────────────────────────────────────
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(30, 30, 30);
      pdf.text('SUMMARY', margin, yPos);
      yPos += 5;

      pdf.autoTable({
        startY: yPos,
        margin: { left: margin, right: margin },
        head: [['Total Entries', 'Approved', 'Submitted', 'Rejected', 'Draft', `${currentOrg?.name} Internal`, 'Subcontractor']],
        body: [[
          summary.total,
          summary.approved,
          summary.pending,
          summary.rejected,
          summary.draft,
          summary.internal,
          summary.subcon
        ]],
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [240, 245, 255] },
        theme: 'grid'
      });

      yPos = pdf.lastAutoTable.finalY + 10;

      // ── Internal entries section ───────────────────────────────────────────
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(30, 64, 175);
      pdf.text(`${currentOrg?.name} — Internal Entries (${internalEntries.length})`, margin, yPos);
      yPos += 5;

      if (internalEntries.length === 0) {
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'italic');
        pdf.setTextColor(120, 120, 120);
        pdf.text('No internal entries in this period.', margin, yPos);
        yPos += 8;
      } else {
        pdf.autoTable({
          startY: yPos,
          margin: { left: margin, right: margin },
          head: [['Date', 'Contract No.', 'Contract Name', 'Template', 'Status', 'By']],
          body: internalEntries.map(e => [
            fmt(e.entry_date),
            e.contract?.contract_number || '—',
            (e.contract?.contract_name || '—').substring(0, 25),
            (e.template?.template_name || '—').substring(0, 20),
            (STATUS_LABEL[e.status]?.label || e.status),
            (creatorNames[e.created_by] || '—').split(' ')[0] // first name only for space
          ]),
          styles: { fontSize: 8, cellPadding: 2.5 },
          headStyles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          theme: 'grid',
          columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 25 }, 5: { cellWidth: 20 } }
        });
        yPos = pdf.lastAutoTable.finalY + 10;
      }

      // ── Subcontractor sections ─────────────────────────────────────────────
      if (includeSubcon && subconRelations.length > 0) {
        for (const rel of subconRelations) {
          const subOrgId      = rel.subcontractor_org_id;
          const subOrgName    = rel.subcontractor_org?.name || 'Subcontractor';
          const subOrgEntries = subconBreakdown[subOrgId] || [];

          // Page break if needed
          if (yPos > 240) {
            pdf.addPage();
            yPos = 20;
          }

          pdf.setFontSize(11);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(124, 45, 18); // orange-900 — distinct from internal
          pdf.text(`${subOrgName} — Subcontractor Entries (${subOrgEntries.length})`, margin, yPos);
          yPos += 5;

          if (subOrgEntries.length === 0) {
            pdf.setFontSize(9);
            pdf.setFont('helvetica', 'italic');
            pdf.setTextColor(120, 120, 120);
            pdf.text('No entries in this period.', margin, yPos);
            yPos += 8;
          } else {
            pdf.autoTable({
              startY: yPos,
              margin: { left: margin, right: margin },
              head: [['Date', 'Contract No.', 'Contract Name', 'Template', 'Status', 'By']],
              body: subOrgEntries.map(e => [
                fmt(e.entry_date),
                e.contract?.contract_number || '—',
                (e.contract?.contract_name || '—').substring(0, 25),
                (e.template?.template_name || '—').substring(0, 20),
                (STATUS_LABEL[e.status]?.label || e.status),
                (creatorNames[e.created_by] || '—').split(' ')[0]
              ]),
              styles: { fontSize: 8, cellPadding: 2.5 },
              headStyles: { fillColor: [124, 45, 18], textColor: 255, fontStyle: 'bold' },
              alternateRowStyles: { fillColor: [255, 247, 237] },
              theme: 'grid',
              columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 25 }, 5: { cellWidth: 20 } }
            });
            yPos = pdf.lastAutoTable.finalY + 10;
          }
        }
      }

      // ── Page numbers ───────────────────────────────────────────────────────
      const pageCount = pdf.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(150, 150, 150);
        pdf.text(
          `Page ${i} of ${pageCount}  |  WorkLedger Consolidated Report`,
          pageW / 2,
          pdf.internal.pageSize.height - 8,
          { align: 'center' }
        );
      }

      // ── Download ───────────────────────────────────────────────────────────
      const dateStr  = new Date().toISOString().split('T')[0];
      const filename = `WorkLedger_Consolidated_${currentOrg?.name?.replace(/\s+/g, '_') || 'Report'}_${dateStr}.pdf`;
      pdf.save(filename);

      console.log('✅ Consolidated PDF downloaded:', filename);

    } catch (err) {
      console.error('❌ PDF generation failed:', err);
      setError('PDF generation failed: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  if (initLoading) {
    return (
      <AppLayout>
        <div className="flex justify-center items-center py-16">
          <LoadingSpinner size="lg" />
        </div>
      </AppLayout>
    );
  }

  // Guard: no subcontractor relationships → show empty state for non-main contractors
  if (subconRelations.length === 0) {
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

          <div>
            <h1 className="text-2xl font-bold text-gray-900">Consolidated Report</h1>
            <p className="text-gray-600 mt-1">Combined report for main contractors and their subcontractors</p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 flex gap-4">
            <div className="flex-shrink-0 text-amber-400">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-amber-900">No Subcontractor Relationships Found</h3>
              <p className="text-sm text-amber-800 mt-1">
                Consolidated reports are for main contractors who have linked subcontractor organisations.
                <strong> {currentOrg?.name}</strong> currently has no active subcontractor relationships.
              </p>
              <p className="text-sm text-amber-700 mt-2">
                To link a subcontractor, go to{' '}
                <button
                  onClick={() => navigate('/subcontractors')}
                  className="underline font-medium hover:text-amber-900"
                >
                  Subcontractors
                </button>
                {' '}and add an organisation.
              </p>
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

        {/* Page header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Consolidated Report</h1>
            <p className="text-gray-600 mt-1">
              Combined work report for <strong>{currentOrg?.name}</strong> and linked subcontractors
            </p>
          </div>
          <span className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">
            {subconRelations.length} subcontractor{subconRelations.length !== 1 ? 's' : ''} linked
          </span>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-red-800">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">✕</button>
          </div>
        )}

        {/* ── Filters panel ──────────────────────────────────────────────── */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Report Filters</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            {/* Date from */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
              <input
                type="date"
                value={dateFrom}
                max={dateTo}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Date to */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
              <input
                type="date"
                value={dateTo}
                min={dateFrom}
                max={today()}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Subcontractor toggle */}
            <div className="flex items-center gap-3 pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeSubcon}
                  onChange={(e) => setIncludeSubcon(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Include subcontractor entries</span>
              </label>
            </div>

            {/* Load button */}
            <button
              onClick={loadEntries}
              disabled={loading}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Loading...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Load Entries
                </>
              )}
            </button>
          </div>

          {/* Quick range shortcuts */}
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              { label: 'Last 7 days',  from: daysAgo(7) },
              { label: 'Last 30 days', from: daysAgo(30) },
              { label: 'Last 90 days', from: daysAgo(90) }
            ].map(({ label, from }) => (
              <button
                key={label}
                onClick={() => {
                  setDateFrom(from); setDateTo(today()); 
                }}
                className="px-3 py-1 text-xs border border-gray-200 rounded-full text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Data sections (only after load) ────────────────────────────── */}
        {dataLoaded && (
          <>
            {/* Summary stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              <StatCard label="Total"    value={summary.total}    />
              <StatCard label="Approved" value={summary.approved} color="text-green-700" />
              <StatCard label="Submitted" value={summary.pending} color="text-blue-700"  />
              <StatCard label="Rejected" value={summary.rejected} color="text-red-700"   />
              <StatCard label="Draft"    value={summary.draft}    color="text-gray-500"  />
              <StatCard label={`${currentOrg?.name?.split(' ')[0]} Internal`} value={summary.internal} color="text-blue-900" />
              <StatCard label="Subcontractor" value={summary.subcon} color="text-orange-700" />
            </div>

            {/* Internal entries section */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 bg-blue-50">
                <h3 className="text-sm font-semibold text-blue-900">
                  {currentOrg?.name} — Internal Entries
                  <span className="ml-2 px-2 py-0.5 bg-blue-200 text-blue-800 text-xs font-bold rounded-full">
                    {internalEntries.length}
                  </span>
                </h3>
              </div>
              <div className="p-5">
                <EntryTable entries={internalEntries} creatorNames={creatorNames} />
              </div>
            </div>

            {/* Subcontractor sections */}
            {includeSubcon && subconRelations.map(rel => {
              const subOrgId   = rel.subcontractor_org_id;
              const subOrgName = rel.subcontractor_org?.name || 'Subcontractor';
              const entries    = subconBreakdown[subOrgId] || [];

              return (
                <div key={subOrgId} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 bg-orange-50">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-orange-900">
                        {subOrgName} — Subcontractor Entries
                        <span className="ml-2 px-2 py-0.5 bg-orange-200 text-orange-800 text-xs font-bold rounded-full">
                          {entries.length}
                        </span>
                      </h3>
                      <span className="text-xs text-orange-700 bg-orange-100 px-2 py-0.5 rounded">
                        Subcontractor
                      </span>
                    </div>
                  </div>
                  <div className="p-5">
                    <EntryTable entries={entries} creatorNames={creatorNames} />
                  </div>
                </div>
              );
            })}

            {/* Generate PDF button */}
            <div className="flex justify-end">
              <button
                onClick={handleGeneratePDF}
                disabled={generating || allEntries.length === 0}
                className="flex items-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white font-medium rounded-lg transition-colors shadow-sm"
              >
                {generating ? (
                  <>
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Generating PDF...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Download Consolidated PDF ({allEntries.length} entries)
                  </>
                )}
              </button>
            </div>
          </>
        )}

        {/* Prompt to load if not yet loaded */}
        {!dataLoaded && !loading && (
          <div className="bg-white border border-gray-200 border-dashed rounded-lg p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-gray-600 font-medium">Select a date range and click "Load Entries"</p>
            <p className="text-gray-400 text-sm mt-1">
              Data for {currentOrg?.name} + {subconRelations.length} subcontractor{subconRelations.length !== 1 ? 's' : ''} will appear here
            </p>
          </div>
        )}

      </div>
    </AppLayout>
  );
}
