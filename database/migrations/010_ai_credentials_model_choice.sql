-- AIntern Migration 010: ai_credentials.model (PDF-import track follow-up, v11)
--
-- Google deprecated gemini-2.0-flash on 2026-06-01, and the immediate
-- replacement (gemini-2.5-flash) turned out to be closed to new users
-- within hours of the fix. Hardcoding a specific model string in
-- ai-gateway/index.ts is a losing game, so this migration adds a nullable
-- `model` column to ai_credentials: each intern's BYOK provider key can now
-- carry a chosen model, populated via the ai-gateway `list_models` /
-- `set_model` actions (which query each provider's OWN live model-list API
-- — never a value baked into our code).
--
-- Null = "use the gateway's built-in fallback default for this provider."
-- Bundled tier (no ai_credentials row) always uses the fixed fallback —
-- model choice is a BYOK-only feature, keeping bundled-tier costs
-- predictable per the Phase 4 monetization design.
--
-- @created July 12, 2026

alter table public.ai_credentials
  add column if not exists model text;

comment on column public.ai_credentials.model is
  'Intern-chosen model id for this BYOK provider key (e.g. "gpt-4o-mini", "gemini-3.5-flash"). Null = gateway default fallback. Populated via list_models/set_model actions in ai-gateway, never hardcoded.';
