/**
 * WorkLedger - PDF Generation Service (CONSOLIDATED)
 * 
 * Bridges reportService.js to the template-driven PDF system.
 * Uses pdfHelpers.js + pdfLayouts.js for professional output.
 * 
 * Flow:
 *   reportService.generateReport(entryIds, options)
 *     → pdfService.generatePDF(reportData, options)  ← THIS FILE
 *       → pdfLayouts.renderTwoColumn / renderChecklist / etc.
 *       → pdfHelpers.embedImage / formatFieldValue / etc.
 * 
 * @module services/pdf/pdfService
 * @created February 5, 2026 - Session 18
 * @updated February 6, 2026 - Consolidated with pdfGenerator template-driven logic
 */

import jsPDF from 'jspdf';
import {
  formatDate,
  formatDateTime,
  checkPageBreak,
  addPageNumbers,
  drawHorizontalLine,
  drawBox
} from './pdfHelpers';
import {
  renderTwoColumn,
  renderSingleColumn,
  renderChecklist,
  renderTable,
  renderMetricsCards,
  renderSignatureBox,
  renderPhotoGrid
} from './pdfLayouts';

class PDFService {
  /**
   * Generate PDF from report data (called by reportService)
   * 
   * @param {Object} reportData - { entries, metadata } from reportService
   * @param {Object} options - PDF generation options
   * @returns {Object} { blob, filename, pdf }
   */
  async generatePDF(reportData, options = {}) {
    try {
      console.log('📄 Generating PDF with template-driven layouts...');
      
      const { entries, metadata } = reportData;
      
      if (!entries || entries.length === 0) {
        throw new Error('No entries to generate PDF from');
      }

      // Create PDF document
      const pdf = new jsPDF({
        orientation: options.orientation || 'portrait',
        unit: 'mm',
        format: options.pageSize || 'a4'
      });

      let yPos = 20;

      // 1. Render report header
      yPos = this.renderReportHeader(pdf, metadata, yPos);

      // 2. Render contract info
      if (metadata.contract) {
        yPos = this.renderContractInfo(pdf, metadata.contract, yPos);
      }

      // 3. Render each work entry
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        
        // Get per-entry selection (if available)
        const entrySelection = options.entrySelections?.[entry.id];

        // Add page break between entries (except first)
        if (i > 0) {
          pdf.addPage();
          yPos = 20;

          // Per-entry logo: repeat header on new pages if includeLogo is true
          if (entrySelection?.includeLogo !== false) {
            yPos = this.renderReportHeader(pdf, metadata, yPos);
          }
        }

        // Entry header
        yPos = this.renderEntryHeader(pdf, entry, i + 1, entries.length, yPos);

        // Check if entry has template with pdf_layout (template-driven)
        if (entry.template?.pdf_layout?.sections && entry.template?.fields_schema?.sections) {
          // ✅ TEMPLATE-DRIVEN RENDERING (professional output)
          yPos = await this.renderTemplatedriven(pdf, entry, options, yPos);
        } else {
          // ⚠️ FALLBACK: Simple key-value rendering (no template)
          yPos = this.renderSimpleData(pdf, entry, yPos, options);
        }

        // Render attachments (photos + signatures) — respects per-entry field selections
        yPos = await this.renderAttachments(pdf, entry, options, yPos);
      }

      // 4. Add page numbers and footer
      this.renderFooterOnAllPages(pdf, metadata);
      addPageNumbers(pdf);

      // 5. Generate output
      const blob = pdf.output('blob');
      const filename = this.generateFilename(metadata);

      console.log('✅ PDF generated:', filename, `(${entries.length} entries)`);

      return { pdf, blob, filename };

    } catch (error) {
      console.error('❌ Failed to generate PDF:', error);
      throw error;
    }
  }

  // ============================================
  // HEADER RENDERING
  // ============================================

  /**
   * Render report header (title + date range)
   */
  renderReportHeader(pdf, metadata, yPos) {
    const marginLeft = 20;
    const pageWidth = pdf.internal.pageSize.width;

    // Logo text
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(59, 130, 246); // Primary blue
    pdf.text('WORKLEDGER', marginLeft, yPos);

    // Generated date (right-aligned)
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(128, 128, 128);
    pdf.text(
      `Generated: ${formatDateTime(metadata.generatedAt)}`,
      pageWidth - 20,
      yPos,
      { align: 'right' }
    );
    yPos += 8;

    // Report title
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(0, 0, 0);
    pdf.text('WORK REPORT', marginLeft, yPos);
    yPos += 7;

    // Date range
    if (metadata.dateRange?.from && metadata.dateRange?.to) {
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(80, 80, 80);
      pdf.text(
        `Period: ${formatDate(metadata.dateRange.from)} to ${formatDate(metadata.dateRange.to)}`,
        marginLeft,
        yPos
      );
      yPos += 5;

      // Entry count
      pdf.setFontSize(9);
      pdf.text(`Total Entries: ${metadata.totalEntries}`, marginLeft, yPos);
      yPos += 5;
    }

    // Separator
    drawHorizontalLine(pdf, yPos, marginLeft);
    yPos += 8;

    return yPos;
  }

  /**
   * Render contract information block
   */
  renderContractInfo(pdf, contract, yPos) {
    const marginLeft = 20;
    const pageWidth = pdf.internal.pageSize.width;
    const rightX = pageWidth / 2 + 10;

    // Section title
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(0, 0, 0);
    pdf.text('CONTRACT INFORMATION', marginLeft, yPos);
    yPos += 6;

    pdf.setFontSize(9);

    // Row 1: Contract No + Type
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(80, 80, 80);
    pdf.text('Contract:', marginLeft, yPos);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(0, 0, 0);
    pdf.text(contract.contract_number || '-', marginLeft + 28, yPos);

    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(80, 80, 80);
    pdf.text('Type:', rightX, yPos);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(0, 0, 0);
    pdf.text(contract.contract_type || '-', rightX + 15, yPos);
    yPos += 5;

    // Row 2: Contract Name + Category
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(80, 80, 80);
    pdf.text('Name:', marginLeft, yPos);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(0, 0, 0);
    const nameText = contract.contract_name || '-';
    pdf.text(nameText.substring(0, 50), marginLeft + 28, yPos);

    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(80, 80, 80);
    pdf.text('Category:', rightX, yPos);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(0, 0, 0);
    const category = contract.contract_category?.replace(/-/g, ' ').toUpperCase() || '-';
    pdf.text(category, rightX + 22, yPos);
    yPos += 5;

    // Row 3: Client + Project
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(80, 80, 80);
    pdf.text('Client:', marginLeft, yPos);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(0, 0, 0);
    pdf.text(
      contract.project?.client_name || contract.project?.organization?.name || '-',
      marginLeft + 28,
      yPos
    );

    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(80, 80, 80);
    pdf.text('Project:', rightX, yPos);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(0, 0, 0);
    pdf.text(contract.project?.project_name || '-', rightX + 18, yPos);
    yPos += 5;

    // Row 4: Period
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(80, 80, 80);
    pdf.text('Period:', marginLeft, yPos);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(0, 0, 0);
    pdf.text(
      `${formatDate(contract.valid_from)} to ${formatDate(contract.valid_until)}`,
      marginLeft + 28,
      yPos
    );
    yPos += 7;

    // Separator
    drawHorizontalLine(pdf, yPos, marginLeft);
    yPos += 8;

    return yPos;
  }

  // ============================================
  // ENTRY RENDERING
  // ============================================

  /**
   * Render entry header (entry number, date, status)
   */
  renderEntryHeader(pdf, entry, entryNumber, totalEntries, yPos) {
    const marginLeft = 20;
    const pageWidth = pdf.internal.pageSize.width;

    // Entry title bar
    drawBox(pdf, marginLeft, yPos - 4, pageWidth - 40, 10, {
      fillColor: [243, 244, 246], // gray-100
      strokeColor: [209, 213, 219], // gray-300
      lineWidth: 0.3
    });

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(0, 0, 0);
    pdf.text(
      `Entry ${entryNumber} of ${totalEntries}: ${formatDate(entry.entry_date)}`,
      marginLeft + 3,
      yPos + 2
    );

    // Status badge
    const statusColors = {
      draft: [245, 158, 11],    // amber
      submitted: [59, 130, 246], // blue
      approved: [16, 185, 129],  // green
      rejected: [239, 68, 68]    // red
    };
    const statusColor = statusColors[entry.status] || [107, 114, 128];
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...statusColor);
    pdf.text(entry.status.toUpperCase(), pageWidth - 22, yPos + 2, { align: 'right' });

    yPos += 10;

    // Reported by + shift
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(100, 100, 100);

    const meta = [];
    if (entry.created_by_profile?.full_name) {
      meta.push(`Reported by: ${entry.created_by_profile.full_name}`);
    }
    if (entry.shift) {
      meta.push(`Shift: ${entry.shift}`);
    }
    if (meta.length > 0) {
      pdf.text(meta.join('  |  '), marginLeft, yPos);
      yPos += 5;
    }

    pdf.setTextColor(0, 0, 0);
    yPos += 3;

    return yPos;
  }

  // ============================================
  // TEMPLATE-DRIVEN RENDERING (Professional)
  // ============================================

  /**
   * Render entry using template's pdf_layout sections
   * Routes each section to the appropriate layout renderer
   * 
   * Respects options.entrySelections[entryId].fields for per-field filtering:
   *   - If field key is false in the map, that field is excluded
   *   - Sections with ALL fields excluded are skipped entirely
   */
  async renderTemplatedriven(pdf, entry, options, yPos) {
    const template = entry.template;
    const data = entry.data || {};
    const attachments = entry.attachments || [];
    
    // Per-entry field selection map
    const entrySelection = options.entrySelections?.[entry.id];
    const fieldSelections = entrySelection?.fields; // { 'section.field': true/false }

    // Loop through pdf_layout sections
    for (const sectionLayout of template.pdf_layout.sections) {
      // Find matching section in fields_schema
      const section = template.fields_schema.sections.find(
        s => s.section_id === sectionLayout.section_id
      );

      if (!section) {
        console.warn('⚠️ Section not found:', sectionLayout.section_id);
        continue;
      }

      // Determine layout type early (needed for field filtering)
      const layout = sectionLayout.layout || 'single_column';

      // ── Per-entry field filtering ──
      // Create a filtered copy of the section with only selected fields
      let filteredSection = section;
      
      // Attachment field types — rendered in attachments section, not in Entry Details
      const ATTACHMENT_FIELD_TYPES = ['photo', 'signature', 'file', 'image'];
      const isAttachmentLayout = layout === 'photo_grid' || layout === 'signature_box';
      
      {
        let selectedFields = section.fields;
        
        // 1. Remove user-deselected fields (per-entry selections)
        if (fieldSelections) {
          selectedFields = selectedFields.filter(field => {
            const fieldKey = `${section.section_id}.${field.field_id}`;
            return fieldSelections[fieldKey] !== false;
          });
        }
        
        // 2. For non-attachment layouts (two_column, single_column, checklist, etc.),
        //    strip out photo/signature/file fields — those only render in photo_grid/signature_box
        if (!isAttachmentLayout) {
          selectedFields = selectedFields.filter(field => {
            return !ATTACHMENT_FIELD_TYPES.includes(field.field_type);
          });
        }

        // Skip section entirely if ALL its fields were removed
        if (selectedFields.length === 0) {
          continue;
        }

        filteredSection = { ...section, fields: selectedFields };
      }

      // Evaluate show_if condition
      if (sectionLayout.show_if) {
        const shouldShow = this.evaluateCondition(sectionLayout.show_if, data);
        if (!shouldShow) {
          continue;
        }
      }

      // Check page break (estimate section needs at least 30mm)
      yPos = checkPageBreak(pdf, yPos, 30);

      // Route to appropriate layout renderer (uses filteredSection)

      switch (layout) {
        case 'two_column':
          yPos = renderTwoColumn(pdf, filteredSection, data, yPos);
          break;

        case 'single_column':
          yPos = renderSingleColumn(pdf, filteredSection, data, yPos);
          break;

        case 'checklist':
          yPos = renderChecklist(pdf, filteredSection, data, sectionLayout, yPos);
          break;

        case 'table':
          yPos = renderTable(pdf, filteredSection, data, sectionLayout, yPos);
          break;

        case 'metrics_cards':
          yPos = renderMetricsCards(pdf, filteredSection, data, sectionLayout, yPos);
          break;

        case 'signature_box': {
          // Check if signature field is selected
          const sigField = filteredSection.fields.find(f => f.field_type === 'signature');
          if (!sigField) {
            break;
          } // field was deselected
          
          const sigFieldKey = `${section.section_id}.${sigField.field_id}`;
          if (fieldSelections && fieldSelections[sigFieldKey] === false) {
            break;
          }
          
          let sigAttachment = attachments.find(a =>
            a.field_id === sigFieldKey &&
            (a.file_type === 'signature' || a.attachment_type === 'signature')
          );
          
          // Enrich signature with descriptive context
          if (sigAttachment) {
            sigAttachment = this.enrichSignature(sigAttachment, entry);
          }
          
          yPos = await renderSignatureBox(pdf, filteredSection, data, yPos, sigAttachment);
          break;
        }

        case 'photo_grid': {
          // Check if any photo fields in this section are selected
          const photoFieldKeys = filteredSection.fields
            .filter(f => f.field_type === 'photo' || f.field_type === 'file')
            .map(f => `${section.section_id}.${f.field_id}`);
          
          if (photoFieldKeys.length === 0) {
            break;
          } // all photo fields deselected
          
          const sectionPhotos = attachments.filter(a =>
            a.field_id?.startsWith(`${section.section_id}.`) &&
            (a.file_type === 'photo' || a.attachment_type === 'photo')
          );
          
          // Enrich photos with descriptive captions
          const enrichedPhotos = this.enrichPhotos(sectionPhotos, entry);
          
          // Pass section title to layout
          const photoLayout = {
            ...sectionLayout,
            title: filteredSection.section_name || 'Photo Documentation'
          };
          
          yPos = await renderPhotoGrid(pdf, enrichedPhotos, photoLayout, yPos);
          break;
        }

        default:
          console.warn('⚠️ Unknown layout type:', layout, '- using single_column');
          yPos = renderSingleColumn(pdf, filteredSection, data, yPos);
      }
    }

    return yPos;
  }

  // ============================================
  // FALLBACK: Simple Data Rendering
  // ============================================

  /**
   * Render entry data as simple key-value pairs (when no template available)
   * Respects per-entry field selections from options.entrySelections
   */
  renderSimpleData(pdf, entry, yPos, options = {}) {
    const data = entry.data || {};
    const marginLeft = 20;
    
    // Per-entry field selection
    const entrySelection = options.entrySelections?.[entry.id];
    const fieldSelections = entrySelection?.fields;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Entry Details', marginLeft, yPos);
    yPos += 6;
    drawHorizontalLine(pdf, yPos, marginLeft);
    yPos += 5;

    Object.entries(data).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') {
        return;
      }
      
      // Skip if field is deselected in per-entry selections
      if (fieldSelections && fieldSelections[key] === false) {
        return;
      }
      
      // Skip attachment-type fields in Entry Details (they render in attachments section)
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes('photo') || lowerKey.includes('signature') || lowerKey.includes('image')) {
        return;
      }

      yPos = checkPageBreak(pdf, yPos, 10);

      // Format key
      const formattedKey = key.split('.').pop().replace(/_/g, ' ');
      const capitalizedKey = formattedKey.charAt(0).toUpperCase() + formattedKey.slice(1);

      // Format value
      let formattedValue = value;
      if (typeof value === 'object') {
        formattedValue = JSON.stringify(value);
      } else if (typeof value === 'boolean') {
        formattedValue = value ? 'Yes' : 'No';
      }

      // Render
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(80, 80, 80);
      pdf.text(`${capitalizedKey}:`, marginLeft, yPos);

      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(0, 0, 0);
      const lines = pdf.splitTextToSize(String(formattedValue), 120);
      pdf.text(lines, marginLeft + 45, yPos);
      yPos += (lines.length * 5) + 2;
    });

    return yPos + 3;
  }

  // ============================================
  // ATTACHMENTS RENDERING
  // ============================================

  /**
   * Render photos and signatures that aren't part of template sections
   * Respects per-entry field selections from options.entrySelections
   */
  async renderAttachments(pdf, entry, options, yPos) {
    const attachments = entry.attachments || [];
    if (attachments.length === 0) {
      return yPos;
    }
    
    // Per-entry field selection
    const entrySelection = options.entrySelections?.[entry.id];
    const fieldSelections = entrySelection?.fields;

    /**
     * Check if a photo/signature attachment's field is selected.
     * If no fieldSelections map exists, include by default (backward compat).
     * If fieldSelections exists, check if ANY photo/signature field key is selected.
     */
    const isFieldTypeSelected = (fieldType) => {
      if (!fieldSelections) {
        return true;
      } // no per-field selection → include all
      
      // Check if any field of this type is still selected
      return Object.entries(fieldSelections).some(([key, selected]) => {
        if (!selected) {
          return false;
        }
        const lowerKey = key.toLowerCase();
        if (fieldType === 'photo') {
          return lowerKey.includes('photo') || lowerKey.includes('image');
        }
        if (fieldType === 'signature') {
          return lowerKey.includes('signature');
        }
        return false;
      });
    };

    // Photos (not already rendered by template sections)
    if (isFieldTypeSelected('photo')) {
      const photos = attachments.filter(a =>
        (a.file_type === 'photo' || a.attachment_type === 'photo')
      );

      // Only render standalone photos if no template-driven photo_grid handled them
      if (photos.length > 0 && !entry.template?.pdf_layout?.sections?.some(s => s.layout === 'photo_grid')) {
        yPos = checkPageBreak(pdf, yPos, 50);
        
        // Enrich photos with descriptive captions from template
        const enrichedPhotos = this.enrichPhotos(photos, entry);
        
        // Group by field label for better organization
        const photosByField = {};
        enrichedPhotos.forEach(p => {
          const group = p.sectionTitle || 'Photo Documentation';
          if (!photosByField[group]) {
            photosByField[group] = [];
          }
          photosByField[group].push(p);
        });
        
        // Render each group with its own title
        for (const [title, groupPhotos] of Object.entries(photosByField)) {
          yPos = await renderPhotoGrid(pdf, groupPhotos, { columns: 2, title }, yPos);
        }
      }
    }

    // Signatures (not already rendered by template sections)
    if (isFieldTypeSelected('signature')) {
      const signatures = attachments.filter(a =>
        (a.file_type === 'signature' || a.attachment_type === 'signature')
      );

      // Only render standalone signatures if no template-driven signature_box handled them
      if (signatures.length > 0 && !entry.template?.pdf_layout?.sections?.some(s => s.layout === 'signature_box')) {
        for (const sig of signatures) {
          yPos = checkPageBreak(pdf, yPos, 50);

          // Enrich signature with descriptive label
          const enriched = this.enrichSignature(sig, entry);
          
          const marginLeft = 20;
          
          // Descriptive title (e.g., "Worker Signature", "Supervisor Signature")
          pdf.setFontSize(11);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(0, 0, 0);
          pdf.text(enriched.caption, marginLeft, yPos);
          yPos += 6;
          drawHorizontalLine(pdf, yPos, marginLeft);
          yPos += 5;

          // Signature box with border
          const sigWidth = 60;
          const sigHeight = 30;
          pdf.setDrawColor(180, 180, 180);
          pdf.setLineWidth(0.5);
          pdf.rect(marginLeft, yPos, sigWidth, sigHeight);

          const { embedSignature: embedSig } = await import('./pdfHelpers');
          await embedSig(pdf, sig.storage_url, marginLeft, yPos, sigWidth, sigHeight);
          yPos += sigHeight + 3;
          
          // Signed timestamp
          if (enriched.capturedAt) {
            pdf.setFontSize(7);
            pdf.setFont('helvetica', 'italic');
            pdf.setTextColor(100, 100, 100);
            pdf.text(`Signed: ${enriched.capturedAt}`, marginLeft, yPos);
            yPos += 5;
            pdf.setTextColor(0, 0, 0);
          }
          
          yPos += 5;
        }
      }
    }

    return yPos;
  }

  // ============================================
  // FOOTER
  // ============================================

  /**
   * Render footer on all pages
   */
  renderFooterOnAllPages(pdf, metadata) {
    const pageCount = pdf.internal.getNumberOfPages();
    const pageWidth = pdf.internal.pageSize.width;
    const pageHeight = pdf.internal.pageSize.height;
    const marginLeft = 20;

    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);

      const footerY = pageHeight - 15;

      // Footer line
      drawHorizontalLine(pdf, footerY - 3, marginLeft);

      // Footer text
      pdf.setFontSize(7);
      pdf.setTextColor(128, 128, 128);
      pdf.setFont('helvetica', 'normal');

      // Left: Generated info
      pdf.text(
        `Generated by WorkLedger on ${formatDateTime(metadata.generatedAt)}`,
        marginLeft,
        footerY
      );

      // Right: Contract
      if (metadata.contract?.contract_number) {
        pdf.text(
          metadata.contract.contract_number,
          pageWidth - marginLeft,
          footerY,
          { align: 'right' }
        );
      }
    }

    // Reset text color
    pdf.setTextColor(0, 0, 0);
  }

  // ============================================
  // ATTACHMENT ENRICHMENT
  // ============================================

  /**
   * Resolve human-readable field label from template via field_id
   * E.g., field_id "documentation.photos_before" → "Photos Before Work"
   * 
   * @param {Object} template - Template with fields_schema
   * @param {string} fieldId - e.g., "documentation.photos_before"
   * @returns {string} Human-readable label or formatted fallback
   */
  resolveFieldLabel(template, fieldId) {
    if (!template?.fields_schema?.sections || !fieldId) {
      return null;
    }
    
    const parts = fieldId.split('.');
    if (parts.length < 2) {
      return null;
    }
    
    const sectionId = parts[0];
    const fId = parts.slice(1).join('.');
    
    const section = template.fields_schema.sections.find(s => s.section_id === sectionId);
    if (!section) {
      return null;
    }
    
    const field = section.fields?.find(f => f.field_id === fId);
    return field?.field_name || null;
  }

  /**
   * Resolve section name from template via field_id
   * E.g., field_id "signoff.worker_signature" → "Worker Sign-Off"
   */
  resolveSectionName(template, fieldId) {
    if (!template?.fields_schema?.sections || !fieldId) {
      return null;
    }
    const sectionId = fieldId.split('.')[0];
    const section = template.fields_schema.sections.find(s => s.section_id === sectionId);
    return section?.section_name || null;
  }

  /**
   * Format attachment timestamp for display
   * @param {string} isoDate - ISO date string (created_at)
   * @returns {string} e.g., "05/02/2026 at 09:15 AM"
   */
  formatAttachmentTimestamp(isoDate) {
    if (!isoDate) {
      return '';
    }
    try {
      const d = new Date(isoDate);
      const date = d.toLocaleDateString('en-GB'); // DD/MM/YYYY
      const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      return `${date} at ${time}`;
    } catch {
      return '';
    }
  }

  /**
   * Enrich photo attachments with comprehensive descriptive context
   * 
   * Answers: WHAT, WHERE, WHEN, WHO
   *   WHAT  → field_name from template (e.g., "Photos Before Work")
   *   WHERE → site_address / client_name from contract → project
   *   WHEN  → attachment.created_at (uploaded) + entry.entry_date (work date)
   *   WHO   → created_by_profile.full_name (who uploaded)
   * 
   * Before: { file_name: "photo_20260205T172759_keeip6j0.jpg", field_id: "documentation.photos_before" }
   * After:  {
   *   ...original,
   *   sectionTitle: "Photos Before Work",
   *   caption:      "Photos Before Work",
   *   capturedAt:   "05/02/2026, 17:27",
   *   capturedBy:   "Ahmad bin Hassan",
   *   location:     "KLCC Tower, Jalan Ampang",
   *   entryDate:    "05/02/2026"
   * }
   */
  enrichPhotos(photos, entry) {
    const template = entry.template;
    const entryDate = formatDate(entry.entry_date);
    const uploaderName = entry.created_by_profile?.full_name || '';
    const siteName = entry.contract?.project?.client_name || '';
    const siteAddress = entry.contract?.project?.site_address || '';
    const location = siteAddress || siteName || '';

    // Group photos by field_id to number them within each group
    const fieldCounts = {};
    photos.forEach(p => {
      fieldCounts[p.field_id] = (fieldCounts[p.field_id] || 0) + 1;
    });
    const fieldIndex = {};

    return photos.map((photo) => {
      // Track index per field group
      fieldIndex[photo.field_id] = (fieldIndex[photo.field_id] || 0) + 1;
      const indexInGroup = fieldIndex[photo.field_id];
      const totalInGroup = fieldCounts[photo.field_id] || 1;

      // WHAT — resolve from template
      const fieldLabel = this.resolveFieldLabel(template, photo.field_id);
      const sectionName = this.resolveSectionName(template, photo.field_id);
      const whatLabel = fieldLabel || sectionName || 'Photo Documentation';

      // Section title for the photo grid heading
      const sectionTitle = whatLabel;

      // Caption line 1: WHAT + numbering if multiple in same field
      let caption = whatLabel;
      if (totalInGroup > 1) {
        caption = `${whatLabel} (${indexInGroup} of ${totalInGroup})`;
      }

      // WHEN — upload timestamp
      const capturedAt = this.formatAttachmentTimestamp(photo.created_at);

      // WHO — uploader name
      const capturedBy = uploaderName;

      // Build descriptive sub-caption: "Ahmad bin Hassan · 05/02/2026, 17:27"
      const subParts = [];
      if (capturedBy) {
        subParts.push(capturedBy);
      }
      if (capturedAt) {
        subParts.push(capturedAt);
      }
      const subCaption = subParts.join(' · ') || `Entry: ${entryDate}`;

      return {
        ...photo,
        sectionTitle,
        caption,
        capturedAt: subCaption,
        capturedBy,
        location,
        entryDate
      };
    });
  }

  /**
   * Enrich a signature attachment with comprehensive descriptive context
   * 
   * Answers: WHOSE signature, WHEN signed
   *   WHOSE → Look up companion name field in same template section
   *           (e.g., worker_name next to worker_signature)
   *           Falls back to field_name label, then created_by_profile
   *   WHEN  → attachment.created_at
   * 
   * Before: { file_name: "sig_20260205T173000.png", field_id: "signoff.worker_signature" }
   * After:  {
   *   ...original,
   *   caption:    "Worker Signature — Ahmad bin Hassan",
   *   capturedAt: "05/02/2026, 17:30",
   *   signerName: "Ahmad bin Hassan"
   * }
   */
  enrichSignature(sig, entry) {
    const template = entry.template;
    const data = entry.data || {};

    // Resolve the field label (e.g., "Worker Signature")
    const fieldLabel = this.resolveFieldLabel(template, sig.field_id) || 'Signature';

    // Try to find WHO signed from companion fields in the same section
    const signerName = this.resolveSignerName(template, data, sig.field_id, entry);

    // Build caption: "Worker Signature — Ahmad bin Hassan" or just "Worker Signature"
    const caption = signerName
      ? `${fieldLabel} — ${signerName}`
      : fieldLabel;

    // WHEN
    const capturedAt = this.formatAttachmentTimestamp(sig.created_at);

    return {
      ...sig,
      caption,
      capturedAt,
      signerName
    };
  }

  /**
   * Resolve who signed from companion fields in the same template section
   * 
   * Strategy:
   *   1. Look for companion name/text fields in same section (e.g., worker_name, supervisor_name)
   *   2. Fall back to entry.created_by_profile.full_name
   * 
   * @param {Object} template - Template with fields_schema
   * @param {Object} data - Work entry data (JSONB)
   * @param {string} sigFieldId - e.g., "signoff.worker_signature"
   * @param {Object} entry - Full work entry (for created_by_profile fallback)
   * @returns {string} Signer name or empty string
   */
  resolveSignerName(template, data, sigFieldId, entry) {
    if (!template?.fields_schema?.sections || !sigFieldId) {
      return entry.created_by_profile?.full_name || '';
    }

    const sectionId = sigFieldId.split('.')[0];
    const section = template.fields_schema.sections.find(s => s.section_id === sectionId);
    if (!section?.fields) {
      return entry.created_by_profile?.full_name || '';
    }

    // Look for companion name field — common patterns:
    //   worker_name, supervisor_name, technician_name, signer_name, name, full_name
    const nameHints = ['name', 'full_name', 'signer', 'technician', 'verified_by', 'approved_by'];
    
    for (const field of section.fields) {
      if (field.field_type === 'signature') {
        continue;
      } // skip the signature field itself
      
      const lowerFieldId = field.field_id.toLowerCase();
      const isNameField = nameHints.some(hint => lowerFieldId.includes(hint));
      
      if (isNameField) {
        const fieldPath = `${sectionId}.${field.field_id}`;
        const value = data[fieldPath];
        if (value && typeof value === 'string' && value.trim()) {
          return value.trim();
        }
      }
    }

    // Fallback: first non-signature text field in the section that has a value
    for (const field of section.fields) {
      if (field.field_type === 'signature') {
        continue;
      }
      if (field.field_type === 'text' || field.field_type === 'short_text') {
        const fieldPath = `${sectionId}.${field.field_id}`;
        const value = data[fieldPath];
        if (value && typeof value === 'string' && value.trim()) {
          return value.trim();
        }
      }
    }

    // Final fallback: user profile who created the entry
    return entry.created_by_profile?.full_name || '';
  }

  // ============================================
  // UTILITIES
  // ============================================

  /**
   * Evaluate show_if condition
   */
  evaluateCondition(condition, data) {
    try {
      if (condition.includes('===')) {
        const [field, value] = condition.split('===').map(s => s.trim());
        const fieldValue = this.getFieldValue(data, field);
        const expectedValue = value.replace(/['"]/g, '').trim();

        if (expectedValue === 'true') {
          return fieldValue === true;
        }
        if (expectedValue === 'false') {
          return fieldValue === false;
        }
        return String(fieldValue) === expectedValue;
      }

      if (condition.includes('!==')) {
        const [field, value] = condition.split('!==').map(s => s.trim());
        const fieldValue = this.getFieldValue(data, field);
        const expectedValue = value.replace(/['"]/g, '').trim();

        if (expectedValue === 'true') {
          return fieldValue !== true;
        }
        if (expectedValue === 'false') {
          return fieldValue !== false;
        }
        return String(fieldValue) !== expectedValue;
      }

      return true; // Default: show
    } catch (error) {
      console.error('❌ Error evaluating condition:', error);
      return true;
    }
  }

  /**
   * Get field value from data object
   */
  getFieldValue(data, path) {
    path = path.replace(/^data\./, '');
    return data[path];
  }

  /**
   * Generate filename for PDF
   */
  generateFilename(metadata) {
    const contract = metadata.contract;
    const date = new Date().toISOString().split('T')[0];
    const contractNum = (contract?.contract_number || 'REPORT').replace(/[^a-zA-Z0-9]/g, '-');
    return `WorkLedger_${contractNum}_${date}.pdf`;
  }

  /**
   * Download PDF file
   */
  downloadPDF(blob, filename) {
    try {
      console.log('💾 Downloading PDF:', filename);

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => URL.revokeObjectURL(url), 100);
      console.log('✅ PDF download triggered');
    } catch (error) {
      console.error('❌ Failed to download PDF:', error);
      throw error;
    }
  }

  /**
   * Open PDF in new tab
   */
  openInNewTab(blob) {
    try {
      console.log('🔗 Opening PDF in new tab');

      const url = URL.createObjectURL(blob);
      const newWindow = window.open(url, '_blank');

      if (!newWindow) {
        throw new Error('Popup blocked. Please allow popups for this site.');
      }

      setTimeout(() => URL.revokeObjectURL(url), 60000);
      console.log('✅ PDF opened in new tab');
    } catch (error) {
      console.error('❌ Failed to open PDF:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const pdfService = new PDFService();

// Export class for testing
export default PDFService;
