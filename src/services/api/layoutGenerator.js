/**
 * WorkLedger - Layout Generator from Template
 * 
 * Automatically generates report layout sections from template schema.
 * Reads template.fields_schema and creates matching layout blocks with proper bindings.
 * 
 * @module services/api/layoutGenerator
 * @created February 17, 2026 - Session 8
 */

/**
 * Generate a complete layout schema from a template
 * 
 * @param {Object} template - Template with fields_schema
 * @returns {Object} Generated layout sections
 */
export function generateLayoutFromTemplate(template) {
  if (!template?.fields_schema?.sections) {
    throw new Error('Template has no valid fields_schema');
  }

  console.log('🏗️ Generating layout from template:', template.template_name);

  const sections = [];
  const photoSections = [];
  const signatureSections = [];

  // 1. Add header block
  sections.push({
    section_id: 'header',
    block_type: 'header',
    content: {
      title: template.template_name
    },
    options: {},
    binding_rules: {}
  });

  // 2. Process each template section
  for (const templateSection of template.fields_schema.sections) {
    const { section_id, section_name, fields } = templateSection;

    // Categorize fields
    const regularFields = [];
    const photoFields = [];
    const signatureFields = [];

    for (const field of fields) {
      if (field.field_type === 'photo') {
        photoFields.push(field);
      } else if (field.field_type === 'signature') {
        signatureFields.push(field);
      } else {
        regularFields.push(field);
      }
    }

    // Create detail_entry block for regular fields
    if (regularFields.length > 0) {
      const layoutSection = {
        section_id: `${section_id}_block`,
        block_type: 'detail_entry',
        content: {
          title: section_name
        },
        options: {
          columns: 2  // Default to 2 columns
        },
        binding_rules: {
          template_section: section_id
        }
      };

      // Special cases for specific field types
      const hasTextarea = regularFields.some(f => f.field_type === 'textarea');
      if (hasTextarea) {
        layoutSection.options.columns = 1;  // Use 1 column for textarea-heavy sections
      }

      sections.push(layoutSection);
    }

    // Collect photo fields for later (group at end)
    photoFields.forEach(photoField => {
      photoSections.push({
        section_id: `${photoField.field_id}_block`,
        block_type: 'photo_grid',
        content: {
          title: photoField.field_name || 'Photos'
        },
        options: {
          columns: photoField.columns || 2,
          showTimestamps: true,
          showCaptions: true
        },
        binding_rules: {
          filter_by_field: photoField.field_id
        }
      });
    });

    // Collect signature fields for later
    signatureFields.forEach(sigField => {
      signatureSections.push({
        field_id: sigField.field_id,
        field_name: sigField.field_name
      });
    });
  }

  // 3. Add photo sections (grouped together)
  sections.push(...photoSections);

  // 4. Add signature block if any signatures found
  if (signatureSections.length > 0) {
    sections.push({
      section_id: 'signatures',
      block_type: 'signature_box',
      content: {
        title: 'Signatures & Acknowledgment'
      },
      options: {
        layout: 'two_column'
      },
      binding_rules: {}
    });
  }

  console.log(`✅ Generated ${sections.length} layout sections`);

  return {
    sections,
    meta: {
      generatedFrom: template.template_id,
      templateName: template.template_name,
      generatedAt: new Date().toISOString()
    }
  };
}

/**
 * Generate a suggested layout name from template
 */
export function suggestLayoutName(template) {
  // Remove common suffixes
  const name = template.template_name
    .replace(/template/i, '')
    .replace(/report/i, '')
    .trim();

  // Add "Layout" suffix
  return `${name} - Layout`;
}

/**
 * Generate layout description
 */
export function suggestLayoutDescription(template) {
  const sectionCount = template.fields_schema?.sections?.length || 0;
  return `Auto-generated layout for ${template.template_name}. Contains ${sectionCount} sections with proper field bindings.`;
}

/**
 * Preview what will be generated (for UI display before confirming)
 */
export function previewLayoutGeneration(template) {
  const { sections } = generateLayoutFromTemplate(template);
  
  const summary = {
    totalSections: sections.length,
    detailSections: sections.filter(s => s.block_type === 'detail_entry').length,
    photoSections: sections.filter(s => s.block_type === 'photo_grid').length,
    hasSignatures: sections.some(s => s.block_type === 'signature_box'),
    hasHeader: sections.some(s => s.block_type === 'header')
  };

  return {
    sections,
    summary,
    suggestedName: suggestLayoutName(template),
    suggestedDescription: suggestLayoutDescription(template)
  };
}

export default {
  generateLayoutFromTemplate,
  suggestLayoutName,
  suggestLayoutDescription,
  previewLayoutGeneration
};
