/**
 * WorkLedger - Photo Gallery Component
 * 
 * Displays photos in grid layout with lightbox for full view.
 * Supports navigation, delete, and download.
 * 
 * @module components/attachments/PhotoGallery
 * @created February 2, 2026 - Session 15
 */

import React, { useState } from 'react';
import { attachmentService } from '../../services/api/attachmentService';
import { useToast } from '../../context/ToastContext';

/**
 * Photo Gallery Component
 * 
 * Features:
 * - Grid layout (responsive)
 * - Lightbox view (click to enlarge)
 * - Navigation (prev/next)
 * - Delete option
 * - Download option
 * - Keyboard navigation (ESC, arrows)
 * 
 * @param {Object} props
 * @param {Array} props.attachments - Array of attachment objects
 * @param {Function} props.onDelete - Callback when photo deleted
 * @param {boolean} props.readOnly - Disable delete/edit
 * @param {number} props.columns - Grid columns (default: 3)
 * 
 * @example
 * <PhotoGallery
 *   attachments={photos}
 *   onDelete={(id) => handleDelete(id)}
 *   readOnly={false}
 *   columns={3}
 * />
 */
export default function PhotoGallery({
  attachments = [],
  onDelete,
  readOnly = false,
  columns = 3
}) {
  // State
  const toast = useToast();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [deleting, setDeleting] = useState(false);

  /**
   * Open lightbox at specific index
   */
  const openLightbox = (index) => {
    setCurrentIndex(index);
    setLightboxOpen(true);
  };

  /**
   * Close lightbox
   */
  const closeLightbox = () => {
    setLightboxOpen(false);
  };

  /**
   * Navigate to previous photo
   */
  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? attachments.length - 1 : prev - 1));
  };

  /**
   * Navigate to next photo
   */
  const goToNext = () => {
    setCurrentIndex((prev) => (prev === attachments.length - 1 ? 0 : prev + 1));
  };

  /**
   * Handle keyboard navigation
   */
  React.useEffect(() => {
    if (!lightboxOpen) {
      return;
    }

    const handleKeyDown = (event) => {
      switch (event.key) {
        case 'Escape':
          closeLightbox();
          break;
        case 'ArrowLeft':
          goToPrevious();
          break;
        case 'ArrowRight':
          goToNext();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxOpen, currentIndex, attachments.length]);

  /**
   * Handle delete photo
   */
  const handleDelete = async () => {
    if (readOnly || !onDelete) {
      return;
    }

    const photo = attachments[currentIndex];

    if (!window.confirm('Delete this photo?')) {
      return;
    }

    try {
      setDeleting(true);

      const result = await attachmentService.deleteAttachment(photo.id);

      if (result.success) {
        console.log('✅ Photo deleted');
        
        // Close lightbox if this was the last photo
        if (attachments.length === 1) {
          closeLightbox();
        } else {
          // Move to next photo if deleting last photo
          if (currentIndex === attachments.length - 1) {
            setCurrentIndex(0);
          }
        }

        // Notify parent
        if (onDelete) {
          onDelete(photo.id);
        }
      }

    } catch (err) {
      console.error('❌ Error deleting photo:', err);
      toast.error('Failed to delete photo');
    } finally {
      setDeleting(false);
    }
  };

  /**
   * Handle download photo
   */
  const handleDownload = () => {
    const photo = attachments[currentIndex];
    
    // Create download link
    const link = document.createElement('a');
    link.href = photo.storage_url;
    link.download = photo.file_name;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Empty state
  if (attachments.length === 0) {
    return (
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
        <svg className="w-12 h-12 mx-auto text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p className="text-gray-600 text-sm">No photos</p>
      </div>
    );
  }

  // Grid column classes
  const gridClass = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3',
    4: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4'
  }[columns] || 'grid-cols-3';

  return (
    <>
      {/* Photo Count */}
      <p className="text-sm text-gray-600 mb-2">
        {attachments.length} {attachments.length === 1 ? 'photo' : 'photos'}
      </p>

      {/* Photo Grid */}
      <div className={`grid ${gridClass} gap-4`}>
        {attachments.map((photo, index) => (
          <div
            key={photo.id}
            className="relative group aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary-500 transition-all"
            onClick={() => openLightbox(index)}
          >
            {/* Thumbnail */}
            <img
              src={photo.storage_url}
              alt={photo.file_name}
              className="w-full h-full object-cover"
              loading="lazy"
            />

            {/* Hover Overlay */}
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center">
              <svg className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
              </svg>
            </div>

            {/* File Info */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <p className="text-xs text-white truncate">{photo.file_name}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {lightboxOpen && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center">
          {/* Close Button */}
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 text-white hover:text-gray-300 p-2"
            title="Close (ESC)"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Previous Button */}
          {attachments.length > 1 && (
            <button
              onClick={goToPrevious}
              className="absolute left-4 text-white hover:text-gray-300 p-2"
              title="Previous (←)"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          {/* Next Button */}
          {attachments.length > 1 && (
            <button
              onClick={goToNext}
              className="absolute right-4 text-white hover:text-gray-300 p-2"
              title="Next (→)"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          {/* Photo */}
          <div className="max-w-6xl max-h-[90vh] mx-4">
            <img
              src={attachments[currentIndex].storage_url}
              alt={attachments[currentIndex].file_name}
              className="max-w-full max-h-[80vh] object-contain"
            />

            {/* Photo Info */}
            <div className="mt-4 text-center">
              <p className="text-white text-sm">
                {attachments[currentIndex].file_name}
              </p>
              <p className="text-gray-400 text-xs">
                {attachments[currentIndex].width}x{attachments[currentIndex].height} •{' '}
                {(attachments[currentIndex].file_size / 1024).toFixed(0)} KB •{' '}
                {currentIndex + 1} of {attachments.length}
              </p>
            </div>

            {/* Actions */}
            <div className="mt-4 flex justify-center gap-2">
              {/* Download Button */}
              <button
                onClick={handleDownload}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download
              </button>

              {/* Delete Button */}
              {!readOnly && onDelete && (
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
