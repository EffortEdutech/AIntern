/**
 * WorkLedger - Loading Spinner Component
 * 
 * Reusable loading spinner with multiple sizes and full-page option.
 * 
 * @module components/common/LoadingSpinner
 * @created January 29, 2026
 */

import React from 'react';

/**
 * LoadingSpinner Component
 * 
 * @param {Object} props
 * @param {string} props.size - Spinner size (sm, md, lg)
 * @param {boolean} props.fullPage - Show as full-page overlay
 * @param {string} props.text - Loading text to display
 * @param {string} props.className - Additional CSS classes
 * 
 * @example
 * <LoadingSpinner size="md" text="Loading data..." />
 * 
 * @example
 * <LoadingSpinner fullPage text="Please wait..." />
 */
export function LoadingSpinner({
  size = 'md',
  fullPage = false,
  text = '',
  className = ''
}) {
  // Size styles
  const sizeStyles = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-2',
    lg: 'w-12 h-12 border-3'
  };

  // Spinner element
  const spinnerElement = (
    <div
      className={`
        ${sizeStyles[size]}
        border-primary-600 border-t-transparent
        rounded-full
        animate-spin
        ${className}
      `}
      role="status"
      aria-label="Loading"
    />
  );

  // Full page variant
  if (fullPage) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white bg-opacity-90">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            {spinnerElement}
          </div>
          {text && (
            <p className="text-gray-600 text-lg">{text}</p>
          )}
        </div>
      </div>
    );
  }

  // Inline variant
  return (
    <div className="flex items-center justify-center">
      {spinnerElement}
      {text && (
        <span className="ml-3 text-gray-600">{text}</span>
      )}
    </div>
  );
}

export default LoadingSpinner;
