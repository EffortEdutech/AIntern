@AGENTS.md

## Claude Code Specific Instructions

Use Claude Code primarily for planning, architecture review, refactor strategy, risk analysis, code review, and documentation review.

Before broad edits:

1. Read AGENTS.md.
2. Read docs/AINTERN_PROJECT_PLAN.md.
3. Explain the plan before structural changes.
4. Do not edit the same files that Codex is currently editing.

## Security-Critical Areas (extra review required)

- `approval_tokens` issue/validate logic and the public supervisor review page.
- `approved_snapshots` / `evaluations` immutability (DB triggers + RLS).
- `ai_credentials` encryption and Edge Function key handling.
- Anything touching Supabase service-role usage.
