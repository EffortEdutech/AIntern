/**
 * AIntern - Final Report Service (Phase B, Case 2: full training-report import)
 *
 * Manages the "final" report_type end-to-end on the client side:
 *  - Resolves the active chapter template (custom import, else the seeded
 *    'aintern-final-report-default') — same daily_template_id-style slot
 *    pattern as Template Studio, but for internships.final_report_template_id.
 *  - Narrative chapter drafts live in internships.metadata.final_report_draft
 *    (no new table — same caching pattern as report_prefs / portfolio).
 *  - Per-chapter AI draft-assist reuses portfolioService's evidence digest
 *    builder (same evidence-only guardrail, no third copy of that logic).
 *  - Official 'final' snapshots go through the EXISTING generic
 *    reportVersionService.createSnapshot() / create_report_snapshot() RPC —
 *    nothing final-report-specific there; verification is untouched.
 *
 * @file src/services/api/finalReportService.js
 * @created July 12, 2026 - Phase B
 */

import { supabase } from '../supabase/client';
import { internshipService } from './internshipService';
import { aiService } from './aiService';
import { portfolioService } from './portfolioService';

const DEFAULT_TEMPLATE_ID = 'aintern-final-report-default';
const MAX_BYTES = 5 * 1024 * 1024;

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const [, b64] = String(reader.result).split(',');
      resolve(b64);
    };
    reader.onerror = () => reject(new Error('Could not read the file'));
    reader.readAsDataURL(file);
  });
}

class FinalReportService {
  /**
   * The chapter structure currently in effect for this internship:
   * a custom import (final_report_template_id) if set, else the default.
   * @returns {Promise<{template: object|null, reportTitle: string, chapters: Array}>}
   */
  async getActiveChapterTemplate(internship) {
    const customId = internship?.final_report_template_id ?? null;
    let query = supabase.from('templates').select('*');
    query = customId ? query.eq('id', customId) : query.eq('template_id', DEFAULT_TEMPLATE_ID);
    const { data, error } = await query.maybeSingle();
    if (error || !data) {
      return { template: null, reportTitle: 'Final Training Report', chapters: [] };
    }
    return {
      template: data,
      reportTitle: data.template_name || 'Final Training Report',
      chapters: data.pdf_layout?.final_report?.chapters ?? [],
    };
  }

  /** Current narrative drafts: { [chapter_id]: text }. */
  getDraft(internship) {
    return internship?.metadata?.final_report_draft ?? {};
  }

  /** Save one chapter's narrative text (debounce at the call site). */
  async saveDraftChapter(internship, chapterId, text) {
    const draft = { ...this.getDraft(internship), [chapterId]: text };
    return internshipService.updateInternship(internship.id, {
      metadata: { ...(internship.metadata ?? {}), final_report_draft: draft },
    });
  }

  /** Upload a full report (PDF/photo) → sanitized chapter structure draft. */
  async extractStructure(file, provider = 'gemini') {
    if (!file) return { success: false, error: 'Choose a file first.' };
    if (file.size > MAX_BYTES) {
      return { success: false, error: 'File too large — keep it under 5 MB (a table-of-contents page or a few sample pages works well).' };
    }
    const file_base64 = await fileToBase64(file);
    return aiService.importReportStructure(file.type, file_base64, provider);
  }

  /** Save the approved chapter structure as the intern's own template and apply it. */
  async saveAndApplyStructure(internship, structure) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not logged in' };

    const templateId = `final-report-${user.id.slice(0, 8)}-${Date.now()}`;
    const { data: tpl, error: tplErr } = await supabase
      .from('templates')
      .insert({
        template_id: templateId,
        template_name: structure.report_title,
        description: 'Imported from an uploaded training report via Report Studio',
        fields_schema: { sections: [] },
        pdf_layout: { final_report: { chapters: structure.chapters } },
        is_public: false,
        owner_id: user.id,
      })
      .select()
      .single();
    if (tplErr) return { success: false, error: tplErr.message };

    const res = await internshipService.updateInternship(internship.id, { final_report_template_id: tpl.id });
    if (!res.success) return res;
    return { success: true, internship: res.data, template: tpl };
  }

  /** Revert to the default chapter structure. */
  async revertToDefault(internship) {
    return internshipService.updateInternship(internship.id, { final_report_template_id: null });
  }

  /**
   * AI draft-assist for ONE narrative chapter — evidence-only, same
   * guardrail pattern as portfolio/eval_comment. Never offered for
   * non-ai_draftable chapters (gated in the UI, not here).
   */
  async draftChapter({ profile, internship, snapshots, evaluations, chapter, provider = 'openai' }) {
    if (!snapshots?.length) {
      return { success: false, error: 'No approved entries yet — a draft needs your own logged evidence to work from.' };
    }
    const digest = portfolioService.buildDigest({ profile, internship, snapshots, evaluations });
    const hints = {
      chapter_title: chapter.chapter_title,
      guidance: chapter.guidance,
      industry: internship?.metadata?.industry,
    };
    return aiService.generate('final_chapter_draft', digest, hints, provider);
  }
}

export const finalReportService = new FinalReportService();
export default finalReportService;
