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

## SECTION 2: GIT WORKFLOW

### One-Time Setup (Done Manually by Human — Not the Agent)

```bash
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

### Per-Task Workflow (Agent Follows This for Every Task)

```bash
# 1. Ensure you are on main and it is up to date
git checkout main
git pull origin main

# 2. Create task branch from main
git checkout -b task/NN-task-name

# 3. Do all work for this task on this branch (multiple commits are fine)

# 4. Before opening a PR:
#    - Run verification criteria from spec/01-mission-outcomes-verification.md
#      that apply to this task
#    - Fix any failures on this branch before proceeding
#    - Do not open a PR if verification fails

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

### Branch Naming Convention

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

### Commit Message Format

Squash merge commit to main must use:
```
Task NN: <task name>
```

### Task Failure Rule

If a task fails its verification criteria: fix on the **same task branch**. Never open a new branch to fix a failed task. Do not merge until verification passes. If the failure reveals a spec gap, stop and flag it to the user.

---

## SECTION 3: VERIFICATION GATE

Before opening a PR for any task, run the verification criteria from `spec/01-mission-outcomes-verification.md` that apply to that task. Do not open a PR if any criterion fails. Fix failures on the same task branch before merging.

Key verification areas:
- **Auth & Authorization:** 401 on unauthenticated admin requests, 403 on wrong role, data isolation between internal users
- **Question Selection:** 4 general + 8 persona-specific = 12 per session; inactive questions never shown
- **P3 Gate:** Hidden from pillar menu when gate answered No; visible when Yes
- **Scoring:** All Level 1 → 1.0, all Level 4 → 4.0, mixed produces value between 1.00–4.00
- **Agent Behavior:** Research cached at account level, 7-day TTL, graceful failure if Agent 1 fails
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
curl http://localhost/api/health
# Expected: {"status": "ok"}
```

### Environment Variables (`.env.example`)

```bash
# Database
POSTGRES_USER=maturity_user
POSTGRES_PASSWORD=changeme
POSTGRES_DB=maturity_platform
DATABASE_URL=postgresql+asyncpg://maturity_user:changeme@postgres:5432/maturity_platform

# Auth
JWT_SECRET_KEY=replace-with-secure-random-string-min-32-chars
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

# Admin seed user
ADMIN_EMAIL=admin@company.com
ADMIN_PASSWORD=changeme-on-first-login
ADMIN_NAME=System Admin

# LLM Provider: ollama | anthropic | openai
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_MODEL=llama3.2

# (Uncomment when switching providers)
# ANTHROPIC_API_KEY=sk-ant-...
# ANTHROPIC_MODEL=claude-sonnet-4-6
# OPENAI_API_KEY=sk-...
# OPENAI_MODEL=gpt-4o

# App
BASE_URL=http://localhost
CORS_ORIGINS=["http://localhost", "http://localhost:3000"]
```

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

Never change the LLM provider in code. Switch providers only by changing the `LLM_PROVIDER` variable in `.env` and restarting. The `llm_factory.py` abstraction handles all provider logic. No other file should reference a specific LLM provider directly.

```python
# backend/app/core/llm_factory.py
import os
from langchain_core.language_models import BaseChatModel

def get_llm() -> BaseChatModel:
    provider = os.getenv("LLM_PROVIDER", "ollama")

    if provider == "ollama":
        from langchain_ollama import ChatOllama
        return ChatOllama(
            model=os.getenv("OLLAMA_MODEL", "llama3.2"),
            base_url=os.getenv("OLLAMA_BASE_URL", "http://ollama:11434")
        )
    elif provider == "anthropic":
        from langchain_anthropic import ChatAnthropic
        return ChatAnthropic(
            model=os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6"),
            api_key=os.getenv("ANTHROPIC_API_KEY")
        )
    elif provider == "openai":
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=os.getenv("OPENAI_MODEL", "gpt-4o"),
            api_key=os.getenv("OPENAI_API_KEY")
        )
    else:
        raise ValueError(f"Unsupported LLM_PROVIDER: {provider}")
```

---

## SECTION 7: SCOPE BOUNDARY

### In Scope — MVP (Build These)

- Three user roles: Prospect (unauthenticated), Internal User, Admin
- Four assessment pillars: P1 Full-Stack Observability, P2 AIOps & Intelligent Observability, P3 AI System Observability (gated), P5 Security & DevSecOps
- 50-question bank per pillar; 12 shown per session (persona-filtered)
- Short URL generation and prospect landing flow
- Multi-agent report generation (Agent 1: Company Research, Agent 2: Report Generation)
- On-screen report display with PDF download (client-side)
- Internal user dashboard: per-account view, per-pillar status, aggregate view (2+ pillars)
- Internal users see raw prospect answers + full report per assessment
- Internal users can only see assessments and reports they created
- Admin CRUD: pillars, questions (with persona tagging and weighting), internal users
- Local JWT authentication (bcrypt passwords)
- Docker Compose single-machine deployment
- Nginx reverse proxy

### Explicitly Out of Scope — MVP (Do Not Build)

- Agent 3: Admin chatbot for question management
- LLM-adaptive question selection based on company research output
- Email notifications of any kind
- CRM integration (Salesforce, HubSpot, Marketo)
- Pillar 4: ML & Foundation Model Operations
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

Every task that adds backend Python code must include structured logging using the existing `logging_config.py` setup:

```python
import logging
logger = logging.getLogger(__name__)

Where to log:
- logger.info(...) — successful operations (record created, cache hit, agent completed)
- logger.warning(...) — recoverable conditions (cache miss, fallback triggered, optional field missing)
- logger.error(...) — caught exceptions and failure paths (DB error, LLM failure, invalid input at boundary)

Rules:
- Never log secrets, passwords, tokens, or PII (email, name, role)
- Log the operation and its key identifiers, not raw request bodies
- Every except block that swallows an exception must call logger.error(...) before continuing

Testing (apply to every task)

Every task must include tests before the PR is opened. Tests live in backend/tests/ or frontend/src/__tests__/ depending on what was built.

Rules:
- Write tests on the same task branch — do not open the PR without them
- Tests must pass before merging (run pytest locally to confirm)
- Prefer tests that run without a live database or network (mock/stub at the boundary)
- If a test requires a real DB or running service, mark it clearly with a comment and ensure it is skipped in unit test runs

What to test per task type:

┌───────────────────────────┬──────────────────────────────────────────────────────────────────────────────────┐
│         Task type         │                                  What to cover                                   │
├───────────────────────────┼──────────────────────────────────────────────────────────────────────────────────┤
│ Models / migrations       │ Column types, nullability, constraints, FK targets, relationships                │
├───────────────────────────┼──────────────────────────────────────────────────────────────────────────────────┤
│ Services / business logic │ Happy path, validation errors, edge cases (empty list, zero score, cache miss)   │
├───────────────────────────┼──────────────────────────────────────────────────────────────────────────────────┤
│ API routes                │ Status codes, response shape, auth enforcement (401/403), input validation (422) │
├───────────────────────────┼──────────────────────────────────────────────────────────────────────────────────┤
│ Agents                    │ Prompt construction, output parsing, fallback on failure                         │
├───────────────────────────┼──────────────────────────────────────────────────────────────────────────────────┤
│ Scoring                   │ All Level 1 → 1.0, all Level 4 → 4.0, mixed inputs, weight application           │
├───────────────────────────┼──────────────────────────────────────────────────────────────────────────────────┤
│ Frontend components       │ Not required for MVP — focus backend test coverage                               │
└───────────────────────────┴──────────────────────────────────────────────────────────────────────────────────┘