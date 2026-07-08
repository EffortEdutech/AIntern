/**
 * WorkLedger - Report Service
 *
 * Orchestrates work entry fetching and PDF/HTML generation
 * via the Render Engine architecture (layout-driven).
 *
 * SESSION 17 CHANGES:
 *   - fetchWorkEntries() now resolves approver & rejector full names
 *     from user_profiles in a single second-pass query (same pattern
 *     already used for created_by). Approval metadata is now available
 *     to every downstream adapter (PDF/HTML).
 *   - getRejectionAnalytics() added — queries reject_entry_history
 *     for the Rejection Analytics page (Priority 3). Added here now so
 *     the service is the single source-of-truth for all report data.
 *
 * @module services/api/reportService
 * @updated March 2, 2026 - Session 17: approval fields + rejection analytics
 */

import { supabase } from '../supabase/client';
import { renderEngineCore } from '../render/renderEngineCore';
import { htmlAdapter } from '../render/adapters/htmlAdapter';
import { pdfAdapter } from '../render/adapters/pdfAdapter';
import { layoutRegistryService } from '../layoutRegistryService';

class ReportService {

  // ─────────────────────────────────────────────────────────────────────────
  // CORE GENERATION
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Generate PDF or HTML report for a set of work entry IDs.
   *
   * @param {string[]} entryIds - Work entry UUIDs to include
   * @param {Object}  options
   * @param {string}  options.layoutId      - Required for Render Engine path
   * @param {string}  options.outputFormat  - 'pdf' | 'html' | 'preview'
   * @param {string}  options.orientation   - 'portrait' | 'landscape'
   * @param {string}  options.pageSize      - 'a4' | 'letter'
   * @param {Object}  options.entrySelections - Per-entry field selections from UI
   * @returns {Promise<{success, blob?, html?, filename?, format, error?}>}
   */
  async generateReport(entryIds, options = {}) {
    try {
      console.log('📄 ReportService: Starting report generation...');
      console.log('  Entries:', entryIds.length);
      console.log('  Layout ID:', options.layoutId);
      console.log('  Output:', options.outputFormat || 'pdf');

      if (!entryIds || entryIds.length === 0) {
        throw new Error('No work entries provided');
      }

      const entries = await this.fetchWorkEntries(entryIds);

      if (!entries || entries.length === 0) {
        throw new Error('No work entries found');
      }

      if (options.layoutId) {
        return await this.generateWithRenderEngine(entries, options);
      } else {
        console.log('⚠️  Using legacy generation (no layoutId provided)');
        return await this.generateLegacy(entries, options);
      }

    } catch (error) {
      console.error('❌ Report generation failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate report using the Render Engine (layout-driven path).
   */
  async generateWithRenderEngine(entries, options) {
    try {
      console.log('🚀 Using Render Engine architecture');

      const layout = await layoutRegistryService.getLayout(options.layoutId);
      console.log('  Layout:', layout.layout_name);

      const renderTrees = [];
      for (const entry of entries) {
        const renderTree = renderEngineCore.generateRenderTree(
          layout.layout_schema,
          entry,
          layout.binding_rules
        );
        renderTrees.push(renderTree);
      }

      console.log(`✅ Generated ${renderTrees.length} Render Trees`);

      if (options.outputFormat === 'html' || options.outputFormat === 'preview') {
        return await this.generateHTML(renderTrees, entries, layout);
      } else {
        return await this.generatePDF(renderTrees, entries, layout, options);
      }

    } catch (error) {
      console.error('❌ Render Engine generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate HTML (used for preview mode).
   */
  async generateHTML(renderTrees, entries, layout) {
    console.log('🌐 Generating HTML...');

    const htmlParts = renderTrees.map((tree, index) => {
      const html = htmlAdapter.render(tree);
      if (index < renderTrees.length - 1) {
        return html + '<div style="page-break-after: always; height: 40px;"></div>';
      }
      return html;
    });

    const fullHTML = htmlParts.join('\n');
    console.log('✅ HTML generated');

    return {
      success: true,
      html: fullHTML,
      format: 'html',
      layoutName: layout.layout_name,
      entryCount: entries.length
    };
  }

  /**
   * Generate PDF.
   */
  async generatePDF(renderTrees, entries, layout, _options) {
    console.log('📄 Generating PDF...');

    let pdf = await pdfAdapter.render(
      renderTrees[0],
      entries[0].attachments || []
    );

    for (let i = 1; i < renderTrees.length; i++) {
      pdf.addPage();
      pdf = await pdfAdapter.render(
        renderTrees[i],
        entries[i].attachments || [],
        pdf
      );
    }

    this.addPageNumbers(pdf);

    const blob = pdf.output('blob');
    const filename = this.generateFilename(entries[0].template, entries, layout);

    console.log('✅ PDF generated:', filename);

    return {
      success: true,
      blob,
      filename,
      pdf,
      format: 'pdf',
      layoutName: layout.layout_name,
      entryCount: entries.length
    };
  }

  /**
   * Legacy fallback — throws to force use of layoutId.
   */
  async generateLegacy(_entries, _options) {
    console.log('⚠️  Legacy PDF generation not available');
    throw new Error('Legacy generation not available. Please select a report layout.');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DATA FETCHING
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Fetch work entries with all relations needed for report generation.
   *
   * SESSION 17 UPDATE:
   *   After the main Supabase query we now do ONE additional second-pass
   *   query against user_profiles to resolve names for THREE user columns:
   *     - created_by       → created_by_profile.full_name
   *     - approved_by      → approved_by_profile.full_name   (NEW)
   *     - rejected_by      → rejected_by_profile.full_name   (NEW)
   *
   *   We collect all unique UUIDs from all three columns, fetch profiles
   *   in a single .in() call, then map back — zero extra round-trips.
   *
   *   We NEVER join auth.users directly. user_profiles (public schema)
   *   is the correct and RLS-safe source for display names.
   *
   * @param {string[]} entryIds
   * @returns {Promise<Object[]>}
   */
  async fetchWorkEntries(entryIds) {
    console.log('📥 Fetching work entries...');

    const { data, error } = await supabase
      .from('work_entries')
      .select(`
        *,
        contract:contracts!work_entries_contract_id_fkey(
          id,
          contract_number,
          contract_name,
          contract_category,
          contract_type,
          project:projects!contracts_project_id_fkey(
            id,
            project_name,
            client_name,
            site_address
          )
        ),
        template:templates!work_entries_template_id_fkey(
          id,
          template_id,
          template_name,
          contract_category,
          fields_schema
        ),
        attachments:attachments!attachments_work_entry_id_fkey(
          id,
          file_name,
          file_type,
          storage_url,
          storage_path,
          field_id,
          created_at
        )
      `)
      .in('id', entryIds)
      .order('entry_date', { ascending: true });

    if (error) {
      throw error;
    }

    // ── Second-pass: resolve all user names in one query ──────────────────
    // Collect unique UUIDs from created_by, approved_by, rejected_by.
    // Filter out nulls (approved_by / rejected_by are nullable).
    const allUserIds = [
      ...new Set(
        data.flatMap(e => [e.created_by, e.approved_by, e.rejected_by].filter(Boolean))
      )
    ];

    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, full_name')
      .in('id', allUserIds);

    const profileMap = {};
    (profiles || []).forEach(p => {
      profileMap[p.id] = p;
    });

    // ── Enrich each entry with resolved profiles ───────────────────────────
    const entries = data.map(entry => ({
      ...entry,
      // Who created the entry
      created_by_profile: profileMap[entry.created_by] || {
        id: entry.created_by,
        full_name: 'Unknown'
      },
      // Who approved (null if not yet approved)
      approved_by_profile: entry.approved_by
        ? (profileMap[entry.approved_by] || { id: entry.approved_by, full_name: 'Unknown' })
        : null,
      // Who rejected (null if never rejected)
      rejected_by_profile: entry.rejected_by
        ? (profileMap[entry.rejected_by] || { id: entry.rejected_by, full_name: 'Unknown' })
        : null
    }));

    console.log(`✅ Fetched ${entries.length} entries with relations`);
    return entries;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REJECTION ANALYTICS  (SESSION 17 — NEW)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Fetch rejection analytics data from reject_entry_history.
   *
   * Returns three datasets for the RejectionAnalytics page:
   *   1. Summary counts (total, unique entries, repeat offenders)
   *   2. Rejections per technician (for training focus)
   *   3. Most common rejection reasons
   *   4. Entries rejected more than once
   *   5. Weekly trend (for the period)
   *
   * IMPORTANT: We join user_profiles on entry_created_by (the technician),
   * NOT on auth.users. The rejected_by column (manager) is also resolved
   * via user_profiles for completeness in the detail rows.
   *
   * @param {string} orgId        - Organization UUID (currentOrg.id)
   * @param {Object} options
   * @param {number} options.days - Lookback window in days (default 30)
   * @param {string} options.from - ISO date string (overrides days if provided)
   * @param {string} options.to   - ISO date string (overrides days if provided)
   * @returns {Promise<{success, data?, error?}>}
   */
  async getRejectionAnalytics(orgId, { days = 30, from = null, to = null } = {}) {
    try {
      console.log('📊 Fetching rejection analytics for org:', orgId);

      if (!orgId) {
        throw new Error('Organization ID required for rejection analytics');
      }

      // Calculate date range
      const toDate   = to   ? new Date(to)   : new Date();
      const fromDate = from ? new Date(from)  : new Date(toDate.getTime() - days * 24 * 60 * 60 * 1000);

      const fromISO = fromDate.toISOString();
      const toISO   = toDate.toISOString();

      console.log(`  Period: ${fromISO.split('T')[0]} → ${toISO.split('T')[0]}`);

      // ── Fetch all rejection history records in the period ─────────────────
      const { data: rows, error } = await supabase
        .from('reject_entry_history')
        .select(`
          id,
          work_entry_id,
          entry_created_by,
          rejected_by,
          rejected_at,
          rejection_reason,
          rejection_count,
          entry_date,
          contract_id
        `)
        .eq('organization_id', orgId)
        .gte('rejected_at', fromISO)
        .lte('rejected_at', toISO)
        .order('rejected_at', { ascending: false });

      if (error) {
        throw error;
      }

      if (!rows || rows.length === 0) {
        console.log('✅ No rejections in period');
        return {
          success: true,
          data: {
            summary: { total: 0, uniqueEntries: 0, repeatOffenders: 0 },
            byTechnician: [],
            topReasons: [],
            repeatEntries: [],
            weeklyTrend: []
          }
        };
      }

      // ── Resolve all user names in one query ───────────────────────────────
      const allUserIds = [
        ...new Set(
          rows.flatMap(r => [r.entry_created_by, r.rejected_by].filter(Boolean))
        )
      ];

      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, full_name')
        .in('id', allUserIds);

      const profileMap = {};
      (profiles || []).forEach(p => {
        profileMap[p.id] = p;
      });

      const getName = (uuid) => profileMap[uuid]?.full_name || 'Unknown';

      // ── 1. Summary counts ─────────────────────────────────────────────────
      const uniqueEntries = new Set(rows.map(r => r.work_entry_id));

      // Entries rejected MORE than once: find max rejection_count per entry
      const maxCountByEntry = {};
      rows.forEach(r => {
        maxCountByEntry[r.work_entry_id] = Math.max(
          maxCountByEntry[r.work_entry_id] || 0,
          r.rejection_count
        );
      });
      const repeatOffenderCount = Object.values(maxCountByEntry).filter(c => c > 1).length;

      const summary = {
        total: rows.length,
        uniqueEntries: uniqueEntries.size,
        repeatOffenders: repeatOffenderCount
      };

      // ── 2. Rejections per technician ──────────────────────────────────────
      const techMap = {};
      rows.forEach(r => {
        const uid = r.entry_created_by;
        if (!techMap[uid]) {
          techMap[uid] = { userId: uid, name: getName(uid), count: 0 };
        }
        techMap[uid].count++;
      });

      const byTechnician = Object.values(techMap)
        .sort((a, b) => b.count - a.count);

      // ── 3. Top rejection reasons ──────────────────────────────────────────
      const reasonMap = {};
      rows.forEach(r => {
        const reason = (r.rejection_reason || 'No reason provided').trim();
        reasonMap[reason] = (reasonMap[reason] || 0) + 1;
      });

      const topReasons = Object.entries(reasonMap)
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // ── 4. Entries rejected more than once ────────────────────────────────
      const repeatEntries = Object.entries(maxCountByEntry)
        .filter(([, count]) => count > 1)
        .map(([workEntryId, timesRejected]) => {
          // Find the most recent row for this entry to get context
          const latestRow = rows
            .filter(r => r.work_entry_id === workEntryId)
            .sort((a, b) => new Date(b.rejected_at) - new Date(a.rejected_at))[0];

          return {
            workEntryId,
            timesRejected,
            entryDate: latestRow?.entry_date,
            technicianName: getName(latestRow?.entry_created_by),
            lastRejectedAt: latestRow?.rejected_at,
            lastReason: latestRow?.rejection_reason
          };
        })
        .sort((a, b) => b.timesRejected - a.timesRejected);

      // ── 5. Weekly trend ───────────────────────────────────────────────────
      // Build week buckets from fromDate to toDate
      const weeklyMap = {};
      rows.forEach(r => {
        const d = new Date(r.rejected_at);
        // Monday of the week that contains d
        const day = d.getDay(); // 0=Sun
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d.setDate(diff));
        const weekKey = monday.toISOString().split('T')[0];
        weeklyMap[weekKey] = (weeklyMap[weekKey] || 0) + 1;
      });

      const weeklyTrend = Object.entries(weeklyMap)
        .map(([week, count]) => ({ week, count }))
        .sort((a, b) => a.week.localeCompare(b.week));

      console.log('✅ Rejection analytics computed:', {
        total: summary.total,
        technicians: byTechnician.length,
        reasons: topReasons.length,
        repeats: repeatEntries.length
      });

      return {
        success: true,
        data: {
          summary,
          byTechnician,
          topReasons,
          repeatEntries,
          weeklyTrend,
          // Raw rows available for advanced consumers
          period: { from: fromISO, to: toISO, days }
        }
      };

    } catch (error) {
      console.error('❌ getRejectionAnalytics failed:', error);
      return { success: false, error: error.message };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REPORT HISTORY
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Fetch saved report history from generated_reports table.
   * Joins contracts → projects to get client_name correctly.
   */
  async getReportHistory(filters = {}) {
    try {
      console.log('📋 Fetching report history...');

      let query = supabase
        .from('generated_reports')
        .select('*')
        .order('generated_at', { ascending: false })
        .limit(filters.limit || 50);

      if (filters.contractId) {
        query = query.eq('contract_id', filters.contractId);
      }
      if (filters.offset) {
        query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
      }

      const { data, error } = await query;
      if (error) {
        throw error;
      }

      if (!data || data.length === 0) {
        console.log('✅ No reports found');
        return [];
      }

      // Enrich with contract + user profile data
      const contractIds = [...new Set(data.map(r => r.contract_id).filter(Boolean))];
      const userIds     = [...new Set(data.map(r => r.generated_by).filter(Boolean))];

      const [contractRes, profileRes] = await Promise.all([
        contractIds.length > 0
          ? supabase.from('contracts').select(`
              id, contract_number, contract_name, contract_category,
              project:projects!contracts_project_id_fkey(client_name)
            `).in('id', contractIds)
          : { data: [] },
        userIds.length > 0
          ? supabase.from('user_profiles').select('id, full_name').in('id', userIds)
          : { data: [] }
      ]);

      const contractMap = {};
      (contractRes.data || []).forEach(c => {
        contractMap[c.id] = {
          id: c.id,
          contract_number: c.contract_number,
          contract_name: c.contract_name,
          contract_category: c.contract_category,
          client_name: c.project?.client_name || null
        };
      });

      const profileMap = {};
      (profileRes.data || []).forEach(p => {
        profileMap[p.id] = p;
      });

      const enriched = data.map(r => ({
        ...r,
        contract: contractMap[r.contract_id] || null,
        generated_by_profile: profileMap[r.generated_by] || null
      }));

      console.log(`✅ Fetched ${enriched.length} reports`);
      return enriched;

    } catch (error) {
      console.error('❌ Failed to fetch report history:', error);
      throw error;
    }
  }

  /**
   * Save a completed report to generated_reports table.
   */
  async saveReportHistory({ contractId, reportType, reportTitle, entryIds, options, periodStart, periodEnd }) {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase.from('generated_reports').insert({
        contract_id:  contractId,
        report_type:  reportType || 'custom',
        report_title: reportTitle,
        entry_ids:    entryIds,
        options:      options || {},
        period_start: periodStart,
        period_end:   periodEnd,
        generated_by: user?.id,
        generated_at: new Date().toISOString()
      });

      if (error) {
        throw error;
      }
      console.log('✅ Report saved to history');
      return { success: true };

    } catch (error) {
      console.error('❌ Failed to save report history:', error);
      return { success: false, error: error.message };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REPORT STATISTICS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get aggregated report statistics for a contract or globally.
   */
  async getReportStats(filters = {}) {
    try {
      console.log('📊 Fetching report stats...');

      let query = supabase
        .from('generated_reports')
        .select('id, contract_id, generated_at, report_type');

      if (filters.contractId) {
        query = query.eq('contract_id', filters.contractId);
      }

      const { data, error } = await query;
      if (error) {
        throw error;
      }

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfWeek  = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      const startOfDay = new Date(now.setHours(0, 0, 0, 0));

      const stats = {
        total: data.length,
        thisMonth: 0,
        thisWeek: 0,
        today: 0,
        lastGenerated: null,
        byType: {}
      };

      data.forEach(report => {
        const genAt = new Date(report.generated_at);
        if (genAt >= startOfMonth) {
          stats.thisMonth++;
        }
        if (genAt >= startOfWeek)  {
          stats.thisWeek++;
        }
        if (genAt >= startOfDay)   {
          stats.today++;
        }

        if (!stats.lastGenerated || genAt > new Date(stats.lastGenerated)) {
          stats.lastGenerated = report.generated_at;
        }

        const type = report.report_type || 'Unknown';
        stats.byType[type] = (stats.byType[type] || 0) + 1;
      });

      console.log('✅ Stats calculated:', stats);
      return stats;

    } catch (error) {
      console.error('❌ Failed to fetch report stats:', error);
      throw error;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UTILITIES
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Generate a descriptive filename for the PDF download.
   */
  generateFilename(template, entries, layout = null) {
    const contractCategory = template?.contract_category || 'REPORT';
    const layoutName = layout?.layout_name.replace(/\s+/g, '_') || 'standard';
    const dateStr    = new Date().toISOString().split('T')[0];
    const entryCount = entries.length;
    return `WorkLedger_${contractCategory}_${layoutName}_${entryCount}entries_${dateStr}.pdf`;
  }

  /**
   * Add page number footers to a jsPDF document.
   */
  addPageNumbers(pdf) {
    const pageCount  = pdf.internal.getNumberOfPages();
    const pageWidth  = pdf.internal.pageSize.width;
    const pageHeight = pdf.internal.pageSize.height;

    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(128, 128, 128);
      pdf.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    }
  }

  /**
   * Trigger a browser download of a PDF blob.
   */
  downloadPDF(blob, filename) {
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href     = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    console.log('💾 PDF downloaded:', filename);
  }

  /**
   * Open PDF blob in a new browser tab.
   */
  openPDFInNewTab(blob) {
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    console.log('🔗 PDF opened in new tab');
  }

  /**
   * Load PDF blob into an existing <iframe> element for inline preview.
   */
  previewPDFInIframe(blob, iframeElement) {
    const url = URL.createObjectURL(blob);
    iframeElement.src = url;
    console.log('👁️ PDF preview loaded in iframe');
  }
}

// Singleton export — import { reportService } from '...'
export const reportService = new ReportService();
