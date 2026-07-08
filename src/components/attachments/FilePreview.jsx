/**
 * WorkLedger - File Preview Component
 * 
 * Displays file thumbnail with metadata.
 * Used for compact display of attachments.
 * 
 * @module components/attachments/FilePreview
 * @created February 2, 2026 - Session 15
 */

import React from 'react';

/**
 * File Preview Component
 * 
 * Features:
 * - Image thumbnail for photos
 * - Icon for signatures/documents
 * - File name and size
 * - Optional delete button
 * - Click to view full
 * 
 * @param {Object} props
 * @param {Object} props.attachment - Attachment object
 * @param {Function} props.onClick - Callback when clicked
 * @param {Function} props.onDelete - Callback when delete clicked
 * @param {boolean} props.showDelete - Show delete button
 * @param {string} props.size - Size variant ('sm', 'md', 'lg')
 * 
 * @example
 * <FilePreview
 *   attachment={photo}
 *   onClick={() => viewPhoto(photo)}
 *   onDelete={() => deletePhoto(photo.id)}
 *   showDelete={true}
 *   size="md"
 * />
 */
export default function FilePreview({
  attachment,
  onClick,
  onDelete,
  showDelete = false,
  size = 'md'
}) {
  if (!attachment) {
    return null;
  }

  // Size classes
  const sizeClasses = {
    sm: {
      container: 'w-16 h-16',
      icon: 'w-8 h-8',
      text: 'text-xs'
    },
    md: {
      container: 'w-24 h-24',
      icon: 'w-12 h-12',
      text: 'text-sm'
    },
    lg: {
      container: 'w-32 h-32',
      icon: 'w-16 h-16',
      text: 'text-base'
    }
  }[size];

  /**
   * Get icon for file type
   */
  const getIcon = () => {
    switch (attachment.file_type) {
      case 'photo':
        return (
          <svg className={`${sizeClasses.icon} text-blue-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        );
      case 'signature':
        return (
          <svg className={`${sizeClasses.icon} text-purple-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        );
      case 'document':
        return (
          <svg className={`${sizeClasses.icon} text-gray-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        );
      default:
        return (
          <svg className={`${sizeClasses.icon} text-gray-400`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
    }
  };

  /**
   * Format file size
   */
  const formatSize = (bytes) => {
    if (bytes < 1024) {
      return bytes + ' B';
    }
    if (bytes < 1024 * 1024) {
      return (bytes / 1024).toFixed(1) + ' KB';
    }
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  /**
   * Handle click
   */
  const handleClick = () => {
    if (onClick) {
      onClick(attachment);
    }
  };

  /**
   * Handle delete
   */
  const handleDelete = (event) => {
    event.stopPropagation();
    if (onDelete) {
      onDelete(attachment);
    }
  };

  return (
    <div
      className={`relative group bg-gray-100 rounded-lg overflow-hidden ${onClick ? 'cursor-pointer hover:ring-2 hover:ring-primary-500' : ''}`}
      onClick={handleClick}
    >
      {/* Thumbnail or Icon */}
      <div className={`${sizeClasses.container} flex items-center justify-center bg-gray-200`}>
        {attachment.storage_url && attachment.file_type === 'photo' ? (
          <img
            src={attachment.storage_url}
            alt={attachment.file_name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : attachment.storage_url && attachment.file_type === 'signature' ? (
          <img
            src={attachment.storage_url}
            alt={attachment.file_name}
            className="w-full h-full object-contain p-2"
            loading="lazy"
          />
        ) : (
          getIcon()
        )}
      </div>

      {/* Delete Button */}
      {showDelete && onDelete && (
        <button
          type="button"
          onClick={handleDelete}
          className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Delete"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      {/* File Info (below thumbnail) */}
      {size !== 'sm' && (
        <div className="p-2 bg-white">
          <p className={`${sizeClasses.text} font-medium text-gray-900 truncate`} title={attachment.file_name}>
            {attachment.file_name}
          </p>
          <p className={`${sizeClasses.text} text-gray-500`}>
            {formatSize(attachment.file_size)}
          </p>
          {attachment.width && attachment.height && (
            <p className="text-xs text-gray-400">
              {attachment.width}x{attachment.height}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
