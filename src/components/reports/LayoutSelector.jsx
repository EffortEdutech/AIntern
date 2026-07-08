/**
 * WorkLedger - Layout Selector Component
 * 
 * Visual layout selection interface with cards showing:
 * - Layout name and description
 * - Preview thumbnail (if available)
 * - Compatible template types
 * 
 * User selects one layout for report generation.
 * 
 * @module components/reports/LayoutSelector
 * @created February 12, 2026 - Session 3
 */

import { useState, useEffect } from 'react';
import { layoutRegistryService } from '../../services/layoutRegistryService';
import LoadingSpinner from '../common/LoadingSpinner';

/**
 * Layout Selector Component
 * 
 * @param {string} templateType - Template type (PMC, CMC, AMC, etc.)
 * @param {Function} onSelect - Callback when layout selected (receives layoutId)
 * @param {string} defaultLayoutId - Default selected layout ID
 */
export default function LayoutSelector({ templateType, onSelect, defaultLayoutId }) {
  const [layouts, setLayouts] = useState([]);
  const [selectedLayoutId, setSelectedLayoutId] = useState(defaultLayoutId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    loadLayouts();
  }, [templateType]);
  
  const loadLayouts = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('📋 Loading layouts for template type:', templateType);
      
      const available = await layoutRegistryService.getAvailableLayouts(templateType);
      setLayouts(available);
      
      // Auto-select first if no default
      if (!selectedLayoutId && available.length > 0) {
        const firstLayoutId = available[0].layoutId;
        setSelectedLayoutId(firstLayoutId);
        onSelect(firstLayoutId);
        console.log('  ✅ Auto-selected first layout:', firstLayoutId);
      } else if (selectedLayoutId) {
        // Ensure callback is called with current selection
        onSelect(selectedLayoutId);
      }
      
    } catch (err) {
      console.error('❌ Failed to load layouts:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleSelect = (layoutId) => {
    console.log('📋 Layout selected:', layoutId);
    setSelectedLayoutId(layoutId);
    onSelect(layoutId);
  };
  
  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <LoadingSpinner />
        <span className="ml-3 text-gray-600">Loading report layouts...</span>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-red-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">Failed to load layouts</p>
            <p className="text-sm text-red-700 mt-1">{error}</p>
            <button
              onClick={loadLayouts}
              className="mt-2 text-sm text-red-600 hover:text-red-800 font-medium underline"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  if (layouts.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
        <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-gray-600 font-medium">No layouts available</p>
        <p className="text-sm text-gray-500 mt-1">No report layouts found for this template type.</p>
      </div>
    );
  }
  
  return (
    <div className="layout-selector">
      <label className="block text-sm font-semibold text-gray-700 mb-3">
        Select Report Layout
      </label>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {layouts.map(layout => {
          const isSelected = selectedLayoutId === layout.layoutId;
          
          return (
            <button
              key={layout.layoutId}
              onClick={() => handleSelect(layout.layoutId)}
              className={`
                relative p-4 border-2 rounded-lg text-left transition-all
                ${isSelected
              ? 'border-primary-500 bg-primary-50 shadow-md ring-2 ring-primary-200'
              : 'border-gray-200 hover:border-gray-300 hover:shadow-sm bg-white'}
              `}
            >
              {/* Preview thumbnail */}
              {layout.preview ? (
                <img
                  src={layout.preview}
                  alt={layout.name}
                  className="w-full h-32 object-cover rounded mb-3 bg-gray-100"
                />
              ) : (
                <div className="w-full h-32 bg-gradient-to-br from-gray-100 to-gray-200 rounded mb-3 flex items-center justify-center">
                  <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              )}
              
              {/* Layout name */}
              <div className="font-semibold text-gray-900 mb-1 flex items-center justify-between">
                <span>{layout.name}</span>
                {isSelected && (
                  <svg className="w-5 h-5 text-primary-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              
              {/* Description */}
              {layout.description && (
                <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                  {layout.description}
                </p>
              )}
              
              {/* Selected indicator */}
              {isSelected && (
                <div className="mt-3 flex items-center text-primary-600 font-medium text-sm">
                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Selected
                </div>
              )}
            </button>
          );
        })}
      </div>
      
      {/* Summary */}
      <div className="mt-3 text-sm text-gray-500">
        {layouts.length} layout{layouts.length !== 1 ? 's' : ''} available
        {selectedLayoutId && (
          <span className="ml-2">
            • Selected: <span className="font-medium text-gray-700">
              {layouts.find(l => l.layoutId === selectedLayoutId)?.name}
            </span>
          </span>
        )}
      </div>
    </div>
  );
}
