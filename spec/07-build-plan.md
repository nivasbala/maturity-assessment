---
title: Build Plan — MVP Scope, Git Workflow, Task Breakdown & Roadmap
version: 1.4
last_updated: 2026-06-28
---

# Build Plan — MVP Scope, Git Workflow, Task Breakdown & Roadmap

> **When to load this file:** Task 1 (to understand the full sequence and git workflow), and at the start of every subsequent task to confirm the current task number, branch name, and scope boundaries. AI agents executing this build: Sections 1–3 are your operating instructions. Section 4 (Phase 2 Roadmap) is informational only — do not build anything listed there.

---

## 1. MVP SCOPE BOUNDARIES

### 1.1 In Scope — MVP (Build These)

- Three user roles: End Customer (Prospect), Internal User, Admin
- Five assessment pillars: P1 Full-Stack Observability, P2 AIOps & Intelligent Observability, P3 AI System Observability (gated), P4 ML & Foundation Model Operations (gated, seeded inactive), P5 Security & DevSecOps
- 50-question bank per pillar; session question count is admin-configurable per pillar (default 12); bounds enforced by system_settings (question_count_min default 12, question_count_max default 25, both admin-adjustable)
- Admin CRUD: pillars (including question count), questions (with persona tagging, weighting, and context_tags), internal users, system settings (question count bounds)
- Three-agent architecture: Agent 1 (Research), Agent 2 (Question Selection), Agent 3 (Report Generation)
- Agent 2 (Question Selection): LLM selects the 12 most diagnostic questions using company research + persona; falls back to rule-based if Agent 2 fails
- Short URL generation and prospect landing flow
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
# Copy specs/ directory here
git add specs/
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
  --body "Completes task NN as defined in specs/07-build-plan.md. Verification criteria checked." \
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

Examples:
```
Task 01: Project scaffolding
Task 07: Prospect landing flow
Task 12: End-to-end verification
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

- Implement all 10 SQLAlchemy ORM models matching schema in `04-data-model.md` Section 1
- Configure async SQLAlchemy engine with asyncpg
- Create Alembic initial migration for all 10 tables
- Add startup logic to run Alembic migrations automatically on backend container start
- Add `db_init.py` script callable from Docker entrypoint

**Verification:**
- [ ] Alembic migration runs cleanly against PostgreSQL container
- [ ] All 10 tables created with correct columns, types, and constraints
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
- Implement Admin Panel pages from `05-architecture-api.md` Section 3.4 (Users, Pillars, Questions, System Settings)
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

- Implement internal user accounts endpoints from `05-architecture-api.md` Section 2.3
- Implement short URL token generation (Section 6 of `04-data-model.md`)
- Implement assessment creation: enforces UNIQUE(account_id, pillar_id)
- Build Accounts List and Account Detail pages (Section 3.3 of `05-architecture-api.md`)
- "Generate URL" button copies `{BASE_URL}/assess/{token}` to clipboard

**Verification:**
- [ ] Creating account + generating P1 URL produces unique 8-char token
- [ ] Second P1 URL request for same account returns 409
- [ ] Account Detail shows correct pillar status grid for all active pillars (P1, P2, P3, P5 — P4 not shown while inactive)
- [ ] Internal user A cannot see accounts created by Internal User B

---

### Task 7: Prospect Landing Flow
**Branch:** `task/07-prospect-landing-flow`
**Spec files:** `02-domain-model.md` + `04-data-model.md` + `05-architecture-api.md` + `06-question-bank.md`

- Implement all `/api/public/assess/` endpoints from `05-architecture-api.md` Section 2.4
- Session token: short-lived JWT (2hr), stored in sessionStorage on client
- Agent 1 triggered in background (non-blocking) at `/register` time
- `/select-pillar` endpoint: synchronous — implement with rule-based fallback selection for now (Agent 2 is wired in Task 9); return 12 questions using fallback logic from `04-data-model.md` Section 8
- Show "Personalizing your questions…" loading state on pillar card while /select-pillar runs
- P3 gate logic: if p3_gate_answered_yes=false, remove P3 from available_pillars
- P4 gate logic: if p4_gate_answered_yes=false, remove P4 from available_pillars (P4 also hidden if is_active=FALSE)
- Build Landing Page, Pillar Selection Page, Assessment Page (Section 3.2 of `05-architecture-api.md`)

**Verification:**
- [ ] SRE persona for P1 returns exactly 12 questions (4 general + 8 SRE-specific)
- [ ] CTO persona for P1 returns exactly 12 questions (4 general + 8 CTO-specific)
- [ ] P3 hidden from pillar menu when gate answered No
- [ ] P4 hidden from pillar menu when gate answered No OR when is_active=FALSE
- [ ] Agent 1 fires at /register time (not at select-pillar time)
- [ ] Pillar card shows loading state while /select-pillar runs
- [ ] Progress bar shows correct count on assessment page
- [ ] Submit disabled until all 12 questions answered

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

- Implement `core/llm_factory.py` exactly as specified in `03-tech-stack-constraints.md` Section 2
- Implement Agent 1: research agent (`05-architecture-api.md` Section 1.2)
- Implement Agent 2: question selection agent (`05-architecture-api.md` Section 1.3):
  - File: `backend/app/agents/question_selection_agent.py`
  - Wire into `/select-pillar` endpoint (replacing the Task 7 stub)
  - Implement fallback to rule-based selection if Agent 2 fails
  - Implement output validation (12 IDs, all in candidate pool)
- Implement Agent 3: report agent (`05-architecture-api.md` Section 1.4)
- Implement LangGraph StateGraph orchestrator (`05-architecture-api.md` Section 1.5)
  - Orchestrator covers submit pipeline only (Agent 3 + scoring)
  - Agent 2 runs independently at /select-pillar time, not inside the orchestrator
- Implement cache check logic from `04-data-model.md` Section 7
- Verify Agent 1 is triggered at `/register` time
- Wire orchestrator into submit endpoint: runs after score is stored

**Verification:**
- [ ] Submit triggers orchestrator; report record updated with executive_summary, strengths, gap_analysis, next_steps
- [ ] Agent 1 fires at /register and result stored in accounts.research_cache
- [ ] Agent 2 runs at /select-pillar time and returns exactly 12 question IDs
- [ ] Agent 2 with research cache: questions reflect company context (e.g., Kubernetes company gets k8s-tagged questions)
- [ ] Agent 2 with empty research cache: returns 12 valid questions based on persona
- [ ] Agent 2 failure triggers rule-based fallback with no user-facing error
- [ ] Second pillar assessment for same account uses cache (no second Agent 1 call)
- [ ] Orchestrator research_node reads from cache only — does not re-fire Agent 1 when cache is fresh
- [ ] Switching LLM_PROVIDER env var and restarting works without code changes
- [ ] No vendor product names appear in generated report text

---

### Task 10: Report Display + PDF
**Branch:** `task/10-report-display-pdf`
**Spec files:** `05-architecture-api.md` + `02-domain-model.md`

- Implement Report Page with all 7 sections from `05-architecture-api.md` Section 3.2
- Loading state with 3 rotating descriptive messages during agent execution
- Recharts RadarChart showing pillar score
- Gap analysis table with impact/effort badges
- Next steps cards grouped by priority
- Client-side PDF generation (react-to-pdf or jsPDF)
- "Take Another Pillar" button returns to pillar selection with completed pillar disabled

**Verification:**
- [ ] Report displays all 7 sections in correct order
- [ ] Radar chart renders with correct pillar score
- [ ] PDF download produces a non-empty, readable PDF
- [ ] "Take Another Pillar" shows completed pillar as disabled on return
- [ ] Loading state displays during agent execution (test with slow model)

---

### Task 11: Internal User Dashboard
**Branch:** `task/11-internal-dashboard`
**Spec files:** `05-architecture-api.md` + `04-data-model.md` + `02-domain-model.md`

- Implement all internal user dashboard pages from `05-architecture-api.md` Section 3.3
- Implement `GET /api/accounts/{id}/aggregate` endpoint
- Aggregate view: radar chart with all completed pillar scores; unlocks at 2+ completions
- Raw answers tab: all 12 questions + selected answer + maturity level
- Report tab: same report UI as prospect-facing page, read-only

**Verification:**
- [ ] Aggregate view visible only when 2+ pillar assessments completed
- [ ] Raw answers tab shows all 12 questions with correct selected answer text
- [ ] Internal user A cannot see reports created by Internal User B
- [ ] "Generate URL" button disabled for pillars with existing assessment

---

### Task 12: End-to-End Verification
**Branch:** `task/12-end-to-end-verification`
**Spec files:** `01-mission-outcomes-verification.md` + ALL files

Run the complete user journey and verify every item in `01-mission-outcomes-verification.md`:

**Full journey to execute:**
1. Admin logs in → creates Internal User
2. Internal User logs in → creates Account for "Acme Corp"
3. Internal User generates P1 URL (suggested pillar)
4. Prospect clicks URL → enters details as SRE persona
5. Prospect selects P1 → answers 12 questions → submits
6. Report displayed on screen → PDF downloaded
7. Prospect clicks "Take Another Pillar" → selects P5 → completes
8. Internal User opens Acme Corp account → views both pillar statuses
9. Internal User opens P1 report → views report tab + raw answers tab
10. Internal User opens aggregate view (2 pillars complete)
11. Verify all 15 outcome criteria in Section 2 of `01-mission-outcomes-verification.md`
12. Verify all 30+ verification criteria in Section 3 of `01-mission-outcomes-verification.md`

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
