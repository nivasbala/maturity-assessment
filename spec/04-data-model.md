---
title: Data Model
version: 1.0
last_updated: 2026-06-27
---

# Data Model

> **When to load this file:** Any task that touches the database — migrations, API routes, services, scoring, seeding, or reporting. This is the most cross-referenced file in the spec. When in doubt, load it.

Ten tables. No additional tables for MVP. All foreign keys enforce referential integrity. Soft deletes (`is_active = FALSE`) are used throughout — never hard delete data.

---

## 1. SCHEMA DEFINITIONS

```sql
-- Users: Admin and Internal Users only.
-- Prospects are not system users — they are stored on assessments only.
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(255) NOT NULL,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'internal_user')),
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Accounts: One per prospect company. Created by an internal user.
-- research_cache stores Agent 1 output and is reused across all pillar
-- assessments for the same company. Cache TTL: 7 days.
CREATE TABLE accounts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name        VARCHAR(255) NOT NULL,
    company_website     VARCHAR(500),
    internal_user_id    UUID NOT NULL REFERENCES users(id),
    suggested_pillars   UUID[] DEFAULT '{}',        -- pillar IDs the internal user recommends
    research_cache      JSONB,                       -- Agent 1 output cached here
    research_cached_at  TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pillars: Fully data-driven.
-- Adding a new pillar = inserting a new row only. No code changes required.
CREATE TABLE pillars (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name           VARCHAR(255) NOT NULL,
    description    TEXT NOT NULL,
    overall_weight DECIMAL(3,2) NOT NULL DEFAULT 1.0,   -- used in aggregate scoring
    display_order  INTEGER NOT NULL,
    is_active      BOOLEAN NOT NULL DEFAULT TRUE,
    is_gated       BOOLEAN NOT NULL DEFAULT FALSE,       -- TRUE for P3
    gate_question  TEXT,                                  -- shown if is_gated = TRUE
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Questions: Belong to a pillar.
-- is_general = TRUE means shown to all personas regardless of question_personas entries.
-- Target: 50 questions per pillar in the bank; 12 selected per session.
CREATE TABLE questions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pillar_id       UUID NOT NULL REFERENCES pillars(id),
    text            TEXT NOT NULL,
    question_weight DECIMAL(3,2) NOT NULL DEFAULT 1.0,   -- 1.0 | 1.5 | 2.0
    is_general      BOOLEAN NOT NULL DEFAULT FALSE,
    display_order   INTEGER NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Question-Persona junction: which personas see which questions, and at what weight.
-- A question with no rows here and is_general=FALSE will never be shown.
CREATE TABLE question_personas (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id    UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    persona        VARCHAR(100) NOT NULL CHECK (persona IN (
                       'cto_executive',
                       'vp_engineering',
                       'ciso_vp_security',
                       'sre_platform_engineer',
                       'devops_engineer',
                       'ml_ai_engineer',
                       'security_engineer',
                       'software_developer'
                   )),
    persona_weight DECIMAL(3,2) NOT NULL DEFAULT 1.0,
    UNIQUE(question_id, persona)
);

-- Answer options: Exactly 4 per question, each mapped to a maturity level 1–4.
CREATE TABLE answer_options (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id    UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    text           TEXT NOT NULL,
    maturity_level INTEGER NOT NULL CHECK (maturity_level BETWEEN 1 AND 4),
    display_order  INTEGER NOT NULL    -- always 1→4 in UI (do not shuffle)
);

-- Assessments: One per prospect per pillar per account.
-- UNIQUE(account_id, pillar_id) enforces one assessment per pillar per company.
CREATE TABLE assessments (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id       UUID NOT NULL REFERENCES accounts(id),
    pillar_id        UUID NOT NULL REFERENCES pillars(id),
    short_url_token  VARCHAR(12) NOT NULL UNIQUE,    -- 8-char URL-safe random string
    prospect_name    VARCHAR(255),
    prospect_email   VARCHAR(255),
    prospect_role    VARCHAR(100),                    -- maps to persona enum values
    status           VARCHAR(50) NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'in_progress', 'completed')),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at     TIMESTAMPTZ,
    UNIQUE(account_id, pillar_id)
);

-- Assessment Answers: One row per question answered in a session.
CREATE TABLE assessment_answers (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id    UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    question_id      UUID NOT NULL REFERENCES questions(id),
    answer_option_id UUID NOT NULL REFERENCES answer_options(id),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(assessment_id, question_id)
);

-- Reports: One per completed assessment. Generated by Agent 2.
-- Score is computed synchronously before agents run.
-- LLM narrative fields are populated after agents complete.
CREATE TABLE reports (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id    UUID NOT NULL UNIQUE REFERENCES assessments(id),
    pillar_score     DECIMAL(4,2) NOT NULL,           -- 1.00 to 4.00
    maturity_level   INTEGER NOT NULL CHECK (maturity_level BETWEEN 1 AND 4),
    maturity_label   VARCHAR(50) NOT NULL,             -- 'Reactive' | 'Developing' | 'Defined' | 'Optimized'
    executive_summary TEXT NOT NULL,                    -- LLM-generated
    strengths        JSONB NOT NULL DEFAULT '[]',      -- [{title, description}]
    gap_analysis     JSONB NOT NULL DEFAULT '[]',      -- [{gap, current_state, target_state, impact, effort}]
    next_steps       JSONB NOT NULL DEFAULT '[]',      -- [{title, description, priority, timeframe}]
    pillar_breakdown JSONB NOT NULL DEFAULT '{}',      -- per-sub-area scores if applicable
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 2. MATURITY LEVEL SCORE RANGES

| Level | Label | Score Range |
|-------|-------|-------------|
| 1 | Reactive | 1.00 – 1.74 |
| 2 | Developing | 1.75 – 2.49 |
| 3 | Defined | 2.50 – 3.24 |
| 4 | Optimized | 3.25 – 4.00 |

Use these exact ranges in the scoring service to determine `maturity_level` and `maturity_label` from `pillar_score`.

---

## 3. SCORING FORMULA

Implemented in `backend/app/services/scoring_service.py`. Runs synchronously before Agent 2 is triggered.

```
pillar_score = Σ(answer.maturity_level × question.question_weight × persona_weight)
             / Σ(4 × question.question_weight × persona_weight)
             × 4
```

**Rules:**
- If a question is `is_general = TRUE`, use `persona_weight = 1.0` (no persona modifier applied)
- If a question has a `question_personas` row for this prospect's persona, use that row's `persona_weight`
- Result is normalized to the range 1.00–4.00
- Round to 2 decimal places
- Store score in `reports.pillar_score` immediately, before LLM generation begins
- If LLM generation fails, the score record still exists and is usable

---

## 4. JSONB FIELD SCHEMAS

The JSONB fields in the `reports` table must conform to these exact structures. Agent 2's output prompt enforces this.

**strengths:**
```json
[
  {"title": "string", "description": "string"}
]
```

**gap_analysis:**
```json
[
  {
    "gap": "string",
    "current_state": "string",
    "target_state": "string",
    "impact": "high | medium | low",
    "effort": "high | medium | low"
  }
]
```

**next_steps:**
```json
[
  {
    "title": "string",
    "description": "string",
    "priority": "quick_win | strategic | foundational",
    "timeframe": "0-30 days | 1-3 months | 3-6 months | 6+ months"
  }
]
```

---

## 5. DATA ISOLATION RULE

This rule must be enforced at the **service layer**, not just at the route layer.

```python
# services/account_service.py — enforce on every query
def assert_owns_account(current_user: User, account: Account) -> None:
    if current_user.role == "admin":
        return  # admins see all
    if account.internal_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
```

Apply this check before returning any account, assessment, answer, or report to an internal user.

---

## 6. SHORT URL TOKEN GENERATION

```python
import secrets

def generate_short_token() -> str:
    return secrets.token_urlsafe(6)  # produces 8-char URL-safe string
```

The token is stored in `assessments.short_url_token`. The full prospect URL is: `{BASE_URL}/assess/{token}`.

---

## 7. AGENT 1 CACHE LOGIC

```python
from datetime import datetime, timedelta, timezone

def should_refresh_research(account: Account) -> bool:
    if account.research_cache is None:
        return True
    if account.research_cached_at is None:
        return True
    cache_age = datetime.now(timezone.utc) - account.research_cached_at
    return cache_age > timedelta(days=7)
```

If `should_refresh_research` returns `False`, skip Agent 1 and use `account.research_cache` directly.
