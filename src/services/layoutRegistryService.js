/**
 * WorkLedger - Layout Registry Service
 * 
 * Manages report layouts:
 * - Fetch available layouts by template type
 * - Get complete layout details
 * - Cache layouts for performance
 * 
 * @module services/layoutRegistryService
 * @created February 12, 2026 - Session 2
 */

import { supabase } from './supabase/client';

class LayoutRegistryService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }
  
  /**
   * Get available layouts for a template type
   * 
   * @param {string} templateType - e.g., 'PMC', 'CMC', 'AMC'
   * @param {string} organizationId - Optional organization filter
   * @returns {Promise<Array>} Array of available layouts
   */
  async getAvailableLayouts(templateType, organizationId = null) {
    try {
      console.log('📋 LayoutRegistry: Fetching layouts for:', templateType);
      
      // Check cache
      const cacheKey = `${templateType}-${organizationId || 'public'}`;
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        console.log('  ✅ Using cached layouts');
        return cached.data;
      }
      
      // Build query
      let query = supabase
        .from('report_layouts')
        .select('layout_id, layout_name, description, preview_config')
        .contains('compatible_template_types', [templateType])
        .eq('is_active', true)
        .order('layout_name');
      
      // Filter by access
      if (organizationId) {
        query = query.or(`is_public.eq.true,organization_id.eq.${organizationId}`);
      } else {
        query = query.eq('is_public', true);
      }
      
      const { data, error } = await query;
      
      if (error) {
        throw error;
      }
      
      // Transform data
      const layouts = data.map(layout => ({
        layoutId: layout.layout_id,
        name: layout.layout_name,
        description: layout.description,
        preview: layout.preview_config?.thumbnail
      }));
      
      // Cache
      this.cache.set(cacheKey, {
        data: layouts,
        timestamp: Date.now()
      });
      
      console.log(`  ✅ Found ${layouts.length} layouts`);
      return layouts;
      
    } catch (error) {
      console.error('❌ Failed to fetch layouts:', error);
      throw error;
    }
  }
  
  /**
   * Get complete layout details
   * 
   * @param {string} layoutId - Layout ID
   * @returns {Promise<Object>} Complete layout with schema and binding rules
   */
  async getLayout(layoutId) {
    try {
      console.log('📋 LayoutRegistry: Fetching layout:', layoutId);
      
      // Check cache
      const cacheKey = `layout-${layoutId}`;
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        console.log('  ✅ Using cached layout');
        return cached.data;
      }
      
      const { data, error } = await supabase
        .from('report_layouts')
        .select('*')
        .eq('layout_id', layoutId)
        .eq('is_active', true)
        .single();
      
      if (error) {
        throw error;
      }
      
      if (!data) {
        throw new Error(`Layout not found: ${layoutId}`);
      }
      
      // Cache
      this.cache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });
      
      console.log('  ✅ Layout fetched:', data.layout_name);
      return data;
      
    } catch (error) {
      console.error('❌ Failed to fetch layout:', error);
      throw error;
    }
  }
  
  /**
   * Clear cache (for testing or after layout updates)
   */
  clearCache() {
    this.cache.clear();
    console.log('🗑️ Layout cache cleared');
  }
}

// Export singleton instance
export const layoutRegistryService = new LayoutRegistryService();
