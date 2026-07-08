/**
 * WorkLedger - Report Preview Component
 * 
 * Modal for previewing PDF reports before download.
 * 
 * @module components/reports/ReportPreview
 * @created February 5, 2026 - Session 18
 */

import React, { useEffect, useState } from 'react';
import Button from '../common/Button';
import PDFViewer from './PDFViewer';

export default function ReportPreview({ blob, filename, onClose, onDownload }) {
  const [objectUrl, setObjectUrl] = useState('');
  
  /**
   * Create object URL from blob
   */
  useEffect(() => {
    if (blob) {
      const url = URL.createObjectURL(blob);
      setObjectUrl(url);
      
      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [blob]);
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-5/6 flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Report Preview</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* PDF Viewer */}
        <div className="flex-1 overflow-auto p-4">
          {objectUrl ? (
            <PDFViewer url={objectUrl} />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500">Loading preview...</p>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="flex justify-between items-center p-4 border-t border-gray-200">
          <span className="text-sm text-gray-600">
            {filename}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
            >
              Close
            </Button>
            <Button
              onClick={onDownload}
            >
              Download PDF
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
