/**
 * WorkLedger - Contract Layout Settings
 * 
 * UI component for managing layout assignments to a contract.
 * Shows assigned layouts, allows add/remove, and set default.
 * 
 * @component
 * @created February 13, 2026
 */

import { useState, useEffect } from 'react';
import { contractLayoutService } from '../../services/api/contractLayoutService';
import { useToast } from '../../context/ToastContext';

export default function ContractLayoutSettings({ contractId }) {
  const toast = useToast();
  const [assignedLayouts, setAssignedLayouts] = useState([]);
  const [availableLayouts, setAvailableLayouts] = useState([]);
  const [defaultLayoutId, setDefaultLayoutId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadLayouts();
  }, [contractId]);

  const loadLayouts = async () => {
    try {
      setLoading(true);
      
      // Load assigned layouts
      const assigned = await contractLayoutService.getAssignedLayouts(contractId);
      setAssignedLayouts(assigned);
      
      // Load default layout
      const defaultLayout = await contractLayoutService.getDefaultLayout(contractId);
      setDefaultLayoutId(defaultLayout?.id);
      
      // Load available layouts
      const available = await contractLayoutService.getAvailableLayouts(contractId);
      setAvailableLayouts(available);
      
    } catch (error) {
      console.error('Failed to load layouts:', error);
      toast.error('Failed to load layouts');
    } finally {
      setLoading(false);
    }
  };

  const handleAddLayout = async (layoutId) => {
    try {
      setProcessing(true);
      const result = await contractLayoutService.assignLayout(contractId, layoutId);
      
      if (result.success) {
        toast.success('Layout assigned successfully!');
        setShowAddModal(false);
        loadLayouts();
      } else {
        toast.error(`${result.error}`);
      }
    } catch (error) {
      toast.error('Failed to assign layout');
    } finally {
      setProcessing(false);
    }
  };

  const handleRemoveLayout = async (layoutId, layoutName) => {
    if (!confirm(`Remove "${layoutName}" from this contract?`)) {
      return;
    }
    
    try {
      setProcessing(true);
      const result = await contractLayoutService.removeLayout(contractId, layoutId);
      
      if (result.success) {
        toast.success('Layout removed successfully!');
        loadLayouts();
      } else {
        toast.error(`${result.error}`);
      }
    } catch (error) {
      toast.error('Failed to remove layout');
    } finally {
      setProcessing(false);
    }
  };

  const handleSetDefault = async (layoutId, layoutName) => {
    if (!confirm(`Set "${layoutName}" as default layout?`)) {
      return;
    }
    
    try {
      setProcessing(true);
      const result = await contractLayoutService.setDefaultLayout(contractId, layoutId);
      
      if (result.success) {
        toast.success('Default layout updated!');
        loadLayouts();
      } else {
        toast.error(`${result.error}`);
      }
    } catch (error) {
      toast.error('Failed to set default layout');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-16 bg-gray-100 rounded"></div>
            <div className="h-16 bg-gray-100 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Report Layouts</h3>
            <p className="text-sm text-gray-600 mt-1">
              Manage layouts for generating reports from this contract
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            disabled={processing || availableLayouts.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <span>➕</span>
            <span>Add Layout</span>
          </button>
        </div>
      </div>

      {/* Assigned Layouts List */}
      <div className="p-6">
        {assignedLayouts.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <div className="text-4xl mb-3">📄</div>
            <p className="text-gray-600 mb-2">No layouts assigned yet</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="text-blue-600 hover:text-blue-700 font-medium text-sm"
            >
              Add your first layout
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {assignedLayouts.map((layout) => (
              <div
                key={layout.id}
                className={`
                  flex items-center gap-4 p-4 rounded-lg border-2 transition-all
                  ${layout.id === defaultLayoutId
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
              }
                `}
              >
                {/* Layout Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h4 className="font-semibold text-gray-900">
                      {layout.layout_name}
                    </h4>
                    {layout.id === defaultLayoutId && (
                      <span className="px-2 py-1 bg-blue-600 text-white text-xs font-semibold rounded">
                        ★ DEFAULT
                      </span>
                    )}
                    <span className="text-xs text-gray-500">
                      ({layout.layout_id})
                    </span>
                  </div>
                  {layout.description && (
                    <p className="text-sm text-gray-600 mt-1">
                      {layout.description}
                    </p>
                  )}
                  <div className="text-xs text-gray-500 mt-2">
                    Assigned {new Date(layout.assigned_at).toLocaleDateString()}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {layout.id !== defaultLayoutId && (
                    <button
                      onClick={() => handleSetDefault(layout.id, layout.layout_name)}
                      disabled={processing}
                      className="px-3 py-2 bg-white border border-blue-600 text-blue-600 text-sm rounded-lg hover:bg-blue-50 disabled:opacity-50"
                      title="Set as default"
                    >
                      Set Default
                    </button>
                  )}
                  
                  <button
                    onClick={() => handleRemoveLayout(layout.id, layout.layout_name)}
                    disabled={processing || layout.id === defaultLayoutId || assignedLayouts.length === 1}
                    className="px-3 py-2 bg-white border border-red-600 text-red-600 text-sm rounded-lg hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed"
                    title={
                      layout.id === defaultLayoutId
                        ? 'Cannot remove default layout'
                        : assignedLayouts.length === 1
                          ? 'Cannot remove last layout'
                          : 'Remove layout'
                    }
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info Box */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex gap-3">
            <span className="text-blue-600 text-xl">💡</span>
            <div className="text-sm text-blue-900">
              <strong>How it works:</strong>
              <ul className="mt-2 space-y-1 text-blue-800">
                <li>• The default layout is pre-selected when generating reports</li>
                <li>• You can override the default at generation time</li>
                <li>• Each contract must have at least one assigned layout</li>
                <li>• Only compatible layouts are shown for this contract type</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Add Layout Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col">
            {/* Modal Header */}
            <div className="border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Add Layout</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Select a layout to assign to this contract
                  </p>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {availableLayouts.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-4xl mb-3">📭</div>
                  <p className="text-gray-600">No available layouts</p>
                  <p className="text-sm text-gray-500 mt-1">
                    All compatible layouts are already assigned
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {availableLayouts.map((layout) => (
                    <div
                      key={layout.id}
                      className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all"
                    >
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">
                          {layout.layout_name}
                        </h4>
                        {layout.description && (
                          <p className="text-sm text-gray-600 mt-1">
                            {layout.description}
                          </p>
                        )}
                        <div className="text-xs text-gray-500 mt-2">
                          ID: {layout.layout_id}
                        </div>
                      </div>
                      <button
                        onClick={() => handleAddLayout(layout.id)}
                        disabled={processing}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        Add
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-gray-200 px-6 py-4">
              <button
                onClick={() => setShowAddModal(false)}
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
