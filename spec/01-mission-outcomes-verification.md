---
title: Mission, Outcomes & Verification Contract
version: 1.1
last_updated: 2026-06-28
---

# Mission, Outcomes & Verification Contract

> **When to load this file:** At the start of Task 1 (to understand what you are building) and at Task 12 (to verify the build is complete). Also load it before merging any task branch to check which verification criteria apply to that task.

---

## 1. PRIMARY MISSION

Build a **Partner Maturity Assessment Platform** that enables Datadog's internal partner teams to send targeted maturity assessments to prospect companies. The platform collects structured responses from prospects across defined technology pillars, uses a multi-agent LLM system to generate a personalized maturity report, and gives internal users the qualified lead intelligence they need to run better sales conversations.

---

## 2. OUTCOME CRITERIA (Definition of Done)

The application is complete when ALL of the following are true:

- [ ] An internal user can create a prospect account, generate a short URL, and send it to a prospect
- [ ] A prospect can click the URL, enter their details, select a pillar, answer 12 questions (persona-filtered + research-informed where available), and immediately see their maturity report on screen
- [ ] A prospect can download their report as a PDF
- [ ] A prospect can optionally take additional pillar assessments after completing one
- [ ] The Pillar 3 (AI System Observability) gate question correctly routes prospects
- [ ] Agent 1 researches the prospect's company and caches the result at the account level
- [ ] Agent 2 generates a structured maturity report using assessment answers + company research
- [ ] The LLM provider is configurable via a single environment variable with no code changes required
- [ ] An internal user can only see assessments and reports they created
- [ ] An internal user can see raw prospect answers and the full report for each assessment
- [ ] An internal user dashboard shows per-pillar status for each account and an aggregate view when 2+ pillars are complete
- [ ] An admin can CRUD pillars, questions (with persona tagging and weighting), and internal users
- [ ] All pillar and question changes are data-only — no code deployments required
- [ ] The application runs on a single machine via Docker Compose
- [ ] The application architecture is container-native and cloud-portable (no machine-specific dependencies)

---

## 3. VERIFICATION CRITERIA

Each criterion must be explicitly tested before the spec is considered implemented. Run relevant criteria before merging each task branch — do not wait until Task 12.

### 3.1 Authentication & Authorization
- [ ] Unauthenticated request to `/api/admin/*` returns 401
- [ ] Internal user request to `/api/admin/*` returns 403
- [ ] Internal user can only retrieve their own accounts (not other internal users' accounts)
- [ ] Prospect public endpoints accessible without auth token

### 3.2 Question Selection
- [ ] For P1, SRE persona: 12 questions returned = 4 general + 8 SRE-specific
- [ ] For P1, CTO persona: 12 questions returned = 4 general + 8 CTO/VP Eng-specific
- [ ] For P1, CISO persona: 12 questions returned = 4 general + CISO/Security-specific questions
- [ ] Inactive questions (`is_active = FALSE`) never appear in assessment sessions
- [ ] When research cache is populated: questions with matching `context_tags` are ranked higher in selection order than questions without matching tags
- [ ] When research cache is absent or empty: question selection falls back to persona-only by `display_order` with no error

### 3.3 Gated Pillars (P3 & P4)
- [ ] P3 card visible on pillar menu when P3 gate answered "Yes"
- [ ] P3 card hidden on pillar menu when P3 gate answered "No"
- [ ] P4 card visible on pillar menu when P4 gate answered "Yes" AND P4 is_active=TRUE
- [ ] P4 card hidden on pillar menu when P4 gate answered "No"
- [ ] P4 card hidden on pillar menu when P4 is_active=FALSE (regardless of gate answer)
- [ ] Pillar menu still shows P1, P2, P5 when both gates answered "No"
- [ ] Both gate questions rendered on the landing page before pillar menu is shown

### 3.4 Scoring
- [ ] All Level 1 answers → score of 1.0
- [ ] All Level 4 answers → score of 4.0
- [ ] Mixed answers produce score between 1.0 and 4.0
- [ ] Score correctly applies question_weight and persona_weight in formula

### 3.5 Agent Behavior
- [ ] Agent 1 fires at `/register` time (not at `/select-pillar` time) — verify by checking research_cache is populated before select-pillar is called
- [ ] Agent 1 result stored in `accounts.research_cache` after first run
- [ ] Second pillar assessment for same account uses cached research (no second Agent 1 call)
- [ ] Cache older than 7 days triggers Agent 1 re-run
- [ ] If Agent 1 fails or cache is empty at submit time, report still generates with empty company profile
- [ ] LangGraph orchestrator research_node reads from cache; only re-runs Agent 1 if cache is NULL (does not re-run when cache is fresh)
- [ ] Changing `LLM_PROVIDER=anthropic` in `.env` and restarting works without code changes

### 3.6 Report Completeness
- [ ] Report contains: executive_summary, strengths (2–4), gap_analysis (3–6), next_steps (4–6)
- [ ] No vendor product names appear in generated report text
- [ ] Radar chart renders with correct pillar score
- [ ] PDF download produces a non-empty PDF file

### 3.7 Internal User Dashboard
- [ ] Account row shows correct count of sent / completed pillars
- [ ] Aggregate view visible only when 2+ pillars are completed for an account
- [ ] Raw answers tab shows all 12 questions with correct selected answer text
- [ ] "Generate URL" disabled for a pillar that already has an assessment (pending or complete)

### 3.8 Admin CRUD
- [ ] Creating a new pillar with `is_active=TRUE` makes it appear in the prospect pillar menu
- [ ] Setting a pillar to `is_active=FALSE` removes it from the prospect menu without deleting data
- [ ] Creating a question with `is_general=TRUE` and no persona tags causes it to appear for all personas
- [ ] Deactivating a question removes it from future sessions but does not affect completed assessments

### 3.9 Infrastructure
- [ ] `docker compose up` starts all services without manual steps
- [ ] Database migrations run automatically on backend container startup
- [ ] Seed data loads automatically if pillars table is empty
- [ ] Application accessible at `http://localhost` via Nginx
