/**
 * WorkLedger - HTML Adapter (WITH LABEL SUPPORT)
 * 
 * Converts Render Tree (IR) to HTML for preview.
 * Now uses _labels from template for proper field names.
 * 
 * @module services/render/adapters/htmlAdapter
 * @updated February 13, 2026 - Label Support
 */

class HTMLAdapter {
  /**
   * Convert Render Tree to HTML
   */
  render(renderTree) {
    console.log('🌐 HTMLAdapter: Rendering HTML from Render Tree...');
    
    const html = [];
    html.push(this.renderPageSetup(renderTree.page, renderTree.metadata));
    
    for (const block of renderTree.blocks) {
      html.push(this.renderBlock(block));
    }
    
    html.push('</div>'); // .page-preview
    
    console.log('✅ HTML rendered');
    return html.join('\n');
  }
  
  /**
   * Render page setup with A4 dimensions and CSS
   */
  renderPageSetup(pageConfig, _metadata) {
    const dimensions = this.getPageDimensions(pageConfig.size, pageConfig.orientation);
    
    return `
<style>
  * { box-sizing: border-box; }
  .page-preview {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    background: white;
    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    margin: 20px auto;
    position: relative;
  }
  .page-preview h1 { font-size: 24px; margin: 0 0 8px 0; color: #1a1a1a; font-weight: 700; }
  .page-preview h2 { font-size: 18px; margin: 16px 0 8px 0; color: #333; font-weight: 600; border-bottom: 2px solid #e5e7eb; padding-bottom: 4px; }
  .page-preview h3 { font-size: 14px; margin: 12px 0 6px 0; color: #555; font-weight: 600; }
  .page-preview p { margin: 4px 0; line-height: 1.6; color: #374151; }
  .header-block { border-bottom: 3px solid #3b82f6; padding-bottom: 12px; margin-bottom: 20px; }
  .header-block .logo { color: #3b82f6; font-size: 20px; font-weight: 700; letter-spacing: -0.5px; }
  .header-block .meta { font-size: 11px; color: #6b7280; margin-top: 4px; }
  .detail-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin: 16px 0; }
  .detail-grid.single-column { grid-template-columns: 1fr; }
  .detail-field { padding: 10px 12px; background: #f9fafb; border-radius: 6px; border: 1px solid #e5e7eb; }
  .detail-field label { display: block; font-size: 11px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
  .detail-field span { display: block; font-size: 14px; color: #1f2937; font-weight: 500; }
  .text-section { margin: 16px 0; padding: 16px; background: #f9fafb; border-radius: 6px; border-left: 4px solid #3b82f6; }
  .text-section p { white-space: pre-wrap; line-height: 1.7; }
  .photo-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin: 16px 0; }
  .photo-grid.single-column { grid-template-columns: 1fr; }
  .photo-item { border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb; background: #f9fafb; }
  .photo-item img { width: 100%; height: auto; display: block; }
  .photo-caption { font-size: 11px; color: #6b7280; padding: 8px 12px; background: white; }
  .checklist-table { width: 100%; border-collapse: collapse; margin: 16px 0; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; }
  .checklist-table th { background: #f3f4f6; padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb; }
  .checklist-table td { padding: 10px 12px; font-size: 13px; border-bottom: 1px solid #f3f4f6; color: #1f2937; }
  .checklist-table tr:last-child td { border-bottom: none; }
  .signature-box { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; margin: 24px 0; padding: 20px; background: #f9fafb; border-radius: 8px; }
  .signature-item { text-align: center; padding: 16px; background: white; border-radius: 6px; border: 1px solid #e5e7eb; }
  .signature-item img { max-width: 200px; height: auto; margin: 0 auto; display: block; border: 1px solid #e5e7eb; border-radius: 4px; }
  .signature-item .placeholder { height: 80px; border: 2px dashed #d1d5db; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: #9ca3af; font-size: 12px; }
  .signature-label { font-size: 11px; color: #6b7280; margin-top: 8px; font-weight: 600; }
</style>
<div class="page-preview" style="width: ${dimensions.width}mm; min-height: ${dimensions.height}mm; padding: ${pageConfig.margins.top}mm ${pageConfig.margins.left}mm ${pageConfig.margins.bottom}mm ${pageConfig.margins.right}mm;">
    `;
  }
  
  getPageDimensions(size, orientation) {
    const sizes = {
      A4: { width: 210, height: 297 },
      Letter: { width: 216, height: 279 }
    };
    const dims = sizes[size] || sizes.A4;
    if (orientation === 'landscape') {
      return { width: dims.height, height: dims.width };
    }
    return dims;
  }
  
  renderBlock(block) {
    switch (block.type) {
      case 'header':
        return this.renderHeader(block);
      case 'detail_entry':
        return this.renderDetailEntry(block);
      case 'text_section':
        return this.renderTextSection(block);
      case 'checklist':
        return this.renderChecklist(block);
      case 'table':
        return this.renderTable(block);
      case 'photo_grid':
        return this.renderPhotoGrid(block);
      case 'signature_box':
        return this.renderSignatureBox(block);
      case 'metrics_cards':
        return this.renderMetricsCards(block);
      default:
        return this.renderGeneric(block);
    }
  }
  
  renderHeader(block) {
    const { content, options } = block;
    return `
<div class="header-block">
  <div class="logo">WORKLEDGER</div>
  <h1>${content.title || options.content?.title || 'Work Report'}</h1>
  ${content.subtitle || options.content?.subtitle ? `<p style="color: #6b7280; font-size: 14px; margin-top: 4px;">${content.subtitle || options.content?.subtitle}</p>` : ''}
  ${content.contract_number ? `<div class="meta">Contract: ${content.contract_number}</div>` : ''}
</div>
    `;
  }
  
  renderDetailEntry(block) {
    const { content, options } = block;
    const columns = options.columns || 2;
    const singleColumn = columns === 1;
    const labels = content._labels || {};
    
    const fields = Object.entries(content)
      .filter(([key, value]) => !key.startsWith('_') && value !== null && value !== undefined)
      .map(([key, value]) => `
        <div class="detail-field">
          <label>${labels[key] || this.formatLabel(key)}</label>
          <span>${this.formatValue(value)}</span>
        </div>
      `).join('');
    
    return `
<div class="detail-grid ${singleColumn ? 'single-column' : ''}">
  ${fields}
</div>
    `;
  }
  
  renderTextSection(block) {
    const { content, options } = block;
    const textFields = Object.entries(content).filter(([key]) => !key.startsWith('_'));
    const text = textFields[0]?.[1] || '';
    
    if (!text) {
      return '';
    }
    
    return `
<div class="text-section">
  <h3>${options.title || 'Observations'}</h3>
  <p>${this.escapeHtml(text)}</p>
</div>
    `;
  }
  
  renderTable(_block) {
    // Table rendering TBD
    return '';
  }
  
  renderChecklist(block) {
    const { content, options } = block;
    const items = content.items || [];
    
    if (items.length === 0) {
      return '';
    }
    
    return `
<div style="margin: 16px 0;">
  <h2>${options.title || 'Checklist'}</h2>
  <table class="checklist-table">
    <thead>
      <tr>
        <th style="width: 50%;">Task</th>
        <th style="width: 25%;">Status</th>
        <th style="width: 25%;">Remarks</th>
      </tr>
    </thead>
    <tbody>
      ${items.map(item => `
        <tr>
          <td>${this.escapeHtml(item.task || '')}</td>
          <td><strong>${this.escapeHtml(item.status || '')}</strong></td>
          <td>${this.escapeHtml(item.remarks || '')}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
</div>
    `;
  }
  
  renderPhotoGrid(block) {
    const { content, options } = block;
    const photos = content.photos || [];
    const columns = options.columns || 2;
    const singleColumn = columns === 1;
    
    if (photos.length === 0) {
      return '';
    }
    
    return `
<div style="margin: 20px 0;">
  <h2>${options.title || 'Photos'}</h2>
  <div class="photo-grid ${singleColumn ? 'single-column' : ''}">
    ${photos.map(photo => `
      <div class="photo-item">
        <img src="${photo.url}" alt="${photo.caption || 'Photo'}" />
        <div class="photo-caption">
          ${options.showCaptions && photo.caption ? `<div><strong>${this.escapeHtml(photo.caption)}</strong></div>` : ''}
          ${options.showTimestamps && photo.timestamp ? `<div>${this.formatDateTime(photo.timestamp)}</div>` : ''}
        </div>
      </div>
    `).join('')}
  </div>
</div>
    `;
  }
  
  renderSignatureBox(block) {
    const { content, options } = block;
    const signatures = content.signatures || [];
    
    if (signatures.length === 0) {
      return '';
    }
    
    return `
<div style="margin: 24px 0;">
  <h2>${options.title || 'Signatures'}</h2>
  <div class="signature-box">
    ${signatures.map(sig => `
      <div class="signature-item">
        ${sig.url 
    ? `<img src="${sig.url}" alt="${sig.name || 'Signature'}" />`
    : '<div class="placeholder">No signature</div>'
}
        <div class="signature-label">${this.escapeHtml(sig.name || 'Signature')}</div>
        ${sig.date ? `<div class="signature-label">${this.formatDate(sig.date)}</div>` : ''}
        ${sig.role ? `<div class="signature-label">${this.escapeHtml(sig.role)}</div>` : ''}
      </div>
    `).join('')}
  </div>
</div>
    `;
  }
  
  renderMetricsCards(block) {
    const { content, options } = block;
    const metrics = content.metrics || [];
    const columns = options.columns || 3;
    
    if (metrics.length === 0) {
      return '';
    }
    
    return `
<div style="margin: 16px 0;">
  <div style="display: grid; grid-template-columns: repeat(${columns}, 1fr); gap: 12px;">
    ${metrics.map(metric => `
      <div style="padding: 16px; background: #eff6ff; border-radius: 8px; border: 1px solid #bfdbfe; text-align: center;">
        <div style="font-size: 11px; color: #1e40af; font-weight: 600; text-transform: uppercase; margin-bottom: 4px;">${this.escapeHtml(metric.label)}</div>
        <div style="font-size: 28px; font-weight: 700; color: #1e3a8a;">${this.escapeHtml(String(metric.value))}</div>
        <div style="font-size: 11px; color: #3b82f6; margin-top: 2px;">${this.escapeHtml(metric.unit)}</div>
      </div>
    `).join('')}
  </div>
</div>
    `;
  }
  
  renderGeneric(block) {
    return `
<div style="margin: 12px 0; padding: 12px; background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px;">
  <strong>Unknown block type: ${block.type}</strong>
  <pre style="font-size: 11px; margin: 8px 0; overflow-x: auto;">${JSON.stringify(block.content, null, 2)}</pre>
</div>
    `;
  }
  
  formatLabel(key) {
    return key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  }
  
  formatValue(value) {
    if (value === null || value === undefined) {
      return '-';
    }
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    if (typeof value === 'object') {
      if (value instanceof Date) {
        return this.formatDate(value);
      }
      return JSON.stringify(value);
    }
    return this.escapeHtml(String(value));
  }
  
  formatDate(dateString) {
    if (!dateString) {
      return '-';
    }
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  
  formatDateTime(dateString) {
    if (!dateString) {
      return '-';
    }
    const date = new Date(dateString);
    return date.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  
  escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(text).replace(/[&<>"']/g, m => map[m]);
  }
}

export const htmlAdapter = new HTMLAdapter();
