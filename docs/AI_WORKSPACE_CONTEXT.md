# AI Workspace Context

This file is a project-local bridge to the Effort Studio central Obsidian vault.

It exists because some Codex or Claude sessions mount only the project folder. In those sessions, the central vault may be outside the sandbox even though it exists on the machine.

## Central Vault

~~~text
C:\Users\user\Documents\00 AI agent\AI-Knowledge
~~~

## How To Use This File

- Read this file only for architecture rationale, ADR, roadmap, cross-project context, and workspace operating rules.
- Do not use this file as a replacement for project docs or source files.
- If the central vault is accessible, prefer the live vault note listed below.
- If the central vault is not accessible, use this local bridge as the fallback context and mention that the live vault was outside the current sandbox.

## Live Vault Note

~~~text
C:\Users\user\Documents\00 AI agent\AI-Knowledge\Projects\AIntern\Overview.md
~~~

## Synced Project Overview

# AIntern Overview

## Purpose

AIntern is a mobile-first, intern-owned internship logbook platform. Interns keep daily logs offline, submit selected entries for supervisor approval, and export approved snapshots into institution-ready logbooks.

## Repository

~~~text
C:\Users\user\Documents\00 aWL_platform\AIntern
~~~

## Project Docs

Start with:

~~~text
docs\AINTERN_PROJECT_PLAN.md
docs\PROGRESS.md
~~~

Current roadmap status from project docs:

- Phase 0 complete.
- Phase 1 in progress: Session 4 complete; Sessions 5 and 6 pending.
- Phase 2 Supervisor Loop follows after Phase 1.

## AI Setup

Project-local assistant files:

~~~text
C:\Users\user\Documents\00 aWL_platform\AIntern\AGENTS.md
C:\Users\user\Documents\00 aWL_platform\AIntern\CLAUDE.md
~~~

Project-local Graphify wrapper:

~~~text
C:\Users\user\Documents\00 aWL_platform\AIntern\scripts\graphify.ps1
~~~

## Current Graphify Scope

Initial code graph folders:

- `src`
- `database\migrations`
- `supabase\functions`

Keep project implementation details in the repository docs. Use this Obsidian note for architecture rationale, ADRs, cross-project decisions, and roadmap context.

## Related Notes

- [[Architecture/AI Development Workspace]]
- [[Architecture/Graphify + Obsidian Workflow]]
- [[Architecture/Codex + Claude Code Workflow]]
- [[Projects/Workledger/Overview]]

