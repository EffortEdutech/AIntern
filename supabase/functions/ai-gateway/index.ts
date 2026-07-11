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
 * @updated July 11, 2026 - v6: portfolio (R5) + ready_check (R1.5) features
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

  // v1.1 R5 — Portfolio Engine (spec §43): verified record → career assets.
  portfolio: (h) => [
    'You are a career coach turning a VERIFIED internship record (daily logs approved and',
    'digitally signed by the supervisor, plus supervisor evaluations) into professional career assets.',
    'Return STRICT JSON only (no markdown fences, no commentary) with exactly these keys:',
    '{"summary": string (2-3 sentence professional summary, first person implied, no "I"),',
    '"technical_skills": string[] (max 10, concrete tools/technologies/methods evidenced in the logs),',
    '"soft_skills": string[] (max 8, grounded in supervisor evaluations and log evidence),',
    '"resume_bullets": string[] (5-8 bullets, each starting with a strong past-tense action verb,',
    'quantified where the data allows, ATS-friendly, max 30 words each),',
    '"highlights": [{"title": string, "description": string}] (max 3 standout projects or achievements),',
    '"talking_points": string[] (exactly 3 concise interview talking points connecting this experience to employer value)}.',
    'Base EVERYTHING strictly on the provided evidence. Never invent tasks, numbers, tools, or outcomes.',
    h.industry ? `The internship field is: ${h.industry}.` : '',
    h.language ? `Write all values in ${h.language}.` : 'Write in the same language as the logs.',
  ].filter(Boolean).join(' '),

  // v1.1 R1.5 — AI narrative-quality Ready Check (advisory only; the
  // deterministic check in reportVersionService remains the authority).
  ready_check: (h) => [
    'You are a quality reviewer for an internship logbook about to be frozen into an official report.',
    'You receive a digest of daily entries (date + text). Assess NARRATIVE quality only:',
    'completeness and clarity of what was done, how, and what was learned or achieved.',
    'Return at most 5 short bullet lines (plain text, each starting with "- "), each naming the',
    'date(s) concerned and the specific weakness (vague summary, missing outcome, repeated filler)',
    'with a one-clause suggestion. If overall quality is good, return one line saying the logbook',
    'reads well, plus at most one optional improvement. Never invent content; judge only what is provided.',
    h.language ? `Respond in ${h.language}.` : 'Respond in the same language as the entries.',
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

// ─── Template import (Session 11): prompt, vision calls, sanitizer ───────

const IMPORT_PROMPT = [
  'You are analyzing a scanned or photographed internship logbook / daily report form.',
  'Extract its structure as STRICT JSON (no markdown fences, no commentary):',
  '{"template_name": string, "sections": [{"section_id": snake_case string, "section_name": string,',
  '"fields": [{"field_id": snake_case string, "field_name": string,',
  '"field_type": one of "text"|"textarea"|"number"|"date"|"time"|"select"|"radio"|"checkbox",',
  '"required": boolean, "options": string[] (only for select/radio), "rows": number (only for textarea)}]}]}.',
  'Rules: long writing areas are "textarea"; date fields "date"; time fields "time"; rating scales or',
  'checklists with fixed choices are "select" or "radio" with their options; signature areas, logos,',
  'page headers/footers, and approval stamps are NOT fields - skip them.',
  'Keep the original language of the form labels. Maximum 8 sections, 15 fields per section.',
].join(' ');

const ALLOWED_FIELD_TYPES = new Set(['text', 'textarea', 'number', 'date', 'time', 'select', 'radio', 'checkbox']);

function slug(input: string, fallback: string): string {
  const s = String(input ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
  return s || fallback;
}

/** Server-side authority: AI output never reaches the form engine unvalidated. */
function sanitizeTemplate(raw: Record<string, unknown>) {
  const sections = (Array.isArray(raw?.sections) ? raw.sections : []).slice(0, 8);
  const outSections = [];
  const seenSectionIds = new Set<string>();
  sections.forEach((sec: Record<string, unknown>, si: number) => {
    const name = String(sec?.section_name ?? '').trim().slice(0, 80);
    if (!name) return;
    let sid = slug(String(sec?.section_id ?? name), `section_${si + 1}`);
    while (seenSectionIds.has(sid)) sid += '_x';
    seenSectionIds.add(sid);
    const fields = [];
    const seenFieldIds = new Set<string>();
    (Array.isArray(sec?.fields) ? sec.fields : []).slice(0, 15).forEach((f: Record<string, unknown>, fi: number) => {
      const fname = String(f?.field_name ?? '').trim().slice(0, 120);
      if (!fname) return;
      let fid = slug(String(f?.field_id ?? fname), `field_${fi + 1}`);
      while (seenFieldIds.has(fid)) fid += '_x';
      seenFieldIds.add(fid);
      let ftype = String(f?.field_type ?? 'text');
      if (!ALLOWED_FIELD_TYPES.has(ftype)) ftype = 'text';
      const field: Record<string, unknown> = {
        field_id: fid,
        field_name: fname,
        field_type: ftype,
        required: Boolean(f?.required),
      };
      if (['select', 'radio'].includes(ftype)) {
        const opts = (Array.isArray(f?.options) ? f.options : [])
          .map((o) => String(o).trim().slice(0, 60)).filter(Boolean).slice(0, 12);
        if (opts.length === 0) { field.field_type = 'text'; } else { field.options = opts; }
      }
      if (ftype === 'textarea') field.rows = Math.min(Math.max(Number(f?.rows) || 3, 2), 8);
      fields.push(field);
    });
    if (fields.length > 0) outSections.push({ section_id: sid, section_name: name, fields });
  });
  if (outSections.length === 0) return null;
  return {
    template_name: String(raw?.template_name ?? 'Imported form').trim().slice(0, 100) || 'Imported form',
    fields_schema: { sections: outSections },
  };
}

function parseModelJson(text: string): Record<string, unknown> | null {
  const cleaned = text.trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try { return JSON.parse(cleaned.slice(start, end + 1)); } catch { return null; }
}

async function visionOpenAI(key: string, system: string, mime: string, b64: string, maxTokens: number): Promise<AiResult> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: [
          { type: 'text', text: 'Extract the form structure from this document.' },
          { type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } },
        ] },
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

async function visionAnthropic(key: string, system: string, mime: string, b64: string, maxTokens: number): Promise<AiResult> {
  const block = mime === 'application/pdf'
    ? { type: 'document', source: { type: 'base64', media_type: mime, data: b64 } }
    : { type: 'image', source: { type: 'base64', media_type: mime, data: b64 } };
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: [block, { type: 'text', text: 'Extract the form structure from this document.' }] }],
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

async function visionGemini(key: string, system: string, mime: string, b64: string, maxTokens: number): Promise<AiResult> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [
          { inline_data: { mime_type: mime, data: b64 } },
          { text: 'Extract the form structure from this document.' },
        ] }],
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

const VISION_PROVIDERS: Record<string, typeof visionOpenAI> = {
  openai: visionOpenAI,
  anthropic: visionAnthropic,
  gemini: visionGemini,
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

    // ── import_form (Session 11): logbook photo/PDF → template draft ──
    if (action === 'import_form') {
      const mime = String(body.mime ?? '');
      const b64 = String(body.file_base64 ?? '');
      const requestedProvider = String(body.provider ?? 'openai');
      const ALLOWED_MIMES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];
      if (!ALLOWED_MIMES.includes(mime)) {
        return json({ success: false, error: 'Upload a PNG/JPG photo or a PDF of the form.' }, 400);
      }
      if (!b64 || b64.length > 8_000_000) {
        return json({ success: false, error: 'File too large — keep it under ~5 MB.' }, 400);
      }

      // Tier resolution (same as generate)
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
        if (!PLATFORM_OPENAI_KEY) {
          return json({ success: false, error: 'No AI key available. Add your own key in Profile → AI Assistant.' }, 402);
        }
        const used = await monthlyUsage(user.id);
        if (used >= MONTHLY_CAP) {
          return json({ success: false, error: `Monthly AI quota reached (${MONTHLY_CAP} tokens).` }, 429);
        }
        tier = 'bundled';
        provider = 'openai';
        key = PLATFORM_OPENAI_KEY;
      }

      if (mime === 'application/pdf' && provider === 'openai') {
        return json({
          success: false,
          error: 'PDF import needs a Gemini or Claude key (Profile → AI Assistant) — or upload a photo/screenshot of the form instead.',
        }, 400);
      }

      const result = await VISION_PROVIDERS[provider](key, IMPORT_PROMPT, mime, b64, 4000);
      if (tier === 'bundled') {
        await admin.from('ai_usage').insert({
          user_id: user.id,
          feature: 'template_import',
          provider: provider,
          tokens_in: result.tokensIn,
          tokens_out: result.tokensOut,
        });
      }

      const parsed = parseModelJson(result.text);
      const sanitized = parsed ? sanitizeTemplate(parsed) : null;
      if (!sanitized) {
        return json({
          success: false,
          error: 'Could not read a form structure from that file. Try a clearer photo (whole page, good lighting).',
        }, 422);
      }

      return json({ success: true, template: sanitized, tier: tier, provider: provider });
    }

    return json({ success: false, error: 'Unknown action' }, 400);
  } catch (err) {
    console.error('ai-gateway error:', err);
    return json({ success: false, error: String(err?.message ?? err) }, 500);
  }
});
