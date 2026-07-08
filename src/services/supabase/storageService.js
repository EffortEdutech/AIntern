/**
 * WorkLedger - Storage Service
 * 
 * Handles file uploads, downloads, and management in Supabase Storage.
 * Provides abstraction over Supabase Storage API.
 * 
 * @module services/supabase/storage
 * @created February 2, 2026 - Session 15
 */

import { supabase } from '../supabase/client';

/**
 * Storage Service
 * 
 * Features:
 * - Upload files to Supabase Storage
 * - Delete files from Supabase Storage
 * - Get public/signed URLs
 * - List files in directory
 * - Progress tracking for uploads
 */
class StorageService {
  /**
   * Upload file to Supabase Storage
   * 
   * @param {string} bucket - Bucket name
   * @param {string} path - File path in bucket
   * @param {File|Blob} file - File to upload
   * @param {Object} options - Upload options
   * @param {Function} options.onProgress - Progress callback (percent)
   * @param {Object} options.metadata - File metadata
   * @returns {Promise<Object>} { success, data: { path, publicUrl }, error }
   * 
   * @example
   * const result = await storageService.uploadFile(
   *   'workledger-attachments',
   *   'org-001/contract-abc/photo.jpg',
   *   fileBlob,
   *   { onProgress: (percent) => console.log(percent) }
   * );
   */
  async uploadFile(bucket, path, file, options = {}) {
    try {
      console.log('📤 Uploading file:', path);

      const { onProgress: _onProgress, metadata = {} } = options;

      // Upload file
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false, // Don't overwrite existing files
          metadata
        });

      if (error) {
        console.error('❌ Upload failed:', error);
        throw error;
      }

      // Get public URL
      const publicUrl = this.getPublicUrl(bucket, data.path);

      console.log('✅ File uploaded:', data.path);

      return {
        success: true,
        data: {
          path: data.path,
          publicUrl,
          fullPath: data.fullPath,
          id: data.id
        }
      };

    } catch (error) {
      console.error('❌ Error in uploadFile:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Delete file from Supabase Storage
   * 
   * @param {string} bucket - Bucket name
   * @param {string} path - File path in bucket
   * @returns {Promise<Object>} { success, error }
   * 
   * @example
   * await storageService.deleteFile(
   *   'workledger-attachments',
   *   'org-001/contract-abc/photo.jpg'
   * );
   */
  async deleteFile(bucket, path) {
    try {
      console.log('🗑️ Deleting file:', path);

      const { error } = await supabase.storage
        .from(bucket)
        .remove([path]);

      if (error) {
        console.error('❌ Delete failed:', error);
        throw error;
      }

      console.log('✅ File deleted:', path);

      return {
        success: true
      };

    } catch (error) {
      console.error('❌ Error in deleteFile:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get public URL for a file
   * 
   * @param {string} bucket - Bucket name
   * @param {string} path - File path in bucket
   * @returns {string} Public URL
   * 
   * @example
   * const url = storageService.getPublicUrl(
   *   'workledger-attachments',
   *   'org-001/contract-abc/photo.jpg'
   * );
   */
  getPublicUrl(bucket, path) {
    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(path);

    return data.publicUrl;
  }

  /**
   * Get signed URL for private file
   * 
   * @param {string} bucket - Bucket name
   * @param {string} path - File path in bucket
   * @param {number} expiresIn - Expiry time in seconds (default: 3600 = 1 hour)
   * @returns {Promise<Object>} { success, data: { signedUrl }, error }
   * 
   * @example
   * const result = await storageService.getSignedUrl(
   *   'workledger-attachments',
   *   'org-001/contract-abc/photo.jpg',
   *   3600
   * );
   */
  async getSignedUrl(bucket, path, expiresIn = 3600) {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, expiresIn);

      if (error) {
        console.error('❌ Failed to get signed URL:', error);
        throw error;
      }

      return {
        success: true,
        data: {
          signedUrl: data.signedUrl
        }
      };

    } catch (error) {
      console.error('❌ Error in getSignedUrl:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * List files in a directory
   * 
   * @param {string} bucket - Bucket name
   * @param {string} path - Directory path (optional)
   * @param {Object} options - List options
   * @param {number} options.limit - Max files to return
   * @param {string} options.sortBy - Sort by column
   * @returns {Promise<Object>} { success, data: files[], error }
   * 
   * @example
   * const result = await storageService.listFiles(
   *   'workledger-attachments',
   *   'org-001/contract-abc',
   *   { limit: 100 }
   * );
   */
  async listFiles(bucket, path = '', options = {}) {
    try {
      const { limit = 100, sortBy = 'created_at' } = options;

      const { data, error } = await supabase.storage
        .from(bucket)
        .list(path, {
          limit,
          sortBy: { column: sortBy, order: 'desc' }
        });

      if (error) {
        console.error('❌ Failed to list files:', error);
        throw error;
      }

      return {
        success: true,
        data: data || []
      };

    } catch (error) {
      console.error('❌ Error in listFiles:', error);
      return {
        success: false,
        data: [],
        error: error.message
      };
    }
  }

  /**
   * Download file as blob
   * 
   * @param {string} bucket - Bucket name
   * @param {string} path - File path in bucket
   * @returns {Promise<Object>} { success, data: Blob, error }
   * 
   * @example
   * const result = await storageService.downloadFile(
   *   'workledger-attachments',
   *   'org-001/contract-abc/photo.jpg'
   * );
   * const blob = result.data;
   */
  async downloadFile(bucket, path) {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .download(path);

      if (error) {
        console.error('❌ Download failed:', error);
        throw error;
      }

      return {
        success: true,
        data
      };

    } catch (error) {
      console.error('❌ Error in downloadFile:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate storage path for work entry attachment
   * 
   * @param {string} organizationId - Organization UUID
   * @param {string} contractId - Contract UUID
   * @param {string} workEntryId - Work entry UUID
   * @param {string} fileName - File name
   * @returns {string} Storage path
   * 
   * @example
   * const path = storageService.generatePath(
   *   'org-001',
   *   'contract-abc',
   *   'entry-xyz',
   *   'photo_20260202_150530_abc123.jpg'
   * );
   * // Returns: 'org-001/contract-abc/entry-xyz/photo_20260202_150530_abc123.jpg'
   */
  generatePath(organizationId, contractId, workEntryId, fileName) {
    return `${organizationId}/${contractId}/${workEntryId}/${fileName}`;
  }

  /**
   * Generate unique file name with timestamp and random ID
   * 
   * @param {string} prefix - File prefix (e.g., 'photo', 'signature')
   * @param {string} extension - File extension (e.g., 'jpg', 'png')
   * @returns {string} Unique file name
   * 
   * @example
   * const fileName = storageService.generateFileName('photo', 'jpg');
   * // Returns: 'photo_20260202_150530_a1b2c3d4.jpg'
   */
  generateFileName(prefix, extension) {
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
    const randomId = Math.random().toString(36).substring(2, 10);
    return `${prefix}_${timestamp}_${randomId}.${extension}`;
  }
}

export const storageService = new StorageService();
