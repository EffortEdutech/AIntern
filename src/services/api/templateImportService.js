/**
 * WorkLedger - AI Template Import Service
 *
 * Uploads a reference PDF report and asks the server-side generator to produce
 * a draft WorkLedger template, report layout, and form page plan.
 */

import { supabase } from '../supabase/client';
import { storageService } from '../supabase/storageService';

const TEMPLATE_IMPORT_BUCKET = 'template-imports';
const MAX_PDF_SIZE_BYTES = 20 * 1024 * 1024;

const sanitizeFileName = (name = 'report.pdf') =>
  name
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120) || 'report.pdf';

class TemplateImportService {
  validatePdf(file) {
    if (!file) {
      return { valid: false, error: 'Select a PDF report first.' };
    }

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      return { valid: false, error: 'Only PDF report files are supported.' };
    }

    if (file.size > MAX_PDF_SIZE_BYTES) {
      return { valid: false, error: 'PDF must be 20 MB or smaller.' };
    }

    return { valid: true };
  }

  generateImportPath(organizationId, fileName) {
    const safeOrg = organizationId || 'no-org';
    const date = new Date().toISOString().slice(0, 10);
    const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
    const random = Math.random().toString(36).slice(2, 8);
    return `${safeOrg}/${date}/${stamp}-${random}-${sanitizeFileName(fileName)}`;
  }

  async uploadSourcePdf({ file, organizationId }) {
    const validation = this.validatePdf(file);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const path = this.generateImportPath(organizationId, file.name);
    const uploaded = await storageService.uploadFile(TEMPLATE_IMPORT_BUCKET, path, file, {
      metadata: {
        source: 'ai-template-studio',
        originalName: file.name,
        contentType: file.type || 'application/pdf'
      }
    });

    if (!uploaded.success) {
      return uploaded;
    }

    return {
      success: true,
      data: {
        bucket: TEMPLATE_IMPORT_BUCKET,
        path: uploaded.data.path,
        publicUrl: uploaded.data.publicUrl,
        fileName: file.name,
        size: file.size,
        type: file.type || 'application/pdf'
      }
    };
  }

  async analyzePdf({ bucket, path, fileName, organizationId, notes }) {
    try {
      const { data, error } = await supabase.functions.invoke('generate-report-template', {
        body: {
          bucket,
          path,
          fileName,
          organizationId,
          notes: notes?.trim() || null
        }
      });

      if (error) {
        return { success: false, error: error.message || 'Template generation failed.' };
      }

      if (!data?.success) {
        return { success: false, error: data?.error || 'Template generation failed.' };
      }

      return {
        success: true,
        data: {
          ...data,
          draft: data.draft,
          source: data.source || { bucket, path, fileName }
        }
      };
    } catch (error) {
      return { success: false, error: error.message || 'Template generation failed.' };
    }
  }

  async createDraftFromPdf({ file, organizationId, notes }) {
    const uploaded = await this.uploadSourcePdf({ file, organizationId });
    if (!uploaded.success) {
      return uploaded;
    }

    const generated = await this.analyzePdf({
      bucket: uploaded.data.bucket,
      path: uploaded.data.path,
      fileName: uploaded.data.fileName,
      organizationId,
      notes
    });

    if (!generated.success) {
      return {
        ...generated,
        uploaded: uploaded.data
      };
    }

    return {
      success: true,
      data: {
        ...generated.data,
        uploaded: uploaded.data
      }
    };
  }
}

export const templateImportService = new TemplateImportService();
