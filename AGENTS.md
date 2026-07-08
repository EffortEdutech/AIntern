# AGENTS.md

## Project Identity

Project name: AIntern

AIntern is a mobile-first, intern-owned internship logbook platform (B2C). Interns log daily activities offline on their phone; supervisors approve and evaluate via audited email links (no account); approved records are stored as immutable snapshots in Supabase; logbooks export to PDF in AI-generated institutional formats.

Seeded from WorkLedger (commit `e78a5a6a`). This repository is part of the Effort Studio AI development workspace.

Central Obsidian vault:

``text
C:\Users\user\Documents\00 AI agent\AI-Knowledge
``

## Key References

- `docs/AINTERN_PROJECT_PLAN.md` — approved plan v0.3 (product model, schema, roadmap)
- `docs/PROGRESS.md` — session-by-session progress log
- `database/migrations/` — schema applied to Supabase project `wdhdjhvvngssnszqgiyk`

## AI Assistant Operating Rules

Before making changes:

1. Read this AGENTS.md.
2. Read CLAUDE.md only if it adds relevant project-specific guidance.
3. Read docs/AINTERN_PROJECT_PLAN.md for product decisions.
4. Query graphify-out/graph.json if it exists.
5. Inspect source files directly before editing.
6. Preserve existing architecture, conventions, and security boundaries.
7. Prefer small, reviewable changes.
8. Do not introduce new production dependencies without approval.
9. Update docs when behavior, APIs, schemas, commands, or operating rules change.

## AIntern-Specific Invariants

- **Trust model:** device (Dexie/IndexedDB) is draft authority; Supabase is approval/audit authority. `approved_snapshots` and `evaluations` are immutable — enforced at the DB layer, never weaken.
- **Supervisor access is token-only:** single-purpose, expiring, audited links. Never create supervisor accounts or sessions.
- **Owner-based RLS:** interns see only their own rows. Token flows go through Edge Functions with service role.
- **Engine compatibility:** keep `src/components/templates/`, `src/services/render/`, and the offline core file-compatible with WorkLedger for cherry-picking fixes.
- **AI keys:** BYOK keys are Vault-encrypted, decrypted only inside Edge Functions, never logged, never sent to the client.
- **Dev server port: 4900** (strict) — do not change.

## Commands

- `npm run dev` (port 4900)
- `npm run build`
- `npm run lint`
- `npm run format`

Run only the checks relevant to the change.

## Done Criteria

A task is complete when:

- changes are implemented,
- relevant checks were run or blockers are explained,
- documentation is updated if needed,
- Graphify is refreshed after meaningful structural changes,
- the final response explains what changed and how it was verified.

## Obsidian Rules

Use Obsidian for architecture rationale, ADRs, cross-project standards, roadmap context, meeting notes, and research. Do not duplicate project implementation docs into Obsidian. Link to repository docs instead.
