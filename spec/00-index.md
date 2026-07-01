---
title: Spec Directory Index
version: 1.2
last_updated: 2026-06-28
---

# Maturity Assessment Platform — Spec Directory Index

## How to Use This Spec Directory

This directory contains the complete specification for the Maturity Assessment Platform. It is written as an **executable specification** — every section is a constraint, not a suggestion. Ambiguity is resolved by the spec, not by inference. If something is not in the spec, do not build it. If something is in the spec, do not skip it.

**The spec is split into focused files deliberately.** Each file is scoped to what a specific build task needs. Loading the entire spec for every task wastes context and degrades agent output quality. Use the Agent Context Map below to load only the files relevant to the task you are executing.

**Read this file first on every session.** Then load only the files listed in the Agent Context Map for your current task.

---

## File Directory

| File | Purpose |
|------|---------|
| `00-index.md` | This file. Directory, context map, bootstrap prompt |
| `01-mission-outcomes-verification.md` | Why this app exists, what done looks like, verification checklist |
| `02-domain-model.md` | User roles, permissions, personas, pillar definitions |
| `03-tech-stack-constraints.md` | Tech stack, hard constraints, LLM abstraction, directory structure, environment variables |
| `04-data-model.md` | Database schema, scoring formula, maturity level reference |
| `05-architecture-api.md` | Multi-agent LLM architecture, API endpoints, UI specifications |
| `06-question-bank.md` | All seed questions for all pillars with answer options and persona tags. P4 questions seeded but pillar inactive until enabled via admin. |
| `07-build-plan.md` | MVP scope boundaries, git workflow, ordered task breakdown, Phase 2 roadmap |

---

## Agent Context Map

Load **only** the files listed for your current task. Do not load files not listed.

| Task | Branch Name | Spec Files to Load |
|------|------------|-------------------|
| Task 1: Project Scaffolding | `task/01-project-scaffolding` | `00-index` + `03-tech-stack-constraints` + `07-build-plan` |
| Task 2: Database + Migrations | `task/02-database-migrations` | `03-tech-stack-constraints` + `04-data-model` |
| Task 3: Auth System | `task/03-auth-system` | `04-data-model` + `02-domain-model` + `03-tech-stack-constraints` |
| Task 4: Seed Data | `task/04-seed-data` | `04-data-model` + `02-domain-model` + `06-question-bank` |
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
5. **Section 2 of `07-build-plan.md` defines the git workflow.** Follow it exactly for every task.

---

## Bootstrap Prompt (For CLAUDE.md Regeneration)

CLAUDE.md was generated from this spec directory and is maintained independently in the project root. Re-run the following only if CLAUDE.md is lost or needs to be fully regenerated from scratch:

```
Read all files in spec/ (00-index through 07-build-plan), then generate CLAUDE.md
covering: Spec Usage Rules, Git Workflow, Verification Gate, Environment Setup,
Coding Conventions, LLM Switching Rule, Scope Boundary, Logging and Testing,
Excalidraw Diagram Files, and UI Consistency Rules. Pull each section directly
from the corresponding spec file. Do not paraphrase where the spec is explicit.
```

---

## Versioning

Each spec file carries `version` and `last_updated` frontmatter. When a file is updated, increment its version and update the date. Other files are not affected. The Agent Context Map in this file does not need updating when individual spec files are updated unless new tasks or files are added.
