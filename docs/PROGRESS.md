# AIntern — Development Progress Log

<!-- Session 6 review addendum appended July 10, 2026 — see below -->

**Last Updated:** July 11, 2026 — v1.1 R2 complete

## 📊 OVERALL STATUS

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 0 | Foundation (seed, schema, AI gateway) | ✅ Complete — S1–S3 |
| Phase 1 | Intern Logging Core | ✅ Complete — S4–S6 |
| Phase 2 | Supervisor Loop (email links, snapshots, evaluations) | ✅ Core complete — S7–S9 |
| Phase 3 | Export & Premium (PDF logbook, AI form import) | ✅ Complete — S10–S11 |
| v1.0 e2e pilot | User end-to-end test | ✅ Completed July 11 |
| **v1.1 R1** | Report versions + Verification IDs + Ready Check | ✅ Complete |
| **v1.1 R2** | Presentation templates + HTML live preview + report style prefs | ✅ Complete |
| v1.1 R3–R5 | DOCX + QR /verify → multi-reviewer → portfolio | 📅 |
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

No schema changes. Uses existing `entry_submissions` owner RLS
---

### Session 6 Review Addendum (Claude) ✅
**Date:** July 10, 2026

Code review of the Session 6 submission flow. Overall: clean implementation, correct security posture (insert-only intern writes, no service-role in client, withdraw scoped by owner RLS). Two findings, both fixed:

1. **Rejected logs could never be resubmitted** — `submitDraft` treated any existing server row as `alreadySubmitted`, flipping a revised local `ready` draft straight back to `rejected`; the unique `(internship_id, entry_date)` constraint blocked re-insert and the delete policy only covered `pending`.
   **Fix:** migration `003_allow_rejected_resubmission` (owner delete policy now covers `pending` + `rejected`; applied to live DB) + resubmit branch in `submissionService.submitDraft` (clear rejected row → fresh insert). Approved rows remain untouchable; `approved_snapshots` stays the immutable audit authority.
2. **Status sync could clobber an in-progress revision** — a sync while a rejected log was re-edited to `ready` overwrote it back to `rejected`.
   **Fix:** guard in `dailyLogService.markSubmitted` — a server `rejected` row never overwrites a local `ready`/`draft` revision newer than the rejection's `resolved_at`.
3. Bonus fix while reconstructing: `saveDraft` now spreads `...existing`, so autosaves no longer drop `submission_id`/`supervisor_comment`/`submitted_at` from synced drafts.

Verification: host-side file integrity confirmed, esbuild syntax pass on both services, migration applied via MCP. ⚠ Tooling note: the sandbox mount served a stale truncated view of dailyLogService.js during patching — file was reconstructed host-side; always verify tails via host tools after bash-side edits.

**Resubmission test path:** reject a submission (SQL editor: `update entry_submissions set status='rejected', supervisor_comment='test', resolved_at=now() where entry_date='...'`) → sync in History → open log, edit, Save as ready → submit again → server row should be fresh `pending`.

**Next (S7 — Phase 2 begins):** approval token service + email delivery (Resend), supervisor review page.

---

### Sessions 7–9 (combined): Supervisor Loop ✅ — PHASE 2 CORE COMPLETE
**Date:** July 10, 2026

#### New — Edge Function `supervisor-review` (deployed v1, ACTIVE, verify_jwt=false BY DESIGN)
- Supervisors have no accounts: token actions implement their own auth; `request_review` validates the intern JWT manually.
- `request_review` (intern JWT): revokes prior open tokens → issues 32-byte token (only SHA-256 stored) covering all pending submissions + evaluation form when cadence period due (computed from last evaluation period_end / start_date + cadence_days) → emails supervisor via Resend.
- `get_review` (token): submissions content + template labels + internship context + evaluation payload + custom KPIs.
- `decide` (token): approve → immutable `approved_snapshots` (content, entry SHA-256 hash, ip/user-agent audit, supervisor signature) + submission resolved; reject → comment stored, content purged (`data={}`), plan §4.2.
- `submit_evaluation` (token): immutable `evaluations` row with server-computed period summary (days logged, approved count, total hours).
- Token lifecycle: 7-day expiry, single active per internship, `used_at` when payload fully resolved; decisions restricted to payload-listed rows only.

#### New — Client
- `src/pages/review/SupervisorReview.jsx` — PUBLIC `/review?token=` page: entry cards rendered from template labels, ✓ Approve / ✗ Needs revision per entry (comment required on reject), 7-metric rubric (1–5) + custom KPIs + strengths/improvements when evaluation due, standalone SignaturePad (touch+mouse, dataURL), guarded submit, done/expired states.
- `src/services/api/reviewService.js` — intern-side `request_review` invoke.
- `router.jsx` — `/review` public route (deliberately outside <Auth>).
- `LogHistory.jsx` — "✉️ Email my supervisor a review link" button (shown when submitted logs exist).

#### ⚠ Required secrets before emails send
- `RESEND_API_KEY` — free account at resend.com (dev mode delivers only to your own address until a domain is verified).
- `AINTERN_APP_URL` — where /review links point (e.g. `http://localhost:4900` for testing; production Vercel URL later).
- Optional: `AINTERN_EMAIL_FROM` (default `AIntern <onboarding@resend.dev>`).

#### Verification
- esbuild pass on all 5 files; function deployed via MCP.
- ⚠ Second mount-corruption incident: LogHistory.jsx truncated during patching; recovered FULL file from `git show HEAD:` then patched on local disk and wrote back whole — this is now the mandatory procedure for editing files >100 lines from the sandbox.
- **E2E test path:** set secrets → set your own email as supervisor_email in Profile → submit 1–2 logs → History → "Email my supervisor" → open link from email → approve one/reject one with comment (+ rubric if cadence due) → sign → submit → intern History sync shows approved/rejected + comment → verify `approved_snapshots` row exists and is immutable (UPDATE should fail in SQL editor).

#### Deferred (Phase 2 polish, later)
- Cron-driven digest emails (per-entry/daily modes) — v1 is intern-triggered, matching the approved flow.
- Rate limiting on token validation attempts.

#### Next (Phase 3 — S10)
- Approvals/
---

### Post-S9 UX fixes (user testing feedback) ✅
**Date:** July 10, 2026

1. **Supervisor email now editable** — Profile → Review settings gains Supervisor name/email fields with an "Update supervisor" button (was onboarding-only; typo or supervisor change had no recovery path).
2. **Digest mode "Every submission" now honored** — Submit selected auto-sends the supervisor review email when `digest_mode === 'per-entry'`. Other modes keep the manual ✉️ button (daily digest automation still deferred).
3. Documented device-locality of drafts (IndexedDB per origin: localhost vs Vercel are separate devices by design); device-restore sync scheduled for S10.

Files: InternProfile.jsx (295 lines), LogHistory.jsx (319 lines) — patched via git-recover procedure, esbuild verified.

---

### Session 10: Logbook + PDF Export + Device Restore ✅ — Phase 3 begins
**Date:** July 10, 2026

#### New
- `src/services/api/logbookService.js` — owner-scoped reads of the authoritative record (approved_snapshots + evaluations).
- `src/pages/logbook/LogbookPage.jsx` — `/logbook`: stats, evaluations with average score, approved entries with supervisor comments, "Export logbook PDF". Server-side data — identical on every device.
- `src/services/pdf/logbookPdf.js` — client-side jsPDF/autotable logbook: dark cover with internship details, per-day entry blocks (template labels, supervisor comments, signature images), evaluation rubric tables with period summaries, page numbers. Lazy-loaded so it only ships when exporting.
- InternHome → Logbook card; router → `/logbook`.

#### Device restore (fixes the "data not sync" report)
- `dailyLogService.restoreRecord` + extended `submissionService.syncLocalStatuses`: server-known entries missing on a device are recreated locally (pending content from submissions, approved content from snapshots, rejected as revision stubs). Never overwrites local work. New device → login → History repopulates.

#### Incident (third mount corruption — now with detection)
- Working tree had silently truncated dailyLogService.js (111/179 lines) and DailyLogPage.jsx (194/206) — caught by `git status` + line-count audit BEFORE patching this time. Restored via `git checkout`, patched in /tmp, wrote back whole. Audit step (`git status --short` + HEAD-vs-WT line counts) is now part of the session-start checklist.

#### E2E test now possible (S10 unblocked it)
1. Vercel app → submit logs → email supervisor (own address) → open /review link → approve with signature (+ rubric if due).
2. History sync → approved status appears.
3. Home → Logbook → entries + evaluation visible → Export logbook PDF.
4. Different browser/device → login → History restores from server.

#### Next (S11)
- AI Template Studio: upload university logbook PDF **or image** → template/layout draft → review → pu
---

### Session 11: AI Template Studio ✅ — Phase 3 feature-complete
**Date:** July 10, 2026

"Logbook and forms generated by AI from image or PDF uploaded by user" — delivered.

#### Edge Function (ai-gateway v5, deployed)
- New `import_form` action: PNG/JPG/WebP with any provider; native PDF with Gemini/Claude keys (OpenAI is image-only → clear error suggests a photo instead). BYOK/bundled tier resolution + `template_import` metering reused.
- Vision calls per provider (gpt-4o-mini / claude-haiku / gemini-2.0-flash multimodal).
- **Server-side sanitizer** — AI output never reaches the form engine unvalidated: allowed field types only (unknown → text), slugged unique IDs, select/radio need options (else coerced to text), caps (8 sections × 15 fields), strict JSON parsing with fence stripping.

#### Client
- `src/services/api/templateStudioService.js` — file→base64, extract via gateway, saveAndApply (owner template row + `internships.daily_template_id`), revertToDefault, offline template caching.
- `src/pages/studio/TemplateStudioPage.jsx` — `/template-studio`: upload (camera-friendly), provider select, extract, **mandatory human review** of sections/fields, apply / revert. Entry point: Profile → "Logbook format" section.
- `dailyLogService.getDailyTemplate(internship)` — custom template wins when assigned; separate offline cache key per custom template. DailyLogPage + LogbookPage pass the internship → daily form AND PDF export labels follow the custom format automatically. Approved snapshots keep their original content regardless (immutability unaffected).

#### Verification
- Gateway deployed v5 ACTIVE; local file synced to deployed content; esbuild pass on all 7 files; session-start truncation audit clean.

#### E2E test additions (S11)
- Profile → Logbook format → Template Studio → upload a photo of any logbook form (Gemini provider, your BYOK key) → review extracted fields → apply → /log now renders the custom form → approve an entry → Logbook PDF uses the custom labels. Revert to default afterwards if desired.

#### Remaining before pilot (Phase 4)
- Polish list: cron digest emails, token rate limiting, draft backup opt-in, PWA install nudge on Vercel origin, monthly-cap tuning from ai_usage telemetry.
- Monetization: internship pass purchase + entitlement gating (S13 per plan).
                  
---

### Post-S11 fix: Review-link share fallback (user testing feedback) ✅
**Date:** July 10, 2026

- **Q from testing:** "Submit selected" vs "Email my supervisor" — Submit uploads selected ready logs to the server review queue; Email creates the secure one-time link covering everything pending and delivers it. Two steps so daily submissions don't spam the supervisor; digest mode "Every submission" merges them.
- **Fix:** RESEND_API_KEY missing no longer blocks the flow. `supervisor-review` v2 (deployed): when email is unconfigured (or `share_mode:'link'`), `request_review` still creates the secure token and returns `review_link`; LogHistory offers it via the phone's native share sheet (WhatsApp) or copies to clipboard. Implements plan §9.3 (WhatsApp fallback for MY deliverability). Same token security — email was delivery, never auth.
- Gmail SMTP rejected as test path: Edge runtime has no raw TCP; Gmail REST API needs a GCloud OAuth setup far heavier than Resend's 2-minute signup. Resend remains the production path.
                                          
---

### Fix: review links pointed to localhost (user testing) ✅
**Date:** July 10, 2026

- Cause: `AINTERN_APP_URL` secret never set → fallback `http://localhost:4900`.
- Fix (supervisor-review v3, deployed): link base URL now resolves **per request** — explicit `AINTERN_APP_URL` secret wins if set; otherwise the calling app's `Origin` header (self-configuring: Vercel requests produce Vercel links, localhost produces localhost); dev fallback last. No secret required anymore.
- Note for later (cron digests): scheduled sends have no Origin — set `AINTERN_APP_URL` before enabling cron in polish phase.
- Old localhost-links: superseded — requesting a new review link revokes prior tokens automatically.

---

## v1.1 UPGRADE TRACK (spec: docs/AIntern New Engine Specification (Version 1.1).md)

Assessment: the v1.1 spec formalizes v1.0's trust model (single source of truth, immutable snapshots, disposable exports, review≠evaluation). Increments: R1 report versioning+ready check → R2 presentation templates + HTML preview (revive parked WorkLedger render engine) → R3 DOCX + verification appendix + QR /verify page → R4 configurable multi-reviewer workflows (industry + educational supervisor) → R5 Portfolio Engine.

### R1: Report Versions + Ready Check ✅
**Date:** July 11, 2026

#### Database (migrations 004 + revoke_anon_report_snapshot, applied)
- `report_versions` — immutable (trigger), numbered per internship+type ('logbook','weekly','monthly','final'), owner SELECT only. Content freezes: intern/internship info, template (labels travel with snapshot), approved entries WITH their existing hashes+signatures (evidence layer), evaluations, stats; plus sha256 `content_hash`.
- `create_report_snapshot()` RPC — SECURITY DEFINER, the ONLY write path: verified status computed server-side (≥1 approved entry AND 0 pending in period ⇒ 'verified' + permanent Verification ID `AIN-XXXX-XXXX`); clients can never mint 'verified'. anon revoked (advisor 0028); authenticated execution intentional (internal auth.uid() ownership check) — advisor 0029 WARN accepted by design.

#### Client
- `src/services/api/reportVersionService.js` — listVersions/getVersion/createSnapshot (RPC) + deterministic **Ready Check** (§28): unsubmitted local drafts, rejected-unrevised, pending reviews (blocking), zero approved entries (blocking), weekday coverage gaps, evaluation cadence shortfall. (Named to leave parked WorkLedger reportService.js untouched.)
- `LogbookPage` v1.1 — Official versions card: Ready Check panel (blocking red / warning amber), "Create official version vN (will be Verified/Unverified)", version list with status chips + Verification IDs + per-version PDF regenerated FROM THE FROZEN SNAPSHOT (spec §21); working preview PDF relabeled "not official" (§10).

#### Deferred to R1.5
- AI-narrative half of Ready Check (gateway `ready_check` feature prompt — quality review of entry text). Deterministic missing-parts detection (the user's stated need) ships now.

#### Test path
- Logbook → Run Ready Check → expect warnings/blocki
---

### R2: Presentation Templates + HTML Live Preview ✅
**Date:** July 11, 2026

Spec §14-18 (Template Engine), §29 (Live Preview). Design decision: rather than reviving the parked WorkLedger RenderEngineCore (coupled to work-entry blocks; remains parked), implemented the spec's model directly as a lean layout chain — ZERO schema changes:

**Layout resolution:** `LAYOUT_DEFAULTS ← template.pdf_layout.report (institution rules; frozen into report snapshots with the template) ← internship.metadata.report_prefs (student preferences, §18)`. One resolved layout feeds BOTH renderers — HTML preview and PDF can never disagree.

#### New
- `src/services/render/reportLayout.js` — resolver + ACCENT_CHOICES; layout keys: title, accent (rgb/hex), show_cover/signatures/comments/evaluations, footer_text, density (normal/compact).
- `src/components/report/ReportPreview.jsx` — full-screen HTML preview (§29): cover, info table, per-day entries with section-grouped fields, comments, signature images, evaluation rubric tables; serves BOTH working report and frozen official versions from the same model.

#### Changed
- `logbookPdf.js` — layout-aware: accent drives cover/headers/table heads; title, toggles, footer, compact density.
- `LogbookPage` — 👁 Live preview (HTML) for the working report; 👁 per-version preview from FROZEN content; both PDF paths pass the resolved layout.
- `InternProfile` — new "Report style" section (§18): title override, 4 accent swatches, signature/comment/evaluation toggles → `metadata.report_prefs` (merged, autosaved). Official record never changes — presentation only.

#### Incident log (4th mount corruption)
- logbookPdf.js truncated by mount immediately after a Write-tool write — caught by the standard esbuild verify, rebuilt via /tmp→cat, re-verified. Procedure held.

#### Test path
- Profile → Report style → pick Navy + set custom title → Logbook → Live preview (HTML) shows navy cover + title → Export working PDF matches preview exactly → per-version 👁 shows frozen content with same styling → toggles (e.g. hide signatures) reflect in both preview and PDF.

#### Next (R3)
- DOCX export (docx npm, client-side) + Verification Appendix + public /verify/:id page with QR embedding the Verification ID.
