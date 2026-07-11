/**
 * AIntern - AI Service (client wrapper for the ai-gateway Edge Function)
 *
 * All AI features go through here. The user's JWT is attached
 * automatically by supabase.functions.invoke; keys never touch the
 * client — only masked provider listings come back.
 *
 * @file src/services/api/aiService.js
 * @created July 9, 2026 - Session 3
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

  /** List providers that have a stored key (no key material returned). */
  listKeys: () => call({ action: 'list_keys' }),

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
};

export default aiService;
