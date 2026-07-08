/**
 * WorkLedger - Contract Layout Service
 * 
 * Manages assignment of layouts to contracts.
 * Handles many-to-many relationship and default layout.
 * 
 * @module services/api/contractLayoutService
 * @created February 13, 2026
 */

import { supabase } from '../supabase/client';

class ContractLayoutService {
  /**
   * Get all layouts assigned to a contract
   * 
   * @param {string} contractId - Contract UUID
   * @returns {Promise<Array>} Assigned layouts with metadata
   */
  async getAssignedLayouts(contractId) {
    try {
      console.log('📋 Fetching assigned layouts for contract:', contractId);
      
      const { data, error } = await supabase
        .from('contract_layouts')
        .select(`
          id,
          assigned_at,
          assigned_by,
          notes,
          layout:report_layouts!contract_layouts_layout_id_fkey(
            id,
            layout_id,
            layout_name,
            description,
            compatible_template_types,
            is_active
          )
        `)
        .eq('contract_id', contractId)
        .order('assigned_at', { ascending: false });
      
      if (error) {
        throw error;
      }
      
      // Flatten structure
      const layouts = data.map(item => ({
        assignment_id: item.id,
        assigned_at: item.assigned_at,
        assigned_by: item.assigned_by,
        notes: item.notes,
        ...item.layout
      }));
      
      console.log(`✅ Found ${layouts.length} assigned layouts`);
      return layouts;
      
    } catch (error) {
      console.error('❌ Failed to fetch assigned layouts:', error);
      throw error;
    }
  }
  
  /**
   * Get contract's default layout
   * 
   * @param {string} contractId - Contract UUID
   * @returns {Promise<Object>} Default layout
   */
  async getDefaultLayout(contractId) {
    try {
      console.log('🎯 Fetching default layout for contract:', contractId);
      
      const { data, error } = await supabase
        .from('contracts')
        .select(`
          default_layout_id,
          default_layout:report_layouts!contracts_default_layout_id_fkey(
            id,
            layout_id,
            layout_name,
            description,
            layout_schema,
            compatible_template_types
          )
        `)
        .eq('id', contractId)
        .single();
      
      if (error) {
        throw error;
      }
      
      console.log('✅ Default layout:', data.default_layout?.layout_name);
      return data.default_layout;
      
    } catch (error) {
      console.error('❌ Failed to fetch default layout:', error);
      throw error;
    }
  }
  
  /**
   * Assign a layout to a contract
   * 
   * @param {string} contractId - Contract UUID
   * @param {string} layoutId - Layout UUID
   * @param {Object} options - Assignment options
   * @returns {Promise<Object>} Assignment result
   */
  async assignLayout(contractId, layoutId, options = {}) {
    try {
      console.log(`📌 Assigning layout ${layoutId} to contract ${contractId}`);
      
      // Check if layout is compatible with contract's template
      const isCompatible = await this.checkCompatibility(contractId, layoutId);
      if (!isCompatible) {
        throw new Error('Layout is not compatible with contract template type');
      }
      
      // Insert assignment
      const { data, error } = await supabase
        .from('contract_layouts')
        .insert({
          contract_id: contractId,
          layout_id: layoutId,
          assigned_by: (await supabase.auth.getUser()).data.user?.id,
          notes: options.notes
        })
        .select()
        .single();
      
      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          throw new Error('Layout already assigned to this contract');
        }
        throw error;
      }
      
      // If this is the first layout, set as default
      const assignedLayouts = await this.getAssignedLayouts(contractId);
      if (assignedLayouts.length === 1) {
        await this.setDefaultLayout(contractId, layoutId);
      }
      
      console.log('✅ Layout assigned successfully');
      return {
        success: true,
        assignment: data
      };
      
    } catch (error) {
      console.error('❌ Failed to assign layout:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Remove a layout assignment from a contract
   * 
   * @param {string} contractId - Contract UUID
   * @param {string} layoutId - Layout UUID
   * @returns {Promise<Object>} Removal result
   */
  async removeLayout(contractId, layoutId) {
    try {
      console.log(`🗑️ Removing layout ${layoutId} from contract ${contractId}`);
      
      // Check if it's the default layout
      const contract = await this.getDefaultLayout(contractId);
      if (contract?.id === layoutId) {
        throw new Error('Cannot remove default layout. Set another layout as default first.');
      }
      
      // Check if it's the last layout
      const assignedLayouts = await this.getAssignedLayouts(contractId);
      if (assignedLayouts.length === 1) {
        throw new Error('Cannot remove the last layout. Contract must have at least one layout.');
      }
      
      // Delete assignment
      const { error } = await supabase
        .from('contract_layouts')
        .delete()
        .eq('contract_id', contractId)
        .eq('layout_id', layoutId);
      
      if (error) {
        throw error;
      }
      
      console.log('✅ Layout removed successfully');
      return {
        success: true
      };
      
    } catch (error) {
      console.error('❌ Failed to remove layout:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Set default layout for a contract
   * 
   * @param {string} contractId - Contract UUID
   * @param {string} layoutId - Layout UUID
   * @returns {Promise<Object>} Update result
   */
  async setDefaultLayout(contractId, layoutId) {
    try {
      console.log(`🎯 Setting default layout ${layoutId} for contract ${contractId}`);
      
      // Verify layout is assigned
      const assignedLayouts = await this.getAssignedLayouts(contractId);
      const isAssigned = assignedLayouts.some(l => l.id === layoutId);
      
      if (!isAssigned) {
        throw new Error('Layout must be assigned to contract before setting as default');
      }
      
      // Update default
      const { error } = await supabase
        .from('contracts')
        .update({ default_layout_id: layoutId })
        .eq('id', contractId);
      
      if (error) {
        throw error;
      }
      
      console.log('✅ Default layout set successfully');
      return {
        success: true
      };
      
    } catch (error) {
      console.error('❌ Failed to set default layout:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Check if layout is compatible with contract
   * 
   * @param {string} contractId - Contract UUID
   * @param {string} layoutId - Layout UUID
   * @returns {Promise<boolean>} Compatibility result
   */
  async checkCompatibility(contractId, layoutId) {
    try {
      // Get contract category
      const { data: contract } = await supabase
        .from('contracts')
        .select('contract_category')
        .eq('id', contractId)
        .single();
      
      // Get layout compatible types
      const { data: layout } = await supabase
        .from('report_layouts')
        .select('compatible_template_types')
        .eq('id', layoutId)
        .single();
      
      if (!contract || !layout) {
        return false;
      }
      
      // Check if contract category is in compatible types
      const isCompatible = layout.compatible_template_types?.includes(contract.contract_category);
      
      console.log(`🔍 Compatibility check: ${isCompatible ? '✅' : '❌'}`);
      return isCompatible;
      
    } catch (error) {
      console.error('❌ Compatibility check failed:', error);
      return false;
    }
  }
  
  /**
   * Get available layouts for a contract (not yet assigned)
   * 
   * @param {string} contractId - Contract UUID
   * @returns {Promise<Array>} Available layouts
   */
  async getAvailableLayouts(contractId) {
    try {
      console.log('🔍 Fetching available layouts for contract:', contractId);
      
      // Get contract category
      const { data: contract } = await supabase
        .from('contracts')
        .select('contract_category, organization_id')
        .eq('id', contractId)
        .single();
      
      if (!contract) {
        throw new Error('Contract not found');
      }
      
      // Get already assigned layout IDs
      const assigned = await this.getAssignedLayouts(contractId);
      const assignedIds = assigned.map(l => l.id);
      
      // Get compatible layouts that aren't assigned yet
      const { data, error } = await supabase
        .from('report_layouts')
        .select('*')
        .eq('is_active', true)
        .or(`organization_id.is.null,organization_id.eq.${contract.organization_id}`)
        .contains('compatible_template_types', [contract.contract_category]);
      
      if (error) {
        throw error;
      }
      
      // Filter out assigned layouts
      const available = data.filter(layout => !assignedIds.includes(layout.id));
      
      console.log(`✅ Found ${available.length} available layouts`);
      return available;
      
    } catch (error) {
      console.error('❌ Failed to fetch available layouts:', error);
      throw error;
    }
  }
  
  /**
   * Initialize contract with simple_v1 layout (for new contracts)
   * 
   * @param {string} contractId - Contract UUID
   * @returns {Promise<Object>} Initialization result
   */
  async initializeContractLayouts(contractId) {
    try {
      console.log('🚀 Initializing layouts for new contract:', contractId);
      
      // Get simple_v1 layout
      const { data: simpleLayout } = await supabase
        .from('report_layouts')
        .select('id')
        .eq('layout_id', 'simple_v1')
        .single();
      
      if (!simpleLayout) {
        console.warn('⚠️ simple_v1 layout not found, skipping initialization');
        return { success: false, error: 'simple_v1 not found' };
      }
      
      // Assign simple_v1
      const assignResult = await this.assignLayout(contractId, simpleLayout.id, {
        notes: 'Auto-assigned on contract creation'
      });
      
      if (!assignResult.success) {
        throw new Error(assignResult.error);
      }
      
      // Set as default
      await this.setDefaultLayout(contractId, simpleLayout.id);
      
      console.log('✅ Contract initialized with simple_v1 layout');
      return { success: true };
      
    } catch (error) {
      console.error('❌ Failed to initialize contract layouts:', error);
      return { success: false, error: error.message };
    }
  }
}

// Export singleton
export const contractLayoutService = new ContractLayoutService();
