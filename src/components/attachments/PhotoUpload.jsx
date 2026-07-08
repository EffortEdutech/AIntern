/**
 * WorkLedger - Photo Upload Component
 * 
 * Handles photo capture from camera or gallery with compression.
 * Supports multiple photos, preview, and deletion.
 * 
 * @module components/attachments/PhotoUpload
 * @created February 2, 2026 - Session 15
 * @updated February 4, 2026 - FIXED: Convert Blob to File before upload
 */

import React, { useState, useRef } from 'react';
import { attachmentService } from '../../services/api/attachmentService';
import Button from '../common/Button';
import LoadingSpinner from '../common/LoadingSpinner';

/**
 * Photo Upload Component
 * 
 * Features:
 * - Camera capture (mobile)
 * - Gallery/file picker
 * - Image compression
 * - Multiple photos support
 * - Preview thumbnails
 * - Delete photos
 * - Upload progress
 * 
 * @param {Object} props
 * @param {string} props.workEntryId - Work entry UUID
 * @param {string} props.fieldId - Field ID (e.g., 'inspection.before_photo')
 * @param {Array} props.value - Current attachment IDs
 * @param {Function} props.onChange - Callback when photos change
 * @param {number} props.maxPhotos - Max number of photos (default: 3)
 * @param {boolean} props.disabled - Disable upload
 * 
 * @example
 * <PhotoUpload
 *   workEntryId="entry-uuid"
 *   fieldId="inspection.before_photo"
 *   value={['attachment-id-1', 'attachment-id-2']}
 *   onChange={(attachments) => handleChange(attachments)}
 *   maxPhotos={3}
 *   disabled={false}
 * />
 */
export default function PhotoUpload({
  workEntryId,
  fieldId,
  value = [],
  onChange,
  maxPhotos = 3,
  disabled = false
}) {
  // State
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  // Refs
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  /**
   * Load existing photos from attachment IDs
   */
  React.useEffect(() => {
    if (value && value.length > 0 && workEntryId) {
      loadPhotos();
    }
  }, [value, workEntryId]);

  /**
   * Load photos from database
   */
  const loadPhotos = async () => {
    try {
      setLoading(true);
      const result = await attachmentService.getAttachments(workEntryId, fieldId);
      
      if (result.success) {
        setPhotos(result.data);
      }
    } catch (err) {
      console.error('Failed to load photos:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle file selection (camera or gallery)
   */
  const handleFileSelect = async (event) => {
    const files = Array.from(event.target.files);
    
    if (files.length === 0) {
      return;
    }

    // Check max photos limit
    if (photos.length + files.length > maxPhotos) {
      setError(`Maximum ${maxPhotos} photos allowed`);
      return;
    }

    setError(null);
    setUploading(true);

    try {
      const uploadedPhotos = [];

      for (const file of files) {
        // Validate file type
        if (!file.type.startsWith('image/')) {
          console.error('Invalid file type:', file.type);
          continue;
        }

        // Validate file size (10MB max)
        if (file.size > 10 * 1024 * 1024) {
          setError('File too large (max 10MB)');
          continue;
        }

        // Compress image
        console.log('📸 Compressing image:', file.name);
        const compressedBlob = await attachmentService.compressImage(file, {
          maxWidth: 1920,
          maxHeight: 1080,
          quality: 0.8
        });

        console.log('✅ Compressed:', {
          original: file.size,
          compressed: compressedBlob.size,
          reduction: `${((1 - compressedBlob.size / file.size) * 100).toFixed(1)}%`
        });

        // ✅ Convert Blob to File with original filename
        // (Blob doesn't have .name property, but File does!)
        const compressedFile = new File(
          [compressedBlob],
          file.name,
          { type: file.type }
        );

        // Upload to storage
        console.log('📤 Uploading photo...');
        const result = await attachmentService.uploadAttachment(
          workEntryId,
          compressedFile,  // ✅ Now has .name property!
          fieldId,
          'photo'
        );

        if (result.success) {
          console.log('✅ Photo uploaded:', result.data.id);
          uploadedPhotos.push(result.data);
        } else {
          console.error('❌ Upload failed:', result.error);
          setError(`Upload failed: ${result.error}`);
        }
      }

      // Update photos state
      const newPhotos = [...photos, ...uploadedPhotos];
      setPhotos(newPhotos);

      // Notify parent component
      if (onChange) {
        onChange(newPhotos.map(p => p.id));
      }

    } catch (err) {
      console.error('❌ Error uploading photos:', err);
      setError(err.message);
    } finally {
      setUploading(false);
      
      // Reset file inputs
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      if (cameraInputRef.current) {
        cameraInputRef.current.value = '';
      }
    }
  };

  /**
   * Handle photo deletion
   */
  const handleDelete = async (photoId) => {
    if (!window.confirm('Delete this photo?')) {
      return;
    }

    try {
      setLoading(true);

      const result = await attachmentService.deleteAttachment(photoId);

      if (result.success) {
        // Remove from photos array
        const newPhotos = photos.filter(p => p.id !== photoId);
        setPhotos(newPhotos);

        // Notify parent component
        if (onChange) {
          onChange(newPhotos.map(p => p.id));
        }

        console.log('✅ Photo deleted');
      } else {
        setError(`Delete failed: ${result.error}`);
      }

    } catch (err) {
      console.error('❌ Error deleting photo:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Trigger camera input
   */
  const handleCameraClick = () => {
    if (cameraInputRef.current) {
      cameraInputRef.current.click();
    }
  };

  /**
   * Trigger file input
   */
  const handleGalleryClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Check if max photos reached
  const isMaxReached = photos.length >= maxPhotos;

  return (
    <div className="space-y-4">
      {/* Upload Buttons */}
      {!disabled && !isMaxReached && (
        <div className="flex gap-2">
          {/* Camera Button (Mobile) */}
          <Button
            type="button"
            variant="outline"
            onClick={handleCameraClick}
            disabled={uploading || loading}
            className="flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Take Photo
          </Button>

          {/* Gallery Button */}
          <Button
            type="button"
            variant="outline"
            onClick={handleGalleryClick}
            disabled={uploading || loading}
            className="flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Choose File
          </Button>

          {/* Hidden file inputs */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileSelect}
            className="hidden"
            multiple={maxPhotos > 1}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            multiple={maxPhotos > 1}
          />
        </div>
      )}

      {/* Photo Count */}
      {maxPhotos > 1 && (
        <p className="text-sm text-gray-600">
          {photos.length} of {maxPhotos} photos
          {isMaxReached && <span className="text-amber-600 ml-1">(Maximum reached)</span>}
        </p>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-900">{error}</p>
        </div>
      )}

      {/* Uploading Indicator */}
      {uploading && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <LoadingSpinner size="sm" />
            <p className="text-sm text-blue-900">Compressing and uploading...</p>
          </div>
        </div>
      )}

      {/* Photo Grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="relative group aspect-square bg-gray-100 rounded-lg overflow-hidden"
            >
              {/* Photo Image */}
              <img
                src={photo.storage_url}
                alt={photo.file_name}
                className="w-full h-full object-cover"
              />

              {/* Delete Button (on hover) */}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleDelete(photo.id)}
                  className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete photo"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}

              {/* File Info Overlay (on hover) */}
              <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-75 text-white p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-xs truncate">{photo.file_name}</p>
                <p className="text-xs text-gray-300">
                  {photo.width}x{photo.height} • {(photo.file_size / 1024).toFixed(0)} KB
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Loading State */}
      {loading && photos.length === 0 && (
        <div className="flex justify-center py-8">
          <LoadingSpinner />
        </div>
      )}

      {/* Empty State */}
      {!loading && photos.length === 0 && !uploading && (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <svg className="w-12 h-12 mx-auto text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-gray-600 text-sm">
            {disabled ? 'No photos added' : 'Take a photo or choose from gallery'}
          </p>
        </div>
      )}
    </div>
  );
}
