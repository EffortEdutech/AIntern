/**
 * WorkLedger - Layout List Page (FINAL FIXED)
 * 
 * Browse all report layouts with filtering, search, and quick actions.
 * 
 * FIX: Proper delete handling (service returns true on success)
 * FIX: Removed profile references
 * FIX: Response format handling
 * 
 * @page /reports/layouts
 * @created February 12, 2026 - Session 6
 * @fixed February 18, 2026 - Session 8: Delete handling
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { layoutService } from '../../../services/api/layoutService';
import AppLayout from '../../../components/layout/AppLayout';
import LoadingSpinner from '../../../components/common/LoadingSpinner';
import { useToast } from '../../../context/ToastContext';

export default function LayoutList() {
  const toast = useToast();
  const navigate = useNavigate();
  
  const [layouts, setLayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState({ templateType: '', isActive: true });
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => {
    loadLayouts();
  }, [filter, showInactive]);

  const loadLayouts = async () => {
    try {
      setLoading(true);
      
      const filters = {
        ...filter,
        search,
        isActive: showInactive ? undefined : true
      };
      
      const result = await layoutService.getLayouts(filters);
      
      // Handle different response formats
      let layoutsData = [];
      if (Array.isArray(result)) {
        layoutsData = result;
      } else if (result && result.data) {
        layoutsData = result.data;
      }
      
      setLayouts(layoutsData);
      
    } catch (error) {
      console.error('❌ Error loading layouts:', error);
      toast.error('Failed to load layouts: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    loadLayouts();
  };

  const handleClone = async (layout) => {
    const newName = prompt(`Clone "${layout.layout_name}" as:`, `${layout.layout_name} (Copy)`);
    
    if (!newName) {
      return;
    }
    
    try {
      const cloned = await layoutService.cloneLayout(layout.id, newName);
      
      if (cloned && cloned.id) {
        toast.success(`Layout cloned: ${cloned.layout_name}`);
        loadLayouts();
      } else {
        toast.error('Failed to clone layout');
      }
    } catch (error) {
      console.error('❌ Error cloning layout:', error);
      toast.error(`Failed to clone: ${error.message || 'Unknown error'}`);
    }
  };

  const handleDelete = async (layout) => {
    if (!confirm(`Deactivate layout "${layout.layout_name}"?\n\nThis will set it as inactive.`)) {
      return;
    }
    
    try {
      console.log('🗑️ Deactivating layout:', layout.id);
      
      const result = await layoutService.deleteLayout(layout.id);
      
      if (result === true) {
        toast.success('Layout deactivated successfully');
        loadLayouts();
      } else {
        toast.warning('Layout deactivation status unclear - refreshing list');
        loadLayouts();
      }
      
    } catch (error) {
      console.error('❌ Error deactivating layout:', error);
      const errorMsg = error.message || error.toString() || 'Unknown error';
      toast.error(`Failed to deactivate: ${errorMsg}`);
    }
  };

  const handleHardDelete = async (layout) => {
    const confirmation = prompt(
      '⚠️ PERMANENT DELETE\n\n' +
      `This will PERMANENTLY delete "${layout.layout_name}" from the database.\n` +
      'This action CANNOT be undone!\n\n' +
      'Type "DELETE" to confirm:',
      ''
    );
    
    if (confirmation !== 'DELETE') {
      return;
    }
    
    try {
      console.log('💀 Permanently deleting layout:', layout.id);
      
      const result = await layoutService.hardDeleteLayout(layout.id);
      
      if (result === true) {
        toast.success('Layout permanently deleted from database');
        loadLayouts();
      } else {
        toast.warning('Layout deletion status unclear - refreshing list');
        loadLayouts();
      }
      
    } catch (error) {
      console.error('❌ Error permanently deleting layout:', error);
      const errorMsg = error.message || error.toString() || 'Unknown error';
      toast.error(`Failed to delete permanently: ${errorMsg}`);
    }
  };

  const handleReactivate = async (layout) => {
    if (!confirm(`Reactivate layout "${layout.layout_name}"?`)) {
      return;
    }
    
    try {
      console.log('♻️ Reactivating layout:', layout.id);
      
      const result = await layoutService.updateLayout(layout.id, {
        is_active: true
      });
      
      if (result && result.id) {
        toast.success('Layout reactivated successfully');
        loadLayouts();
      } else {
        toast.warning('Layout reactivation status unclear - refreshing list');
        loadLayouts();
      }
      
    } catch (error) {
      console.error('❌ Error reactivating layout:', error);
      const errorMsg = error.message || error.toString() || 'Unknown error';
      toast.error(`Failed to reactivate: ${errorMsg}`);
    }
  };

  const templateTypes = [
    { value: '', label: 'All Types' },
    { value: 'comprehensive-maintenance', label: 'CMC - Comprehensive Maintenance' },
    { value: 'preventive-maintenance', label: 'PMC - Preventive Maintenance' },
    { value: 'corrective-maintenance', label: 'Corrective Maintenance' },
    { value: 'service-level', label: 'SLA - Service Level Agreement' }
  ];

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Report Layouts</h1>
            <p className="text-sm text-gray-600 mt-1">
              Manage report layout templates for different contract types
            </p>
          </div>
          <Link
            to="/reports/layouts/new"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <span>➕</span>
            Create Layout
          </Link>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <form onSubmit={handleSearch} className="flex gap-4">
            <div className="flex-1">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search layouts..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <select
              value={filter.templateType}
              onChange={(e) => setFilter({ ...filter, templateType: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {templateTypes.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>

            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Search
            </button>
          </form>

          <div className="mt-3 flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="rounded"
              />
              <span className="text-gray-700">Show inactive layouts</span>
            </label>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center py-12">
            <LoadingSpinner />
          </div>
        )}

        {/* Layout List */}
        {!loading && layouts.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <div className="text-5xl mb-4">📄</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No layouts found</h3>
            <p className="text-sm text-gray-600 mb-4">
              {search ? 'Try adjusting your search filters' : 'Get started by creating your first layout'}
            </p>
            {!search && (
              <Link
                to="/reports/layouts/new"
                className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Create Layout
              </Link>
            )}
          </div>
        )}

        {!loading && layouts.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {layouts.map(layout => (
              <LayoutCard
                key={layout.id}
                layout={layout}
                onClone={handleClone}
                onDelete={handleDelete}
                onHardDelete={handleHardDelete}
                onReactivate={handleReactivate}
                onEdit={() => navigate(`/reports/layouts/${layout.id}/edit`)}
              />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

/**
 * Layout Card Component
 */
function LayoutCard({ layout, onClone, onDelete, onHardDelete, onReactivate, onEdit }) {
  const isActive = layout.is_active;
  
  return (
    <div className={`bg-white rounded-lg border-2 overflow-hidden hover:shadow-lg transition-shadow ${
      !isActive ? 'border-red-200 opacity-75' : 'border-gray-200'
    }`}>
      {/* Header */}
      <div className={`p-4 ${
        isActive 
          ? 'bg-gradient-to-r from-blue-500 to-blue-600' 
          : 'bg-gradient-to-r from-gray-400 to-gray-500'
      }`}>
        <h3 className="font-semibold text-white truncate">
          {layout.layout_name}
        </h3>
        {layout.description && (
          <p className="text-sm text-blue-100 mt-1 line-clamp-2">
            {layout.description}
          </p>
        )}
      </div>

      {/* Body */}
      <div className="p-4">
        {/* Stats */}
        <div className="flex items-center gap-3 text-xs text-gray-600 mb-4">
          <span>📦 {layout.layout_schema?.sections?.length || 0} sections</span>
          <span>📄 {layout.layout_schema?.page?.size || 'A4'}</span>
          <span>{layout.version}</span>
        </div>

        {/* Compatible Types */}
        <div className="mb-4">
          <div className="text-xs text-gray-600 mb-1">Compatible types:</div>
          <div className="flex flex-wrap gap-1">
            {layout.compatible_template_types?.slice(0, 2).map((type, idx) => (
              <span
                key={idx}
                className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded"
              >
                {type}
              </span>
            ))}
            {layout.compatible_template_types?.length > 2 && (
              <span className="text-xs text-gray-500">
                +{layout.compatible_template_types.length - 2}
              </span>
            )}
          </div>
        </div>

        {/* Status */}
        <div className="mb-4">
          <span className={`inline-block text-xs px-2 py-1 rounded font-medium ${
            isActive 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            {isActive ? '✓ Active' : '✗ Inactive'}
          </span>
        </div>

        {/* Actions - Different for Active vs Inactive */}
        {isActive ? (
          // ACTIVE LAYOUT ACTIONS
          <div className="space-y-2">
            <div className="flex gap-2">
              <button
                onClick={onEdit}
                className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Edit
              </button>
              <button
                onClick={() => onClone(layout)}
                className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                title="Clone"
              >
                📋
              </button>
            </div>
            <button
              onClick={() => onDelete(layout)}
              className="w-full px-3 py-2 text-sm bg-yellow-50 text-yellow-700 border border-yellow-300 rounded-lg hover:bg-yellow-100"
            >
              🗑️ Deactivate
            </button>
          </div>
        ) : (
          // INACTIVE LAYOUT ACTIONS
          <div className="space-y-2">
            <button
              onClick={() => onReactivate(layout)}
              className="w-full px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              ♻️ Reactivate
            </button>
            <button
              onClick={() => onClone(layout)}
              className="w-full px-3 py-2 text-sm bg-gray-100 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-200"
            >
              📋 Clone
            </button>
            <button
              onClick={() => onHardDelete(layout)}
              className="w-full px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
            >
              💀 Delete Permanently
            </button>
            <p className="text-xs text-red-600 text-center">
              ⚠️ Permanent deletion cannot be undone!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
