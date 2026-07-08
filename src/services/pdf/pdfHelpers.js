/**
 * WorkLedger - PDF Helper Utilities
 * 
 * Utility functions for PDF generation.
 * Used by pdfGenerator and pdfLayouts.
 * 
 * @module services/pdf/pdfHelpers
 * @created February 5, 2026 - Session 17
 */

/**
 * Format field value for PDF display
 * 
 * @param {Object} field - Field definition
 * @param {any} value - Field value
 * @returns {string} Formatted value
 */
export function formatFieldValue(field, value) {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  switch (field.field_type) {
    case 'date':
      return formatDate(value);
    
    case 'datetime':
      return formatDateTime(value);
    
    case 'time':
      return value; // Already in HH:MM format
    
    case 'number':
      return formatNumber(value, field.decimals || 0);
    
    case 'checkbox':
      return value === true || value === 'true' ? '✓' : '✗';
    
    case 'select':
    case 'radio':
      return String(value);
    
    case 'textarea':
      return String(value);
    
    case 'calculated':
      return formatNumber(value, 2);
    
    default:
      return String(value);
  }
}

/**
 * Format date as DD/MM/YYYY
 * 
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted date
 */
export function formatDate(dateString) {
  if (!dateString) {
    return '-';
  }
  
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  
  return `${day}/${month}/${year}`;
}

/**
 * Format datetime as DD/MM/YYYY HH:MM
 * 
 * @param {string} dateTimeString - ISO datetime string
 * @returns {string} Formatted datetime
 */
export function formatDateTime(dateTimeString) {
  if (!dateTimeString) {
    return '-';
  }
  
  const date = new Date(dateTimeString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/**
 * Format number with decimals
 * 
 * @param {number} value - Number value
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted number
 */
export function formatNumber(value, decimals = 0) {
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  
  const num = parseFloat(value);
  if (isNaN(num)) {
    return '-';
  }
  
  return num.toFixed(decimals);
}

/**
 * Get field display label
 * 
 * @param {Object} field - Field definition
 * @returns {string} Display label
 */
export function getFieldLabel(field) {
  let label = field.field_name;
  
  if (field.required) {
    label += ' *';
  }
  
  return label;
}

/**
 * Calculate text height with wrapping
 * 
 * @param {Object} pdf - jsPDF instance
 * @param {string} text - Text to measure
 * @param {number} maxWidth - Maximum width in mm
 * @returns {number} Height in mm
 */
export function calculateTextHeight(pdf, text, maxWidth) {
  if (!text || text === '-') {
    return 5;
  }
  
  const lines = pdf.splitTextToSize(String(text), maxWidth);
  const lineHeight = 5;
  
  return lines.length * lineHeight;
}

/**
 * Wrap text to fit width
 * 
 * @param {Object} pdf - jsPDF instance
 * @param {string} text - Text to wrap
 * @param {number} maxWidth - Maximum width in mm
 * @returns {Array<string>} Array of text lines
 */
export function wrapText(pdf, text, maxWidth) {
  if (!text) {
    return [''];
  }
  
  return pdf.splitTextToSize(String(text), maxWidth);
}

/**
 * Draw a styled box
 * 
 * @param {Object} pdf - jsPDF instance
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} width - Box width
 * @param {number} height - Box height
 * @param {Object} style - Style options
 */
export function drawBox(pdf, x, y, width, height, style = {}) {
  const {
    fillColor = null,
    strokeColor = [200, 200, 200],
    lineWidth = 0.1,
    radius = 0
  } = style;
  
  // Set stroke
  if (strokeColor) {
    pdf.setDrawColor(...strokeColor);
    pdf.setLineWidth(lineWidth);
  }
  
  // Set fill
  if (fillColor) {
    pdf.setFillColor(...fillColor);
  }
  
  // Draw
  if (radius > 0) {
    if (fillColor && strokeColor) {
      pdf.roundedRect(x, y, width, height, radius, radius, 'FD');
    } else if (fillColor) {
      pdf.roundedRect(x, y, width, height, radius, radius, 'F');
    } else {
      pdf.roundedRect(x, y, width, height, radius, radius);
    }
  } else {
    if (fillColor && strokeColor) {
      pdf.rect(x, y, width, height, 'FD');
    } else if (fillColor) {
      pdf.rect(x, y, width, height, 'F');
    } else {
      pdf.rect(x, y, width, height);
    }
  }
}

/**
 * ALTERNATIVE FIX: Use Supabase Download (Bypasses CORS Completely)
 * 
 * Replace embedImage function in: src/services/pdf/pdfHelpers.js
 * 
 * This version uses Supabase's download method instead of fetch(),
 * which completely bypasses CORS issues.
 */

import { supabase } from '../supabase/client';

/**
 * Embed image in PDF using Supabase download (CORS-free)
 */
export async function embedImage(pdf, imageUrl, x, y, maxWidth, maxHeight) {
  try {
    console.log('🖼️ Embedding image:', imageUrl);
    
    // Validate URL
    if (!imageUrl || !imageUrl.startsWith('http')) {
      throw new Error('Invalid image URL');
    }
    
    // Parse Supabase storage URL
    // Format: https://xxx.supabase.co/storage/v1/object/public/bucket-name/path/to/file.jpg
    const urlPattern = /\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/;
    const match = imageUrl.match(urlPattern);
    
    if (!match) {
      throw new Error('Invalid Supabase storage URL format');
    }
    
    const [, bucketName, filePath] = match;
    console.log('  Bucket:', bucketName);
    console.log('  Path:', filePath);
    
    // Download via Supabase client (bypasses CORS!)
    const { data: blob, error } = await supabase.storage
      .from(bucketName)
      .download(filePath);
    
    if (error) {
      console.error('  ❌ Supabase download error:', error);
      throw error;
    }
    
    if (!blob || blob.size === 0) {
      throw new Error('Empty image blob');
    }
    
    console.log('  ✅ Downloaded blob:', blob.size, 'bytes, type:', blob.type);
    
    // Convert blob to base64
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result) {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to read blob'));
        }
      };
      reader.onerror = () => reject(new Error('FileReader error'));
      reader.readAsDataURL(blob);
    });
    
    console.log('  ✅ Converted to base64');
    
    // Create image element to get dimensions
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      
      image.onload = () => {
        console.log('  ✅ Image loaded:', image.width, 'x', image.height);
        resolve(image);
      };
      
      image.onerror = (e) => {
        console.error('  ❌ Image load error:', e);
        reject(new Error('Failed to load image'));
      };
      
      image.src = base64;
    });
    
    // Calculate scaled dimensions (px to mm: 1px = 0.264583mm)
    let width = img.width * 0.264583;
    let height = img.height * 0.264583;
    
    // Scale to fit maxWidth
    if (width > maxWidth) {
      height = (maxWidth / width) * height;
      width = maxWidth;
    }
    
    // Scale to fit maxHeight
    if (height > maxHeight) {
      width = (maxHeight / height) * width;
      height = maxHeight;
    }
    
    console.log('  ✅ Scaled dimensions:', Math.round(width), 'x', Math.round(height), 'mm');
    
    // Determine format from blob type
    let format = 'JPEG';
    if (blob.type.includes('png')) {
      format = 'PNG';
    } else if (blob.type.includes('webp')) {
      format = 'WEBP';
    }
    
    // Add to PDF
    pdf.addImage(base64, format, x, y, width, height);
    
    console.log('✅ Image embedded successfully');
    return height;
    
  } catch (error) {
    console.error('❌ Failed to embed image:', error);
    console.error('   URL:', imageUrl);
    console.error('   Full error:', error);
    
    // Draw error placeholder
    pdf.setDrawColor(220, 53, 69);
    pdf.setFillColor(255, 240, 245);
    pdf.rect(x, y, maxWidth, maxHeight, 'FD');
    
    pdf.setFontSize(8);
    pdf.setTextColor(220, 53, 69);
    pdf.text('Image not available', x + maxWidth / 2, y + maxHeight / 2 - 3, { align: 'center' });
    
    pdf.setFontSize(6);
    pdf.setTextColor(150, 150, 150);
    const errorMsg = error.message.substring(0, 40);
    pdf.text(errorMsg, x + maxWidth / 2, y + maxHeight / 2 + 2, { align: 'center' });
    
    pdf.setTextColor(0, 0, 0);
    
    return maxHeight;
  }
}

/**
 * USAGE NOTE:
 * 
 * This version REQUIRES the supabase client to be imported.
 * Add this import at the top of pdfHelpers.js:
 * 
 * import { supabase } from '../supabase/client';
 * 
 * PROS:
 * ✅ Completely bypasses CORS
 * ✅ Works with public AND private buckets
 * ✅ More reliable
 * 
 * CONS:
 * ❌ Slightly slower (extra API call)
 * ❌ Requires authenticated supabase client
 */

/**
 * Embed signature in PDF
 * 
 * @param {Object} pdf - jsPDF instance
 * @param {string} signatureUrl - Signature image URL
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} width - Width
 * @param {number} height - Height
 * @returns {Promise<void>}
 */
export async function embedSignature(pdf, signatureUrl, x, y, width, height) {
  try {
    console.log('🖊️ Embedding signature:', signatureUrl);
    
    // Validate URL
    if (!signatureUrl || !signatureUrl.startsWith('http')) {
      throw new Error('Invalid signature URL');
    }
    
    // Fetch signature with proper CORS settings
    const response = await fetch(signatureUrl, {
      mode: 'cors',
      credentials: 'omit',
      headers: {
        'Accept': 'image/*'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const blob = await response.blob();
    
    if (!blob || blob.size === 0) {
      throw new Error('Empty signature blob');
    }
    
    console.log('  ✅ Fetched blob:', blob.size, 'bytes, type:', blob.type);
    
    // Convert to base64
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result) {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to read blob'));
        }
      };
      reader.onerror = () => reject(new Error('FileReader error'));
      reader.readAsDataURL(blob);
    });
    
    console.log('  ✅ Converted to base64');
    
    // Determine format
    const format = blob.type.includes('png') ? 'PNG' : 'JPEG';
    
    // Add to PDF
    pdf.addImage(base64, format, x, y, width, height);
    
    console.log('✅ Signature embedded successfully');
    
  } catch (error) {
    console.error('❌ Failed to embed signature:', error.message);
    console.error('   URL:', signatureUrl);
    
    // Draw error placeholder
    pdf.setDrawColor(220, 53, 69);
    pdf.setFillColor(255, 240, 245);
    pdf.rect(x, y, width, height, 'FD');
    
    pdf.setFontSize(7);
    pdf.setTextColor(220, 53, 69);
    pdf.text('Signature failed', x + width / 2, y + height / 2 - 2, { align: 'center' });
    
    pdf.setFontSize(6);
    pdf.setTextColor(150, 150, 150);
    const errorMsg = error.message.substring(0, 20);
    pdf.text(errorMsg, x + width / 2, y + height / 2 + 2, { align: 'center' });
    
    pdf.setTextColor(0, 0, 0);
  }
}


/**
 * Check if page break is needed
 * 
 * @param {Object} pdf - jsPDF instance
 * @param {number} yPos - Current Y position
 * @param {number} requiredHeight - Required height for next content
 * @returns {number} New Y position (20 if new page, otherwise yPos)
 */
export function checkPageBreak(pdf, yPos, requiredHeight) {
  const pageHeight = pdf.internal.pageSize.height;
  const marginBottom = 20;
  
  if (yPos + requiredHeight > pageHeight - marginBottom) {
    pdf.addPage();
    return 20; // Top margin
  }
  
  return yPos;
}

/**
 * Add page numbers to all pages
 * 
 * @param {Object} pdf - jsPDF instance
 */
export function addPageNumbers(pdf) {
  const pageCount = pdf.internal.getNumberOfPages();
  
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFontSize(9);
    pdf.setTextColor(128, 128, 128);
    pdf.text(
      `Page ${i} of ${pageCount}`,
      pdf.internal.pageSize.width / 2,
      pdf.internal.pageSize.height - 10,
      { align: 'center' }
    );
  }
  
  // Reset text color
  pdf.setTextColor(0, 0, 0);
}

/**
 * Draw a horizontal line (separator)
 * 
 * @param {Object} pdf - jsPDF instance
 * @param {number} y - Y position
 * @param {number} leftMargin - Left margin
 * @param {number} rightMargin - Right margin
 */
export function drawHorizontalLine(pdf, y, leftMargin = 20, rightMargin = 20) {
  const pageWidth = pdf.internal.pageSize.width;
  
  pdf.setDrawColor(200, 200, 200);
  pdf.setLineWidth(0.1);
  pdf.line(leftMargin, y, pageWidth - rightMargin, y);
}

/**
 * Convert file to base64
 * 
 * @param {Blob} blob - File blob
 * @returns {Promise<string>} Base64 string
 */
export async function fileToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
