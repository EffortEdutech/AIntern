# AIntern — Development Progress Log

**Last Updated:** July 9, 2026 — End of Session 6

## 📊 OVERALL STATUS

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 0 | Foundation (seed, schema, AI gateway) | ✅ Complete — S1–S3 |
| Phase 1 | Intern Logging Core | ✅ Complete — S4–S6 |
| Phase 2 | Supervisor Loop (email links, snapshots, evaluations) | 🔄 Next — S7 token/email service |
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

---

### Session 4: Daily Log Core + AI Polish ✅
**Date:** July 9, 2026

#### Database
- Migration `seed_daily_template` — `aintern-daily-log-v1` (public): Attendance (date/time in/time out/location), Tasks (category select, summary, outcomes, hours), Learning & Blockers. No photo/signature fields yet (arrive with submission flow, S6). `database/migrations/002_seed_daily_template.sql`.

#### New
- `src/services/offline/internDb.js` — clean Dexie v1: `dailyDrafts` (keyed by entry_date; one draft/day; statuses draft→ready→submitted→approved/rejected), `templateCache`.
- `src/services/api/dailyLogService.js` — template fetch network-first with offline cache fallback; draft CRUD preserving `client_created_at` (late-flag authority).
- `src/context/AiPolishContext.jsx` — opt-in bridge: pages provide `polish(text)`; engine textareas consume it.
- `src/pages/log/DailyLogPage.jsx` — DynamicForm-rendered daily sheet; 800ms debounced autosave to Dexie; offline banner; status badge; read-only once submitted/approved; Save marks `ready`.
- `src/pages/log/LogHistory.jsx` — local drafts list, status chips, tap-to-edit via `/log?date=`.

#### Engine change (bounded, marked AINTERN)
- `FieldRenderer.jsx` textarea case → `AinternPolishableTextarea`: renders identical to upstream when no AiPolishProvider is mounted; with provider, adds ✨ Polish with AI button (disabled while empty/busy, error inline).

#### Changed
- `router.jsx` — `/log` and `/history` now real pages (ComingSoon removed).
- `InternHome.jsx` — "Start today's log" live.

#### Verification
- esbuild syntax pass on all 7 new/changed files; repo-wide null-byte scan clean.
- Manual test checklist (user): create today's log → type rough notes in "What did you work on today?" → ✨ Polish (Gemini BYOK) → verify autosave chip → Save log → History shows entry `ready` → airplane mode → reopen /log → form loads from cache, edits persist.

---

### Session 5: Late Flags, Date Navigation, Polish Undo, Week Strip ✅
**Date:** July 9, 2026

All edits to existing files — no new modules, no schema changes. Graphify graph.json (built earlier today, 875 nodes) confirmed to cover all S4 modules before editing.

#### Changed
- `dailyLogService.saveDraft` — computes `late` flag: first save (device `client_created_at`) after the entry-date deadline (default 23:59, override via `internships.metadata.deadline_time` "HH:MM"). Offline-fair by design: sync time never matters.
- `DailyLogPage` — ‹ › per-day navigation (future dates blocked); Late chip; deadline policy passed through; autosave now refreshes draft state.
- `LogHistory` — orange `late` chip alongside status.
- `FieldRenderer` (AINTERN block) — ↩ Undo restores pre-polish text after an AI polish.
- `InternHome` — last-7-days strip (✓ logged / today ring / empty), "Not logged yet" nudge, button text adapts (Start/Continue).

#### Verification
- esbuild syntax pass on all 5 changed files; null-byte scan clean.
- Note: existing drafts saved before S5 have no `late` field — they show as on-time (acceptable; flag recomputes on next save).
- ⚠ Graphify: content changed in 5 files (no structural additions). Refresh at sign-off from Windows: `.\scripts\graphify.ps1` per AGENTS.md (PowerShell wrapper can't run in the Linux sandbox).

---

### Session 6: Submission Flow + Batch Queue ✅
**Date:** July 9, 2026

No schema changes. Uses existing `entry_submissions` owner RLS: interns insert/read/delete their own pending submissions; approvals/rejections remain service-role-only for Phase 2.

#### New
- `src/services/api/submissionService.js` — authenticated submission API:
  - inserts ready Dexie drafts into `entry_submissions` with `status = 'pending'`;
  - detects existing same-date submissions instead of upserting (keeps RLS narrow; no intern UPDATE policy needed);
  - syncs readable submission status (`pending`/`approved`/`rejected`) back into Dexie;
  - withdraws still-pending submissions via the existing owner delete policy.

#### Changed
- `dailyLogService` — added helpers for selected ready drafts, marking local drafts submitted/approved/rejected, and reopening withdrawn drafts to `ready`.
- `DailyLogPage` — "Save log" renamed to "Save as ready"; copy now points interns to History for online submission; submitted logs show supervisor comments when present.
- `LogHistory` — now doubles as the batch submission workspace:
  - select all ready logs or pick individual ready logs;
  - submit selected logs to Supabase when online;
  - sync review status from `entry_submissions`;
  - withdraw still-pending submissions back to ready.

#### Verification
- `npm run build` passed.
- Build note: Browserslist/caniuse-lite warning is informational; no action taken.

#### Next Session (S7)
- Token service + email sending: issue scoped supervisor links for pending `entry_submissions`, send via Resend/SMTP Edge Function, and prepare digest/cadence scheduling.
