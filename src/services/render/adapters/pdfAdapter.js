/**
 * WorkLedger - PDF Adapter
 * 
 * Converts Render Tree (IR) to PDF using jsPDF.
 * Delegates to existing pdfLayouts.js renderers for actual rendering.
 * 
 * @module services/render/adapters/pdfAdapter
 * @created February 12, 2026 - Session 2
 */

import jsPDF from 'jspdf';
import {
  renderTwoColumn,
  renderSingleColumn,
  renderChecklist,
  renderTable,
  renderMetricsCards,
  renderSignatureBox,
  renderPhotoGrid
} from '../../pdf/pdfLayouts';
import {
  formatDate,
  formatDateTime,
  checkPageBreak,
  drawHorizontalLine
} from '../../pdf/pdfHelpers';

class PDFAdapter {
  /**
   * Convert Render Tree to PDF
   * 
   * @param {Object} renderTree - Intermediate Representation
   * @param {Array} attachments - Photos and signatures (for embedding)
   * @param {jsPDF} existingPdf - Optional existing PDF instance (for multi-entry)
   * @returns {jsPDF} PDF document
   */
  async render(renderTree, attachments = [], existingPdf = null) {
    console.log('📄 PDFAdapter: Rendering PDF from Render Tree...');
    
    // Create or use existing PDF
    const pdf = existingPdf || new jsPDF({
      orientation: renderTree.page.orientation || 'portrait',
      unit: 'mm',
      format: renderTree.page.size || 'A4'
    });
    
    let yPos = 20;
    
    // Render header (metadata)
    yPos = this.renderPDFHeader(pdf, renderTree.metadata, yPos);
    
    // Render each block
    for (const block of renderTree.blocks) {
      yPos = await this.renderBlock(pdf, block, yPos, attachments);
      
      // Check page break
      yPos = checkPageBreak(pdf, yPos, 40);
    }
    
    console.log('✅ PDF rendered');
    return pdf;
  }
  
  /**
   * Render PDF header (contract info, report title)
   */
  renderPDFHeader(pdf, metadata, yPos) {
    const marginLeft = 20;
    const pageWidth = pdf.internal.pageSize.width;
    const contentWidth = pageWidth - 40;
    const reportTitle = metadata.template?.name || 'Work Report';
    const status = (metadata.status || 'draft').toUpperCase();
    const statusStyle = this.getStatusStyle(metadata.status);
    
    // Brand
    pdf.setFontSize(15);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(15, 23, 42);
    pdf.text('WORKLEDGER', marginLeft, yPos);
    
    // Generated date
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(100, 116, 139);
    pdf.text(
      `Generated: ${formatDateTime(metadata.generatedAt)}`,
      pageWidth - 20,
      yPos,
      { align: 'right' }
    );
    yPos += 7;
    
    // Report title and status badge
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(17, 24, 39);
    pdf.text(reportTitle, marginLeft, yPos);

    const badgeWidth = Math.max(22, pdf.getTextWidth(status) + 8);
    const badgeX = pageWidth - 20 - badgeWidth;
    pdf.setFillColor(...statusStyle.fill);
    pdf.setDrawColor(...statusStyle.stroke);
    pdf.roundedRect(badgeX, yPos - 5, badgeWidth, 7, 1.5, 1.5, 'FD');
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...statusStyle.text);
    pdf.text(status, badgeX + badgeWidth / 2, yPos - 0.5, { align: 'center' });
    yPos += 8;
    
    const details = [
      ['Contract No.', metadata.contract?.number],
      ['Contract Name', metadata.contract?.name],
      ['Client', metadata.contract?.client],
      ['Site', metadata.contract?.location],
      ['Category', metadata.contract?.category],
      ['Entry Date', metadata.entryDate ? formatDate(metadata.entryDate) : null],
      ['Shift', metadata.shift],
      ['Technician', metadata.creator?.name]
    ].filter(([, value]) => value);

    const leftColumn = details.filter((_, index) => index % 2 === 0);
    const rightColumn = details.filter((_, index) => index % 2 === 1);
    const columnWidth = (contentWidth - 8) / 2;
    const startY = yPos;

    yPos = this.renderHeaderDetailColumn(pdf, leftColumn, marginLeft, yPos, columnWidth);
    const rightY = this.renderHeaderDetailColumn(
      pdf,
      rightColumn,
      marginLeft + columnWidth + 8,
      startY,
      columnWidth
    );
    yPos = Math.max(yPos, rightY) + 2;

    if (metadata.approval?.approvedAt || metadata.approval?.rejectedAt) {
      const approvalText = metadata.approval.approvedAt
        ? `Approved by ${metadata.approval.approvedBy || 'Manager'} on ${formatDateTime(metadata.approval.approvedAt)}`
        : `Rejected by ${metadata.approval.rejectedBy || 'Manager'} on ${formatDateTime(metadata.approval.rejectedAt)}`;

      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(...statusStyle.text);
      const approvalLines = pdf.splitTextToSize(approvalText, contentWidth);
      pdf.text(approvalLines, marginLeft, yPos);
      yPos += approvalLines.length * 4;

      const note = metadata.approval.remarks || metadata.approval.rejectionReason;
      if (note) {
        pdf.setTextColor(71, 85, 105);
        const noteLines = pdf.splitTextToSize(`Note: ${note}`, contentWidth);
        pdf.text(noteLines, marginLeft, yPos);
        yPos += noteLines.length * 4;
      }
    }

    pdf.setTextColor(0, 0, 0);
    yPos += 2;
    drawHorizontalLine(pdf, yPos, marginLeft);
    yPos += 5;
    
    return yPos;
  }

  renderHeaderDetailColumn(pdf, rows, x, y, width) {
    rows.forEach(([label, value]) => {
      const valueLines = pdf.splitTextToSize(String(value), width - 25);
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(100, 116, 139);
      pdf.text(label, x, y);

      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(15, 23, 42);
      pdf.text(valueLines, x + 25, y);
      y += Math.max(4, valueLines.length * 4);
    });

    return y;
  }

  getStatusStyle(status) {
    switch ((status || '').toLowerCase()) {
      case 'approved':
        return { fill: [220, 252, 231], stroke: [34, 197, 94], text: [22, 101, 52] };
      case 'submitted':
        return { fill: [219, 234, 254], stroke: [59, 130, 246], text: [30, 64, 175] };
      case 'rejected':
        return { fill: [254, 226, 226], stroke: [239, 68, 68], text: [153, 27, 27] };
      default:
        return { fill: [241, 245, 249], stroke: [148, 163, 184], text: [51, 65, 85] };
    }
  }
  
  /**
   * Render a block based on type
   */
  async renderBlock(pdf, block, yPos, attachments) {
    console.log(`  📦 Rendering block: ${block.type}`);
    
    // Map Render Tree block to existing pdfLayouts renderer
    switch (block.type) {
      case 'header':
        return this.renderHeaderBlock(pdf, block, yPos);
        
      case 'detail_entry':
        return this.renderDetailBlock(pdf, block, yPos);
        
      case 'text_section':
        return this.renderTextBlock(pdf, block, yPos);
        
      case 'checklist':
        return await this.renderChecklistBlock(pdf, block, yPos);

      case 'table':
        return this.renderTableBlock(pdf, block, yPos);

      case 'metrics_cards':
        return this.renderMetricsBlock(pdf, block, yPos);
        
      case 'photo_grid':
        return await this.renderPhotoBlock(pdf, block, yPos, attachments);
        
      case 'signature_box':
        return await this.renderSignatureBlock(pdf, block, yPos, attachments);
        
      default:
        console.warn(`  ⚠️  Unknown block type: ${block.type}`);
        return yPos;
    }
  }
  
  /**
   * Render header block (section title)
   */
  renderHeaderBlock(pdf, block, yPos) {
    const marginLeft = 20;
    
    // Check page break
    yPos = checkPageBreak(pdf, yPos, 20);
    
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(0, 0, 0);
    
    if (block.content.title || block.options.content?.title) {
      const title = block.content.title || block.options.content?.title;
      pdf.text(title, marginLeft, yPos);
      yPos += 7;
    }
    
    if (block.content.subtitle || block.options.content?.subtitle) {
      const subtitle = block.content.subtitle || block.options.content?.subtitle;
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 100, 100);
      pdf.text(subtitle, marginLeft, yPos);
      yPos += 6;
    }
    
    pdf.setTextColor(0, 0, 0);
    yPos += 3;
    return yPos;
  }
  
  /**
   * Render detail entry block using existing two_column renderer
   */
  renderDetailBlock(pdf, block, yPos) {
    const labels = block.content._labels || {};
    const visibleEntries = Object.entries(block.content)
      .filter(([key, value]) =>
        !key.startsWith('_') &&
        value !== null &&
        value !== undefined &&
        value !== ''
      );

    if (visibleEntries.length === 0) {
      return yPos;
    }

    // Convert block.content to section format expected by pdfLayouts
    const section = {
      section_id: block.blockId,
      section_name: block.title || this.formatLabel(block.blockId),
      fields: visibleEntries
        .map(([key, value]) => ({
          field_id: key,
          field_name: labels[key] || this.formatLabel(key),
          field_type: this.guessFieldType(value)
        }))
    };
    
    const data = {};
    visibleEntries.forEach(([key, value]) => {
      data[`${block.blockId}.${key}`] = value;
    });
    
    // Check page break
    yPos = checkPageBreak(pdf, yPos, 50);
    
    // Delegate to existing renderer
    if (block.layout === 'two_column' || block.layout === 'grid' || block.options.columns === 2) {
      return renderTwoColumn(pdf, section, data, yPos);
    } else {
      return renderSingleColumn(pdf, section, data, yPos);
    }
  }
  
  /**
   * Render text section
   */
  renderTextBlock(pdf, block, yPos) {
    const marginLeft = 20;
    const maxWidth = 170;
    
    const text = block.content.text || block.content.observations || '';
    
    if (!text) {
      return yPos;
    }
    
    // Check page break
    yPos = checkPageBreak(pdf, yPos, 30);
    
    // Section title
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(0, 0, 0);
    const title = block.options.title || 'Observations';
    pdf.text(title, marginLeft, yPos);
    yPos += 6;
    
    // Text content
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    const lines = pdf.splitTextToSize(text, maxWidth);
    
    // Check if all lines fit on page
    const requiredHeight = lines.length * 5;
    yPos = checkPageBreak(pdf, yPos, requiredHeight);
    
    pdf.text(lines, marginLeft, yPos);
    yPos += (lines.length * 5) + 5;
    
    return yPos;
  }
  
  /**
   * Render checklist using existing renderer
   */
  async renderChecklistBlock(pdf, block, yPos) {
    const items = block.content.items || [];
    
    if (items.length === 0) {
      return yPos;
    }
    
    // Check page break
    yPos = checkPageBreak(pdf, yPos, 40);
    
    // Create section for pdfLayouts
    const section = {
      section_id: block.blockId,
      section_name: block.options.title || 'Checklist',
      fields: [
        { field_id: 'items', field_name: 'Checklist Items', field_type: 'checklist' }
      ]
    };
    
    const data = {
      [`${block.blockId}.items`]: items
    };
    
    const sectionLayout = {
      layout: 'checklist',
      show_status: block.options.showStatus !== false
    };
    
    return renderChecklist(pdf, section, data, sectionLayout, yPos);
  }

  /**
   * Render table block using existing table renderer.
   */
  renderTableBlock(pdf, block, yPos) {
    const rows = Array.isArray(block.content.rows) ? block.content.rows : null;
    const source = rows?.[0] || block.content;
    const labels = block.content._labels || {};
    const visibleEntries = Object.entries(source || {})
      .filter(([key, value]) =>
        !key.startsWith('_') &&
        value !== null &&
        value !== undefined &&
        value !== ''
      );

    if (visibleEntries.length === 0) {
      return yPos;
    }

    const section = {
      section_id: block.blockId,
      section_name: block.title || block.options.title || this.formatLabel(block.blockId),
      fields: visibleEntries.map(([key, value]) => ({
        field_id: key,
        field_name: labels[key] || this.formatLabel(key),
        field_type: this.guessFieldType(value)
      }))
    };

    const data = {};
    visibleEntries.forEach(([key, value]) => {
      data[`${block.blockId}.${key}`] = value;
    });

    yPos = checkPageBreak(pdf, yPos, 30);
    return renderTable(pdf, section, data, block.options, yPos);
  }

  /**
   * Render metrics cards block.
   */
  renderMetricsBlock(pdf, block, yPos) {
    const metrics = Array.isArray(block.content.metrics)
      ? block.content.metrics.reduce((acc, metric, index) => {
          acc[`metric_${index}`] = metric.value;
          return acc;
        }, {})
      : block.content;

    const fields = Array.isArray(block.content.metrics)
      ? block.content.metrics.map((metric, index) => ({
          field_id: `metric_${index}`,
          field_name: metric.unit ? `${metric.label} (${metric.unit})` : metric.label,
          field_type: 'number'
        }))
      : Object.entries(metrics || {})
          .filter(([key, value]) => !key.startsWith('_') && value !== null && value !== undefined && value !== '')
          .map(([key, value]) => ({
            field_id: key,
            field_name: this.formatLabel(key),
            field_type: this.guessFieldType(value)
          }));

    if (fields.length === 0) {
      return yPos;
    }

    const section = {
      section_id: block.blockId,
      section_name: block.title || block.options.title || this.formatLabel(block.blockId),
      fields
    };

    const data = {};
    fields.forEach((field) => {
      data[`${block.blockId}.${field.field_id}`] = metrics[field.field_id];
    });

    yPos = checkPageBreak(pdf, yPos, 35);
    return renderMetricsCards(pdf, section, data, block.options, yPos);
  }
  
  /**
   * Render photo grid using existing renderer
   */
  async renderPhotoBlock(pdf, block, yPos, _attachments) {
    const photos = block.content.photos || block.content || [];
    
    if (photos.length === 0) {
      return yPos;
    }
    
    // Check page break
    yPos = checkPageBreak(pdf, yPos, 60);
    
    const photoLayout = {
      columns: block.options.columns || 2,
      title: block.options.title || 'Photo Documentation',
      show_timestamps: block.options.showTimestamps !== false,
      show_captions: block.options.showCaptions !== false
    };
    
    return await renderPhotoGrid(pdf, photos, photoLayout, yPos);
  }
  
  /**
   * Render signature box using existing renderer
   */
  async renderSignatureBlock(pdf, block, yPos, _attachments) {
    const signatures = block.content.signatures || block.content || [];
    
    if (signatures.length === 0) {
      console.log('⚠️ No signatures in block');
      return yPos;
    }
    
    console.log(`✍️ Rendering ${signatures.length} signatures`);
    
    // Check page break
    yPos = checkPageBreak(pdf, yPos, 50);
    
    // Create section for pdfLayouts
    const section = {
      section_id: block.blockId,
      section_name: block.options.title || 'Signatures',
      fields: signatures.map((sig, idx) => ({
        field_id: sig.role || `signature_${idx}`,
        field_name: sig.name || `Signature ${idx + 1}`,
        field_type: 'signature'
      }))
    };
    
    const data = {};
    
    // Map signatures to expected format
    signatures.forEach((sig, index) => {
      const fieldId = sig.role || `signature_${index}`;
      data[`${block.blockId}.${fieldId}`] = sig;
    });
    
    // FIXED: Pass ALL signatures array instead of just first one!
    return await renderSignatureBox(pdf, section, data, yPos, signatures);
  }
  
  /**
   * Format label from snake_case
   */
  formatLabel(key) {
    return key
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  
  /**
   * Guess field type from value
   */
  guessFieldType(value) {
    if (typeof value === 'boolean') {
      return 'checkbox';
    }
    if (typeof value === 'number') {
      return 'number';
    }
    if (value instanceof Date) {
      return 'date';
    }
    if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
      return 'date';
    }
    return 'text';
  }
}

// Export singleton instance
export const pdfAdapter = new PDFAdapter();
