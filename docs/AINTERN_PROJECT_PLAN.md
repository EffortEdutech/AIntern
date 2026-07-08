# AIntern — Project Plan

**Version:** 0.3 (APPROVED — July 9, 2026)
**Date:** July 8, 2026
**Repo:** https://github.com/EffortEdutech/AIntern
**Supabase:** https://wdhdjhvvngssnszqgiyk.supabase.co
**Parent platform:** WorkLedger (commit `e78a5a6a`) — engine reuse
**Status:** Approved by Eff — ready for Phase 0, Session 1

**Changelog v0.2 → v0.3:** Pivoted from multi-org B2B to intern-paid B2C. Mobile-first intern app; supervisor becomes a no-account email-link approver; local-first data with immutable snapshot on approval; one-time internship pass pricing. Org/university tenancy deferred to v2.

---

## 1. Executive Summary

AIntern is a **mobile-first, intern-owned** internship logbook app. The intern is the customer and primary user; the supervisor participates with zero setup via email links.

- **Intern** logs daily activities on their phone (offline-first PWA), polished by an AI writing assistant. Drafts live locally on the device.
- **Supervisor** receives email digests with a secure link — no account, no app install. One page to review entries, approve/reject with comments, complete periodic evaluations (7/14/30-day cadence, intern-configurable), and sign on screen.
- **On approval, an immutable snapshot** (entry content + photo hashes + signature + timestamp/IP) is stored in Supabase — audit-proof and survives a lost phone. Day-to-day drafts never leave the device.
- **PDF logbook export:** approved entries + evaluations render into a university-format logbook (client-side jsPDF), optionally matching the intern's own university form via AI PDF import.
- **Pricing:** one-time **internship pass** (3 or 6 months). AI via BYOK (intern's own key, free tier friendly) or a bundled-AI pass upgrade (default provider OpenAI; per-request cap ~5,000 tokens, monthly cap TBD after measuring real usage).

**Stack:** React/Vite PWA + Supabase (Auth, Postgres, Storage, Edge Functions) + Vercel — the WorkLedger engine (templates, DynamicForm, offline/Dexie, PDF render, signatures) reused; the org/project/contract hierarchy stripped.

---

## 2. Users and Access Model

| Actor | Access | Notes |
|---|---|---|
| **Intern** (customer) | Full account (Supabase Auth), mobile PWA | Owns all data; configures internship profile, supervisor email, evaluation cadence, digest mode |
| **Supervisor** | No account — signed, expiring magic links | Approval/evaluation pages only; every action audited (timestamp, IP, user-agent) |
| **Platform Admin** | Internal | Ops, support, bundled-AI caps |

Deferred to v2: university coordinator portals, company/HR dashboards, multi-org tenancy (WorkLedger's RLS machinery makes this a natural upsell later — approved snapshots are already server-side).

**RBAC simplification:** WorkLedger's 5-role hierarchy collapses. RLS becomes owner-based (intern sees only own rows); supervisor actions authorize via single-use link tokens validated in an Edge Function, never a logged-in session.

---

## 3. Domain Model

The WorkLedger org → project → contract chain is replaced by a flat, intern-owned model:

| Entity (new) | Purpose | Derived from |
|---|---|---|
| `internships` | The placement: company name, supervisor name/email, start/end, evaluation cadence (7/14/30d), digest mode, template refs, pass status | Slimmed `contracts` |
| `templates` | Daily log + evaluation form definitions (JSONB `fields_schema` — unchanged engine) | As-is |
| `approved_snapshots` | **Immutable** approved entry content + photo hashes + supervisor signature + audit metadata | New (core of the trust model) |
| `evaluations` | Periodic supervisor evaluations (rubric scores, comments, signature) — also snapshot-immutable | New |
| `approval_tokens` | Signed single-purpose links: entry batch or evaluation, expiry, used_at | New |
| `ai_credentials` / `ai_usage` | BYOK keys (Vault-encrypted) / bundled-tier metering | From v0.2 plan |
| Local only (Dexie) | Drafts, unsent entries, cached templates, photos pre-approval | WorkLedger offline engine |

Immutability enforced in Postgres (no UPDATE/DELETE policies on snapshots + trigger guard), not just app code.

---

## 4. Core Workflows

### 4.1 Daily Logging (intern, mobile)
1. Open PWA → today's Daily Log (DynamicForm renders JSON template): tasks, categories, hours (auto-calc), outcomes, blockers, photos.
2. AI polish per textarea (online only; graceful offline degradation).
3. Entry saved to IndexedDB. Nothing uploads yet.
4. Submission deadline reminders via local notifications; late flag uses creation timestamp.

### 4.2 Supervisor Approval (email link, no account)
1. Per the digest mode (per-entry / daily / batched at cadence), an Edge Function emails the supervisor a link.
2. The link's token authorizes exactly one review page: pending entries (content pushed from device at send time), approve/reject each with comments, batch approve, sign once.
3. On approve: `approved_snapshots` written (immutable), intern notified; local entry marked approved and pinned read-only.
4. On reject: comment returns to intern; entry reopens locally for revision and resubmission.
5. Tokens: short expiry (e.g., 7 days), single active token per batch, re-issuable by intern, all access logged.

**Design note:** entry content must be uploaded (transiently) for the supervisor page to display it — "data stays on the phone" holds *until submission for approval*, then approved content persists as the snapshot and rejected transient copies are purged.

### 4.3 Periodic Evaluation (supervisor, at 7/14/30-day cadence)
1. At cadence end, supervisor's email includes the evaluation form link: prefilled period summary (days logged, hours, task digest from snapshots), core rubric (communication, punctuality, problem-solving, quality, initiative), up to 3 custom KPIs (intern/company-defined), narrative comments (AI draft assist optional), signature.
2. Stored immutable in `evaluations`.

### 4.4 Logbook Export (intern)
1. Approvals page lists all approved/rejected with comments (from snapshots — the authoritative record).
2. Export to PDF: date-range render of approved entries + evaluations through a layout (WorkLedger `RenderEngineCore`), university-format aware.
3. Logbook/form formats are AI-generated: intern uploads their university's logbook as **PDF or image (photo/scan)** → AI Template Studio generates a matching template/layout (premium feature, human-review flow retained). Image input is a scope addition over WorkLedger's PDF-only studio — the extraction Edge Function must accept image MIME types (vision-capable model call).

### 4.5 Purchase (intern)
1. Free trial window (e.g., 7 days or N entries) → buy internship pass (3/6 months) to unlock approvals + export.
2. Payment: Stripe (works in MY); local channels (FPX/e-wallets via Stripe or toyyibPay) evaluated at Phase 4.
3. Bundled-AI upgrade optional; BYOK free path always available.

---

## 5. AI Layer (retained from v0.2, B2C-adjusted)

Single `ai-gateway` Edge Function; provider abstraction (OpenAI default, Anthropic/Gemini selectable).

- **BYOK:** intern's key, Vault/pgsodium-encrypted, decrypted only in the Edge Function.
- **Bundled:** platform OpenAI key; per-request cap ~5,000 tokens; monthly cap **TBD** — instrument `ai_usage` from day one and set the cap after observing real per-request consumption.
- Features on the gateway: writing assistant (intern), evaluation comment draft (supervisor page), template import (premium).

---

## 6. Reuse from WorkLedger

| Reused (engine) | Dropped/stripped | New |
|---|---|---|
| Template engine + DynamicForm + FieldRenderer (incl. photo, signature, calculated) | Org/project/contract hierarchy, org_members | `internships`, `approved_snapshots`, `evaluations`, `approval_tokens` schema + RLS |
| Offline core: Dexie schema patterns, sync-queue mechanics (repurposed: push-on-submit instead of full sync) | 5-role RBAC, role guards | Magic-link token issue/validate Edge Functions |
| PDF render engine + layouts | Subcontractors, approval queue UI, multi-template junction | Supervisor review page (public route, token-gated) |
| AI Template Studio (import PDF → template) | Maintenance contract categories, WhatsApp quick entry | Email service (Resend/SMTP via Edge Function) + digest scheduler (pg_cron) |
| Signature canvas, photo upload, PWA install flow | Client portal, org dashboards | Pass purchase + entitlement checks; onboarding (profile → supervisor → template → first log) |
| jsPDF, Workbox config, form validation | | AI gateway + BYOK settings UI |

Honest sizing: this is closer to **"engine reuse" (~50–60%)** than v0.2's fork-everything (~85%) — the pivot trades reuse for a much simpler product. Still far faster than greenfield.

---

## 7. Architecture Notes

- **Repo:** `EffortEdutech/AIntern` — fresh repo seeded from WorkLedger, then strip; keep engine dirs upstream-compatible for cherry-picks. New Supabase + Vercel projects.
- **Trust model:** device = draft authority; Supabase = approval/audit authority. Approved snapshots immutable at the DB layer.
- **Supervisor link security:** signed JWT-style tokens bound to (internship, batch/evaluation, expiry), single active token, server-side validation + audit log; page is read/approve only — no navigation into other data.
- **Email:** Resend free tier (3k/month) via Edge Function; digest mode reduces volume. pg_cron drives cadence emails and reminders.
- **Storage discipline:** photos upload only at submission; rejected-entry uploads purged; approved photos retained under snapshot. Keeps free-tier storage viable.
- **Zero-cost posture:** base stack free-tier; email free-tier; AI user-billed (BYOK) or metered (bundled); Stripe per-transaction only.

---

## 8. Phased Roadmap (~2–3h sessions)

### Phase 0 — Foundation (3 sessions)
- S1: Repo seed + strip, new Supabase project, new schema (internships, snapshots, evaluations, tokens, ai_credentials/usage) + owner-based RLS + immutability triggers, deploy skeleton.
- S2: AIntern branding, mobile-first shell (intern nav only), onboarding flow (profile → supervisor → cadence → template).
- S3: `ai-gateway` Edge Function (provider abstraction, BYOK encrypt/decrypt, usage metering).

### Phase 1 — Intern Logging Core (3 sessions)
- S4: Daily Log template seed + DynamicForm integration + Dexie local persistence; today view + history strip.
- S5: AI writing assistant UX (polish/accept/edit, offline degradation); deadline reminders + late flags.
- S6: Submission flow — batch selection, transient upload, e2e offline test.

### Phase 2 — Supervisor Loop (3 sessions)
- S7: Token service + email sending (Resend) + digest modes + pg_cron cadence scheduler.
- S8: Supervisor review page — entry list, approve/reject + comments, signature, snapshot write, purge-on-reject; intern notification + local status sync.
- S9: Evaluation form (rubric + custom KPIs + AI comment draft) at cadence; e2e: log week → digest → batch approve → evaluation.

### Phase 3 — Export & Premium (2–3 sessions)
- S10: Approvals page (approved/rejected + comments) + PDF logbook export from snapshots via render engine.
- S11: AI Template Studio import (university PDF → template/layout) as premium flow.
- S12 (buffer): polish, regression PDFs, empty/edge states.

### Phase 4 — Monetization & Pilot (2+ sessions)
- S13: Internship pass purchase (Stripe), entitlement gating (approvals/export locked to pass), bundled-AI upgrade.
- S14: Pilot with 3–5 real interns + one university logbook format; measure `ai_usage` → set bundled monthly cap; pricing validation.

---

## 9. Risks and Open Decisions

1. **Transient-upload honesty.** Marketing says "data stays on your phone," but approval requires content upload. Position accurately: *drafts stay on-device; only what you submit for approval is shared, and only approved records are retained.*
2. **Device loss before approval.** Drafts not yet approved are still at risk (IndexedDB eviction, lost phone). Mitigation: optional encrypted draft backup (opt-in) in v1.1; persistent-storage API request on install.
3. **Supervisor email deliverability/engagement.** Spam folders and unresponsive supervisors block the intern's product value. Mitigations: resend/reminder controls for the intern, link re-issue, WhatsApp share of the same link as fallback (Malaysian context), SPF/DKIM via Resend.
4. **Token security.** Single-use scope, expiry, audit; signature page must show exactly what is being signed (entry list hash displayed).
5. **B2C revenue ceiling.** Accepted for v1; org/university dashboards over the already-server-side snapshots are the natural v2 B2B upsell.
6. **Bundled-AI cap unset.** Per-request ~5k tokens; monthly cap decided from pilot telemetry (S14).
7. **Payment rails for Malaysian students.** Stripe cards may exclude some; evaluate FPX/e-wallet (toyyibPay/Billplz) in Phase 4.
8. **Engine drift vs WorkLedger.** Keep `components/templates/`, `services/render/`, offline core file-compatible; document cherry-pick discipline in AIntern's AGENTS.md.

---

## 10. Decision Filter Check

1. Faster reporting? ✅ Mobile logging + AI polish + zero-friction supervisor loop.
2. Works offline? ✅ Drafting fully offline; submission/AI need connectivity by nature.
3. Respects access control? ✅ Owner-based RLS + audited single-purpose tokens; snapshots immutable at DB level.
4. Avoids runtime schema changes? ✅ Forms remain JSONB template-driven; new tables are fork-time design, not runtime drift.
5. Zero cost? ✅ Free-tier base; AI and payments are user-funded.

---

## 11. Before Session 1 — ALL RESOLVED (July 9, 2026)

- [x] v0.3 approved, including §4.2 design note and §9.1 positioning.
- [x] Trial gate: 7-day free trial; pass pricing placeholders (3-month / 6-month, RM amounts finalized at Phase 4 pilot).
- [x] Reference format: no fixed reference — logbooks/forms are AI-generated from user-uploaded PDF **or image** (§4.4).
- [x] Repo: https://github.com/EffortEdutech/AIntern · Supabase: https://wdhdjhvvngssnszqgiyk.supabase.co
