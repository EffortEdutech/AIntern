/**
 * WorkLedger - Template Binding Mapper
 * 
 * Maps work entry template data to report layout sections.
 * Extracts data based on binding rules from layout sections.
 * 
 * @module utils/templateBindingMapper
 * @created February 13, 2026 - Binding Integration
 */

/**
 * Extract data from work entry based on binding rules
 * 
 * @param {Object} workEntry - Work entry with template data
 * @param {Object} section - Layout section with binding_rules
 * @returns {Object} Extracted data for rendering
 */
export function extractSectionData(workEntry, section) {
  const bindingRules = section.binding_rules || {};
  const blockType = section.block_type;
  
  // NEW: Auto-extract ALL fields from work_entries.data
  if (bindingRules.mode === 'auto_extract_all') {
    return extractAllFields(workEntry);
  }
  
  // Photo grid with field filter
  if (blockType === 'photo_grid' && bindingRules.filter_by_field) {
    return { photos: extractPhotos(workEntry, bindingRules.filter_by_field) };
  }
  
  // Handle different binding formats
  if (bindingRules.template_section) {
    return extractFromTemplateSection(workEntry, bindingRules);
  } else if (bindingRules.source) {
    return extractFromPath(workEntry, bindingRules.source);
  } else if (bindingRules.metrics) {
    return { metrics: extractMetrics(workEntry, bindingRules.metrics) };
  } else if (blockType === 'photo_grid') {
    return { photos: extractPhotos(workEntry) };
  } else if (blockType === 'signature_box') {
    return { signatures: extractSignatures(workEntry) };
  }
  
  return {};
}

/**
 * Extract ALL fields from work_entries.data automatically
 * PROFESSIONAL: Excludes photos/signatures (they have dedicated sections)
 */
function extractAllFields(workEntry) {
  const extracted = {};
  const entryData = workEntry.entry_data || workEntry.data || {};
  
  // Extract all field values (SHORT NAMES ONLY)
  for (const [fullKey, value] of Object.entries(entryData)) {
    // CRITICAL: Skip photos and signatures (they have dedicated sections!)
    const lowerKey = fullKey.toLowerCase();
    if (lowerKey.includes('photo') || lowerKey.includes('signature')) {
      continue;
    }
    
    // Skip arrays
    if (Array.isArray(value)) {
      continue;
    }
    
    // Extract just the field name from "section_name.field_name"
    const fieldName = fullKey.split('.').pop();
    
    // Store ONLY with short name (no duplicates!)
    extracted[fieldName] = value;
  }
  
  // Add top-level fields
  if (workEntry.entry_date) {
    extracted.entry_date = workEntry.entry_date;
  }
  if (workEntry.shift) {
    extracted.shift = workEntry.shift;
  }
  if (workEntry.created_by_profile?.full_name) {
    extracted.technician_name = workEntry.created_by_profile.full_name;
  }
  
  console.log('  ✅ Extracted', Object.keys(extracted).length, 'fields (photos/signatures excluded)');
  return extracted;
}

/**
 * Extract data from a specific template section using FLAT dotted keys
 * 
 * Our work_entries.data is stored FLAT:
 *   { "section_1_dates.entry_date": "2026-02-05", "section_2_text.simple_text": "TEST" }
 * NOT nested:
 *   { section_1_dates: { entry_date: "2026-02-05" } }
 * 
 * This function finds all keys starting with "section_id." and extracts them.
 */
function extractFromTemplateSection(workEntry, bindingRules) {
  const { template_section, fields, field } = bindingRules;
  const entryData = workEntry.entry_data || workEntry.data || {};
  
  console.log(`  🔍 Extracting from template section: "${template_section}"`);
  
  // FIXED: Search flat dotted keys for this section prefix
  // e.g. template_section: "section_1_dates" matches keys like "section_1_dates.entry_date"
  const prefix = `${template_section}.`;
  const extracted = {};
  let found = 0;
  
  for (const [fullKey, value] of Object.entries(entryData)) {
    // Match keys that belong to this section
    if (fullKey.startsWith(prefix)) {
      // Skip arrays (photos handled separately)
      if (Array.isArray(value)) {
        continue;
      }
      
      // Get short field name: "section_1_dates.entry_date" → "entry_date"
      const fieldName = fullKey.slice(prefix.length);
      
      // If specific fields requested, filter
      if (fields && Array.isArray(fields)) {
        if (fields.includes(fieldName)) {
          extracted[fieldName] = value;
          found++;
        }
      } else if (field) {
        // Single field requested
        if (fieldName === field) {
          extracted[fieldName] = value;
          found++;
        }
      } else {
        // All fields in this section
        extracted[fieldName] = value;
        found++;
      }
    }
  }
  
  // Also check top-level fields if nothing found
  if (found === 0) {
    console.warn(`  ⚠️ No data found for section "${template_section}". Check section_id matches template.`);
  }
  
  // Add technician name if this is a header-type section
  if (workEntry.created_by_profile?.full_name && !extracted.technician_name) {
    extracted.technician_name = workEntry.created_by_profile.full_name;
  }
  if (workEntry.entry_date && !extracted.entry_date) {
    extracted.entry_date = workEntry.entry_date;
  }
  
  console.log(`  ✅ Extracted ${found} fields from section "${template_section}"`);
  return extracted;
}

/**
 * Extract data from path (legacy)
 */
function extractFromPath(workEntry, path) {
  const parts = path.split('.');
  let current = workEntry;
  
  for (const part of parts) {
    if (current && typeof current === 'object') {
      current = current[part];
    } else {
      return {};
    }
  }
  
  return current || {};
}

/**
 * Extract metrics data
 */
function extractMetrics(workEntry, metricsConfig) {
  if (!Array.isArray(metricsConfig)) {
    return [];
  }
  
  const entryData = workEntry.entry_data || workEntry.data || {};
  
  return metricsConfig.map(metric => {
    const sectionData = entryData[metric.template_section] || {};
    const value = sectionData[metric.field];
    
    return {
      label: metric.label,
      value: formatFieldValue(value, 'number'),
      unit: metric.unit || ''
    };
  });
}

/**
 * Extract photos from work entry
 * ENHANCED: Supports filtering by field_id for Before/During/After categorization
 */
export function extractPhotos(workEntry, filterByField = null) {
  const attachments = workEntry.attachments || [];
  
  // Get all photo attachments
  let photoAttachments = attachments.filter(att => att.file_type === 'photo');
  
  // Filter by field_id if specified
  if (filterByField) {
    photoAttachments = photoAttachments.filter(att => {
      const fieldId = att.field_id || '';
      return fieldId.toLowerCase().includes(filterByField.toLowerCase());
    });
  }
  
  // Convert to display format
  const photos = photoAttachments.map(photo => ({
    url: photo.storage_url || photo.url,
    caption: photo.caption || photo.metadata?.caption || photo.file_name || '',
    timestamp: photo.created_at || '',
    field_id: photo.field_id
  }));
  
  console.log(`  📸 Extracted ${photos.length} photos${filterByField ? ` (filtered by: ${filterByField})` : ''}`);
  return photos;
}

/**
 * Extract signatures from work entry
 * FIXED: Resolves UUIDs from attachments array properly
 */
export function extractSignatures(workEntry) {
  const attachments = workEntry.attachments || [];
  const entryData = workEntry.entry_data || workEntry.data || {};
  
  // Get all signature attachments
  const signatureAttachments = attachments.filter(att => att.file_type === 'signature');
  
  // Also check for signature UUIDs in entry data
  const signatureIds = [];
  for (const [key, value] of Object.entries(entryData)) {
    if (key.includes('signature') && typeof value === 'string' && !Array.isArray(value)) {
      // This is a signature UUID
      signatureIds.push(value);
    }
  }
  
  // Resolve UUIDs to actual attachments
  const resolvedSignatures = [];
  
  // First, add all signature attachments
  for (const sig of signatureAttachments) {
    resolvedSignatures.push({
      url: sig.storage_url || sig.url,
      name: sig.metadata?.signer_name || sig.field_id || 'Signature',
      role: sig.metadata?.signer_role || '',
      date: sig.created_at || '',
      field_id: sig.field_id
    });
  }
  
  // If no signatures found yet, try to resolve UUIDs
  if (resolvedSignatures.length === 0 && signatureIds.length > 0) {
    for (const sigId of signatureIds) {
      const attachment = attachments.find(att => att.id === sigId);
      if (attachment) {
        resolvedSignatures.push({
          url: attachment.storage_url || attachment.url,
          name: attachment.metadata?.signer_name || attachment.field_id || 'Signature',
          role: attachment.metadata?.signer_role || '',
          date: attachment.created_at || '',
          field_id: attachment.field_id
        });
      }
    }
  }
  
  console.log(`  ✅ Extracted ${resolvedSignatures.length} signatures`);
  return resolvedSignatures;
}

/**
 * Format field value for display
 */
export function formatFieldValue(value, fieldType) {
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  
  switch (fieldType) {
    case 'number':
      return typeof value === 'number' ? value.toLocaleString() : value;
    
    case 'date':
      return value ? new Date(value).toLocaleDateString('en-GB') : '-';
    
    case 'month':
      return formatMonth(value);
    
    case 'checkbox':
      return value ? '✅ Yes' : '❌ No';
    
    case 'textarea':
    case 'text':
    default:
      return String(value);
  }
}

/**
 * Format month value
 */
function formatMonth(monthValue) {
  if (!monthValue) {
    return '-';
  }
  
  if (monthValue.includes('-')) {
    const [year, month] = monthValue.split('-');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
  }
  
  return monthValue;
}

/**
 * Get field label from template
 */
export function getFieldLabel(template, sectionId, fieldId) {
  if (!template || !template.fields_schema) {
    return fieldId;
  }
  
  const schema = template.fields_schema;
  const section = schema.sections?.find(s => s.section_id === sectionId);
  if (!section) {
    return fieldId;
  }
  
  const field = section.fields?.find(f => f.field_id === fieldId);
  return field?.field_name || fieldId;
}
