/**
 * WorkLedger - Layout Service (FIXED - No is_default)
 * 
 * Complete CRUD operations for report layout management.
 * 
 * FIX: Removed is_default column (not in database schema)
 * 
 * @module services/api/layoutService
 * @created February 12, 2026 - Session 6
 * @fixed February 17, 2026 - Session 8: Removed is_default
 */

import { supabase } from '../supabase/client';

/**
 * Available block types for layout builder
 */
export const BLOCK_TYPES = [
  {
    type: 'header',
    label: 'Header',
    icon: '📌',
    description: 'Report title and metadata',
    defaultContent: {
      title: 'Work Report',
      subtitle: ''
    }
  },
  {
    type: 'detail_entry',
    label: 'Detail Entry',
    icon: '📋',
    description: 'Key-value pairs in columns',
    defaultOptions: {
      columns: 2,
      layout: 'two_column'
    }
  },
  {
    type: 'text_section',
    label: 'Text Section',
    icon: '📝',
    description: 'Free-form text content',
    defaultOptions: {
      title: 'Observations'
    }
  },
  {
    type: 'checklist',
    label: 'Checklist',
    icon: '✅',
    description: 'Task list with status',
    defaultOptions: {
      showStatus: true
    }
  },
  {
    type: 'table',
    label: 'Table',
    icon: '📊',
    description: 'Structured data table',
    defaultOptions: {
      showHeaders: true
    }
  },
  {
    type: 'photo_grid',
    label: 'Photo Grid',
    icon: '📷',
    description: 'Photo gallery',
    defaultOptions: {
      columns: 2,
      showTimestamps: true,
      showCaptions: true
    }
  },
  {
    type: 'signature_box',
    label: 'Signature Box',
    icon: '✍️',
    description: 'Signature capture area',
    defaultOptions: {
      title: 'Signatures'
    }
  },
  {
    type: 'metrics_cards',
    label: 'Metrics Cards',
    icon: '📈',
    description: 'Statistics cards',
    defaultOptions: {
      columns: 3
    }
  }
];

class LayoutService {
  /**
   * Get all layouts with optional filtering
   */
  async getLayouts(filters = {}) {
    try {
      console.log('📋 Fetching layouts...', filters);

      let query = supabase
        .from('report_layouts')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters.templateType) {
        query = query.contains('compatible_template_types', [filters.templateType]);
      }

      if (filters.isActive !== undefined) {
        query = query.eq('is_active', filters.isActive);
      }

      if (filters.search) {
        query = query.ilike('layout_name', `%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) {
        throw error;
      }

      console.log(`✅ Found ${data.length} layouts`);
      return data;

    } catch (error) {
      console.error('❌ Failed to fetch layouts:', error);
      throw error;
    }
  }

  /**
   * Get single layout by ID or layout_id
   */
  async getLayout(identifier) {
    try {
      console.log('📄 Fetching layout:', identifier);

      let query = supabase
        .from('report_layouts')
        .select('*')
        .eq('id', identifier)
        .maybeSingle();

      let { data, error } = await query;

      if (!data && !error) {
        query = supabase
          .from('report_layouts')
          .select('*')
          .eq('layout_id', identifier)
          .maybeSingle();

        ({ data, error } = await query);
      }

      if (error) {
        throw error;
      }
      if (!data) {
        throw new Error('Layout not found');
      }

      console.log('✅ Layout found:', data.layout_name);
      return data;

    } catch (error) {
      console.error('❌ Failed to fetch layout:', error);
      throw error;
    }
  }

  /**
   * Validate layout schema structure
   */
  validateLayoutSchema(schema) {
    if (!schema) {
      throw new Error('Layout schema is required');
    }

    if (!schema.page) {
      throw new Error('Schema must have page configuration');
    }

    if (!schema.sections || !Array.isArray(schema.sections)) {
      throw new Error('Schema must have sections array');
    }

    schema.sections.forEach((section, index) => {
      if (!section.section_id) {
        throw new Error(`Section ${index} missing section_id`);
      }
      if (!section.block_type) {
        throw new Error(`Section ${index} missing block_type`);
      }
    });

    return true;
  }

  /**
   * Create new layout
   * FIX: Removed is_default column (doesn't exist in database)
   * FIX: Added timestamp to layout_id to ensure uniqueness
   */
  async createLayout(layoutData) {
    try {
      console.log('📝 Creating layout:', layoutData.layout_name);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      this.validateLayoutSchema(layoutData.layout_schema);

      // Generate layout_id from name with timestamp for uniqueness
      const baseLayoutId = layoutData.layout_id || 
        layoutData.layout_name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '');
      
      // Add timestamp suffix to ensure uniqueness
      const timestamp = Date.now();
      const layoutId = `${baseLayoutId}_${timestamp}`;

      // Prepare layout object - REMOVED is_default!
      const newLayout = {
        layout_id: layoutId,
        layout_name: layoutData.layout_name,
        description: layoutData.description || null,
        compatible_template_types: layoutData.compatible_template_types || [],
        layout_schema: layoutData.layout_schema,
        binding_rules: layoutData.binding_rules || {},
        preview_config: layoutData.preview_config || null,
        is_public: layoutData.is_public !== undefined ? layoutData.is_public : true,
        organization_id: layoutData.organization_id || null,
        version: layoutData.version || '1.0',
        is_active: layoutData.is_active !== undefined ? layoutData.is_active : true,
        created_by: user.id
        // REMOVED: is_default (column doesn't exist!)
      };

      const { data, error } = await supabase
        .from('report_layouts')
        .insert(newLayout)
        .select()
        .single();

      if (error) {
        throw error;
      }

      console.log('✅ Layout created:', data.id);
      return data;

    } catch (error) {
      console.error('❌ Failed to create layout:', error);
      throw error;
    }
  }

  /**
   * Update existing layout
   */
  async updateLayout(id, updates) {
    try {
      console.log('✏️ Updating layout:', id);

      if (updates.layout_schema) {
        this.validateLayoutSchema(updates.layout_schema);
      }

      const { 
        id: _, 
        created_at: _created_at, 
        created_by: _created_by, 
        is_default: _is_default, // Remove if present
        ...allowedUpdates 
      } = updates;

      allowedUpdates.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('report_layouts')
        .update(allowedUpdates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      console.log('✅ Layout updated:', data.layout_name);
      return data;

    } catch (error) {
      console.error('❌ Failed to update layout:', error);
      throw error;
    }
  }

  /**
   * Delete layout (soft delete)
   */
  async deleteLayout(id) {
    try {
      console.log('🗑️ Deleting layout:', id);

      const usage = await this.getLayoutUsage(id);
      if (usage > 0) {
        throw new Error(`Cannot delete layout: ${usage} reports are using it`);
      }

      const { error } = await supabase
        .from('report_layouts')
        .update({
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) {
        throw error;
      }

      console.log('✅ Layout deleted (soft)');
      return true;

    } catch (error) {
      console.error('❌ Failed to delete layout:', error);
      throw error;
    }
  }

  /**
   * Permanently delete layout (hard delete)
   * WARNING: This actually removes the record from database!
   * Should only be used for inactive layouts.
   * 
   * @param {string} id - Layout UUID
   * @returns {Promise<boolean>} Success status
   */
  async hardDeleteLayout(id) {
    try {
      console.log('💀 PERMANENTLY deleting layout:', id);

      // Get layout first to check if it's inactive
      const layout = await this.getLayout(id);
      
      if (layout.is_active) {
        throw new Error('Cannot permanently delete active layout. Deactivate it first.');
      }

      // Check if layout is in use by reports
      const usage = await this.getLayoutUsage(id);
      if (usage > 0) {
        throw new Error(`Cannot delete layout: ${usage} reports are using it`);
      }

      // Check if layout is in use by contracts as default layout
      const { count: contractCount, error: contractError } = await supabase
        .from('contracts')
        .select('*', { count: 'exact', head: true })
        .eq('default_layout_id', id);

      if (!contractError && contractCount > 0) {
        throw new Error(
          `Cannot delete layout: ${contractCount} contract(s) are using it as default layout. ` +
          'Please update those contracts to use a different layout first.'
        );
      }

      // HARD DELETE - Actually remove from database
      const { data, error } = await supabase
        .from('report_layouts')
        .delete()
        .eq('id', id)
        .select();  // ← Added .select() to verify deletion

      if (error) {
        console.error('❌ Supabase delete error:', error);
        throw error;
      }

      // Verify deletion happened
      if (!data || data.length === 0) {
        console.error('❌ Delete returned no data - might be blocked by RLS');
        throw new Error('Failed to delete layout - check RLS policies or permissions');
      }

      console.log('✅ Layout permanently deleted from database:', data);
      return true;

    } catch (error) {
      console.error('❌ Failed to permanently delete layout:', error);
      throw error;
    }
  }

  /**
   * Get layout usage count
   */
  async getLayoutUsage(layoutId) {
    try {
      const { count, error } = await supabase
        .from('generated_reports')
        .select('*', { count: 'exact', head: true })
        .eq('layout_id', layoutId);

      if (error) {
        console.warn('⚠️ Could not fetch usage count:', error.message);
        return 0;
      }

      return count || 0;

    } catch (error) {
      console.warn('⚠️ getLayoutUsage failed silently:', error.message);
      return 0;
    }
  }

  /**
   * Clone existing layout
   */
  async cloneLayout(id, newName) {
    try {
      console.log('📋 Cloning layout:', id, '→', newName);

      const original = await this.getLayout(id);

      const cloneData = {
        layout_name: newName,
        description: original.description 
          ? `${original.description} (Clone)` 
          : 'Cloned layout',
        compatible_template_types: original.compatible_template_types,
        layout_schema: original.layout_schema,
        binding_rules: original.binding_rules,
        preview_config: original.preview_config,
        is_public: original.is_public,
        version: '1.0'
      };

      return await this.createLayout(cloneData);

    } catch (error) {
      console.error('❌ Failed to clone layout:', error);
      throw error;
    }
  }

  /**
   * Get empty schema template
   */
  getEmptySchema() {
    return {
      page: {
        size: 'A4',
        orientation: 'portrait',
        margins: {
          top: 20,
          right: 20,
          bottom: 20,
          left: 20
        }
      },
      sections: []
    };
  }
}

export const layoutService = new LayoutService();
