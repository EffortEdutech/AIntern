/**
 * WorkLedger - PDF Viewer Component
 * 
 * Displays PDF in browser using iframe or object tag.
 * 
 * @module components/reports/PDFViewer
 * @created February 5, 2026 - Session 18
 */

import React from 'react';

export default function PDFViewer({ url }) {
  return (
    <div className="w-full h-full bg-gray-100 rounded-lg overflow-hidden">
      <iframe
        src={url}
        className="w-full h-full border-0"
        title="PDF Preview"
      />
    </div>
  );
}
