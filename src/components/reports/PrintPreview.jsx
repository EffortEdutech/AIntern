/**
 * WorkLedger - Print Preview Component
 * 
 * Full-screen modal displaying HTML preview of report.
 * Features:
 * - Dark toolbar with controls
 * - Zoom controls (50% - 200%)
 * - Scrollable preview area
 * - Generate PDF button
 * - Close button
 * 
 * @module components/reports/PrintPreview
 * @created February 12, 2026 - Session 3
 */

import { useState, useEffect } from 'react';
import { reportService } from '../../services/api/reportService';
import LoadingSpinner from '../common/LoadingSpinner';

/**
 * Print Preview Component
 * 
 * @param {Array<string>} entryIds - Work entry IDs
 * @param {string} layoutId - Selected layout ID
 * @param {Function} onClose - Close modal callback
 * @param {Function} onGenerate - Generate PDF callback
 */
export default function PrintPreview({ entryIds, layoutId, onClose, onGenerate }) {
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [zoom, setZoom] = useState(1.0);
  
  useEffect(() => {
    loadPreview();
  }, [entryIds, layoutId]);
  
  // Handle ESC key to close
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);
  
  const loadPreview = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('👁️ Loading preview...');
      console.log('  Entries:', entryIds.length);
      console.log('  Layout:', layoutId);
      
      const result = await reportService.generateReport(entryIds, {
        layoutId,
        outputFormat: 'html'
      });
      
      if (result.success) {
        setHtml(result.html);
        console.log('✅ Preview loaded');
      } else {
        throw new Error(result.error || 'Failed to generate preview');
      }
      
    } catch (err) {
      console.error('❌ Preview failed:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleZoomIn = () => {
    setZoom(Math.min(2.0, zoom + 0.1));
  };
  
  const handleZoomOut = () => {
    setZoom(Math.max(0.5, zoom - 0.1));
  };
  
  const handleZoomReset = () => {
    setZoom(1.0);
  };
  
  const handleGeneratePDF = () => {
    console.log('📄 Generating PDF from preview...');
    onGenerate();
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex flex-col">
      {/* Toolbar */}
      <div className="bg-gray-900 text-white p-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-4">
          {/* Close button */}
          <button
            onClick={onClose}
            className="flex items-center gap-2 text-white hover:text-gray-300 transition-colors"
            title="Close preview (ESC)"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="font-medium">Back</span>
          </button>
          
          <div className="h-6 w-px bg-gray-700" /> {/* Divider */}
          
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span className="text-lg font-semibold">Print Preview</span>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          {/* Zoom controls */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">Zoom:</span>
            <button
              onClick={handleZoomOut}
              disabled={zoom <= 0.5}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
              title="Zoom out"
            >
              −
            </button>
            
            <button
              onClick={handleZoomReset}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded transition-colors min-w-[70px] font-mono text-sm"
              title="Reset zoom"
            >
              {Math.round(zoom * 100)}%
            </button>
            
            <button
              onClick={handleZoomIn}
              disabled={zoom >= 2.0}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
              title="Zoom in"
            >
              +
            </button>
          </div>
          
          {/* Generate PDF button */}
          <button
            onClick={handleGeneratePDF}
            disabled={loading || error}
            className="flex items-center gap-2 px-6 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors shadow-lg"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Generate PDF
          </button>
        </div>
      </div>
      
      {/* Preview area */}
      <div className="flex-1 overflow-auto bg-gray-200 p-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full">
            <LoadingSpinner />
            <p className="mt-4 text-gray-700 font-medium">Generating preview...</p>
            <p className="text-sm text-gray-600 mt-1">This may take a few seconds</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="bg-white rounded-lg p-8 shadow-lg max-w-md">
              <div className="text-red-600 text-center mb-4">
                <svg className="w-16 h-16 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-xl font-semibold">Preview Failed</h3>
              </div>
              <p className="text-gray-700 text-center mb-4">{error}</p>
              <div className="flex gap-3">
                <button
                  onClick={loadPreview}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
                >
                  Try Again
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'top center',
              transition: 'transform 0.2s ease-out'
            }}
            className="mx-auto"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
      </div>
      
      {/* Footer hint */}
      {!loading && !error && (
        <div className="bg-gray-900 text-gray-400 text-xs py-2 px-4 text-center border-t border-gray-800">
          Use zoom controls to adjust view • Press ESC or click Back to close • Click Generate PDF when ready
        </div>
      )}
    </div>
  );
}
