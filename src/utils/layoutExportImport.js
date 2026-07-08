/**
 * WorkLedger - Layout Export/Import Utility
 * 
 * Functions to export layouts as JSON files and import them back.
 * Enables sharing layouts between users and organizations.
 * 
 * @module
 * @created February 12, 2026 - Session 8
 */

/**
 * Export layout as JSON file
 * 
 * @param {Object} layout - Layout object to export
 * @param {string} filename - Optional custom filename
 */
export function exportLayout(layout, filename = null) {
  try {
    // Prepare export data
    const exportData = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      layout: {
        layout_name: layout.layout_name,
        layout_description: layout.layout_description,
        layout_schema: layout.layout_schema,
        compatible_template_types: layout.compatible_template_types
      }
    };

    // Convert to JSON string
    const jsonString = JSON.stringify(exportData, null, 2);
    
    // Create blob
    const blob = new Blob([jsonString], { type: 'application/json' });
    
    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `${sanitizeFilename(layout.layout_name)}_layout.json`;
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Cleanup
    URL.revokeObjectURL(url);
    
    console.log('✅ Layout exported successfully');
    return { success: true };
    
  } catch (error) {
    console.error('❌ Failed to export layout:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Import layout from JSON file
 * 
 * @param {File} file - JSON file to import
 * @returns {Promise<Object>} Imported layout data
 */
export async function importLayout(file) {
  try {
    // Read file
    const text = await file.text();
    
    // Parse JSON
    const importData = JSON.parse(text);
    
    // Validate structure
    if (!importData.layout) {
      throw new Error('Invalid layout file: missing layout data');
    }
    
    if (!importData.layout.layout_schema) {
      throw new Error('Invalid layout file: missing layout_schema');
    }
    
    // Validate schema
    validateLayoutSchema(importData.layout.layout_schema);
    
    // Return layout data
    console.log('✅ Layout imported successfully');
    return {
      success: true,
      layout: importData.layout,
      version: importData.version,
      exported_at: importData.exported_at
    };
    
  } catch (error) {
    console.error('❌ Failed to import layout:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Validate layout schema structure
 * 
 * @param {Object} schema - Layout schema to validate
 * @throws {Error} If schema is invalid
 */
function validateLayoutSchema(schema) {
  const errors = [];

  // Check required fields
  if (!schema.page) {
    errors.push('Missing required field: page');
  }

  if (!schema.sections || !Array.isArray(schema.sections)) {
    errors.push('Missing or invalid field: sections');
  }

  // Validate page
  if (schema.page) {
    const validSizes = ['A4', 'A3', 'Letter'];
    const validOrientations = ['portrait', 'landscape'];

    if (!validSizes.includes(schema.page.size)) {
      errors.push(`Invalid page size: ${schema.page.size}`);
    }

    if (!validOrientations.includes(schema.page.orientation)) {
      errors.push(`Invalid page orientation: ${schema.page.orientation}`);
    }
  }

  // Validate sections
  if (schema.sections) {
    const validBlockTypes = [
      'header', 'detail_entry', 'text_section', 'checklist',
      'table', 'photo_grid', 'signature_box', 'metrics_cards'
    ];

    schema.sections.forEach((section, idx) => {
      if (!section.section_id) {
        errors.push(`Section ${idx}: missing section_id`);
      }

      if (!section.block_type) {
        errors.push(`Section ${idx}: missing block_type`);
      } else if (!validBlockTypes.includes(section.block_type)) {
        errors.push(`Section ${idx}: invalid block_type: ${section.block_type}`);
      }
    });
  }

  if (errors.length > 0) {
    throw new Error(`Schema validation failed:\n${errors.join('\n')}`);
  }

  return true;
}

/**
 * Sanitize filename for safe file system use
 * 
 * @param {string} filename - Original filename
 * @returns {string} Sanitized filename
 */
function sanitizeFilename(filename) {
  return filename
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 50);
}

/**
 * Export multiple layouts as a single JSON file
 * 
 * @param {Array} layouts - Array of layout objects
 * @param {string} filename - Optional custom filename
 */
export function exportLayoutBundle(layouts, filename = 'layout_bundle.json') {
  try {
    const exportData = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      count: layouts.length,
      layouts: layouts.map(layout => ({
        layout_name: layout.layout_name,
        layout_description: layout.layout_description,
        layout_schema: layout.layout_schema,
        compatible_template_types: layout.compatible_template_types
      }))
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log(`✅ Exported ${layouts.length} layouts successfully`);
    return { success: true, count: layouts.length };

  } catch (error) {
    console.error('❌ Failed to export layout bundle:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Import layout bundle (multiple layouts)
 * 
 * @param {File} file - JSON file containing multiple layouts
 * @returns {Promise<Object>} Imported layouts data
 */
export async function importLayoutBundle(file) {
  try {
    const text = await file.text();
    const importData = JSON.parse(text);

    if (!importData.layouts || !Array.isArray(importData.layouts)) {
      throw new Error('Invalid bundle file: missing layouts array');
    }

    // Validate each layout
    const validLayouts = [];
    const errors = [];

    importData.layouts.forEach((layout, idx) => {
      try {
        if (!layout.layout_schema) {
          throw new Error('Missing layout_schema');
        }
        validateLayoutSchema(layout.layout_schema);
        validLayouts.push(layout);
      } catch (error) {
        errors.push(`Layout ${idx + 1}: ${error.message}`);
      }
    });

    console.log(`✅ Imported ${validLayouts.length}/${importData.layouts.length} layouts`);

    return {
      success: true,
      layouts: validLayouts,
      count: validLayouts.length,
      errors: errors.length > 0 ? errors : null
    };

  } catch (error) {
    console.error('❌ Failed to import layout bundle:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Copy layout to clipboard as JSON
 * 
 * @param {Object} layout - Layout to copy
 */
export async function copyLayoutToClipboard(layout) {
  try {
    const exportData = {
      layout_name: layout.layout_name,
      layout_description: layout.layout_description,
      layout_schema: layout.layout_schema,
      compatible_template_types: layout.compatible_template_types
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    await navigator.clipboard.writeText(jsonString);

    console.log('✅ Layout copied to clipboard');
    return { success: true };

  } catch (error) {
    console.error('❌ Failed to copy layout:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Paste layout from clipboard
 * 
 * @returns {Promise<Object>} Parsed layout data
 */
export async function pasteLayoutFromClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    const layoutData = JSON.parse(text);

    if (!layoutData.layout_schema) {
      throw new Error('Invalid clipboard data: missing layout_schema');
    }

    validateLayoutSchema(layoutData.layout_schema);

    console.log('✅ Layout pasted from clipboard');
    return {
      success: true,
      layout: layoutData
    };

  } catch (error) {
    console.error('❌ Failed to paste layout:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
