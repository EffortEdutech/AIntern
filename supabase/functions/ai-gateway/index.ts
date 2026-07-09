/**
 * AIntern - ai-gateway Edge Function
 *
 * Single entry point for ALL AI calls (writing assistant, evaluation
 * comments, template import). Implements the dual-tier model:
 *
 *   Tier 1 BYOK    — intern's own key (OpenAI/Anthropic/Gemini), stored
 *                    AES-GCM-encrypted in ai_credentials; decrypted only
 *                    here, never sent to the client.
 *   Tier 2 Bundled — platform OpenAI key with per-request and monthly
 *                    token caps, metered in ai_usage.
 *
 * Actions (POST JSON { action, ... }, Authorization: Bearer <user JWT>):
 *   save_key    { provider, api_key }        → encrypt + upsert
 *   delete_key  { provider }
 *   list_keys   {}                            → providers with stored keys
 *   generate    { feature, text, hints? , provider? }
 *
 * Required secrets (Dashboard → Edge Functions → Secrets):
 *   AINTERN_KEY_ENCRYPTION_SECRET  — long random string (BYOK crypto)
 *   OPENAI_API_KEY                 — platform key for bundled tier
 * Optional:
 *   AINTERN_BUNDLED_MONTHLY_TOKEN_CAP   (default 100000)
 *   AINTERN_PER_REQUEST_MAX_TOKENS      (default 5000)
 *
 * @file supabase/functions/ai-gateway/index.ts
 * @created July 9, 2026 - Session 3
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ENC_SECRET = Deno.env.get('AINTERN_KEY_ENCRYPTION_SECRET') ?? '';
const PLATFORM_OPENAI_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';
const MONTHLY_CAP = Number(Deno.env.get('AINTERN_BUNDLED_MONTHLY_TOKEN_CAP') ?? '100000');
const PER_REQUEST_MAX_TOKENS = Number(Deno.env.get('AINTERN_PER_REQUEST_MAX_TOKENS') ?? '5000');

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// CORS: reflect whatever headers the browser preflights (the Supabase
// client attaches custom x-application-* headers), rather than a static list.
function corsHeaders(req: Request): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers':
      req.headers.get('Access-Control-Request-Headers') ??
      'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

const jsonWith = (req: Request) => (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  });

// ─── Crypto (AES-GCM, key derived from secret) ────────────────────────────

async function cryptoKey(): Promise<CryptoKey> {
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(ENC_SECRET),
  );
  return crypto.subtle.importKey('raw', hash, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function encrypt(plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await cryptoKey(),
    new TextEncoder().encode(plain),
  );
  const buf = new Uint8Array(iv.length + ct.byteLength);
  buf.set(iv, 0);
  buf.set(new Uint8Array(ct), iv.length);
  return btoa(String.fromCharCode(...buf));
}

async function decrypt(encoded: string): Promise<string> {
  const buf = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
  const iv = buf.slice(0, 12);
  const ct = buf.slice(12);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    await cryptoKey(),
    ct,
  );
  return new TextDecoder().decode(plain);
}

// ─── Feature prompts (server-side — client sends raw text only) ──────────

const FEATURES: Record<string, (hints: Record<string, string>) => string> = {
  polish: (h) => [
    'You are a writing assistant for internship daily logbooks.',
    'Rewrite the intern\'s rough notes into clear, professional, first-person log text.',
    'Rules: keep every fact; never invent tasks, numbers, or outcomes; keep it concise;',
    'use complete sentences; neutral-formal register suitable for a supervisor and university.',
    h.industry ? `The internship field is: ${h.industry}. Adapt vocabulary appropriately.` : '',
    h.language ? `Respond in ${h.language}.` : 'Respond in the same language as the input.',
    'Return ONLY the rewritten text, no preamble.',
  ].filter(Boolean).join(' '),

  eval_comment: (h) => [
    'You are helping an internship supervisor draft an evaluation comment.',
    'Based ONLY on the provided log summaries, write objective, constructive feedback:',
    '2-4 sentences on strengths, 1-2 on areas to improve. Never invent incidents.',
    h.language ? `Respond in ${h.language}.` : '',
    'Return ONLY the draft comment.',
  ].filter(Boolean).join(' '),
};

// ─── Providers ────────────────────────────────────────────────────────────

type AiResult = { text: string; tokensIn: number; tokensOut: number };

async function callOpenAI(key: string, system: string, user: string, maxTokens: number): Promise<AiResult> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return {
    text: data.choices?.[0]?.message?.content ?? '',
    tokensIn: data.usage?.prompt_tokens ?? 0,
    tokensOut: data.usage?.completion_tokens ?? 0,
  };
}

async function callAnthropic(key: string, system: string, user: string, maxTokens: number): Promise<AiResult> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return {
    text: data.content?.[0]?.text ?? '',
    tokensIn: data.usage?.input_tokens ?? 0,
    tokensOut: data.usage?.output_tokens ?? 0,
  };
}

async function callGemini(key: string, system: string, user: string, maxTokens: number): Promise<AiResult> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { maxOutputTokens: maxTokens },
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return {
    text: data.candidates?.[0]?.content?.parts?.[0]?.text ?? '',
    tokensIn: data.usageMetadata?.promptTokenCount ?? 0,
    tokensOut: data.usageMetadata?.candidatesTokenCount ?? 0,
  };
}

const PROVIDERS: Record<string, typeof callOpenAI> = {
  openai: callOpenAI,
  anthropic: callAnthropic,
  gemini: callGemini,
};

// ─── Metering ─────────────────────────────────────────────────────────────

async function monthlyUsage(userId: string): Promise<number> {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const { data, error } = await admin
    .from('ai_usage')
    .select('tokens_in, tokens_out')
    .eq('user_id', userId)
    .gte('created_at', monthStart.toISOString());
  if (error) throw new Error('usage query failed: ' + error.message);
  return (data ?? []).reduce((s, r) => s + (r.tokens_in ?? 0) + (r.tokens_out ?? 0), 0);
}

// ─── Handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const json = jsonWith(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json({ success: false, error: 'POST only' }, 405);

  // Authenticate the intern
  const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
  const { data: { user }, error: authErr } = await admin.auth.getUser(jwt);
  if (authErr || !user) return json({ success: false, error: 'Unauthorized' }, 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: 'Invalid JSON' }, 400);
  }

  const action = String(body.action ?? '');

  try {
    // ── save_key ──────────────────────────────────────────────────────
    if (action === 'save_key') {
      const provider = String(body.provider ?? '');
      const apiKey = String(body.api_key ?? '').trim();
      if (!PROVIDERS[provider]) return json({ success: false, error: 'Unknown provider' }, 400);
      if (apiKey.length < 10) return json({ success: false, error: 'Key looks invalid' }, 400);
      if (!ENC_SECRET) return json({ success: false, error: 'Server missing AINTERN_KEY_ENCRYPTION_SECRET' }, 500);

      const encrypted_key = await encrypt(apiKey);
      const { error } = await admin
        .from('ai_credentials')
        .upsert({ user_id: user.id, provider, encrypted_key }, { onConflict: 'user_id,provider' });
      if (error) return json({ success: false, error: error.message }, 500);
      return json({ success: true });
    }

    // ── delete_key ────────────────────────────────────────────────────
    if (action === 'delete_key') {
      const provider = String(body.provider ?? '');
      const { error } = await admin
        .from('ai_credentials')
        .delete()
        .eq('user_id', user.id)
        .eq('provider', provider);
      if (error) return json({ success: false, error: error.message }, 500);
      return json({ success: true });
    }

    // ── list_keys ─────────────────────────────────────────────────────
    if (action === 'list_keys') {
      const { data, error } = await admin
        .from('ai_credentials')
        .select('provider, created_at')
        .eq('user_id', user.id);
      if (error) return json({ success: false, error: error.message }, 500);
      return json({ success: true, keys: data ?? [] });
    }

    // ── generate ──────────────────────────────────────────────────────
    if (action === 'generate') {
      const feature = String(body.feature ?? '');
      const text = String(body.text ?? '').slice(0, 8000);
      const hints = (body.hints ?? {}) as Record<string, string>;
      const requestedProvider = String(body.provider ?? 'openai');

      const promptBuilder = FEATURES[feature];
      if (!promptBuilder) return json({ success: false, error: 'Unknown feature' }, 400);
      if (!text.trim()) return json({ success: false, error: 'Empty text' }, 400);

      const system = promptBuilder(hints);
      const maxTokens = Math.min(PER_REQUEST_MAX_TOKENS, 2000);

      // Tier resolution: BYOK first
      const { data: cred } = await admin
        .from('ai_credentials')
        .select('provider, encrypted_key')
        .eq('user_id', user.id)
        .eq('provider', requestedProvider)
        .maybeSingle();

      let tier: 'byok' | 'bundled';
      let provider: string;
      let key: string;

      if (cred?.encrypted_key) {
        if (!ENC_SECRET) return json({ success: false, error: 'Server missing encryption secret' }, 500);
        tier = 'byok';
        provider = cred.provider;
        key = await decrypt(cred.encrypted_key);
      } else {
        // Bundled tier — platform OpenAI key, capped
        if (!PLATFORM_OPENAI_KEY) {
          return json({
            success: false,
            error: 'No AI key available. Add your own key in Profile → AI Assistant, or upgrade to the bundled AI plan.',
          }, 402);
        }
        const used = await monthlyUsage(user.id);
        if (used >= MONTHLY_CAP) {
          return json({
            success: false,
            error: `Monthly AI quota reached (${MONTHLY_CAP} tokens). Add your own key in Profile → AI Assistant to continue.`,
          }, 429);
        }
        tier = 'bundled';
        provider = 'openai';
        key = PLATFORM_OPENAI_KEY;
      }

      const result = await PROVIDERS[provider](key, system, text, maxTokens);

      // Meter bundled usage only (BYOK is user-billed)
      if (tier === 'bundled') {
        await admin.from('ai_usage').insert({
          user_id: user.id,
          feature,
          provider,
          tokens_in: result.tokensIn,
          tokens_out: result.tokensOut,
        });
      }

      return json({
        success: true,
        text: result.text,
        tier,
        provider,
        tokens: { in: result.tokensIn, out: result.tokensOut },
      });
    }

    return json({ success: false, error: 'Unknown action' }, 400);
  } catch (err) {
    console.error('ai-gateway error:', err);
    return json({ success: false, error: String(err?.message ?? err) }, 500);
  }
});
