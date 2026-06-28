---
title: Spec Directory Index
version: 1.1
last_updated: 2026-06-27
---

# Maturity Assessment Platform — Spec Directory Index

## How to Use This Spec Directory

This directory contains the complete specification for the Maturity Assessment Platform. It is written as an **executable specification** — every section is a constraint, not a suggestion. Ambiguity is resolved by the spec, not by inference. If something is not in the spec, do not build it. If something is in the spec, do not skip it.

**The spec is split into focused files deliberately.** Each file is scoped to what a specific build task needs. Loading the entire spec for every task wastes context and degrades agent output quality. Use the Agent Context Map below to load only the files relevant to the task you are executing.

**Read this file first on every session.** Then load only the files listed in the Agent Context Map for your current task.

---

## File Directory

| File | Purpose | Primary Reader |
|------|---------|----------------|
| `00-index.md` | This file. Directory, context map, bootstrap prompt | Agent (every session) |
| `01-mission-outcomes-verification.md` | Why this app exists, what done looks like, verification checklist | Agent (task start + task end) |
| `02-domain-model.md` | User roles, permissions, personas, pillar definitions | Agent (any task touching users, personas, or pillars) |
| `03-tech-stack-constraints.md` | Tech stack, hard constraints, LLM abstraction, directory structure, environment variables | Agent (scaffolding, any architectural decision) |
| `04-data-model.md` | Database schema, scoring formula, maturity level reference | Agent (any task touching data) |
| `05-architecture-api.md` | Multi-agent LLM architecture, API endpoints, UI specifications | Agent (any task building API routes or UI pages) |
| `06-question-bank.md` | All seed questions for all 4 pillars with answer options and persona tags | Agent (seed data task and prospect flow task only) |
| `07-build-plan.md` | MVP scope boundaries, git workflow, ordered task breakdown, Phase 2 roadmap | Agent (task sequencing and git operations) |

---

## Agent Context Map

Load **only** the files listed for your current task. Do not load files not listed.

| Task | Branch Name | Spec Files to Load |
|------|------------|-------------------|
| Task 1: Project Scaffolding | `task/01-project-scaffolding` | `00-index` + `03-tech-stack-constraints` + `07-build-plan` |
| Task 2: Database + Migrations | `task/02-database-migrations` | `03-tech-stack-constraints` + `04-data-model` |
| Task 3: Auth System | `task/03-auth-system` | `04-data-model` + `02-domain-model` + `03-tech-stack-constraints` |
| Task 4: Seed Data | `task/04-seed-data` | `04-data-model` + `06-question-bank` |
| Task 5: Admin API + UI | `task/05-admin-api-ui` | `04-data-model` + `05-architecture-api` + `02-domain-model` |
| Task 6: Short URL Flow | `task/06-short-url-flow` | `04-data-model` + `05-architecture-api` |
| Task 7: Prospect Landing Flow | `task/07-prospect-landing-flow` | `02-domain-model` + `04-data-model` + `05-architecture-api` + `06-question-bank` |
| Task 8: Scoring Engine | `task/08-scoring-engine` | `04-data-model` + `02-domain-model` |
| Task 9: LLM Agents | `task/09-llm-agents` | `05-architecture-api` + `04-data-model` + `02-domain-model` + `03-tech-stack-constraints` |
| Task 10: Report Display + PDF | `task/10-report-display-pdf` | `05-architecture-api` + `02-domain-model` |
| Task 11: Internal Dashboard | `task/11-internal-dashboard` | `05-architecture-api` + `04-data-model` + `02-domain-model` |
| Task 12: End-to-End Verification | `task/12-end-to-end-verification` | `01-mission-outcomes-verification` + ALL files |

---

## Spec File Rules

These rules apply to every agent session:

1. **Never modify spec files.** They are read-only reference material. If you believe a spec is wrong, stop and flag it to the user — do not self-correct silently.
2. **Spec wins over inference.** If the spec and your training disagree, follow the spec.
3. **Load spec files at the start of each task**, before writing any code.
4. **Verify against `01-mission-outcomes-verification.md`** before merging any task branch.
5. **Section 0 of `07-build-plan.md` defines the git workflow.** Follow it exactly for every task.

---

## Bootstrap Prompt (For CLAUDE.md Generation)

Use this prompt once, after the specs directory is in place but before any coding begins. Run it in the coding agent (Claude Code or equivalent) from the project root:

```
Read all files in the specs/ directory in this order:
  specs/00-index.md
  specs/01-mission-outcomes-verification.md
  specs/02-domain-model.md
  specs/03-tech-stack-constraints.md
  specs/04-data-model.md
  specs/05-architecture-api.md
  specs/06-question-bank.md
  specs/07-build-plan.md

After reading all files, generate a CLAUDE.md file in the project root.
CLAUDE.md is the operating manual for every coding session. It must cover
all of the following sections, pulling content directly from the spec files
referenced — do not paraphrase where the spec is explicit:

---

SECTION 1: SPEC USAGE RULES
Pull from: specs/00-index.md (Spec File Rules section)

Include all 5 rules verbatim:
- Never modify spec files
- Spec wins over inference
- Load spec files at the start of each task before writing any code
- Verify against 01-mission-outcomes-verification.md before merging
- Follow 07-build-plan.md Section 2 for git workflow

Also include the Agent Context Map table from specs/00-index.md so the
agent knows exactly which spec files to load for each task number.

---

SECTION 2: GIT WORKFLOW
Pull from: specs/07-build-plan.md (Section 2 in full)

Include:
- The one-time setup block (done manually by human, not the agent)
- The per-task workflow with exact shell commands
- The branch naming table (Task 1 → task/01-project-scaffolding etc.)
- Commit message format: "Task NN: <task name>"
- The task failure rule: fix on same branch, never open a new branch
- The gh CLI commands: gh pr create then gh pr merge --squash --auto

---

SECTION 3: VERIFICATION GATE
Pull from: specs/01-mission-outcomes-verification.md

Before opening a PR for any task:
- Run the verification criteria that apply to the completed task
- Do not open a PR if any criterion fails
- Fix failures on the same task branch before merging

---

SECTION 4: ENVIRONMENT SETUP
Pull from: specs/03-tech-stack-constraints.md (Section 4)

Include:
- How to start the stack: docker compose up
- Location of .env file (project root, copy from .env.example)
- Health check confirmation: GET /api/health must return 200 before coding
- Note: gh CLI must be configured and authenticated before Task 1 begins

---

SECTION 5: CODING CONVENTIONS
Pull from: specs/03-tech-stack-constraints.md (Section 5)

Include all rules exactly as written:
Python:
  - Black formatter enforced
  - Type hints required on all function signatures
  - Async throughout — all DB calls and external API calls must be async
  - No synchronous blocking calls in route handlers

TypeScript:
  - ESLint enforced
  - No `any` types — use proper interfaces from src/types/
  - Functional components only, no class components
  - All API calls go through src/api/ — no inline fetch or axios in components

General:
  - No secrets in code, ever — only via .env
  - No hard-coded pillar IDs, question IDs, or persona strings in business
    logic — always reference via DB query or enum
  - No HTML <form> tags in React — use controlled components with
    onClick/onChange handlers

---

SECTION 6: LLM SWITCHING RULE
Pull from: specs/03-tech-stack-constraints.md (Section 2)

Never change the LLM provider in code. Switch providers only by changing
the LLM_PROVIDER variable in .env and restarting. The llm_factory.py
abstraction handles all provider logic. No other file should reference
a specific LLM provider directly.

---

SECTION 7: SCOPE BOUNDARY
Pull from: specs/07-build-plan.md (Section 1.2)

Include the full "Explicitly Out of Scope" list. If a feature is not in
the MVP scope (Section 1.1 of 07-build-plan.md), do not build it.
When in doubt, check 07-build-plan.md before starting any new work.
Phase 2 items are documented in Section 4 of 07-build-plan.md —
they are informational only and must not be built during MVP.

---

Ask me any clarifying questions before generating the file.
```

---

## Versioning

Each spec file carries `version` and `last_updated` frontmatter. When a file is updated, increment its version and update the date. Other files are not affected. The Agent Context Map in this file does not need updating when individual spec files are updated unless new tasks or files are added.
