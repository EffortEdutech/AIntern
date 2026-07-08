/**
 * WorkLedger - PDF Generator Service
 * 
 * Main PDF generation orchestration.
 * Handles header, sections, footer, page numbers.
 * 
 * @module services/pdf/pdfGenerator
 * @created February 5, 2026 - Session 17
 */

import jsPDF from 'jspdf';
import {
  formatDate,
  formatDateTime,
  addPageNumbers,
  drawHorizontalLine
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

/**
 * PDF Generator Service
 */
class PDFService {
  /**
   * Generate PDF report from work entry
   * 
   * @param {Object} workEntry - Work entry data
   * @param {Object} template - Template definition
   * @param {Object} contract - Contract data
   * @param {Array} attachments - Photos and signatures
   * @returns {Promise<Blob>} PDF blob
   */
  async generateReport(workEntry, template, contract, attachments = []) {
    console.log('📄 Generating PDF report...');
    console.log('Work Entry:', workEntry.id);
    console.log('Template:', template.template_name);
    
    // Create PDF document
    const pdf = new jsPDF({
      orientation: template.pdf_layout?.orientation || 'portrait',
      unit: 'mm',
      format: template.pdf_layout?.page_size || 'A4'
    });
    
    let yPos = 20;
    
    // 1. Render header
    yPos = this.renderHeader(pdf, template, contract, workEntry, yPos);
    
    // 2. Render sections
    for (const sectionLayout of template.pdf_layout.sections) {
      const section = template.fields_schema.sections.find(
        s => s.section_id === sectionLayout.section_id
      );
      
      if (!section) {
        continue;
      }
      
      // Check show_if condition
      if (sectionLayout.show_if) {
        const shouldShow = this.evaluateCondition(
          sectionLayout.show_if,
          workEntry.data
        );
        if (!shouldShow) {
          continue;
        }
      }
      
      // Render based on layout
      yPos = await this.renderSection(
        pdf,
        section,
        workEntry.data,
        sectionLayout,
        yPos,
        attachments
      );
    }
    
    // 3. Render photos (if not already in sections)
    const photos = attachments.filter(a => a.attachment_type === 'photo');
    if (photos.length > 0) {
      yPos = await renderPhotoGrid(pdf, photos, { columns: 2 }, yPos);
    }
    
    // 4. Add page numbers
    addPageNumbers(pdf);
    
    // 5. Render footer
    this.renderFooter(pdf, template, workEntry);
    
    console.log('✅ PDF generated successfully');
    
    // Return as blob
    return pdf.output('blob');
  }
  
  /**
   * Render PDF header
   * 
   * @param {Object} pdf - jsPDF instance
   * @param {Object} template - Template definition
   * @param {Object} contract - Contract data
   * @param {Object} workEntry - Work entry data
   * @param {number} yPos - Current Y position
   * @returns {number} New Y position
   */
  renderHeader(pdf, template, contract, workEntry, yPos) {
    const marginLeft = 20;
    const pageWidth = pdf.internal.pageSize.width;
    
    // Logo placeholder (if enabled)
    if (template.pdf_layout?.header?.show_logo) {
      // TODO: Add logo embedding in future
      // For now, just add text logo
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(59, 130, 246);
      pdf.text('WORKLEDGER', marginLeft, yPos);
      yPos += 8;
    }
    
    // Report title
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(0, 0, 0);
    const title = template.pdf_layout?.header?.title || template.template_name;
    pdf.text(title.toUpperCase(), marginLeft, yPos);
    yPos += 8;
    
    // Separator
    drawHorizontalLine(pdf, yPos, marginLeft);
    yPos += 6;
    
    // Contract info (two columns)
    pdf.setFontSize(9);
    const leftX = marginLeft;
    const rightX = pageWidth / 2 + 10;
    
    // Left column
    pdf.setFont('helvetica', 'bold');
    pdf.text('Contract:', leftX, yPos);
    pdf.setFont('helvetica', 'normal');
    pdf.text(contract.contract_no || '-', leftX + 25, yPos);
    
    // Right column
    pdf.setFont('helvetica', 'bold');
    pdf.text('Date:', rightX, yPos);
    pdf.setFont('helvetica', 'normal');
    pdf.text(formatDate(workEntry.entry_date), rightX + 15, yPos);
    yPos += 5;
    
    // Client
    pdf.setFont('helvetica', 'bold');
    pdf.text('Client:', leftX, yPos);
    pdf.setFont('helvetica', 'normal');
    pdf.text(contract.client_name || '-', leftX + 25, yPos);
    
    // Status
    pdf.setFont('helvetica', 'bold');
    pdf.text('Status:', rightX, yPos);
    pdf.setFont('helvetica', 'normal');
    pdf.text(workEntry.status.toUpperCase(), rightX + 15, yPos);
    yPos += 5;
    
    // Asset category (if applicable)
    if (contract.asset_category) {
      pdf.setFont('helvetica', 'bold');
      pdf.text('Asset:', leftX, yPos);
      pdf.setFont('helvetica', 'normal');
      pdf.text(contract.asset_category, leftX + 25, yPos);
      yPos += 5;
    }
    
    // Separator
    drawHorizontalLine(pdf, yPos, marginLeft);
    yPos += 8;
    
    return yPos;
  }
  
  /**
   * Render a section
   * 
   * @param {Object} pdf - jsPDF instance
   * @param {Object} section - Section definition
   * @param {Object} data - Work entry data
   * @param {Object} sectionLayout - Section layout config
   * @param {number} yPos - Current Y position
   * @param {Array} attachments - Attachments array
   * @returns {Promise<number>} New Y position
   */
  async renderSection(pdf, section, data, sectionLayout, yPos, attachments) {
    const layout = sectionLayout.layout || 'single_column';
    
    switch (layout) {
      case 'two_column':
        return renderTwoColumn(pdf, section, data, yPos);
      
      case 'single_column':
        return renderSingleColumn(pdf, section, data, yPos);
      
      case 'checklist':
        return renderChecklist(pdf, section, data, sectionLayout, yPos);
      
      case 'table':
        return renderTable(pdf, section, data, sectionLayout, yPos);
      
      case 'metrics_cards':
        return renderMetricsCards(pdf, section, data, sectionLayout, yPos);
      
      case 'signature_box': {
        const signatureField = section.fields.find(
          f => f.field_type === 'signature'
        );
        const signatureAttachment = signatureField
          ? attachments.find(a => 
            a.field_id === `${section.section_id}.${signatureField.field_id}` &&
              a.attachment_type === 'signature'
          )
          : null;
        
        return await renderSignatureBox(
          pdf,
          section,
          data,
          yPos,
          signatureAttachment
        );
      }
      
      case 'photo_grid': {
        const sectionPhotos = attachments.filter(a =>
          a.field_id?.startsWith(`${section.section_id}.`) &&
          a.attachment_type === 'photo'
        );
        
        return await renderPhotoGrid(
          pdf,
          sectionPhotos,
          sectionLayout,
          yPos
        );
      }
      
      default:
        console.warn('⚠️ Unknown layout:', layout);
        return renderSingleColumn(pdf, section, data, yPos);
    }
  }
  
  /**
   * Render PDF footer
   * 
   * @param {Object} pdf - jsPDF instance
   * @param {Object} template - Template definition
   * @param {Object} workEntry - Work entry data
   */
  renderFooter(pdf, template, workEntry) {
    const pageCount = pdf.internal.getNumberOfPages();
    const pageHeight = pdf.internal.pageSize.height;
    const pageWidth = pdf.internal.pageSize.width;
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
        `Generated by WorkLedger on ${formatDateTime(new Date().toISOString())}`,
        marginLeft,
        footerY
      );
      
      // Right: Entry ID
      pdf.text(
        `Entry ID: ${workEntry.id.substring(0, 8)}...`,
        pageWidth - marginLeft,
        footerY,
        { align: 'right' }
      );
    }
    
    // Reset text color
    pdf.setTextColor(0, 0, 0);
  }
  
  /**
   * Evaluate show_if condition
   * 
   * @param {string} condition - Condition string
   * @param {Object} data - Work entry data
   * @returns {boolean} Should show
   */
  evaluateCondition(condition, data) {
    try {
      // Simple evaluation for common patterns
      // Example: "data.inspection_required === true"
      
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
      
      // Default: show
      return true;
      
    } catch (error) {
      console.error('❌ Error evaluating condition:', error);
      return true; // Show by default on error
    }
  }
  
  /**
   * Get field value from data
   * 
   * @param {Object} data - Work entry data
   * @param {string} path - Field path (e.g., "section.field")
   * @returns {any} Field value
   */
  getFieldValue(data, path) {
    // Remove "data." prefix if present
    path = path.replace(/^data\./, '');
    
    return data[path];
  }
}

// Export singleton instance
export const pdfService = new PDFService();
