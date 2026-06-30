---
title: Architecture & API Design
version: 1.5
last_updated: 2026-06-28
---

# Architecture & API Design

> **When to load this file:** Tasks 5, 6, 7, 9, 10, and 11. Any task building API routes, LLM agent logic, or UI pages. Load alongside `04-data-model.md` and `02-domain-model.md` for full context.

---

## 1. MULTI-AGENT LLM ARCHITECTURE

### 1.1 Agent Overview

Three agents operate across three phases. Agent 1 output feeds both Agent 2 and Agent 3.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 1 — REGISTRATION  (triggers Agent 1)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Prospect fills in name, email, role, gate answers
                    │
                    ▼
           POST /register
                    │
         ┌──────────┴──────────────────────────────┐
         │ returns immediately                      │ background
         ▼                                          ▼ (non-blocking)
 {session_token}                     ┌──────────────────────┐
 → prospect sees                     │   Agent 1:           │──── cache hit?
   pillar menu                       │   Research Agent     │         │
                                     │                      │ No:  web search
                                     │  Input:              │ Yes: use cache
                                     │  - company_name      │         │
                                     │  - company_website   │         │
                                     │                      │◄────────┘
                                     │  Output stored in    │
                                     │  accounts.           │
                                     │  research_cache:     │
                                     │  - industry          │
                                     │  - tech_signals[]    │
                                     │  - cloud_providers[] │
                                     │  - builds_ai         │
                                     │  - key_challenges[]  │
                                     │  - business_         │
                                     │    outcomes[]        │
                                     └──────────────────────┘
                                       stored at account level
                                       (JSONB, 7-day TTL)
                                       reused across all pillars

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 2 — QUESTION SELECTION  (Agent 2 — synchronous LLM)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Prospect selects a pillar
                    │
                    ▼
        POST /select-pillar  ← synchronous — prospect waits
                    │           UI shows "Personalizing your
                    │           questions…" (~3–8 seconds)
                    │
                    ▼
   DB fetch: general questions + persona-eligible questions
   for this pillar (with id, text, context_tags per question)
                    │
                    ▼
   ┌────────────────────────────────────────────────────┐
   │   Agent 2: Question Selection Agent (LLM)          │
   │   (question_selection_agent.py)                    │
   │                                                    │
   │  Input:                                            │
   │  - prospect persona + pillar context               │
   │  - research_cache from Agent 1 (if ready)          │
   │  - candidate questions list:                       │
   │    • all general questions (must include all)      │
   │    • all persona-eligible questions for this role  │
   │    each with: id, text, context_tags               │
   │                                                    │
   │  LLM selects which questions are most             │
   │  diagnostic given:                                 │
   │    • company's tech stack, cloud providers,        │
   │      industry, and business outcomes               │
   │    • prospect's role and expertise level           │
   │    • context_tags as structured relevance hints    │
   │                                                    │
   │  If research_cache is empty:                       │
   │    → selects based on persona expertise only       │
   │  If Agent 2 fails (timeout/error):                 │
   │    → rule-based fallback:                          │
   │      4 general + 8 persona by display_order        │
   │                                                    │
   │  Output: ordered list of exactly 12 question IDs  │
   └─────────────────────┬──────────────────────────────┘
                         │
                         ▼
            12 questions returned to prospect
            (ordered for maximum diagnostic value)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 3 — REPORT GENERATION  (Agent 3 — uses Agent 1 cache + answers)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Prospect answers 12 questions → submits
                    │
                    ▼
           POST /submit
                    │
                    ├── score computed synchronously
                    │   (scoring_service.py)
                    │   stored in reports table
                    │
                    ▼
   ┌──────────────────────┐
   │   Agent 3:           │
   │   Report Agent       │
   │                      │
   │  Input:              │
   │  - research_cache    │◄── from Phase 1
   │    (company profile  │    (always ready
   │     + business       │     by now)
   │     outcomes)        │
   │  - answers (12 Qs)   │
   │  - pillar context    │
   │  - maturity score    │
   │    (pre-computed)    │
   │                      │
   │  Output:             │
   │  - executive_summary │
   │  - strengths[]       │
   │  - gap_analysis[]    │
   │  - next_steps[]      │
   └──────────────────────┘
                    │
                    ▼
   report stored → displayed on screen → PDF available
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
- Business outcomes that define success for this company — based on what they build and who they serve (e.g., an e-commerce company's success outcomes are increased sales conversion, customer retention, and satisfaction; a SaaS company's outcomes are churn reduction, expansion revenue, and uptime; a fintech's outcomes are transaction reliability, fraud reduction, and compliance). Infer the most meaningful business outcomes from the company's domain, products, and customer base.

Return ONLY valid JSON with this exact structure, no preamble, no markdown:
{
  "company_name": string,
  "industry": string,
  "company_size": "startup" | "mid-market" | "enterprise",
  "products_summary": string (2-3 sentences),
  "technology_signals": string[],
  "builds_ai_products": boolean,
  "cloud_providers": string[],
  "key_challenges": string[],
  "business_outcomes": string[]   -- 3-5 outcomes specific to this company's domain and business model
}
```

### 1.3 Agent 2: Question Selection Agent

**File:** `backend/app/agents/question_selection_agent.py`

**When it runs:** Synchronously at `/select-pillar` time. The prospect waits while this agent executes (~3–8 seconds). This is a standalone LangChain chain — not part of the LangGraph submit pipeline.

**Input preparation (before calling the agent):**
The calling service fetches from the DB:
1. All active general questions for the pillar (`is_general=TRUE`)
2. All active persona-eligible questions for the prospect's role (via `question_personas`)
Both sets include: `id`, `text`, `context_tags`, `is_general`, `question_weight`

**System prompt:**
```
You are a technical assessment expert helping to personalize a maturity
assessment for a specific company and role.

You will receive:
1. Prospect role: {persona_label} — {persona_description}
2. Assessment pillar: {pillar_name}
   Description: {pillar_description}
3. Company research context:
{research_summary}

4. Candidate questions (JSON):
{candidate_questions_json}

Each question has: "id", "text", "is_general", "context_tags"

Your task: Select exactly 12 questions that best assess this prospect's
maturity in {pillar_name}.

MANDATORY RULES:
- Include ALL questions where "is_general" is true — no exceptions
- Select remaining questions ONLY from the provided list — never invent questions
- Return exactly 12 question IDs total

When research is available, prefer questions whose context_tags match the
company's technology stack, cloud providers, and industry. Prioritize questions
that address the specific challenges and business outcomes in the research.

When research is empty, select the most broadly diagnostic questions for a
{persona_label} in this pillar.

Return ONLY a valid JSON array of exactly 12 question IDs in presentation order.
No explanation, no markdown, no preamble — just the array:
["uuid-1", "uuid-2", ..., "uuid-12"]
```

**Fallback (if Agent 2 fails or times out):**
The calling service catches all exceptions and falls back to rule-based selection:
4 general questions + first 8 persona-eligible questions by `display_order`.
The assessment always proceeds — Agent 2 is an enhancement, not a dependency.

**Output parsing:**
```python
import json
raw = llm_response.strip()
question_ids = json.loads(raw)  # expects list of 12 UUID strings
assert len(question_ids) == 12
# validate all IDs exist in candidate pool (prevent hallucination)
valid_ids = {q.id for q in all_candidates}
question_ids = [qid for qid in question_ids if qid in valid_ids]
if len(question_ids) != 12:
    raise ValueError("Agent 2 returned invalid IDs — triggering fallback")
```

---

### 1.4 Agent 3: Report Agent

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

### 1.5 LangGraph Orchestration

**File:** `backend/app/agents/orchestrator.py`

**Scope:** This orchestrator runs at `/submit` time only. It does NOT include Agent 2 (Question Selection), which runs independently at `/select-pillar` time.

```
State: AssessmentReportState
Nodes:
  - research_node        → reads from accounts.research_cache
                           (Agent 1 already fired at /register — do NOT re-trigger)
                           Only re-runs Agent 1 if cache is NULL (edge case: prospect
                           submitted before Agent 1 background task completed)
  - compute_score_node   → runs scoring formula synchronously
  - generate_report_node → runs Agent 3 (Report Agent)

Edges:
  research_node → compute_score_node → generate_report_node → END

Error handling:
  - Each node catches exceptions, logs the error, and returns partial state
  - If research_node finds empty cache and Agent 1 re-run also fails: set company_profile = {} and continue
  - If generate_report_node fails: return score only, no narrative

Timeout: 120 seconds total for Agent 3
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

GET    /api/admin/settings                    → list all system settings {key, value, description, updated_at}
GET    /api/admin/settings/{key}              → get single setting by key
PUT    /api/admin/settings/{key}              → update setting value
  Body:    {value: string}
  Validates per 04-data-model.md Section 9 rules:
    - question_count_min: new int >= 12; new int <= current question_count_max
    - question_count_max: new int >= current question_count_min
  Returns: updated setting object
  Error:   400 with descriptive message if validation fails
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
    prospect_role: string,              -- must match persona enum
    p3_gate_answered_yes?: boolean,     -- required if P3 is active
    p4_gate_answered_yes?: boolean      -- required if P4 is active
  }
  Returns: {session_token: string}  -- short-lived JWT (2hr), stored client-side in sessionStorage
  Side effect: if p3_gate_answered_yes = false, P3 excluded from subsequent pillar menu
  Side effect: if p4_gate_answered_yes = false, P4 excluded from subsequent pillar menu
  Side effect: P4 always excluded if pillar is_active = FALSE (regardless of gate answer)
  Side effect: triggers Agent 1 in background (non-blocking) if no fresh research cache —
               fired here so results are likely ready by the time select-pillar is called

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
  Execution: SYNCHRONOUS — endpoint waits for Agent 2 to complete before returning
  Side effect: sets assessment.status = 'in_progress'
  Question selection sequence:
    1. Fetch general questions + persona-eligible questions for this pillar from DB
    2. Call Agent 2 (Question Selection) with: persona, pillar context,
       research_cache, and candidate question list
    3. Agent 2 returns 12 ordered question IDs
    4. If Agent 2 fails: fallback to 4 general + 8 persona by display_order
    5. Fetch full question objects (text + answer_options) for the 12 IDs
    6. Return questions in Agent 2's selected order

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
- Gate questions rendered below the role field, one per gated pillar that is `is_active=TRUE`:
  - P3 gate: "Is your organization currently building, deploying, or operating AI-powered applications or services?"
  - P4 gate: "Is your organization currently training, fine-tuning, or managing machine learning or foundation models in-house?"
  - Each gate question: yes/no radio buttons, only shown if the corresponding gated pillar is active
- Primary CTA: "Begin Assessment"
- On submit: POST `/register`, store session_token in sessionStorage, navigate to pillar select

**Pillar Selection Page (`/assess/:token/pillars`)**
- 2-column card grid of available pillars
- Each card: pillar name, 1-sentence description, "~8 minutes" time estimate
- Suggested pillars (from `account.suggested_pillars`): highlighted with "Recommended" badge
- P3 card: hidden if P3 gate answered No
- P4 card: hidden if P4 gate answered No OR if P4 `is_active = FALSE`
- Already-completed pillars: disabled card, shows score badge and "Completed" label
- Each card CTA: "Start Assessment"
- On click: POST `/select-pillar` (synchronous) — show inline loading state on the card
  ("Personalizing your questions…") while Agent 2 runs (~3–8 seconds)
- On response: navigate to Assessment Page with questions

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
Pillar Name      | Prospect Name  | Prospect Role | Score    | Status      | Action
P1 Observability | Sarah Smith    | SRE           | 2.4 / 4  | ✅ Complete  | [View Report]
P2 AIOps         | —              | —             | —        | ⏳ Sent      | [Copy URL]
P3 AI Systems    | —              | —             | —        | 📋 Not Sent  | [Generate URL]
P4 ML & Models   | —              | —             | —        | 🔒 Inactive  | [Admin Only]
P5 Security      | —              | —             | —        | 📋 Not Sent  | [Generate URL]
```

P4 row behavior: shown in the grid with "Inactive" status and no Generate URL button when `is_active = FALSE`. When activated by admin, behaves identically to other gated pillars.

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
- "New Pillar" button → modal form: Name, Description, Overall Weight, Display Order, Is Gated, Gate Question (shown if Is Gated = true), Questions Per Assessment (number input; min and max fetched from system_settings at form load; shown as helper text e.g. "Min: 12 / Max: 25")
- Toggle Active button sets is_active without deleting
- Note: changing Questions Per Assessment takes effect immediately for assessments not yet started (status = 'pending'); in-progress and completed assessments are unaffected

**Questions (`/admin/pillars/:id/questions`)**
Split-panel layout:
- **Left panel:** List of all questions for this pillar (active and inactive). Each row shows: question text (truncated), Is General badge, question_weight, active persona count, Active/Inactive status. Edit and Toggle Active actions per row.
- **Right panel:** Create/Edit question form with:
  - Question Text (textarea, required)
  - Is General (toggle — if on, question shown to all personas)
  - Question Weight (select: 1.0 / 1.5 / 2.0)
  - Personas (multi-select from enum — disabled if Is General is on)
  - Persona Weight per selected persona (number input, shown per selected persona)
  - Context Tags (tag/chip input — comma-separated lowercase strings e.g. "kubernetes, aws, microservices". Stored as JSONB array. Helper text: "Technology signal keywords passed to the Question Selection Agent (Agent 2) to help it understand when this question is most relevant. Leave empty for universally applicable questions.")
  - Answer Options: 4 text fields labeled "Level 1 — Reactive", "Level 2 — Developing", "Level 3 — Defined", "Level 4 — Optimized"
  - Active toggle
  - Save / Cancel buttons

**System Settings (`/admin/settings`)**
- Simple key-value editor showing all rows from `system_settings` table
- Each row displays: Setting Name (human-readable label from key), Current Value (editable number input), Description (read-only helper text)
- Question Count Bounds section:
  - **Min Questions Per Session** (`question_count_min`): number input, minimum value 12 enforced in UI and backend
  - **Max Questions Per Session** (`question_count_max`): number input, must be >= min value
  - Save button per row (or a single Save All)
- Validation errors shown inline: e.g. "Minimum cannot be set below 12" or "Maximum must be at least equal to minimum"
- Note shown below the form: "Changing these bounds does not automatically update existing pillar question counts. Review pillars after changing bounds."
