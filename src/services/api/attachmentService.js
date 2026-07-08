/**
 * WorkLedger - Attachment Service
 * 
 * Manages attachments (photos, signatures) for work entries.
 * Handles both database records and Supabase Storage.
 * 
 * @module services/api/attachmentService
 * @created February 2, 2026 - Session 15
 */

import { supabase } from '../supabase/client';
import { storageService } from '../supabase/storageService';

/**
 * Attachment Service
 * 
 * Features:
 * - Upload photos and signatures
 * - Store metadata in database
 * - Get attachments for work entry
 * - Delete attachments
 * - Offline-first with sync
 */
class AttachmentService {
  /**
   * Upload attachment (photo or signature)
   * 
   * Workflow:
   * 1. Compress image (if needed)
   * 2. Generate unique file name
   * 3. Upload to Supabase Storage
   * 4. Create database record
   * 5. Return attachment data
   * 
   * @param {string} workEntryId - Work entry UUID
   * @param {File|Blob} file - File to upload
   * @param {string} fieldId - Field ID (e.g., 'inspection.before_photo')
   * @param {string} fileType - 'photo' or 'signature'
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} { success, data: attachment, error }
   * 
   * @example
   * const result = await attachmentService.uploadAttachment(
   *   'entry-uuid',
   *   photoFile,
   *   'inspection.before_photo',
   *   'photo'
   * );
   */
  async uploadAttachment(workEntryId, file, fieldId, fileType = 'photo', metadata = {}) {
    try {
      console.log('📤 Uploading attachment:', {
        workEntryId,
        fieldId,
        fileType,
        fileName: file.name,
        fileSize: file.size
      });

      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      // Get work entry to determine organization and contract
      const { data: workEntry, error: entryError } = await supabase
        .from('work_entries')
        .select(`
          id,
          contract_id,
          contract:contracts(
            id,
            project:projects(
              id,
              organization_id
            )
          )
        `)
        .eq('id', workEntryId)
        .single();

      if (entryError || !workEntry) {
        throw new Error('Work entry not found');
      }

      // Extract IDs for storage path
      const organizationId = workEntry.contract.project.organization_id;
      const contractId = workEntry.contract_id;

      // Generate unique file name
      const extension = file.name.split('.').pop() || 'jpg';
      const fileName = storageService.generateFileName(fileType, extension);

      // Generate storage path
      const storagePath = storageService.generatePath(
        organizationId,
        contractId,
        workEntryId,
        fileName
      );

      // Upload to Supabase Storage
      const uploadResult = await storageService.uploadFile(
        'workledger-attachments',
        storagePath,
        file,
        metadata
      );

      if (!uploadResult.success) {
        throw new Error(`Upload failed: ${uploadResult.error}`);
      }

      // Get image dimensions (if image)
      const dimensions = await this.getImageDimensions(file);

      // Create database record
      const attachment = {
        work_entry_id: workEntryId,
        file_name: fileName,
        file_type: fileType,
        file_size: file.size,
        mime_type: file.type,
        storage_bucket: 'workledger-attachments',
        storage_path: storagePath,
        storage_url: uploadResult.data.publicUrl,
        field_id: fieldId,
        width: dimensions.width,
        height: dimensions.height,
        sync_status: 'uploaded',
        synced_at: new Date().toISOString(),
        created_by: user.id
      };

      const { data, error } = await supabase
        .from('attachments')
        .insert(attachment)
        .select()
        .single();

      if (error) {
        console.error('❌ Failed to create attachment record:', error);
        
        // Try to delete uploaded file
        await storageService.deleteFile('workledger-attachments', storagePath);
        
        throw error;
      }

      console.log('✅ Attachment uploaded:', data.id);

      return {
        success: true,
        data
      };

    } catch (error) {
      console.error('❌ Error in uploadAttachment:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get attachments for work entry
   * 
   * @param {string} workEntryId - Work entry UUID
   * @param {string} fieldId - Optional field ID to filter
   * @returns {Promise<Object>} { success, data: attachments[], error }
   * 
   * @example
   * const result = await attachmentService.getAttachments('entry-uuid');
   * const photos = result.data.filter(a => a.file_type === 'photo');
   */
  async getAttachments(workEntryId, fieldId = null) {
    try {
      console.log('📋 Getting attachments:', { workEntryId, fieldId });

      let query = supabase
        .from('attachments')
        .select('*')
        .eq('work_entry_id', workEntryId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

      if (fieldId) {
        query = query.eq('field_id', fieldId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ Failed to get attachments:', error);
        throw error;
      }

      console.log(`✅ Retrieved ${data.length} attachments`);

      return {
        success: true,
        data: data || []
      };

    } catch (error) {
      console.error('❌ Error in getAttachments:', error);
      return {
        success: false,
        data: [],
        error: error.message
      };
    }
  }

  /**
   * Delete attachment
   * 
   * Deletes both database record and storage file.
   * 
   * @param {string} attachmentId - Attachment UUID
   * @returns {Promise<Object>} { success, error }
   * 
   * @example
   * await attachmentService.deleteAttachment('attachment-uuid');
   */
  async deleteAttachment(attachmentId) {
    try {
      console.log('🗑️ Deleting attachment:', attachmentId);

      // Get attachment details
      const { data: attachment, error: fetchError } = await supabase
        .from('attachments')
        .select('*')
        .eq('id', attachmentId)
        .single();

      if (fetchError || !attachment) {
        throw new Error('Attachment not found');
      }

      // Delete from storage (if uploaded)
      if (attachment.storage_path && attachment.sync_status === 'uploaded') {
        await storageService.deleteFile(
          attachment.storage_bucket,
          attachment.storage_path
        );
      }

      // HARD delete from database
      const { error: deleteError } = await supabase
        .from('attachments')
        .delete()
        .eq('id', attachmentId);

      if (deleteError) {
        console.error('❌ Failed to delete attachment:', deleteError);
        throw deleteError;
      }

      console.log('✅ Attachment deleted (file + database record):', attachmentId);

      return {
        success: true
      };

    } catch (error) {
      console.error('❌ Error in deleteAttachment:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get image dimensions from file
   * 
   * @param {File|Blob} file - Image file
   * @returns {Promise<Object>} { width, height }
   * 
   * @private
   */
  async getImageDimensions(file) {
    return new Promise((resolve) => {
      if (!file.type.startsWith('image/')) {
        resolve({ width: null, height: null });
        return;
      }

      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({
          width: img.width,
          height: img.height
        });
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve({ width: null, height: null });
      };

      img.src = url;
    });
  }

  /**
   * Compress image file
   * 
   * Reduces file size for faster uploads and storage efficiency.
   * 
   * @param {File} file - Image file
   * @param {Object} options - Compression options
   * @param {number} options.maxWidth - Max width (default: 1920)
   * @param {number} options.maxHeight - Max height (default: 1080)
   * @param {number} options.quality - Quality 0-1 (default: 0.8)
   * @returns {Promise<Blob>} Compressed image blob
   * 
   * @example
   * const compressed = await attachmentService.compressImage(file, {
   *   maxWidth: 1920,
   *   maxHeight: 1080,
   *   quality: 0.8
   * });
   */
  async compressImage(file, options = {}) {
    const {
      maxWidth = 1920,
      maxHeight = 1080,
      quality = 0.8
    } = options;

    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      img.onload = () => {
        // Calculate new dimensions
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = width * ratio;
          height = height * ratio;
        }

        // Set canvas size
        canvas.width = width;
        canvas.height = height;

        // Draw image
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to blob
        canvas.toBlob(
          (blob) => {
            if (blob) {
              console.log('✅ Image compressed:', {
                originalSize: file.size,
                compressedSize: blob.size,
                reduction: `${((1 - blob.size / file.size) * 100).toFixed(1)}%`
              });
              resolve(blob);
            } else {
              reject(new Error('Compression failed'));
            }
          },
          'image/jpeg',
          quality
        );
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };

      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Convert file to base64 string
   * 
   * @param {File|Blob} file - File to convert
   * @returns {Promise<string>} Base64 string (with data URI prefix)
   * 
   * @example
   * const base64 = await attachmentService.fileToBase64(file);
   * // Returns: 'data:image/jpeg;base64,/9j/4AAQ...'
   */
  async fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = () => {
        resolve(reader.result);
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      
      reader.readAsDataURL(file);
    });
  }

  /**
   * Convert base64 to file
   * 
   * @param {string} base64 - Base64 string (with data URI prefix)
   * @param {string} fileName - File name
   * @returns {File} File object
   * 
   * @example
   * const file = attachmentService.base64ToFile(
   *   'data:image/jpeg;base64,/9j/4AAQ...',
   *   'photo.jpg'
   * );
   */
  base64ToFile(base64, fileName) {
    const arr = base64.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    
    return new File([u8arr], fileName, { type: mime });
  }
}

export const attachmentService = new AttachmentService();
