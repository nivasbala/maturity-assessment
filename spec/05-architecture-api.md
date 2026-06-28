---
title: Architecture & API Design
version: 1.0
last_updated: 2026-06-27
---

# Architecture & API Design

> **When to load this file:** Tasks 5, 6, 7, 9, 10, and 11. Any task building API routes, LLM agent logic, or UI pages. Load alongside `04-data-model.md` and `02-domain-model.md` for full context.

---

## 1. MULTI-AGENT LLM ARCHITECTURE

### 1.1 Agent Overview

```
Prospect submits answers
         │
         ▼
┌────────────────────┐     cache hit?
│   Agent 1:         │─────────────────────────────────┐
│   Research Agent   │                                 │
│                    │  No: runs web research          │
│  Input:            │  Yes: returns cached result     │
│  - company_name    │                                 │
│  - company_website │                                 │
│                    │                                 │
│  Output:           │                                 │
│  - company_profile │◄────────────────────────────────┘
│    {industry,      │  accounts.research_cache
│     products,      │  (JSONB, cached at account level)
│     tech_signals,  │
│     company_size,  │
│     cloud_signals} │
└────────┬───────────┘
         │ company_profile
         ▼
┌────────────────────┐
│   Agent 2:         │
│   Report Agent     │
│                    │
│  Input:            │
│  - company_profile │
│  - assessment      │
│    answers (12 Qs) │
│  - pillar context  │
│  - maturity scores │
│    (pre-computed)  │
│                    │
│  Output:           │
│  - executive_      │
│    summary (text)  │
│  - strengths[]     │
│  - gap_analysis[]  │
│  - next_steps[]    │
└────────────────────┘
         │
         ▼
    Report stored → displayed on screen → PDF available
```

### 1.2 Agent 1: Research Agent

**File:** `backend/app/agents/research_agent.py`

**Tool:** DuckDuckGo Search (langchain-community)

**Cache behavior:**
- Check `accounts.research_cached_at` before running
- If cache is fresh (< 7 days old), skip Agent 1 and use `accounts.research_cache`
- If cache is stale or empty, run Agent 1 and update `accounts.research_cache` and `accounts.research_cached_at`
- If search fails entirely, return a minimal profile from company name alone — do not block report generation

**System prompt:**
```
You are a technology analyst researching companies for a maturity assessment.
Given a company name and website, research the company and return a structured
JSON profile. Focus on:
- What the company does (products/services)
- Industry vertical
- Company size (employees, funding stage if startup)
- Technology signals (cloud providers, programming languages, open source)
- Whether they appear to be building AI-powered products
- Key technology challenges their industry typically faces

Return ONLY valid JSON with this exact structure, no preamble, no markdown:
{
  "company_name": string,
  "industry": string,
  "company_size": "startup" | "mid-market" | "enterprise",
  "products_summary": string (2-3 sentences),
  "technology_signals": string[],
  "builds_ai_products": boolean,
  "cloud_providers": string[],
  "key_challenges": string[]
}
```

### 1.3 Agent 2: Report Agent

**File:** `backend/app/agents/report_agent.py`

**System prompt:**
```
You are a technology maturity expert helping organizations understand their
current capabilities and identify improvement opportunities.

You will receive:
1. A company profile (from research)
2. Assessment answers from a {persona} at {company_name}
3. The pillar being assessed: {pillar_name}
4. Pre-computed maturity score: {score}/4.0 ({maturity_label})

Generate a professional maturity report. Be specific, constructive, and
grounded in the actual answers provided. Do NOT mention Datadog or any
specific vendor by name. Frame recommendations as capabilities and outcomes.

Return ONLY valid JSON with this exact structure, no preamble, no markdown:
{
  "executive_summary": string (3-4 paragraphs, professional tone),
  "strengths": [
    {"title": string, "description": string}
  ],
  "gap_analysis": [
    {
      "gap": string,
      "current_state": string,
      "target_state": string,
      "impact": "high" | "medium" | "low",
      "effort": "high" | "medium" | "low"
    }
  ],
  "next_steps": [
    {
      "title": string,
      "description": string,
      "priority": "quick_win" | "strategic" | "foundational",
      "timeframe": "0-30 days" | "1-3 months" | "3-6 months" | "6+ months"
    }
  ]
}

Constraints:
- executive_summary: acknowledge company context from research
- strengths: 2-4 items based on high-scoring answers
- gap_analysis: 3-6 items, ordered by impact (high first)
- next_steps: 4-6 items, mix of quick wins and strategic investments
- Never mention specific vendor product names
- Keep language accessible to the persona level ({persona})
```

### 1.4 LangGraph Orchestration

**File:** `backend/app/agents/orchestrator.py`

```
State: AssessmentReportState
Nodes:
  - research_node       → runs Agent 1 (or returns cache)
  - compute_score_node  → runs scoring formula synchronously
  - generate_report_node → runs Agent 2

Edges:
  research_node → compute_score_node → generate_report_node → END

Error handling:
  - Each node catches exceptions, logs the error, and returns partial state
  - If research_node fails: set company_profile = {} and continue
  - If generate_report_node fails: return score only, no narrative

Timeout: 120 seconds total for both agents combined
```

---

## 2. API ENDPOINTS

### 2.1 Authentication

```
POST /api/auth/login
  Body:    {email: string, password: string}
  Returns: {access_token: string, refresh_token: string,
            user: {id, name, email, role}}

POST /api/auth/refresh
  Body:    {refresh_token: string}
  Returns: {access_token: string}

POST /api/auth/logout
  Headers: Authorization: Bearer <token>
  Returns: {success: true}
```

### 2.2 Admin Endpoints (role: admin only)

```
GET    /api/admin/users                       → list all users
POST   /api/admin/users                       → create internal user
GET    /api/admin/users/{id}                  → get user
PUT    /api/admin/users/{id}                  → update user
DELETE /api/admin/users/{id}                  → deactivate (soft delete, is_active=FALSE)

GET    /api/admin/pillars                     → list all pillars
POST   /api/admin/pillars                     → create pillar
GET    /api/admin/pillars/{id}               → get pillar with question count
PUT    /api/admin/pillars/{id}               → update pillar
DELETE /api/admin/pillars/{id}               → deactivate pillar (is_active=FALSE)

GET    /api/admin/pillars/{id}/questions      → list all questions for pillar
POST   /api/admin/pillars/{id}/questions      → create question with options + personas
GET    /api/admin/questions/{id}              → get question with options + personas
PUT    /api/admin/questions/{id}              → update question
DELETE /api/admin/questions/{id}              → deactivate question (is_active=FALSE)

GET    /api/admin/accounts                    → list all accounts (all internal users)
GET    /api/admin/assessments                 → list all assessments
```

### 2.3 Internal User Endpoints (role: internal_user or admin)

```
GET    /api/accounts
  → list accounts (own only for internal_user: filter by internal_user_id = me)

POST   /api/accounts
  Body:    {company_name, company_website?, suggested_pillars?: uuid[]}
  Returns: account object

GET    /api/accounts/{id}
  → account with pillar assessment statuses

GET    /api/accounts/{id}/aggregate
  → aggregate score view
  → Returns 404 if fewer than 2 assessments are completed for this account

POST   /api/accounts/{id}/assessments
  Body:    {pillar_id: uuid}
  Returns: {assessment_id, short_url_token, full_url}
  Error:   409 if assessment already exists for this account + pillar

GET    /api/accounts/{id}/assessments
  → list all assessments for account with status + scores

GET    /api/assessments/{id}
  → assessment detail (prospect info + status)

GET    /api/assessments/{id}/answers
  → raw answers: [{question_text, selected_option_text, maturity_level}]

GET    /api/assessments/{id}/report
  → full report object
```

### 2.4 Prospect (Public) Endpoints — No Auth Required

```
GET    /api/public/assess/{token}
  Returns: {
    company_name: string,
    suggested_pillars: uuid[],
    available_pillars: [{id, name, description, is_gated, gate_question}]
  }
  Error: 404 if token not found

POST   /api/public/assess/{token}/register
  Body:    {
    prospect_name: string,
    prospect_email: string,
    prospect_role: string,          -- must match persona enum
    gate_answered_yes?: boolean     -- only required if a gated pillar exists
  }
  Returns: {session_token: string}  -- short-lived JWT (2hr), stored client-side in sessionStorage
  Side effect: if gate_answered_yes = false, P3 excluded from subsequent pillar menu

POST   /api/public/assess/{token}/select-pillar
  Headers: X-Session-Token: <session_token>
  Body:    {pillar_id: uuid}
  Returns: {
    assessment_id: uuid,
    questions: [{
      id: uuid,
      text: string,
      answer_options: [{id, text, display_order}]
    }]
  }
  Side effect: sets assessment.status = 'in_progress'
  Side effect: triggers Agent 1 in background (non-blocking) if no fresh cache

POST   /api/public/assess/{token}/submit
  Headers: X-Session-Token: <session_token>
  Body:    {
    assessment_id: uuid,
    answers: [{question_id: uuid, answer_option_id: uuid}]
  }
  Validates: exactly 12 answers, all question_ids match questions returned for this session
  Sequence:
    1. Save answers to assessment_answers
    2. Compute score synchronously (scoring_service)
    3. Create report record with score (executive_summary = '' initially)
    4. Set assessment.status = 'completed', assessment.completed_at = now()
    5. Trigger LangGraph orchestrator synchronously (user waits — show loading state)
    6. Update report with LLM narrative
  Returns: {report_id: uuid}
  Error:   422 if answer count or question IDs are invalid

GET    /api/public/assess/{token}/report/{assessment_id}
  Returns: full report object + prospect info + pillar name
  Auth:    token is the access control — no additional auth required
  Note:    this endpoint is also used by the internal user to show the same report
           (internal users access via /api/assessments/{id}/report instead)
```

### 2.5 Response Conventions

- All timestamps: ISO 8601 UTC
- All IDs: UUID strings
- Error format: `{"error": string, "detail": string?, "field": string?}`
- HTTP status codes: 200 / 201 / 204 / 400 / 401 / 403 / 404 / 409 / 422 / 500
- Pagination (list endpoints): `{"items": [], "total": int, "page": int, "size": int}`
- Default page size: 25

---

## 3. UI SPECIFICATIONS

### 3.1 Design Principles

- Clean, professional, data-forward aesthetic appropriate for a B2B enterprise tool
- Color palette: deep navy primary (#1B2B4B), electric blue accent (#0066FF), neutral grays, white backgrounds
- Typography: Inter for all UI text, no decorative fonts
- All forms use controlled React components — no HTML `<form>` tags
- All interactive elements must have visible focus states (keyboard accessible)
- Loading states required for all async operations (agents can take 15–45 seconds)
- Error states must explain what went wrong and what action to take
- Responsive: minimum 1024px desktop; tablet-friendly at 768px

### 3.2 Prospect Flow — Page Specifications

**Landing Page (`/assess/:token`)**
- Company name displayed prominently (pulled from account via token)
- Heading: "Maturity Assessment" + brief one-paragraph explanation
- Form fields: First Name, Last Name, Email, Role (dropdown from persona enum)
- P3 gate question rendered below the role field if P3 is an available pillar
- Gate question: yes/no radio buttons
- Primary CTA: "Begin Assessment"
- On submit: POST `/register`, store session_token in sessionStorage, navigate to pillar select

**Pillar Selection Page (`/assess/:token/pillars`)**
- 2-column card grid of available pillars
- Each card: pillar name, 1-sentence description, "~8 minutes" time estimate
- Suggested pillars (from `account.suggested_pillars`): highlighted with "Recommended" badge
- P3 card: hidden if gate answered No
- Already-completed pillars: disabled card, shows score badge and "Completed" label
- Each card CTA: "Start Assessment"
- On click: POST `/select-pillar`, navigate to assessment page

**Assessment Page (`/assess/:token/assessment/:assessmentId`)**
- Progress bar at top: "Question 4 of 12"
- One question displayed at a time — no scrolling through all questions
- Question text as heading, 4 radio button options below (ordered 1→4 by maturity level)
- "Back" and "Next" navigation buttons
- "Submit" button appears only on question 12 (replaces "Next")
- No ability to skip questions — "Next" disabled until a radio option is selected
- All answers stored in local React state until Submit — not saved to DB until submission

**Report Page (`/assess/:token/report/:assessmentId`)**

Loading state (shown while agents run — can take 15–45 seconds):
- Full-page centered loading indicator
- Rotating descriptive messages:
  1. "Researching your company…"
  2. "Analyzing your responses…"
  3. "Generating your report…"

Report sections (rendered in this order):
1. **Header:** Company name, pillar name, maturity level badge (color-coded by level), score (e.g., "2.7 / 4.0")
2. **Executive Summary:** LLM-generated narrative paragraphs, rendered as prose
3. **Radar Chart:** Recharts RadarChart showing pillar score; if pillar_breakdown JSONB contains sub-areas, show each sub-area as a radar axis
4. **Strengths:** Card grid (2 columns), each card shows title + description with a checkmark icon
5. **Gap Analysis:** Table with columns: Gap, Current State, Target State, Impact (badge), Effort (badge). Ordered by impact (high first)
6. **Recommended Next Steps:** Cards grouped by priority. Quick Wins first, then Strategic, then Foundational. Each card shows title, description, timeframe badge
7. **Footer actions:** "Download PDF" button + "Take Another Pillar Assessment" button

PDF download:
- Captures the report DOM element client-side
- No backend dependency
- File name: `{company_name}-{pillar_name}-maturity-report.pdf`

"Take Another Pillar Assessment":
- Navigates back to pillar selection page (`/assess/:token/pillars`)
- Completed pillar shown as disabled on return

### 3.3 Internal User Dashboard — Page Specifications

**Accounts List (`/dashboard`)**
- Table columns: Company Name, Website, Pillars Sent, Pillars Completed, Date Created, Actions
- "New Account" button → opens modal with fields: Company Name (required), Website (optional), Suggested Pillars (multi-select from active pillars)
- Click row → navigate to Account Detail page

**Account Detail (`/dashboard/accounts/:id`)**

Account header section:
- Company name, website (linked), date created, created by (internal user name)

Pillar status grid (one row per active pillar):
```
Pillar Name    | Prospect Name  | Prospect Role | Score    | Status      | Action
P1 Observability | Sarah Smith  | SRE           | 2.4 / 4  | ✅ Complete  | [View Report]
P2 AIOps         | —            | —             | —        | ⏳ Sent      | [Copy URL]
P3 AI Systems    | —            | —             | —        | 📋 Not Sent  | [Generate URL]
P5 Security      | —            | —             | —        | 📋 Not Sent  | [Generate URL]
```

"Generate URL" button:
- Calls POST `/api/accounts/{id}/assessments` with selected pillar_id
- Returns short URL
- Opens modal showing the full URL with copy-to-clipboard button
- Disabled if assessment already exists for this pillar (status: pending or completed)

"Aggregate View" tab:
- Visible only when 2+ pillar assessments are completed for this account
- Shows a radar chart with all completed pillar scores overlaid
- Summary table: pillar name, score, maturity label, prospect name

**Report Detail (`/dashboard/assessments/:id`)**
Two tabs:

"Report" tab:
- Identical report UI as the prospect-facing report page
- Read-only for internal user

"Raw Answers" tab:
- Table: Question Text | Selected Answer | Maturity Level (1–4)
- 12 rows (one per question)
- Prospect details shown above table: name, email, role, date completed
- Pillar score and maturity label shown as summary below table

### 3.4 Admin Panel — Page Specifications

**Users (`/admin/users`)**
- Table: Name, Email, Role, Status, Date Created, Actions (Edit, Deactivate)
- "New User" button → modal form: Name, Email, Password, Role (internal_user only — cannot create admin via UI)
- Deactivate = soft delete (is_active = FALSE), never hard delete

**Pillars (`/admin/pillars`)**
- Table: Name, Display Order, Active, Gated, Question Count, Actions (Edit, Toggle Active)
- "New Pillar" button → modal form: Name, Description, Overall Weight, Display Order, Is Gated, Gate Question (shown if Is Gated = true)
- Toggle Active button sets is_active without deleting

**Questions (`/admin/pillars/:id/questions`)**
Split-panel layout:
- **Left panel:** List of all questions for this pillar (active and inactive). Each row shows: question text (truncated), Is General badge, question_weight, active persona count, Active/Inactive status. Edit and Toggle Active actions per row.
- **Right panel:** Create/Edit question form with:
  - Question Text (textarea, required)
  - Is General (toggle — if on, question shown to all personas)
  - Question Weight (select: 1.0 / 1.5 / 2.0)
  - Personas (multi-select from enum — disabled if Is General is on)
  - Persona Weight per selected persona (number input, shown per selected persona)
  - Answer Options: 4 text fields labeled "Level 1 — Reactive", "Level 2 — Developing", "Level 3 — Defined", "Level 4 — Optimized"
  - Active toggle
  - Save / Cancel buttons
