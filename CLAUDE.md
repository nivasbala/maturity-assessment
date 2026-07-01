# CLAUDE.md — Maturity Assessment Platform Operating Manual

---

## SECTION 1: SPEC USAGE RULES

### Rules (apply every session)

1. **Never modify spec files.** They are read-only reference material. If you believe a spec is wrong, stop and flag it to the user — do not self-correct silently.
2. **Spec wins over inference.** If the spec and your training disagree, follow the spec.
3. **Load spec files at the start of each task**, before writing any code.
4. **Verify against `specs/01-mission-outcomes-verification.md`** before merging any task branch.
5. **Section 2 of `specs/07-build-plan.md` defines the git workflow.** Follow it exactly for every task.

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
  --body "Completes task NN as defined in specs/07-build-plan.md. Verification criteria checked." \
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

Before opening a PR for any task, run the applicable criteria from `specs/01-mission-outcomes-verification.md`. Do not open a PR if any criterion fails — fix on the same branch first.

Key areas to verify:
- **Auth & Authorization:** 401 on unauthenticated requests, 403 on wrong role, data isolation between internal users
- **Question Selection:** Agent 2 receives TWO inputs: (1) research_cache profile; (2) prospect's raw tech context (infrastructure_location, tech_stack_description, current_tools, key_challenges_input, prospect_corrections); selects `pillar.question_count` questions using both; falls back to rule-based if Agent 2 fails
- **Gated Pillars (P3 & P4):** P3 hidden when gate answered No; P4 hidden when gate answered No OR when is_active=FALSE
- **Research Summary:** prospect reviews Agent 1 output before pillar selection; optional corrections saved; data_confidence badge shown; GET /research-summary polls until is_ready=true
- **Agent Behavior:** Agent 1 fires at `/register` (non-blocking, dual inputs: web + prospect context); Agent 2 runs synchronously at `/select-pillar`; LangGraph orchestrator at submit covers Agent 3 only; all agents use same LLM factory
- **Report Completeness:** executive_summary, 2–4 strengths, 3–6 gaps, 4–6 next steps; no vendor names
- **Infrastructure:** `docker compose up` runs without manual steps; migrations run automatically

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

Never change the LLM provider in code. Switch providers only by changing `LLM_PROVIDER` in `.env` and restarting. All provider logic lives in `backend/app/core/llm_factory.py` — no other file should reference a specific LLM provider directly.

---

## SECTION 7: SCOPE BOUNDARY

### In Scope — MVP (Build These)

- Three user roles: Prospect (unauthenticated), Internal User, Admin
- Five assessment pillars: P1 Full-Stack Observability, P2 AIOps & Intelligent Observability, P3 AI Application Observability (gated), P4 ML & Foundation Model Operations (gated, seeded inactive — activates via admin panel), P5 Security & DevSecOps
- 50-question bank per pillar; session question count admin-configurable per pillar (default 12); bounds controlled by system_settings (question_count_min default 12 hard floor, question_count_max default 25, both admin-editable via System Settings page)
- Prospect context collection at registration: optional infrastructure location, tech stack description, current tools, and key challenges — stored on account, passed to Agent 1 as primary input
- Research summary validation step between registration and pillar selection: prospect reviews Agent 1 output, optionally corrects it, then confirms before proceeding
- Three-agent architecture: Agent 1 (Research, dual-input: web + prospect context), Agent 2 (Question Selection, dual-input: research profile + prospect context), Agent 3 (Report Generation)
- Agent 2 uses prospect's raw tech descriptions as primary selection signal; falls back to rule-based if LLM fails
- Short URL generation and prospect landing flow
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

If a feature is not in the MVP scope list above, do not build it. When in doubt, check `specs/07-build-plan.md` before starting any new work. Phase 2 items in Section 4 of that file are informational only.

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
