# AIntern

**Your internship logbook — daily logs, supervisor sign-off, PDF reports.**

AIntern is a mobile-first PWA for interns. Log your daily work (even offline), get it approved and signed by your supervisor through a simple email link — no account needed on their side — and export a university-ready PDF logbook at the end.

## How it works

1. **Log daily** — structured daily activity sheet on your phone; drafts stay on your device. An AI assistant polishes rough notes into formal language.
2. **Supervisor signs off** — your supervisor gets an email digest with a secure link to review, approve/reject with comments, and sign. Periodic evaluations at 7/14/30-day cadence.
3. **Records that count** — every approved entry is stored as an immutable, audited snapshot. Lost phone ≠ lost logbook.
4. **Export** — generate a PDF logbook matching your university's format (upload their form as PDF or photo; AI builds the template).

## Stack

React 18 + Vite (PWA, Workbox) · Tailwind · Supabase (Postgres, Auth, Storage, Edge Functions) · Dexie (IndexedDB) · jsPDF · Vercel

Seeded from the WorkLedger engine (`e78a5a6a`).

## Development

```bash
npm install
cp .env.example .env.local   # fill in Supabase anon key
npm run dev                  # http://localhost:4900
```

Database schema lives in `database/migrations/` and is applied to the Supabase project via MCP/SQL Editor.

## Docs

- [Project Plan v0.3 (approved)](docs/AINTERN_PROJECT_PLAN.md)
- [Progress log](docs/PROGRESS.md)

---

**PROPRIETARY** — © 2026 Effort Edutech
