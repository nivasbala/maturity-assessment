---
title: Tech Stack, Constraints & Decisions
version: 1.1
last_updated: 2026-06-28
---

# Tech Stack, Constraints & Decisions

> **When to load this file:** Task 1 (scaffolding), Task 2 (database setup), Task 3 (auth), Task 9 (LLM agents), and any task where an architectural decision needs to be made. Also load whenever the directory structure needs to be referenced.

All decisions in this file are final. Do not deviate. If you believe a decision is wrong, stop and flag it to the user — do not self-correct silently.

---

## 1. TECH STACK

### 1.1 Frontend

```
Framework:     React 18 + TypeScript 5
Build tool:    Vite 5
Styling:       Tailwind CSS 3.4
Charts:        Recharts 2.x (radar/spider chart for pillar scores)
PDF export:    react-to-pdf or jsPDF (client-side, no backend dependency)
HTTP client:   Axios
State:         React Context + useReducer (no Redux — scope does not require it)
Routing:       React Router v6
```

### 1.2 Backend

```
Framework:     FastAPI (Python 3.12+)
ORM:           SQLAlchemy 2.0 (async with asyncpg)
Migrations:    Alembic
Database:      PostgreSQL 16
Password hash: bcrypt (passlib)
Auth:          JWT (python-jose), access token 15min, refresh token 7 days
Validation:    Pydantic v2
```

### 1.3 AI / LLM Layer

```
Orchestration: LangChain 0.3+ + LangGraph 0.2+
Default LLM:   Ollama (local, llama3.2 model)
Abstraction:   LangChain BaseChatModel factory — single env var switches provider
Search tool:   DuckDuckGo Search (langchain-community) for Agent 1
```

### 1.4 Infrastructure

```
Containerization: Docker + Docker Compose
Reverse proxy:    Nginx (serves React build + proxies /api to FastAPI)
Environment:      .env file, no secrets in code or Docker images
```

---

## 2. LLM PROVIDER ABSTRACTION (Hard Constraint)

The LLM provider MUST be switchable via a single environment variable. No other code changes are permitted when switching providers. This is a non-negotiable architectural constraint.

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

## 3. DIRECTORY STRUCTURE

```
maturity-platform/
├── CLAUDE.md
├── docker-compose.yml
├── .env
├── .env.example
├── specs/                        ← read-only spec files, never modified by agent
│   ├── 00-index.md
│   ├── 01-mission-outcomes-verification.md
│   ├── 02-domain-model.md
│   ├── 03-tech-stack-constraints.md
│   ├── 04-data-model.md
│   ├── 05-architecture-api.md
│   ├── 06-question-bank.md
│   └── 07-build-plan.md
├── nginx/
│   └── nginx.conf
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── alembic/
│   │   ├── env.py
│   │   └── versions/
│   └── app/
│       ├── main.py
│       ├── core/
│       │   ├── config.py         # Settings via pydantic-settings
│       │   ├── security.py       # JWT + bcrypt
│       │   ├── database.py       # Async SQLAlchemy engine + session
│       │   └── llm_factory.py    # LLM provider abstraction (see Section 2)
│       ├── models/               # SQLAlchemy ORM models (one file per table)
│       ├── schemas/              # Pydantic request/response schemas
│       ├── routers/              # FastAPI routers (one per domain)
│       │   ├── auth.py
│       │   ├── admin.py
│       │   ├── accounts.py
│       │   ├── assessments.py
│       │   └── public.py
│       ├── services/             # Business logic layer (one per domain)
│       │   ├── auth_service.py
│       │   ├── account_service.py
│       │   ├── assessment_service.py
│       │   ├── question_service.py
│       │   └── scoring_service.py
│       ├── agents/               # LangGraph agents
│       │   ├── research_agent.py           # Agent 1: Company Research
│       │   ├── question_selection_agent.py # Agent 2: LLM Question Selection
│       │   ├── report_agent.py             # Agent 3: Report Generation
│       │   └── orchestrator.py             # LangGraph StateGraph (submit pipeline only)
│       └── seed/
│           └── seed_data.py      # Pillar + question seed data
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── api/                  # Axios API client (one file per domain)
        ├── components/           # Shared reusable UI components
        ├── pages/
        │   ├── prospect/         # Assessment flow pages
        │   │   ├── LandingPage.tsx
        │   │   ├── PillarSelectPage.tsx
        │   │   ├── AssessmentPage.tsx
        │   │   └── ReportPage.tsx
        │   ├── internal/         # Internal user dashboard
        │   │   ├── AccountsListPage.tsx
        │   │   ├── AccountDetailPage.tsx
        │   │   └── ReportDetailPage.tsx
        │   └── admin/            # Admin panel
        │       ├── UsersPage.tsx
        │       ├── PillarsPage.tsx
        │       └── QuestionsPage.tsx
        ├── contexts/             # React contexts (AuthContext, etc.)
        └── types/                # TypeScript interfaces matching backend schemas
```

---

## 4. ENVIRONMENT VARIABLES

```bash
# .env.example

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

# Admin seed user (created on first startup if no admin exists)
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

---

## 5. CODING CONVENTIONS (Hard Constraints)

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
