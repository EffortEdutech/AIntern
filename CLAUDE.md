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

<!-- AI-DEVELOPMENT-WORKSPACE-GRAPHIFY-OBSIDIAN -->

## AI Development Workspace: Graphify + Obsidian

This repository is part of the Effort Studio AI development workspace.

Central Obsidian vault:

~~~text
C:\Users\user\Documents\00 AI agent\AI-Knowledge
~~~

Use Graphify for code navigation:

~~~powershell
.\scripts\graphify.ps1 query "question" --graph "graphify-out\graph.json"
.\scripts\graphify.ps1 explain "symbol-or-file" --graph "graphify-out\graph.json"
.\scripts\graphify.ps1 path "A" "B" --graph "graphify-out\graph.json"
~~~

Use Obsidian only for architecture rationale, ADRs, roadmap context, research, meetings, and cross-project decisions. Project-specific implementation docs remain in this repository.

Before editing, read AGENTS.md, read CLAUDE.md if relevant, read docs/AINTERN_PROJECT_PLAN.md and docs/PROGRESS.md, query Graphify if graphify-out/graph.json exists, then inspect source files directly.

Current Graphify scope: src, database/migrations, and supabase/functions.
