/**
 * AIntern - AI Service (client wrapper for the ai-gateway Edge Function)
 *
 * All AI features go through here. The user's JWT is attached
 * automatically by supabase.functions.invoke; keys never touch the
 * client — only masked provider listings come back.
 *
 * @file src/services/api/aiService.js
 * @created July 9, 2026 - Session 3
 * @updated July 12, 2026 - v11: listModels/setModel — per-BYOK-provider model
 *   choice, populated from that provider's own live model list (gateway
 *   never hardcodes a model string anymore).
 */

import { supabase } from '../supabase/client';

const FN = 'ai-gateway';

async function call(body) {
  try {
    const { data, error } = await supabase.functions.invoke(FN, { body });
    if (error) {
      // supabase-js wraps non-2xx into FunctionsHttpError; surface the payload
      let message = error.message;
      try {
        const ctx = await error.context?.json?.();
        if (ctx?.error) message = ctx.error;
      } catch { /* keep original message */ }
      return { success: false, error: message };
    }
    return data;
  } catch (err) {
    console.error('❌ aiService error:', err);
    return { success: false, error: err.message };
  }
}

export const aiService = {
  /** Save (encrypt server-side) the intern's own provider key. */
  saveKey: (provider, apiKey) =>
    call({ action: 'save_key', provider, api_key: apiKey }),

  /** Remove a stored key. */
  deleteKey: (provider) => call({ action: 'delete_key', provider }),

  /** List providers that have a stored key (+ chosen model, if any). No key material returned. */
  listKeys: () => call({ action: 'list_keys' }),

  /**
   * LIVE list of usable models for a provider, straight from that
   * provider's own API (never hardcoded client-side) — uses the intern's
   * stored BYOK key for that provider (or the bundled key, for openai only).
   */
  listModels: (provider) => call({ action: 'list_models', provider }),

  /** Save which model a BYOK provider key should use. model: '' reverts to the built-in default. */
  setModel: (provider, model) => call({ action: 'set_model', provider, model }),

  /**
   * Polish rough log notes into formal text.
   * @param {string} text - the intern's rough notes
   * @param {Object} hints - { industry, language }
   * @param {string} provider - preferred provider if BYOK (default openai)
   */
  polish: (text, hints = {}, provider = 'openai') =>
    call({ action: 'generate', feature: 'polish', text, hints, provider }),

  /** Draft an evaluation comment from log summaries (Phase 2 supervisor flow). */
  draftEvalComment: (text, hints = {}, provider = 'openai') =>
    call({ action: 'generate', feature: 'eval_comment', text, hints, provider }),

  /**
   * Generic gateway call for any server-registered feature prompt
   * (v1.1: 'portfolio' R5, 'ready_check' R1.5). The prompt lives
   * server-side; the client only ships the evidence digest.
   */
  generate: (feature, text, hints = {}, provider = 'openai') =>
    call({ action: 'generate', feature, text, hints, provider }),

  /**
   * Phase B (Case 2): extract a chapter structure from an uploaded full
   * training-report document (PDF/photo) — mirrors import_form's shape.
   */
  importReportStructure: (mime, file_base64, provider = 'gemini') =>
    call({ action: 'import_report_structure', mime, file_base64, provider }),
};

export default aiService;
