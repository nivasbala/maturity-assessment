---
title: Build Plan — MVP Scope, Git Workflow, Task Breakdown & Roadmap
version: 1.8
last_updated: 2026-07-02
---

# Build Plan — MVP Scope, Git Workflow, Task Breakdown & Roadmap

> **When to load this file:** Task 1 (to understand the full sequence and git workflow), and at the start of every subsequent task to confirm the current task number, branch name, and scope boundaries. AI agents executing this build: Sections 1–3 are your operating instructions. Section 4 (Phase 2 Roadmap) is informational only — do not build anything listed there.

---

## 1. MVP SCOPE BOUNDARIES

### 1.1 In Scope — MVP (Build These)

- Three user roles: Prospect (unauthenticated), Internal User, Admin
- Five assessment pillars: P1 Full-Stack Observability, P2 AIOps & Intelligent Observability, P3 AI Application Observability (gated), P4 ML & Foundation Model Operations (gated, seeded inactive), P5 Security & DevSecOps
- 50-question bank per pillar; session question count is admin-configurable per pillar (default 12); bounds enforced by system_settings (question_count_min default 12, question_count_max default 25, both admin-adjustable)
- Admin CRUD: pillars (including question count), questions (with persona tagging, weighting, and context_tags), internal users, system settings (question count bounds)
- Three-agent architecture: Agent 1 (Research — dual input: web + prospect context), Agent 2 (Question Selection — dual input: research profile + prospect context), Agent 3 (Report Generation)
- Internal/admin users create Prospect records under an Account (email provided by internal user); creating a Prospect generates a unique short URL. Multiple Prospects under one Account are independent.
- Prospect context collection at registration: email pre-populated (read-only); optional infrastructure location, tech stack, current tools, key challenges — stored on **prospect** record, passed to Agent 1
- Research summary validation step: shown immediately after registration, before pillar selection; additional notes saved live to the prospect record and copied to the assessment at confirm-research time; confirm-research is called from PillarSelectPage (immediately after pillar selection) and returns questions from background Agent 2
- On-screen report display with PDF download (client-side)
- Internal user dashboard: per-account view, per-pillar status, aggregated view (2+ pillars)
- Internal users see raw prospect answers + full report per assessment
- Internal users can only see assessments and reports they created
- Local JWT authentication (bcrypt passwords)
- Docker Compose single-machine deployment
- Nginx reverse proxy

### 1.2 Explicitly Out of Scope — MVP (Do Not Build)

- Admin AI Chatbot for question management (no agent number assigned — see Phase 2)
- Email notifications of any kind
- CRM integration (Salesforce, HubSpot, Marketo)
- Benchmarking or peer comparison features
- OAuth2 / SSO authentication
- Multi-tenancy or white-labeling
- Mobile-native app
- Intelligent pillar suggestions based on previous answers
- Cloud deployment automation (AWS ECS/EKS, GCP, Azure)
- Any feature not explicitly described in the spec files

---

## 2. GIT WORKFLOW

All git operations follow this workflow exactly. No exceptions.

### 2.1 Setup (One-Time, Done Manually Before Coding Starts)

```bash
# Done by the human operator, not the agent
mkdir maturity-platform
cd maturity-platform
git init
git remote add origin https://github.com/<org>/<repo>.git
git checkout -b main
# Copy spec/ directory here
git add spec/
git commit -m "Initial commit: add spec files"
git push -u origin main
```

### 2.2 Per-Task Workflow (Agent Follows This for Every Task)

```bash
# 1. Ensure you are on main and it is up to date
git checkout main
git pull origin main

# 2. Create task branch from main
git checkout -b task/NN-task-name
# e.g. git checkout -b task/01-project-scaffolding

# 3. Do all work for this task on this branch
# Multiple commits are fine during development

# 4. Before opening a PR:
# - Run verification criteria from 01-mission-outcomes-verification.md
#   that apply to this task
# - Fix any failures on this branch before proceeding
# - Do not open a PR if verification fails

# 5. Open a PR on GitHub
gh pr create \
  --title "Task NN: <task name>" \
  --body "Completes task NN as defined in spec/07-build-plan.md. Verification criteria checked." \
  --base main

# 6. Squash merge the PR
gh pr merge --squash --auto

# 7. Return to main and pull the merged commit
git checkout main
git pull origin main

# 8. Begin next task branch from updated main
```

### 2.3 Branch Naming Convention

| Task | Branch Name |
|------|------------|
| Task 1 | `task/01-project-scaffolding` |
| Task 2 | `task/02-database-migrations` |
| Task 3 | `task/03-auth-system` |
| Task 4 | `task/04-seed-data` |
| Task 5 | `task/05-admin-api-ui` |
| Task 6 | `task/06-short-url-flow` |
| Task 7 | `task/07-prospect-landing-flow` |
| Task 8 | `task/08-scoring-engine` |
| Task 9 | `task/09-llm-agents` |
| Task 10 | `task/10-report-display-pdf` |
| Task 11 | `task/11-internal-dashboard` |
| Task 12 | `task/12-end-to-end-verification` |

### 2.4 Task Failure Rule

If a task fails its verification criteria:
- Fix the failure on the **same task branch**
- Do not open a new branch to fix a failed task
- Do not merge until verification passes
- If the failure reveals a spec gap, stop and flag it to the user before proceeding

### 2.5 Commit Message Format

During development on a task branch, use descriptive commit messages. The squash merge commit to main must use this format:

```
Task NN: <task name>
```

---

## 3. TASK BREAKDOWN (Execute in Order)

Tasks are sequential. Do not start a task until the previous task's PR is merged to main.

---

### Task 1: Project Scaffolding
**Branch:** `task/01-project-scaffolding`
**Spec files:** `00-index.md` + `03-tech-stack-constraints.md` + `07-build-plan.md`

- Create full directory structure as defined in `03-tech-stack-constraints.md` Section 3
- Initialize React app with Vite + TypeScript + Tailwind CSS
- Initialize FastAPI app with health check endpoint `GET /api/health → {status: "ok"}`
- Create `docker-compose.yml` with services: postgres, backend, frontend, nginx, ollama
- Create `nginx.conf`: serve React build at `/`, proxy `/api` to FastAPI port 8000
- Create `.env.example` with all variables from `03-tech-stack-constraints.md` Section 4
- Create placeholder `requirements.txt` and `package.json` with all required dependencies

**Verification:**
- [ ] `docker compose up` runs without errors
- [ ] `GET /api/health` returns 200 `{"status": "ok"}`
- [ ] React app loads at `http://localhost`

---

### Task 2: Database + Migrations
**Branch:** `task/02-database-migrations`
**Spec files:** `03-tech-stack-constraints.md` + `04-data-model.md`

- Implement all 11 SQLAlchemy ORM models matching schema in `04-data-model.md` Section 1
- New `prospects` table: all context fields, `prospect_role`, `p3_gate_answered_yes`, `p4_gate_answered_yes`, `prospect_additional_notes`, `research_started_at`, `research_cache`, `short_url_token` (VARCHAR(16)), `is_registered`, `suggested_pillars` (String[]) — no `updated_at` column
- `assessments` table: `prospect_id` FK is **nullable**; add `short_url_token`, `prospect_name`, `prospect_email`, `prospect_role` (denormalized), `prospect_additional_notes`, `research_confirmed_at`; no `score` column (score lives only on `reports.pillar_score`); `UNIQUE(account_id, pillar_id)` plus a partial unique index on `(account_id, prospect_id, pillar_id) WHERE prospect_id IS NOT NULL`
- `accounts` table: company fields only, plus `suggested_pillars UUID[] DEFAULT '{}'`
- `reports` table: add `research_data JSONB nullable`
- Configure async SQLAlchemy engine with asyncpg
- Create Alembic initial migration for all 11 tables
- Add startup logic to run Alembic migrations automatically on backend container start
- Add `db_init.py` script callable from Docker entrypoint

**Verification:**
- [ ] Alembic migration runs cleanly against PostgreSQL container
- [ ] All 11 tables created with correct columns, types, and constraints
- [ ] `prospects` table has UNIQUE(account_id, email)
- [ ] `assessments` table has UNIQUE(account_id, pillar_id) plus a partial unique index on (account_id, prospect_id, pillar_id) WHERE prospect_id IS NOT NULL
- [ ] Migrations run automatically on `docker compose up`

---

### Task 3: Auth System
**Branch:** `task/03-auth-system`
**Spec files:** `04-data-model.md` + `02-domain-model.md` + `03-tech-stack-constraints.md`

- Implement `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`
- JWT: access token 15min expiry, refresh token 7 days
- Implement FastAPI dependency `get_current_user` — validates JWT, returns user
- Implement FastAPI dependency `require_role(role: str)` — enforces role on routes
- Implement service-layer `assert_owns_account(user, account)` for data isolation
- Seed one admin user on first startup if no admin exists (credentials from `.env`)

**Verification:**
- [ ] Login with correct credentials returns access + refresh tokens
- [ ] Protected route without token returns 401
- [ ] Internal user role on admin route returns 403
- [ ] Admin seed user created on first startup

---

### Task 4: Seed Data
**Branch:** `task/04-seed-data`
**Spec files:** `04-data-model.md` + `02-domain-model.md` + `06-question-bank.md`

- Implement `seed/seed_data.py` inserting all 5 pillars from `02-domain-model.md` (P4 seeded with `is_active=FALSE`)
- Insert all questions from `06-question-bank.md` with correct weights, is_general flags, persona tags, and `context_tags` arrays
- Insert all answer options with correct maturity_level values
- Seed `system_settings` with two rows (see `04-data-model.md` Section 9): `question_count_min=12` and `question_count_max=25`
- Seed is idempotent: check pillar count and system_settings key count before running, skip if already seeded
- Seed runs automatically on backend container start after migrations

**Verification:**
- [ ] After startup: 5 pillars exist with correct is_gated flags and question_count = 12
- [ ] P3 has is_gated=TRUE and gate_question set
- [ ] P4 has is_gated=TRUE, gate_question set, and is_active=FALSE
- [ ] P1, P2, P5 have is_active=TRUE; P4 has is_active=FALSE
- [ ] Each pillar has at least 4 general questions (is_general=TRUE)
- [ ] question_personas rows exist for all persona-tagged questions
- [ ] Each question has exactly 4 answer_options with maturity_levels 1–4
- [ ] Questions with context_tags in `06-question-bank.md` have correct non-empty context_tags JSONB arrays seeded
- [ ] system_settings table has exactly 2 rows: question_count_min=12 and question_count_max=25

---

### Task 5: Admin API + UI
**Branch:** `task/05-admin-api-ui`
**Spec files:** `04-data-model.md` + `05-architecture-api.md` + `02-domain-model.md`

- Implement all admin endpoints from `05-architecture-api.md` Section 2.2 (including `GET/PUT /api/admin/settings`)
- Implement `settings_service.py` with `get_setting()`, `get_question_count_bounds()`, and `validate_question_count()` from `04-data-model.md` Section 9
- Wire `validate_question_count()` into the pillar create/update path
- Implement Admin Panel pages from `05-architecture-api.md` Section 3.5 (Users, Pillars, Questions, System Settings)
- Pillars form fetches current min/max from system_settings to display as input bounds and helper text
- Soft-delete throughout: is_active = FALSE, never hard delete

**Verification:**
- [ ] Admin can create and edit a pillar with question_count; value is validated against system_settings bounds
- [ ] Setting question_count below question_count_min returns 400 with descriptive error
- [ ] Setting question_count above question_count_max returns 400 with descriptive error
- [ ] Admin can update question_count_min (minimum 12 enforced; cannot be set above question_count_max)
- [ ] Admin can update question_count_max (no ceiling; must be >= question_count_min)
- [ ] Setting question_count_min below 12 returns 400 with descriptive error
- [ ] Setting question_count_max below question_count_min returns 400 with descriptive error
- [ ] Pillars form shows correct min/max helper text from current system_settings values
- [ ] Admin can create a question with 4 answer options, persona tags, weight, and context_tags
- [ ] Deactivating a pillar sets is_active=FALSE, pillar no longer returned by public endpoints
- [ ] Creating internal user succeeds; user can log in

---

### Task 6: Short URL Flow
**Branch:** `task/06-short-url-flow`
**Spec files:** `04-data-model.md` + `05-architecture-api.md`

- Implement internal user endpoints from `05-architecture-api.md` Section 2.3:
  - `POST /api/accounts` — creates account (company container only; no personal fields)
  - `POST /api/accounts/{id}/prospects` — creates prospect, generates short_url_token; returns full_url (does NOT trigger Agent 1 — that fires at registration, built in Task 9)
  - `GET /api/accounts/{id}/prospects` — list prospects with registration status
- Implement short URL token generation (Section 6 of `04-data-model.md`) — token stored on `prospects.short_url_token`
- Build Accounts List and Account Detail pages (Section 3.4 of `05-architecture-api.md`):
  - Account Detail shows prospect list; "Create Prospect" form (email + suggested pillars)
  - Copy URL action from prospect row

**Verification:**
- [ ] Creating account + prospect produces a unique 8-char token on the prospect
- [ ] Second prospect with same email under same account returns 409
- [ ] Account Detail shows list of prospects with registration status
- [ ] Creating a prospect does NOT trigger Agent 1 (verify research_cache stays NULL until registration)
- [ ] Internal user A cannot see accounts or prospects created by Internal User B

---

### Task 7: Prospect Landing Flow
**Branch:** `task/07-prospect-landing-flow`
**Spec files:** `02-domain-model.md` + `04-data-model.md` + `05-architecture-api.md` + `06-question-bank.md`

- Implement all `/api/public/assess/` endpoints from `05-architecture-api.md` Section 2.4:
  - `GET /assess/{token}`: resolve token → return company_name, prospect_email, is_registered, suggested_pillars, available_pillars, and (if already registered) saved context fields + existing assessments
  - `POST /register`: updates **existing** prospect (is_registered=true); does NOT accept email (pre-set); saves optional context fields to prospects table; 409 if already registered; triggers Agent 1 in background
  - `GET /research-summary`: return Agent 1 output from prospect.research_cache; `is_ready: false` if still running
  - `PUT /research-additional-notes`: saves additional notes to prospect.prospect_additional_notes as the prospect types on ResearchSummaryPage
  - `POST /select-pillar`: creates or reuses (resets to in_progress) the assessment for this prospect + pillar; starts Agent 2 in background; returns {assessment_id}
  - `POST /confirm-research`: called from PillarSelectPage immediately after pillar selection, before navigating to AssessmentPage; copies prospect_additional_notes + sets research_confirmed_at on **assessment**; waits for Agent 2; returns questions
- Session token: short-lived JWT (2hr) scoped to prospect_id, stored in sessionStorage
- Build all pages from `05-architecture-api.md` Section 3.3 in this order:
  - Landing Page: email pre-populated (read-only); registration form with optional context section; pre-fills from GET /assess/{token} if already registered
  - Researching Page: transient polling page shown immediately after registration
  - Research Summary Page: shown immediately after registration, before pillar selection; additional notes saved live via PUT /research-additional-notes
  - Pillar Selection Page: shown after research summary, with suggested pillars highlighted; calls POST /select-pillar then POST /confirm-research immediately, before navigating to AssessmentPage with questions already loaded
  - Assessment Page: renders the questions returned by confirm-research; no additional fetch on load
  - Submitting Page: transient loading page shown while the submit pipeline runs
  - Report Page
- Gate logic: P3/P4 hidden based on gate answers and is_active flag

**Verification:**
- [ ] `GET /assess/{token}` returns prospect_email; Landing Page pre-populates it as read-only
- [ ] Registration form collects optional infrastructure_location, tech_stack_description, current_tools, key_challenges_input
- [ ] Context fields saved to **prospects** table (not accounts)
- [ ] POST /register updates prospect (is_registered=true), triggers Agent 1 in background; returns 409 on second attempt
- [ ] Research Summary Page shown immediately after registration, before pillar selection
- [ ] Pillar Selection Page shown after research summary; suggested pillars highlighted
- [ ] POST /select-pillar creates or reuses assessment non-blocking; Agent 2 starts in background
- [ ] POST /confirm-research (called from PillarSelectPage, immediately after pillar selection) saves additional notes to **assessment**; returns questions
- [ ] P3 hidden from pillar menu when gate answered No
- [ ] P4 hidden when gate answered No OR when is_active=FALSE
- [ ] SRE persona for P1 returns correct question count
- [ ] Progress bar shows correct question count
- [ ] Submit disabled until all questions answered

---

### Task 8: Scoring Engine
**Branch:** `task/08-scoring-engine`
**Spec files:** `04-data-model.md` + `02-domain-model.md`

- Implement synchronous scoring function in `services/scoring_service.py`
- Implement exact formula from `04-data-model.md` Section 3
- Apply maturity level ranges from `04-data-model.md` Section 2
- Store score in `reports` table immediately on submit, before LLM agents run
- Wire scoring into the submit endpoint from Task 7

**Verification:**
- [ ] All Level 1 answers → pillar_score = 1.00
- [ ] All Level 4 answers → pillar_score = 4.00
- [ ] Mixed answers produce score between 1.00 and 4.00
- [ ] Score stored in reports table before agent execution begins

---

### Task 9: LLM Agents
**Branch:** `task/09-llm-agents`
**Spec files:** `05-architecture-api.md` + `04-data-model.md` + `02-domain-model.md` + `03-tech-stack-constraints.md`

- Implement `core/llm_factory.py` exactly as specified in `03-tech-stack-constraints.md` Section 2, including `json_mode` / `model_env_var` params and the three named per-agent wrapper functions
- Implement Agent 1: research agent (`05-architecture-api.md` Section 1.2)
  - Agent 1 fires at **prospect registration** (`POST /register`) — replace Task 6/7 stub; both web research and prospect-provided context are available in this single fire
  - Before running, hash the six research inputs and compare to the stored hash (stored inside `research_cache`); skip Agent 1 and reuse the cache if unchanged and within the 3-day TTL
  - technology_signals NOT in output — prospect context passed directly to Agent 2
  - Output stored in `prospects.research_cache` (not accounts); `prospects.research_started_at` set when Agent 1 begins
  - Output includes: industry, company_size, products_summary, target_customers, builds_ai_products, cloud_providers, key_challenges, business_outcomes, operational_scale, data_confidence, research_notes, news_insights, observability_outcome, sources
- Implement Agent 2: question selection agent (`05-architecture-api.md` Section 1.3):
  - Agent 2 runs in **background** at `POST /select-pillar` time (non-blocking)
  - Agent 2 inputs: (1) prospect.research_cache; (2) prospect context (infrastructure_location, tech_stack_description, current_tools, key_challenges_input, assessment.prospect_additional_notes)
  - Wire into `POST /confirm-research` (called from PillarSelectPage, immediately after pillar selection) to wait for Agent 2 completion and return questions
  - Implement fallback to rule-based selection if Agent 2 fails
  - Implement output validation (IDs match candidate pool, correct count)
- Implement Agent 3: report agent (`05-architecture-api.md` Section 1.4) — 300 second timeout
- Implement LangGraph StateGraph orchestrator (`05-architecture-api.md` Section 1.5)
  - Covers submit pipeline only (Agent 3 + scoring); Agent 2 runs independently
- Implement cache check logic from `04-data-model.md` Section 7 (against `prospects.research_cache`, including the input-hash skip)
- Wire orchestrator into submit endpoint: runs after score is stored; POST /submit is synchronous and blocks (up to the 300s Agent 3 timeout) until the report is ready before responding with {report_id}

**Verification:**
- [ ] Submit triggers orchestrator; report updated with executive_summary, strengths, gap_analysis, next_steps
- [ ] Agent 1 fires at prospect registration and result stored in `prospects.research_cache`
- [ ] Re-registration with unchanged inputs within the TTL window skips Agent 1 (input hash match)
- [ ] Agent 2 starts in background at /select-pillar time; POST /confirm-research (called immediately afterward, from PillarSelectPage) waits and returns questions
- [ ] Agent 2 with research cache: questions reflect company context
- [ ] Agent 2 with empty research cache: returns pillar.question_count valid questions based on persona
- [ ] Agent 2 failure triggers rule-based fallback with no user-facing error
- [ ] Second pillar assessment for same prospect uses cached research (no second Agent 1 call)
- [ ] Orchestrator research_node reads from prospect.research_cache; does not re-fire Agent 1 when cache is fresh
- [ ] Agent 3 respects its 300-second timeout
- [ ] Switching LLM_PROVIDER env var and restarting works without code changes
- [ ] RESEARCH_AGENT_MODEL / QUESTION_SELECTION_AGENT_MODEL / REPORT_AGENT_MODEL override the model per agent without a provider switch
- [ ] No vendor product names appear in generated report text

---

### Task 10: Report Display + PDF
**Branch:** `task/10-report-display-pdf`
**Spec files:** `05-architecture-api.md` + `02-domain-model.md`

- Implement SubmittingPage: loading state with 3 rotating descriptive messages shown for the duration of the synchronous `POST /submit` call (submit pipeline: Agent 3 + scoring + report generation; up to 300s timeout); on response, navigates directly to ReportPage with the returned report_id — replaces the previous loading-within-ReportPage design
- Implement Report Page as a four-tab layout (Report, Questions & Answers, Research Summary, Registration Context) per `05-architecture-api.md` Section 3.3 — "Report" tab active by default, footer actions always visible below the tabs
- "Report" tab: Executive Summary, Score chart (Recharts RadarChart), Strengths, Gap Analysis (impact/effort badges), Next Steps (grouped by priority) — each section conditionally rendered only when non-empty
- Banner shown above the tabs when executive_summary and strengths are both empty
- "Questions & Answers" tab: Question Text | Selected Answer | Maturity Level badge table
- "Research Summary" tab: research profile fields (industry, company_size, data_confidence — color-coded badge, products_summary, target_customers, operational_scale, cloud_providers, key_challenges, business_outcomes, news_insights, observability_outcome, sources); `builds_ai_products` excluded on this prospect-facing tab
- "Registration Context" tab: prospect-submitted context fields as individual cards, conditionally rendered
- Client-side PDF generation (react-to-pdf or jsPDF) — captures the "Report" tab only
- "Take Another Pillar" button returns to pillar selection with completed pillar disabled

**Verification:**
- [ ] Report Page renders all four tabs; "Report" active by default
- [ ] Score chart renders with correct pillar score
- [ ] Empty report sections (Strengths, Gap Analysis, Next Steps) are omitted rather than rendered blank
- [ ] Narrative-pending banner appears when executive_summary and strengths are both empty
- [ ] Research Summary tab is visible to the prospect and shows the color-coded data_confidence badge
- [ ] `builds_ai_products` does not appear on the prospect-facing Research Summary tab
- [ ] PDF download produces a non-empty, readable PDF of the "Report" tab content
- [ ] "Take Another Pillar" shows completed pillar as disabled on return
- [ ] SubmittingPage displays rotating loading messages for the duration of the synchronous submit call and navigates directly to ReportPage on response (test with slow model)

---

### Task 11: Internal User Dashboard
**Branch:** `task/11-internal-dashboard`
**Spec files:** `05-architecture-api.md` + `04-data-model.md` + `02-domain-model.md`

- Implement all internal user dashboard pages from `05-architecture-api.md` Section 3.4:
  - Account Detail: prospect list table; "Create Prospect" form (email + optional suggested pillars); copy URL action
  - Prospect Detail: pillar status grid (all active pillars) for a single prospect
  - Report Detail: same four tabs as the prospect-facing Report Page (Report, Questions & Answers, Research Summary, Registration Context), plus a header card (prospect name, role, email, completion date); "Report" tab shows "Report not yet generated." or an inline load-failure error as applicable; Research Summary tab additionally shows `builds_ai_products`
- Implement `GET /api/accounts/{id}/aggregate` endpoint (account-scoped — aggregates across all completed assessments for the account)
- Aggregate view: radar chart with all completed pillar scores; unlocks at 2+ completions for a prospect
- "Questions & Answers" tab: all question_count questions + selected answer + maturity level

**Verification:**
- [ ] Account Detail shows list of prospects with email and registration status
- [ ] "Create Prospect" form submits email, returns URL, shows copy action
- [ ] 409 shown if email already exists under account
- [ ] Prospect Detail shows pillar status grid for all active pillars
- [ ] Aggregate view visible only when 2+ assessments completed for a single prospect
- [ ] Report Detail renders the same four tabs as the prospect Report Page plus the header card
- [ ] "Questions & Answers" tab shows all pillar.question_count questions with correct selected answer text
- [ ] Report Detail's Research Summary tab shows `builds_ai_products`; prospect-facing tab does not
- [ ] Internal user A cannot see accounts or prospects created by Internal User B

---

### Task 12: End-to-End Verification
**Branch:** `task/12-end-to-end-verification`
**Spec files:** `01-mission-outcomes-verification.md` + ALL files

Run the complete user journey and verify every item in `01-mission-outcomes-verification.md`:

**Full journey to execute:**
1. Admin logs in → creates Internal User
2. Internal User logs in → creates Account for "Acme Corp"
3. Internal User generates P1 URL (suggested pillar)
4. Prospect clicks URL → enters details as SRE persona → reviews research summary → selects P1
5. Prospect answers question_count questions → submits → views SubmittingPage
6. Report displayed on screen → PDF downloaded
7. Prospect clicks "Take Another Pillar" → selects P5 → completes
8. Internal User opens Acme Corp account → views both pillar statuses
9. Internal User opens P1 report → views Report tab, Questions & Answers tab, and Research Summary tab (including builds_ai_products)
10. Internal User opens aggregate view (2 pillars complete)
11. Verify all 15 outcome criteria in Section 2 of `01-mission-outcomes-verification.md`
12. Verify all verification criteria in Section 3 of `01-mission-outcomes-verification.md`

**This task is complete only when all criteria are checked off.**

---

## 4. PHASE 2 ROADMAP (Informational Only — Do Not Build)

The following features are documented here to ensure MVP architecture does not preclude them. Do not build any of these items during MVP development.

> **Note on P4:** Pillar 4 (ML & Foundation Model Operations) is defined in `02-domain-model.md` and seeded in `06-question-bank.md` but activated via the admin panel, not code. It is NOT listed here as Phase 2 — it is in MVP scope and activates when an admin sets `is_active = TRUE` on the P4 pillar row.

| Feature | Description | Depends On |
|---------|-------------|------------|
| **Admin AI Chatbot for Question Management** | Admin panel chatbot (no agent number — assessment pipeline agents 1–3 are reserved). Takes natural language prompts, generates staged question objects for human review before committing to DB. Uses same LLM factory. | Same LangChain abstraction layer |
| **LLM-Adaptive Questions (session-level)** | Dynamically modifies questions based on previous answers *within* a session — distinct from the company-research-based Agent 2 selection already in MVP. | Admin Chatbot + question bank expansion |
| **Benchmarking** | Anonymized score comparisons across completed assessments in the partner network | Aggregated reporting layer |
| **CRM Integration** | Salesforce / HubSpot webhook on assessment completion | Webhook service |
| **Email Notifications** | Prospect receives report link via email; internal user notified on completion | Email service (SendGrid, SES) |
| **Cloud Deployment** | Terraform or CDK modules for AWS ECS/EKS | Container-native architecture (already built) |
| **Post-completion Pillar Suggestions** | Intelligent recommendations for which pillar to take next based on gaps identified in completed report | Report gap_analysis JSONB + LLM |
| **SSO / OAuth2** | Okta, Google, or Azure AD login for internal users | Auth abstraction layer |
