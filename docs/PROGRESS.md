# AIntern — Development Progress Log

**Last Updated:** July 9, 2026 — End of Session 3

## 📊 OVERALL STATUS

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 0 | Foundation (seed, schema, AI gateway) | ✅ Complete — S1–S3 |
| Phase 1 | Intern Logging Core | 📅 |
| Phase 2 | Supervisor Loop (email links, snapshots, evaluations) | 📅 |
| Phase 3 | Export & Premium (PDF logbook, AI form import) | 📅 |
| Phase 4 | Monetization & Pilot | 📅 |

---

### Session 1: Repo Seed + Database Foundation ✅
**Date:** July 9, 2026

#### Repo
- Seeded from WorkLedger `e78a5a6a` (excluded: .git, node_modules, dist, docs, database, graphify-out caches, scripts).
- `package.json` → name `aintern`, version 0.1.0.
- `vite.config.js` → dev/preview port **4900 (strict)**; PWA manifest renamed to AIntern.
- `.env.example` → new Supabase project URL, port 4900.
- New AGENTS.md / CLAUDE.md / README.md; plan v0.3 copied to docs/.
- ⚠ Git not initialized in-session (mounted-FS limitation) — run on host:
  `git init -b main && git remote add origin https://github.com/EffortEdutech/AIntern.git && git add -A && git commit -m "Session 1: seed from WorkLedger e78a5a6a + AIntern schema" && git push -u origin main`

#### Database (Supabase `wdhdjhvvngssnszqgiyk`)
- Migrations applied: `initial_schema` + `fix_function_search_path` — see `database/migrations/001_initial_schema.sql`.
- Security advisors: clean (0 lints) after search_path fix.
- Tables: profiles, internships, templates, entry_submissions, approved_snapshots, evaluations, approval_tokens, ai_credentials, ai_usage.
- Owner-based RLS on all tables; snapshots/evaluations immutable via trigger + no UPDATE/DELETE policies; ai_credentials service-role-only.

#### Not in this session (deliberate)
- `src/` still contains WorkLedger modules (orgs, contracts, subcontractors) — stripped in Session 2 alongside routing/nav rebuild.
- Supabase Edge Functions from WorkLedger (`generate-report-template`, `notify-approval`) copied but not deployed — reworked in S3/Phase 2.

---

### Session 2: Module Strip + Intern Shell + Onboarding ✅
**Date:** July 9, 2026

#### New
- `src/config/platform.js` — app identity, module flags (WorkLedger business modules parked), cadence/digest options, terminology defaults.
- `src/hooks/useTerminology.js` — label lookup with per-internship overrides (`metadata.terminology`).
- `src/services/api/internshipService.js` — getMyInternship / createInternship / updateInternship / saveProfile (owner-scoped via RLS).
- `src/components/layout/InternShell.jsx` — mobile-first shell: top bar + bottom nav (Home / Log / History / Profile), max-w-md, OfflineIndicator retained.
- `src/pages/intern/InternHome.jsx` — internship card, onboarding CTA, feature-gated daily-log button.
- `src/pages/intern/InternProfile.jsx` — profile fields + review settings (cadence 7/14/30, digest mode). Replaces org-dependent ProfilePage.
- `src/pages/intern/ComingSoon.jsx` — placeholder for /log and /history.
- `src/pages/onboarding/Onboarding.jsx` — 4-step wizard (You → Internship → Supervisor → Reviews); saves profile at step 1, creates internship on finish.

#### Changed
- `src/router.jsx` — rewritten: public auth routes + 5 intern routes + 404. All WorkLedger business routes unrouted (pages parked in src/pages for engine reuse). Role guards removed — single authenticated persona.
- `src/App.jsx` — OrganizationProvider removed; platform branding.
- `src/services/supabase/auth.js` — `user_profiles` → `profiles`, `phone_number` → `phone`, profile select matches AIntern columns.
- `src/components/layout/AuthLayout.jsx`, `index.html`, `main.jsx` — rebranded to AIntern.
- Removed stray `graphify-out/cache` dirs from src subfolders (seed hygiene).

#### Verification
- esbuild syntax check passed on all 13 new/changed files (full `npm run build` to be run locally — sandbox can't persist node_modules).
- Known deferred: OfflineContext still references WorkLedger Dexie schema — harmless at boot (empty queue); rewritten in Phase 1 (S4).

---

### Session 3: AI Gateway (Dual-Tier) ✅
**Date:** July 9, 2026

#### New
- `supabase/functions/ai-gateway/index.ts` — deployed (v1, ACTIVE, verify_jwt on):
  - Actions: `save_key` / `delete_key` / `list_keys` / `generate`.
  - BYOK keys AES-GCM encrypted (key derived from `AINTERN_KEY_ENCRYPTION_SECRET`); decrypt only in-function; ciphertext in `ai_credentials`.
  - Providers: OpenAI (gpt-4o-mini, default), Anthropic (claude-haiku-4-5), Gemini (gemini-2.0-flash) behind one abstraction.
  - Tier resolution: BYOK if the user has a key for the requested provider, else bundled (platform OpenAI key) with monthly token cap + `ai_usage` metering. BYOK is unmetered (user-billed).
  - Server-side feature prompts: `polish` (log writing assistant), `eval_comment` (Phase 2).
  - Caps: per-request `min(AINTERN_PER_REQUEST_MAX_TOKENS, 2000)` output tokens; monthly default 100k (tune after pilot telemetry).
- `src/services/api/aiService.js` — client wrapper (functions.invoke; keys never returned to client).
- InternProfile → new "AI Assistant" section: save/remove BYOK keys per provider (masked list).

#### ⚠ Required before AI works — set Edge Function secrets
Dashboard → Project Settings → Edge Functions → Secrets:
- `AINTERN_KEY_ENCRYPTION_SECRET` = long random string (e.g. 64 hex chars) — NEVER rotate casually; rotating invalidates all stored BYOK keys.
- `OPENAI_API_KEY` = platform key for the bundled tier (optional until bundled tier is offered; BYOK works without it).
- Optional: `AINTERN_BUNDLED_MONTHLY_TOKEN_CAP`, `AINTERN_PER_REQUEST_MAX_TOKENS`.

#### Verification & Post-deploy Fixes (same day)
- Function deployed via MCP, JWT verification enforced platform-side.
- Fix 1: CORS — Supabase client sends `x-application-version`; function now reflects `Access-Control-Request-Headers` in preflight instead of a static allow-list. Redeployed (v4).
- Fix 2: legacy WorkLedger sync in OfflineContext gated off (`LEGACY_SYNC_ENABLED = false`) — was 404-ing on `user_profiles`/`org_members` at boot. Rewritten properly in S4.
- Fix 3: client header rebranded `x-application-name: AIntern`.
- ✅ **User-verified end-to-end:** secrets set, Gemini BYOK key saved → encrypted → listed masked in Profile → AI Assistant. BYOK tier proven.

#### Next Session (S4 — Phase 1 begins)
- Seed Daily Task Sheet template; DynamicForm integration; Dexie local persistence; today view + history strip. Wire the polish button to aiService.
