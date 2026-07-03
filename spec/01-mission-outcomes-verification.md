---
title: Mission, Outcomes & Verification Contract
version: 1.7
last_updated: 2026-07-02
---

# Mission, Outcomes & Verification Contract

> **When to load this file:** At the start of Task 1 (to understand what you are building) and at Task 12 (to verify the build is complete). Also load it before merging any task branch to check which verification criteria apply to that task.

---

## 1. PRIMARY MISSION

Build a **Partner Maturity Assessment Platform** that enables Datadog's internal partner teams to send targeted maturity assessments to prospect companies. The platform collects structured responses from prospects across defined technology pillars, uses a multi-agent LLM system to generate a personalized maturity report, and gives internal users the qualified lead intelligence they need to run better sales conversations.

---

## 2. OUTCOME CRITERIA (Definition of Done)

The application is complete when ALL of the following are true:

- [ ] An internal user can create a prospect account, create one or more prospects with emails, and share the generated URL with each prospect
- [ ] A prospect can click their unique URL, complete registration (email pre-populated and read-only, plus optional tech context), review the research summary, select a pillar, answer the configured number of questions, and immediately see their maturity report on screen
- [ ] Two prospects under the same account can each independently complete assessments without affecting each other's data
- [ ] A prospect can download their report as a PDF
- [ ] A prospect can optionally take additional pillar assessments after completing one
- [ ] The research summary validation step shows Agent 1 output and allows prospect to add notes before proceeding
- [ ] The Pillar 3 (AI Application Observability) gate question correctly routes prospects
- [ ] Agent 1 researches the prospect's company using both web research and prospect-provided context
- [ ] Agent 3 generates a structured maturity report using assessment answers + company research
- [ ] The LLM provider is configurable via a single environment variable with no code changes required
- [ ] An internal user can only see assessments and reports they created
- [ ] An internal user can see raw prospect answers and the full report for each assessment
- [ ] An internal user dashboard shows per-pillar status for each account and an aggregate view when 2+ pillars are complete
- [ ] An admin can CRUD pillars (including configuring question count per pillar), questions (with persona tagging and weighting), internal users, and system settings (question count bounds)
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
- [ ] For P1, SRE persona: pillar.question_count questions returned — all general questions included, remainder SRE-specific (default: 12 total = 4 general + 8 SRE-specific)
- [ ] For P1, CTO persona: pillar.question_count questions returned — all general questions included, remainder CTO/VP Eng-specific (default: 12 total = 4 general + 8 CTO-specific)
- [ ] For P1, CISO persona: pillar.question_count questions returned — all general questions included, remainder CISO/Security-specific
- [ ] Inactive questions (`is_active = FALSE`) never appear in assessment sessions
- [ ] Agent 2 (Question Selection) returns exactly pillar.question_count valid question IDs for the pillar + persona
- [ ] When research cache is available: Agent 2 question selection reflects company context (questions relevant to company's business context and prospect's tech signals prioritized)
- [ ] When research cache is absent: Agent 2 selects pillar.question_count questions appropriate for the prospect's persona
- [ ] If Agent 2 fails: rule-based fallback returns pillar.question_count questions with no user-facing error

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
- [ ] Agent 1 fires at **prospect registration** time (non-blocking) — verify by checking prospect.research_cache is populated after the prospect submits the landing page form
- [ ] Agent 1 receives both inputs (web research + prospect-provided context) at registration in a single fire; a hash of the six research inputs is stored so a re-registration with unchanged inputs within the TTL window skips Agent 1 and reuses the cache
- [ ] Agent 1 output does NOT include technology_signals — prospect tech context is passed separately to Agent 2
- [ ] Agent 1 output includes: industry, company_size, products_summary, target_customers, builds_ai_products, cloud_providers, key_challenges, business_outcomes, operational_scale, data_confidence, research_notes, news_insights, observability_outcome, sources
- [ ] Agent 1 result stored in `prospects.research_cache` after first run
- [ ] Second pillar assessment for same prospect uses cached research (no second Agent 1 call)
- [ ] Cache older than 7 days (and input hash changed) triggers Agent 1 re-run
- [ ] Agent 2 receives TWO inputs: (1) research_cache from prospect; (2) prospect context (infrastructure_location, tech_stack_description, current_tools, key_challenges_input, prospect_additional_notes from assessment)
- [ ] Agent 2 starts in the **background** immediately after `POST /select-pillar`; not synchronous
- [ ] Agent 2 output is validated: correct count, all IDs from the provided candidate pool
- [ ] Agent 2 failure triggers rule-based fallback — assessment proceeds without user-facing error
- [ ] LangGraph orchestrator (submit pipeline) covers Agent 3 only — does NOT call Agent 1 or Agent 2
- [ ] LangGraph research_node reads from prospect.research_cache; only re-runs Agent 1 if cache is NULL
- [ ] If Agent 1 fails or cache empty at submit time, Agent 3 still generates report with empty company profile
- [ ] Agent 3 respects its 300-second timeout; on timeout, report retains its score with no narrative rather than blocking indefinitely
- [ ] POST /select-pillar reuses (resets to in_progress) an existing pending/in_progress assessment for the same prospect + pillar rather than returning a 409
- [ ] Changing `LLM_PROVIDER=anthropic` in `.env` and restarting works without code changes for all three agents

### 3.6 Research Summary Validation
- [ ] GET /research-summary returns is_ready=false while Agent 1 is running (typical immediately after registration — Agent 1 fires at registration, not before)
- [ ] GET /research-summary returns is_ready=true with full profile once Agent 1 completes
- [ ] ResearchingPage polls GET /research-summary and auto-advances to ResearchSummaryPage once is_ready=true
- [ ] ResearchSummaryPage shown immediately after registration, before pillar selection
- [ ] ResearchSummaryPage displays: company overview, key_challenges, business_outcomes, cloud_providers, operational_scale, news_insights, observability_outcome, sources, research_notes, data_confidence badge
- [ ] data_confidence badge accurately reflects the quality of available public information
- [ ] Prospect can submit optional additional notes via the notes text area on ResearchSummaryPage; notes are saved via PUT /research-additional-notes as the prospect types, not only held in session state
- [ ] POST /confirm-research (called from PillarSelectPage, immediately after pillar selection and before navigating to AssessmentPage) saves prospect_additional_notes to **assessments** table (not accounts or prospects)
- [ ] POST /confirm-research sets research_confirmed_at on the **assessments** table
- [ ] POST /confirm-research waits for background Agent 2 to complete and returns questions
- [ ] Additional notes are passed to Agent 2 alongside the research profile (via assessment record)
- [ ] Prospect cannot proceed to questions without passing through the research summary page (UI routing enforced)

### 3.7 Report Completeness
- [ ] Report contains: executive_summary, strengths (2–4), gap_analysis (3–6), next_steps (4–6)
- [ ] No vendor product names appear in generated report text
- [ ] Radar chart renders with correct pillar score
- [ ] PDF download produces a non-empty PDF file

### 3.8 Internal User Dashboard
- [ ] Account Detail page lists all prospects under the account with email, registration status, and assessment count
- [ ] "Create Prospect" form accepts email; on submit creates prospect and displays the generated URL with copy button
- [ ] 409 error shown if the same email is used twice under the same account
- [ ] Clicking a prospect navigates to Prospect Detail showing all pillar statuses for that prospect
- [ ] Aggregate view visible only when 2+ pillar assessments are completed for a single prospect
- [ ] Raw answers tab shows all pillar.question_count questions with correct selected answer text
- [ ] Internal user can only see accounts (and their prospects) they created

### 3.9 Admin CRUD
- [ ] Creating a new pillar with `is_active=TRUE` makes it appear in the prospect pillar menu
- [ ] Setting a pillar to `is_active=FALSE` removes it from the prospect menu without deleting data
- [ ] Creating a question with `is_general=TRUE` and no persona tags causes it to appear for all personas
- [ ] Deactivating a question removes it from future sessions but does not affect completed assessments
- [ ] Admin can set `question_count` on a pillar to any value within current system_settings bounds
- [ ] Setting `question_count` outside system_settings bounds returns 400 with descriptive error
- [ ] A `question_count` change takes effect on the next `/select-pillar` call (pending assessments); in-progress and completed assessments are unaffected
- [ ] Admin can update `question_count_min` (hard floor: cannot go below 12)
- [ ] Admin can update `question_count_max` (no ceiling; must be >= question_count_min)
- [ ] system_settings changes are reflected immediately in the Pillars form helper text and pillar validation

### 3.10 Infrastructure
- [ ] `docker compose up` starts all services without manual steps
- [ ] Database migrations run automatically on backend container startup
- [ ] Seed data loads automatically if pillars table is empty
- [ ] Application accessible at `http://localhost` via Nginx

### 3.11 UI Consistency
- [ ] LandingPage shows no back navigation — it is the entry point URL sent to the prospect
- [ ] LandingPage email field is pre-populated from the prospect record and is read-only
- [ ] ResearchingPage shows a back link to LandingPage; SubmittingPage shows a back link to AssessmentPage (navigating back does not cancel an in-flight request)
- [ ] ResearchSummaryPage shows a back link to LandingPage
- [ ] PillarSelectPage shows a back link to ResearchSummaryPage
- [ ] AssessmentPage shows a back link to PillarSelectPage, plus prev/next question buttons within the session
- [ ] ReportPage shows a back link to PillarSelectPage
- [ ] Navigating back to any page within the prospect flow restores all previously entered form values on that page (LandingPage fields, ResearchSummaryPage additional notes, AssessmentPage question answers)
- [ ] AccountDetailPage shows a back link to AccountsListPage; Prospect Detail shows a back link to AccountDetailPage
- [ ] All primary action buttons use `bg-blue-600` (light) / `dark:bg-blue-500` (dark) — no other button colors except `bg-red-600` for destructive (delete/remove) actions in the Admin panel
- [ ] All navigation and back links use `text-blue-600` (light) / `dark:text-blue-400` (dark)
- [ ] Dark mode renders no black text — every text element uses a paired `text-*` / `dark:text-*` Tailwind class; `text-black` and `dark:text-black` do not appear in any component file
- [ ] No page under `/assess/:token/*` contains a link, button, or redirect to `/login`, `/admin`, `/dashboard`, or any internal user route
- [ ] The prospect header on all seven prospect pages contains only assessment branding — no authentication or internal navigation links
- [ ] Session expiry within the prospect flow shows an inline error message — does not redirect to `/login`
