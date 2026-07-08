/**
 * WorkLedger - Template Service (UPDATED)
 * 
 * Full CRUD for template management + builder support.
 * 
 * Session 12: getTemplates, getTemplate, getTemplateByContract, validate, helpers
 * Session 20: createTemplate, updateTemplate, deleteTemplate, cloneTemplate,
 *             getContractsUsingTemplate, generateTemplateId
 * 
 * @module services/api/templateService
 * @created January 31, 2026 - Session 12
 * @updated February 7, 2026 - Session 20: Full CRUD + builder support
 */

import { supabase } from '../supabase/client';

/**
 * Supported field types with metadata
 */
export const FIELD_TYPES = [
  { value: 'text',       label: 'Text',           icon: '📝', description: 'Single line text input' },
  { value: 'textarea',   label: 'Text Area',      icon: '📄', description: 'Multi-line text input' },
  { value: 'number',     label: 'Number',         icon: '🔢', description: 'Numeric input' },
  { value: 'date',       label: 'Date',           icon: '📅', description: 'Date picker' },
  { value: 'datetime',   label: 'Date & Time',    icon: '🕐', description: 'Date and time picker' },
  { value: 'month',      label: 'Month',          icon: '📆', description: 'Month picker' },
  { value: 'select',     label: 'Dropdown',       icon: '📋', description: 'Single selection from list' },
  { value: 'radio',      label: 'Radio Buttons',  icon: '🔘', description: 'Single selection (visible options)' },
  { value: 'checkbox',   label: 'Checkbox',       icon: '☑️', description: 'Yes/No toggle' },
  { value: 'photo',      label: 'Photo',          icon: '📷', description: 'Photo capture/upload' },
  { value: 'signature',  label: 'Signature',      icon: '✍️', description: 'Signature capture pad' },
  { value: 'file',       label: 'File Upload',    icon: '📎', description: 'File attachment' },
  { value: 'calculated', label: 'Calculated',     icon: '🧮', description: 'Auto-calculated from other fields' }
];

/**
 * Template categories (Malaysian FM market)
 */
export const TEMPLATE_CATEGORIES = [
  { value: 'pmc',                  label: 'PMC - Preventive Maintenance' },
  { value: 'cmc',                  label: 'CMC - Comprehensive Maintenance' },
  { value: 'amc',                  label: 'AMC - Annual Maintenance' },
  { value: 'sla',                  label: 'SLA - Service Level Agreement' },
  { value: 'corrective',           label: 'Corrective / Breakdown' },
  { value: 'emergency-on-call',    label: 'Emergency / On-Call' },
  { value: 'time-material',        label: 'Time & Material' },
  { value: 'construction-daily',   label: 'Construction Daily Diary' },
  { value: 'custom',               label: 'Custom' }
];

/**
 * Industry options
 */
export const TEMPLATE_INDUSTRIES = [
  { value: 'maintenance',          label: 'Maintenance' },
  { value: 'construction',         label: 'Construction' },
  { value: 'facilities',           label: 'Facilities Management' },
  { value: 'it-services',          label: 'IT Services' },
  { value: 'property-management',  label: 'Property Management' },
  { value: 'industrial',           label: 'Industrial' },
  { value: 'other',                label: 'Other' }
];

/**
 * Section layout options
 */
export const SECTION_LAYOUTS = [
  { value: 'single_column', label: 'Single Column' },
  { value: 'two_column',    label: 'Two Columns' },
  { value: 'checklist',     label: 'Checklist' }
];

/**
 * Template Service
 */
export class TemplateService {

  // ============================================
  // READ OPERATIONS (Session 12 — preserved)
  // ============================================

  /**
   * Get all templates
   */
  async getTemplates(filters = {}) {
    try {
      console.log('📊 Getting templates...');

      let query = supabase
        .from('templates')
        .select('*')
        .is('deleted_at', null)
        .order('template_name');

      if (filters.industry) {
        query = query.eq('industry', filters.industry);
      }
      if (filters.contract_category) {
        query = query.eq('contract_category', filters.contract_category);
      }
      if (filters.is_public !== undefined) {
        query = query.eq('is_public', filters.is_public);
      }
      if (filters.organization_id) {
        query = query.eq('organization_id', filters.organization_id);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ Error fetching templates:', error);
        throw error;
      }

      console.log('✅ Retrieved templates:', data?.length || 0);
      return data || [];
    } catch (error) {
      console.error('❌ Exception in getTemplates:', error);
      throw error;
    }
  }

  /**
   * Get templates by contract category
   */
  async getTemplatesByCategory(category) {
    try {
      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .eq('contract_category', category)
        .is('deleted_at', null)
        .order('version', { ascending: false });

      if (error) {
        throw error;
      }
      return data || [];
    } catch (error) {
      console.error('❌ Exception in getTemplatesByCategory:', error);
      throw error;
    }
  }

  /**
   * Get single template by UUID or template_id
   */
  async getTemplate(id) {
    try {
      // Try by UUID first
      let { data: template, error } = await supabase
        .from('templates')
        .select('*')
        .eq('id', id)
        .single();

      // If not found, try by template_id
      if (error || !template) {
        const result = await supabase
          .from('templates')
          .select('*')
          .eq('template_id', id)
          .single();
        template = result.data;
        error = result.error;
      }

      if (error) {
        console.error('❌ Error fetching template:', error);
        return null;
      }

      return template;
    } catch (error) {
      console.error('❌ Exception in getTemplate:', error);
      return null;
    }
  }

  /**
   * Get template associated with a contract
   */
  async getTemplateByContract(contractId) {
    try {
      const { data: contract, error: contractError } = await supabase
        .from('contracts')
        .select('template_id')
        .eq('id', contractId)
        .single();

      if (contractError || !contract) {
        return null;
      }
      return await this.getTemplate(contract.template_id);
    } catch (error) {
      console.error('❌ Exception in getTemplateByContract:', error);
      return null;
    }
  }

  // ============================================
  // WRITE OPERATIONS (Session 20 — NEW)
  // ============================================

  /**
   * Create a new template
   * @param {object} templateData - Template data
   * @returns {Promise<{success: boolean, data?: object, error?: string}>}
   */
  async createTemplate(templateData) {
    try {
      console.log('📝 Creating template:', templateData.template_name);

      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        throw new Error('Not authenticated');
      }

      // Generate template_id if not provided
      const template_id = templateData.template_id || this.generateTemplateId(templateData);

      // Validate schema before saving
      const validation = this.validateTemplateSchema({
        ...templateData,
        template_id,
        fields_schema: templateData.fields_schema
      });

      if (!validation.isValid) {
        return { success: false, error: `Validation failed: ${validation.errors.join(', ')}` };
      }

      const insertData = {
        template_id,
        template_name: templateData.template_name,
        industry: templateData.industry || null,
        contract_category: templateData.contract_category || null,
        report_type: templateData.report_type || null,
        fields_schema: templateData.fields_schema,
        validation_rules: templateData.validation_rules || {},
        pdf_layout: templateData.pdf_layout || {},
        version: templateData.version || '1.0',
        is_locked: false,
        is_public: templateData.is_public !== undefined ? templateData.is_public : true,
        organization_id: templateData.organization_id || null,
        created_by: user.id
      };

      const { data, error } = await supabase
        .from('templates')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('❌ Error creating template:', error);
        // Handle unique constraint on template_id
        if (error.code === '23505') {
          return { success: false, error: 'A template with this ID already exists. Try a different name.' };
        }
        return { success: false, error: error.message };
      }

      console.log('✅ Template created:', data.template_id);
      return { success: true, data };

    } catch (error) {
      console.error('❌ Exception in createTemplate:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update an existing template
   * @param {string} id - Template UUID
   * @param {object} updates - Fields to update
   */
  async updateTemplate(id, updates) {
    try {
      console.log('📝 Updating template:', id);

      // Check if locked
      const existing = await this.getTemplate(id);
      if (existing?.is_locked) {
        return { success: false, error: 'This template is locked and cannot be edited. Clone it instead.' };
      }

      // Validate schema if fields_schema is being updated
      if (updates.fields_schema) {
        const validation = this.validateTemplateSchema({
          template_id: existing.template_id,
          template_name: updates.template_name || existing.template_name,
          fields_schema: updates.fields_schema
        });

        if (!validation.isValid) {
          return { success: false, error: `Validation failed: ${validation.errors.join(', ')}` };
        }
      }

      // Don't allow updating certain fields
      const { id: _id, created_at: _created_at, created_by: _created_by, deleted_at: _deleted_at, ...safeUpdates } = updates;

      const { data, error } = await supabase
        .from('templates')
        .update(safeUpdates)
        .eq('id', id)
        .is('deleted_at', null)
        .select()
        .single();

      if (error) {
        console.error('❌ Error updating template:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ Template updated:', data.template_id);
      return { success: true, data };

    } catch (error) {
      console.error('❌ Exception in updateTemplate:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Soft delete a template
   * @param {string} id - Template UUID
   */
  async deleteTemplate(id) {
    try {
      console.log('🗑️ Deleting template:', id);

      // Check if any active contracts use this template
      const contracts = await this.getContractsUsingTemplate(id);
      const activeContracts = contracts.filter(c => c.status === 'active');

      if (activeContracts.length > 0) {
        return {
          success: false,
          error: `Cannot delete: ${activeContracts.length} active contract(s) use this template. Archive or reassign them first.`
        };
      }

      const { error } = await supabase
        .from('templates')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        console.error('❌ Error deleting template:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ Template soft-deleted:', id);
      return { success: true };

    } catch (error) {
      console.error('❌ Exception in deleteTemplate:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Clone a template
   * @param {string} id - Template UUID to clone
   * @param {string} newName - Name for the clone
   */
  async cloneTemplate(id, newName) {
    try {
      console.log('📋 Cloning template:', id);

      const original = await this.getTemplate(id);
      if (!original) {
        return { success: false, error: 'Template not found' };
      }

      const cloneData = {
        template_name: newName || `${original.template_name} (Copy)`,
        industry: original.industry,
        contract_category: original.contract_category,
        report_type: original.report_type,
        fields_schema: JSON.parse(JSON.stringify(original.fields_schema)), // Deep clone
        validation_rules: JSON.parse(JSON.stringify(original.validation_rules || {})),
        pdf_layout: JSON.parse(JSON.stringify(original.pdf_layout || {})),
        version: '1.0',
        is_public: original.is_public,
        organization_id: original.organization_id
      };

      return await this.createTemplate(cloneData);

    } catch (error) {
      console.error('❌ Exception in cloneTemplate:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get contracts that use a template
   * @param {string} templateId - Template UUID
   */
  async getContractsUsingTemplate(templateId) {
    try {
      // contracts.template_id FK was removed in Session 14 (many-to-many migration).
      // Query through the junction table: contract_templates → contracts.
      const { data, error } = await supabase
        .from('contract_templates')
        .select(`
          contract:contracts (
            id,
            contract_number,
            contract_name,
            contract_type,
            status,
            deleted_at,
            created_at,
            project:projects (
              project_name,
              client_name
            )
          )
        `)
        .eq('template_id', templateId);

      if (error) {
        throw error;
      }

      // Unwrap nested contract objects and filter out soft-deleted
      const contracts = (data || [])
        .map(row => row.contract)
        .filter(c => c && !c.deleted_at)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      return contracts;
    } catch (error) {
      console.error('❌ Exception in getContractsUsingTemplate:', error);
      return [];
    }
  }

  /**
   * Lock/unlock a template
   */
  async toggleLock(id) {
    try {
      const template = await this.getTemplate(id);
      if (!template) {
        return { success: false, error: 'Template not found' };
      }

      const { data, error } = await supabase
        .from('templates')
        .update({ is_locked: !template.is_locked })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ============================================
  // HELPERS
  // ============================================

  /**
   * Generate a template_id slug from template data
   */
  generateTemplateId(data) {
    const category = (data.contract_category || 'custom').toLowerCase().replace(/[^a-z0-9]/g, '-');
    const name = (data.template_name || 'template')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .substring(0, 40);
    const suffix = `v${data.version || '1'}`;
    return `${category}-${name}-${suffix}`;
  }

  /**
   * Create a blank section
   */
  createBlankSection(index = 0) {
    return {
      section_id: `section_${Date.now()}_${index}`,
      section_name: '',
      description: '',
      required: false,
      layout: 'single_column',
      fields: []
    };
  }

  /**
   * Create a blank field
   */
  createBlankField(index = 0) {
    return {
      field_id: `field_${Date.now()}_${index}`,
      field_name: '',
      field_type: 'text',
      required: false,
      placeholder: '',
      description: '',
      default_value: '',
      options: [],
      prefill_from: '',
      show_if: null,
      auto_calculate: false,
      formula: ''
    };
  }

  /**
   * Create a blank template structure
   */
  createBlankTemplate() {
    return {
      template_name: '',
      industry: 'maintenance',
      contract_category: 'custom',
      report_type: '',
      version: '1.0',
      is_public: true,
      fields_schema: {
        sections: [this.createBlankSection(0)]
      },
      validation_rules: {},
      pdf_layout: {}
    };
  }

  /**
   * Validate template schema (Session 12 — preserved)
   */
  validateTemplateSchema(template) {
    const errors = [];

    if (!template.template_id) {
      errors.push('Missing template_id');
    }
    if (!template.template_name) {
      errors.push('Missing template_name');
    }
    if (!template.fields_schema) {
      errors.push('Missing fields_schema');
    }

    if (template.fields_schema) {
      if (!template.fields_schema.sections || !Array.isArray(template.fields_schema.sections)) {
        errors.push('fields_schema.sections must be an array');
      } else {
        template.fields_schema.sections.forEach((section, sIndex) => {
          if (!section.section_id) {
            errors.push(`Section ${sIndex + 1} missing section_id`);
          }
          if (!section.section_name) {
            errors.push(`Section ${sIndex + 1}: "Section Name" is required`);
          }
          if (!section.fields || !Array.isArray(section.fields)) {
            errors.push(`Section ${sIndex + 1} missing fields array`);
          } else {
            if (section.fields.length === 0) {
              errors.push(`Section "${section.section_name || sIndex + 1}" has no fields`);
            }
            section.fields.forEach((field, fIndex) => {
              if (!field.field_id) {
                errors.push(`Section ${sIndex + 1}, Field ${fIndex + 1} missing field_id`);
              }
              if (!field.field_name) {
                errors.push(`Section "${section.section_name || sIndex + 1}", Field ${fIndex + 1}: "Field Name" is required`);
              }
              if (!field.field_type) {
                errors.push(`Section "${section.section_name || sIndex + 1}", Field "${field.field_name || fIndex + 1}": "Field Type" is required`);
              }
              // Validate options for select/radio types
              if (['select', 'radio'].includes(field.field_type)) {
                if (!field.options || field.options.length === 0) {
                  errors.push(`Field "${field.field_name || fIndex + 1}" (${field.field_type}) needs at least one option`);
                }
              }
            });
          }
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get field count for a template
   */
  getFieldCount(template) {
    if (!template?.fields_schema?.sections) {
      return 0;
    }
    return template.fields_schema.sections.reduce((count, section) => {
      return count + (section.fields?.length || 0);
    }, 0);
  }

  /**
   * Get section count
   */
  getSectionCount(template) {
    return template?.fields_schema?.sections?.length || 0;
  }

  /**
   * Extract all field IDs
   */
  getFieldIds(template) {
    if (!template?.fields_schema?.sections) {
      return [];
    }
    const fieldIds = [];
    template.fields_schema.sections.forEach(section => {
      section.fields?.forEach(field => {
        fieldIds.push(`${section.section_id}.${field.field_id}`);
      });
    });
    return fieldIds;
  }

  /**
   * Get template summary
   */
  getTemplateSummary(template) {
    return {
      id: template.id,
      template_id: template.template_id,
      name: template.template_name,
      industry: template.industry,
      category: template.contract_category,
      version: template.version,
      sectionCount: this.getSectionCount(template),
      fieldCount: this.getFieldCount(template),
      estimatedTime: template.metadata?.estimated_completion_time,
      requiresApproval: template.metadata?.approval_required,
      offlineCapable: template.metadata?.offline_capable
    };
  }
}

export const templateService = new TemplateService();
export default templateService;
