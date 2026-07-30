# CLAUDE.md — Maturity Assessment Platform Operating Manual

---

## SECTION 1: SPEC USAGE RULES

### Rules (apply every session)

1. **Never modify spec files.** They are read-only reference material. If you believe a spec is wrong, stop and flag it to the user — do not self-correct silently.
2. **Spec wins over inference.** If the spec and your training disagree, follow the spec.
3. **Load spec files at the start of each task**, before writing any code.
4. **Verify against `spec/01-mission-outcomes-verification.md`** before merging any task branch.
5. **Section 2 of `spec/07-build-plan.md` defines the git workflow.** Follow it exactly for every task.

### Agent Context Map

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

## SECTION 2: GIT WORKFLOW

### Per-Task Workflow (Agent Follows This for Every Task)

1. Ensure you are on `main` and it is up to date (`git pull origin main`)
2. Create task branch: `git checkout -b task/NN-task-name`
3. Do all work on this branch — multiple commits are fine
4. Run verification criteria before opening a PR — do not open if any fail
5. Open and squash-merge the PR:

```bash
gh pr create \
  --title "Task NN: <task name>" \
  --body "Completes task NN as defined in spec/07-build-plan.md. Verification criteria checked." \
  --base main

gh pr merge --squash --auto
```

6. Return to main and pull: `git checkout main && git pull origin main`

### Commit Message Format

Squash merge commit to main must use:
```
Task NN: <task name>
```

### Task Failure Rule

If a task fails its verification criteria: fix on the **same task branch**. Never open a new branch to fix a failed task. Do not merge until verification passes. If the failure reveals a spec gap, stop and flag it to the user.

---

## SECTION 3: VERIFICATION GATE

Before opening a PR for any task, run the applicable criteria from `spec/01-mission-outcomes-verification.md`. Do not open a PR if any criterion fails — fix on the same branch first.

Key areas to verify:
- **Auth & Authorization:** 401 on unauthenticated requests, 403 on wrong role, data isolation between internal users
- **Question Selection:** Agent 2 dual inputs — (1) research_cache profile; (2) prospect context (infrastructure_location, tech_stack_description, current_tools, key_challenges_input, prospect_additional_notes); returns pillar.question_count IDs; falls back to rule-based if LLM fails
- **Gated Pillars (P3 & P4):** P3 hidden when gate answered No; P4 hidden when gate answered No OR when is_active=FALSE
- **Research Summary:** prospect reviews Agent 1 output on ResearchSummaryPage, shown immediately after registration and before pillar selection; optional additional notes saved live via PUT /research-additional-notes; data_confidence badge shown; ResearchingPage polls GET /research-summary until is_ready=true
- **Agent Behavior:** Agent 1 fires at **prospect registration** (non-blocking, single fire with both web search + prospect-submitted context; input hash + 7-day TTL skip cached reruns); Agent 2 runs in **background** at `/select-pillar`; `/confirm-research` (called from PillarSelectPage) waits for Agent 2 and returns questions; LangGraph orchestrator at submit covers Agent 3 only (up to 300s, synchronous); all agents use the same LLM factory, with optional per-agent model overrides
- **Report Completeness:** executive_summary, 2–4 strengths, 3–6 gaps, 4–6 next steps; no vendor names; both report pages (prospect-facing and internal Report Detail) use the same four-tab layout — Report, Questions & Answers, Research Summary, Registration Context — with empty sections omitted rather than shown blank; the Research Summary tab is visible to the prospect and its data_confidence badge is color-coded (High=green/Medium=yellow/Low=grey); `builds_ai_products` is internal-only, shown on Report Detail's Research Summary tab but not the prospect-facing one
- **Infrastructure:** `docker compose up` runs without manual steps; migrations run automatically
- **UI Consistency (any task touching frontend):** back navigation on every prospect page except LandingPage, ResearchingPage, and SubmittingPage; form state persists when navigating back/forward; blue buttons and links throughout; no `text-black` in dark mode; prospect pages never link to admin/login routes; session expiry shows inline error only

---

## SECTION 4: ENVIRONMENT SETUP

### Starting the Stack

```bash
cp .env.example .env
# Edit .env to set secrets (JWT_SECRET_KEY, ADMIN_PASSWORD)
docker compose up
```

All services start together: postgres, backend, frontend, nginx, ollama.

### Health Check

Before writing any code each session, confirm the stack is up:
```bash
curl http://localhost:8080/api/health
# Expected: {"status": "ok"}
```

### Environment Variables

See `.env.example` in the repo root for the full file. Required variables:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | asyncpg connection string (postgres) |
| `JWT_SECRET_KEY` | Min 32-char random string — change before deploy |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` | Seed admin user |
| `LLM_PROVIDER` | `ollama` \| `anthropic` \| `openai` |
| `OLLAMA_BASE_URL` / `OLLAMA_MODEL` | Ollama config (default provider) |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | Used when `LLM_PROVIDER=anthropic` |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | Used when `LLM_PROVIDER=openai` |
| `RESEARCH_AGENT_MODEL` | Optional per-agent model name override for Agent 1 within the configured provider |
| `QUESTION_SELECTION_AGENT_MODEL` | Optional per-agent model name override for Agent 2 within the configured provider |
| `REPORT_AGENT_MODEL` | Optional per-agent model name override for Agent 3 within the configured provider |
| `BASE_URL` / `CORS_ORIGINS` | App URL and allowed origins |

Note: `gh` CLI must be configured and authenticated before Task 1 begins.

---

## SECTION 5: CODING CONVENTIONS

**Python (backend):**
- Black formatter — enforced
- Type hints required on all function signatures
- Async throughout — all database calls and external API calls must be async
- No synchronous blocking calls in route handlers

**TypeScript (frontend):**
- ESLint enforced
- No `any` types — use proper interfaces from `src/types/`
- Functional components only — no class components
- All API calls go through `src/api/` — no inline fetch or axios calls in components

**General:**
- No secrets in code, ever — only via `.env`
- No hard-coded pillar IDs, question IDs, or persona strings in business logic — always reference via DB query or enum
- No HTML `<form>` tags in React — use controlled components with `onClick`/`onChange` handlers

---

## SECTION 6: LLM SWITCHING RULE

Never change the LLM provider in code. Switch providers only by changing `LLM_PROVIDER` in `.env` and restarting. All provider logic lives in `backend/app/core/llm_factory.py` — no other file should reference a specific LLM provider directly. Three optional env vars (`RESEARCH_AGENT_MODEL`, `QUESTION_SELECTION_AGENT_MODEL`, `REPORT_AGENT_MODEL`) allow overriding the model name per agent without changing the provider. These are also set in `.env`, not in code.

---

## SECTION 7: SCOPE BOUNDARY

### In Scope — MVP (Build These)

- Three user roles: Prospect (unauthenticated), Internal User, Admin
- Five assessment pillars: P1 Full-Stack Observability, P2 AIOps & Intelligent Observability, P3 AI Application Observability (gated), P4 ML & Foundation Model Operations (gated, seeded inactive — activates via admin panel), P5 Security & DevSecOps
- 50-question bank per pillar; session question count admin-configurable per pillar (default 12); bounds controlled by system_settings (question_count_min default 12 hard floor, question_count_max default 25, both admin-editable via System Settings page)
- Internal/admin users create **Prospect** records under an **Account** (org container) by providing an email. Creating a Prospect generates a unique short URL scoped to that Prospect. Multiple Prospects can exist under one Account — each is independent.
- The landing/registration page pre-populates and locks the email from the Prospect record. Registration updates the Prospect record (does not create a new one).
- Prospect context collection at registration: optional infrastructure location, tech stack, current tools, and key challenges — stored on the **prospect** record, passed to Agent 1 as primary input
- Research summary validation step: shown **immediately after registration, before pillar selection**; additional notes saved live to the **prospect** record and copied to the **assessment** record at confirm-research time; `POST /confirm-research` (called from PillarSelectPage, immediately after pillar selection) waits for background Agent 2 and returns questions
- Agent 1 fires at **prospect registration** (non-blocking) — it needs prospect-provided context, which is not available until registration; a hash of the six research inputs (stored inside research_cache) plus a 7-day TTL skip re-running Agent 1 when nothing has changed
- On-screen report display with PDF download (client-side)
- Internal user dashboard: per-account view, per-pillar status, aggregate view (2+ pillars)
- Internal users see raw prospect answers + full report per assessment
- Internal users can only see assessments and reports they created
- Admin CRUD: pillars (including question count per pillar), questions (with persona tagging, weighting, and context_tags as hints for Agent 2), internal users, system settings (question count bounds: min/max)
- Local JWT authentication (bcrypt passwords)
- Docker Compose single-machine deployment
- Nginx reverse proxy

### Explicitly Out of Scope — MVP (Do Not Build)

- Admin AI Chatbot for question management (no agent number assigned — admins converse to update and refine questions; see Phase 2)
- Email notifications of any kind
- CRM integration (Salesforce, HubSpot, Marketo)
- Benchmarking or peer comparison features
- OAuth2 / SSO authentication
- Multi-tenancy or white-labeling
- Mobile-native app
- Intelligent pillar suggestions based on previous answers
- Cloud deployment automation (AWS ECS/EKS, GCP, Azure)
- Any feature not explicitly described in the spec files

If a feature is not in the MVP scope list above, do not build it. When in doubt, check `spec/07-build-plan.md` before starting any new work. Phase 2 items in Section 4 of that file are informational only.

---

## SECTION 8: LOGGING AND TESTING REQUIREMENTS

### Logging (apply to every task)

Every task that adds backend Python code must include structured logging using `logging_config.py`:

```python
import logging
logger = logging.getLogger(__name__)
```

- `logger.info(...)` — successful operations (record created, cache hit, agent completed)
- `logger.warning(...)` — recoverable conditions (cache miss, fallback triggered, optional field missing)
- `logger.error(...)` — caught exceptions and failure paths (DB error, LLM failure, invalid input at boundary)
- Never log secrets, passwords, tokens, or PII (email, name, role)
- Every `except` block that swallows an exception must call `logger.error(...)` before continuing

### Testing (apply to every task)

Every task must include tests before the PR is opened. Tests live in `backend/tests/` or `frontend/src/__tests__/`.

- Write tests on the same task branch — do not open the PR without them
- Tests must pass before merging (`pytest` locally to confirm)
- Prefer tests that run without a live database or network (mock/stub at the boundary)
- If a test requires a real DB or running service, mark it with a comment and skip it in unit test runs

| Task type | What to cover |
|-----------|--------------|
| Models / migrations | Column types, nullability, constraints, FK targets, relationships |
| Services / business logic | Happy path, validation errors, edge cases (empty list, zero score, cache miss) |
| API routes | Status codes, response shape, auth enforcement (401/403), input validation (422) |
| Agents | Prompt construction, output parsing, fallback on failure |
| Scoring | All Level 1 → 1.0, all Level 4 → 4.0, mixed inputs, weight application |
| Frontend components | Not required for MVP — focus backend test coverage |

---

## SECTION 9: EXCALIDRAW DIAGRAM FILES

When saving a diagram as a `.excalidraw` file for use on excalidraw.com, the MCP streaming tool's `label` shorthand **does not work** in native Excalidraw files. Always use the proper bound-text format.

### Rule: no `label` on shapes — use bound text elements

The `label` shorthand only works in the MCP `create_view` streaming tool. For `.excalidraw` files, text inside shapes requires two elements:

```json
{ "type": "rectangle", "id": "r1", ..., "boundElements": [{ "type": "text", "id": "r1_lbl" }] }
{ "type": "text", "id": "r1_lbl", "containerId": "r1",
  "textAlign": "center", "verticalAlign": "middle", "fontFamily": 1, "lineHeight": 1.25,
  "text": "Hello", "originalText": "Hello", "fontSize": 14,
  "x": <container_x>, "y": <container_y + (height - textHeight) / 2>,
  "width": <container_width>, "height": <fontSize × 1.25 × numLines> }
```

### Required fields on every element

All elements need: `angle`, `strokeColor`, `backgroundColor`, `fillStyle`, `strokeWidth`, `strokeStyle`, `roughness`, `opacity`, `groupIds`, `frameId`, `roundness`, `seed`, `version`, `versionNonce`, `isDeleted`, `boundElements`, `updated`, `link`, `locked`

Arrows also need: `startBinding: null`, `endBinding: null`, `startArrowhead: null`

### Wrap arrow bounding box

`width`/`height` must span all points, not be 0. Example: points `[[0,0],[0,45],[-800,45]]` → `width: 800, height: 45`

---

## SECTION 10: UI CONSISTENCY & IMPLEMENTATION RULES

Apply to every task that produces or modifies a frontend component (Tasks 5, 6, 7, 10, 11). Authoritative detail in `spec/05-architecture-api.md` Section 3.2. Verify against `spec/01-mission-outcomes-verification.md` Section 3.11 before opening any UI task PR.

### Navigation

**Landing Page is the entry point** — no back navigation. Every other prospect page has a back link to the immediately preceding page, including the transient ResearchingPage and SubmittingPage. Forward is always via explicit user action (button/card) or an automatic advance once a background call completes.

| Page | Back navigation |
|---|---|
| LandingPage | None (entry point) |
| ResearchingPage | "← Back" → LandingPage |
| ResearchSummaryPage | "← Back" → LandingPage |
| PillarSelectPage | "← Back" → ResearchSummaryPage |
| AssessmentPage | "← Back" → PillarSelectPage; prev/next within questions |
| SubmittingPage | "← Back" → AssessmentPage (does not cancel an in-flight submit request) |
| ReportPage | "← Back" → PillarSelectPage |

Seven prospect pages total. Internal user flow: AccountDetailPage ← AccountsListPage; Prospect Detail ← AccountDetailPage.

### Session-Persistent Form State

When a user navigates between pages using the back/forward navigation above, all previously entered values on each page must still be populated. This is the rule — form state must persist via `sessionStorage` for the duration of the browser session (not component-local state, which is lost on unmount).

Fields to persist: all LandingPage fields, `prospect_additional_notes`, and AssessmentPage question answers (keyed by `question_id`).

### Button and Link Color — Blue Throughout

| Element | Classes |
|---|---|
| Primary button | `bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-500 dark:hover:bg-blue-600` |
| Back / nav link | `text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300` |
| Ghost button | `border border-blue-600 text-blue-600 hover:bg-blue-50 dark:border-blue-400 dark:text-blue-400 dark:hover:bg-blue-950` |
| Disabled | `bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-600 dark:text-gray-400` |
| Destructive only | `bg-red-600 hover:bg-red-700 text-white dark:bg-red-500 dark:hover:bg-red-600` |

### Dark Mode — No Black Text

`text-black` and `dark:text-black` are forbidden. Every text element uses a paired light/dark class: `text-gray-900 dark:text-white` (primary), `text-gray-600 dark:text-gray-400` (secondary), `bg-white dark:bg-gray-900` (page), `bg-gray-50 dark:bg-gray-800` (card).

### Prospect Flow Isolation

Pages under `/assess/:token/*` must never link to `/login`, `/admin`, `/dashboard`, or any internal route. Prospect headers contain only assessment branding. Session expiry shows an inline error — never redirects to `/login`.
