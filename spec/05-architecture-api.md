---
title: Architecture & API Design
version: 1.8
last_updated: 2026-07-02
---

# Architecture & API Design

> **When to load this file:** Tasks 5, 6, 7, 9, 10, and 11. Any task building API routes, LLM agent logic, or UI pages. Load alongside `04-data-model.md` and `02-domain-model.md` for full context.

---

## 1. MULTI-AGENT LLM ARCHITECTURE

### 1.1 Agent Overview

Three agents operate across three phases. Agent 1 output feeds both Agent 2 and Agent 3.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 1 — PROSPECT CREATION  (internal user action)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Internal user fills in email (+ company from account context)
and clicks "Create Prospect"
                    │
                    ▼
   POST /api/accounts/{id}/prospects
                    │
                    ▼
 {prospect_id,
  short_url_token,
  full_url}
 → internal user copies URL
   and shares with prospect

 No agent fires yet — Agent 1 needs prospect-provided context,
 which is not available until registration (Phase 1.5).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 1.5 — PROSPECT REGISTRATION  (triggers Agent 1)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Prospect visits URL → LandingPage shows registration form
  - Email pre-populated (read-only) from prospect record
  - Prospect fills in: name, role, gate answers, optional context
                    │
                    ▼
         POST /register
         (updates existing prospect: is_registered=true,
          saves name, role, context fields; does NOT accept email)
                    │
         ┌──────────┴──────────────────────────────────────┐
         │ returns immediately                              │ background (non-blocking)
         ▼                                                  ▼
 → navigate to ResearchingPage           ┌────────────────────────────────┐
   (polls research-summary until ready)  │   Agent 1: Research Agent      │──── input hash
                                          │                                │     matches cache?
                                          │  Input 1 — Prospect context    │  Yes: skip, reuse cache
                                          │  (treated as ground truth):    │  No:  run
                                          │  - infrastructure_location     │◄─────────────┘
                                          │  - tech_stack_description      │
                                          │  - current_tools               │
                                          │  - key_challenges_input        │
                                          │  (from prospects table)        │
                                          │                                │
                                          │  Input 2 — Web research:       │
                                          │  - company_name + website      │
                                          │  - 2–3 DuckDuckGo searches     │
                                          │  - 1 news-focused search pass  │
                                          │    (past 30–60 days)           │
                                          │                                │
                                          │  Output → prospect.            │
                                          │  research_cache:               │
                                          │  - company_name                │
                                          │  - industry                    │
                                          │  - company_size                │
                                          │  - products_summary            │
                                          │  - target_customers            │
                                          │  - builds_ai_products          │
                                          │  - cloud_providers[]           │
                                          │  - key_challenges[]            │
                                          │  - business_outcomes[]         │
                                          │  - operational_scale           │
                                          │  - data_confidence             │
                                          │  - research_notes              │
                                          │  - news_insights                │
                                          │  - observability_outcome       │
                                          │  - sources[]                   │
                                          └────────────────────────────────┘
                                            JSONB, 7-day TTL per prospect
                                            (skipped early if input hash unchanged)
                    │
                    ▼
           ResearchSummaryPage
           (shown before pillar selection)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 2 — PILLAR SELECTION  (Agent 2 — background)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ResearchSummaryPage:
- shows company profile
- data_confidence badge
- news_insights, observability_outcome
- sources (collapsible)
- additional notes textarea
  (saved via PUT /research-
   additional-notes as typed)
                    │
                    │ "Select Assessment →"
                    ▼
           PillarSelectPage
                    │
                    │ Prospect selects a pillar card
                    ▼
        POST /select-pillar  ← returns {assessment_id} immediately
         Creates (or reuses) assessment; starts Agent 2 in BACKGROUND
                    │
         ┌──────────┴──────────────────────────────────────┐
         │ returns immediately                              │ background (non-blocking)
         ▼                                                  ▼
   POST /confirm-research (called                ┌────────────────────────────────────────────────────┐
   immediately, still on PillarSelectPage):       │   Agent 2: Question Selection Agent (LLM)          │
   - copies prospect_additional_notes             │   (question_selection_agent.py)                    │
     onto the assessment                          │                                                    │
   - sets research_confirmed_at                   │  Input:                                            │
   - waits for background Agent 2 →               │  - prospect persona + pillar context               │
     returns questions                            │  - research_cache from prospect                    │
                    │                              │  - prospect context (tech stack, tools,            │
                    ▼                              │    key challenges, prospect_additional_notes)      │
          questions returned                       │  - candidate questions list                        │
                    │                              │                                                    │
                    ▼                              │  LLM selects which questions are most             │
           navigate to AssessmentPage              │  diagnostic given:                                 │
           (questions already loaded)              │    • prospect's tech context + key challenges      │
                                                    │    • company profile: industry, challenges,        │
                                                    │      outcomes, target customers, scale             │
                                                    │    • prospect's role and expertise level           │
                                                    │    • context_tags as structured relevance hints    │
                                                    │                                                    │
                                                    │  If Agent 2 fails (timeout/error):                 │
                                                    │    → rule-based fallback:                          │
                                                    │      general_count general + remaining persona     │
                                                    │      by display_order (up to question_count total) │
                                                    │                                                    │
                                                    │  Output: ordered list of {question_count} IDs     │
                                                    └────────────────────────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 3 — REPORT GENERATION  (Agent 3 — uses Agent 1 cache + answers)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Prospect answers question_count questions → submits
                    │
                    ▼
   navigate to SubmittingPage → POST /submit  (SYNCHRONOUS — blocks until step 6 completes)
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
   │  - assessment answers  │
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
   report stored → POST /submit response returns {report_id} → SubmittingPage navigates to ReportPage → PDF available
```

**Notes:**
- Section 2.4 documents the exact `select-pillar` upsert behavior and the `confirm-research` call happening from `PillarSelectPage` immediately after pillar selection, before navigating to AssessmentPage.
- `SubmittingPage` is shown for the duration of the synchronous `POST /submit` call (up to 300s) — see Section 3.3.

### 1.2 Agent 1: Research Agent

**File:** `backend/app/agents/research_agent.py`

**Tool:** DuckDuckGo Search (langchain-community)

**Cache behavior:**
- Fires at prospect **registration** (`POST /register`), when both inputs first become available — not at prospect creation
- Before running, compute a hash of the six research inputs (`company_name`, `company_website`, `infrastructure_location`, `tech_stack_description`, `current_tools`, `key_challenges_input`) and compare to the stored hash
- If the hash matches and cache is fresh (< 7 days old), skip Agent 1 and use `prospect.research_cache`
- If the hash differs, or cache is stale or empty, run Agent 1 and update `prospect.research_cache`, `prospect.research_cached_at`, and the stored input hash
- `prospect.research_started_at` is set when Agent 1 begins
- If search fails entirely, return a minimal profile from company name alone — do not block report generation

**Two inputs passed into the agent by the calling service:**
1. Web-searchable: `company_name`, `company_website`
2. Prospect-provided (from the `prospects` table, any may be empty): `infrastructure_location`, `tech_stack_description`, `current_tools`, `key_challenges_input`

**System prompt:**
```
You are a business intelligence analyst preparing a company profile for a
technology maturity assessment. You have TWO inputs: publicly available
web information AND direct context provided by the prospect. Synthesize
both into a precise, grounded profile.

ACCURACY RULE: Do not infer or fabricate. If a field cannot be determined
from the inputs, use the exact default specified. A missing value is better
than an incorrect one.

INPUT 1 — PROSPECT-PROVIDED CONTEXT (highest priority — treat as ground truth)
The following was stated directly by the prospect at registration:
  Infrastructure & deployment:  {infrastructure_location}
  Tech stack description:       {tech_stack_description}
  Current tools:                {current_tools}
  Key challenges they stated:   {key_challenges_input}

Empty fields above mean the prospect did not provide that information.

INPUT 2 — WEB RESEARCH
Run 2–3 targeted searches:
  1. "{company_name} company products customers"
  2. "{company_name} {company_website} about funding size"
  3. "{company_name} technology engineering" (if additional context needed)

Trusted sources: company website, LinkedIn, Crunchbase, press releases.
Ignore sources older than 3 years.

INPUT 3 — NEWS-FOCUSED SEARCH PASS
Run one additional search covering the past 30–60 days:
  "{company_name} security OR AI OR observability OR cost news"
Use this pass specifically to populate news_insights below. If nothing
relevant from the past 30–60 days is found, use the empty-string default.

SYNTHESIS RULES
1. key_challenges: if the prospect provided key_challenges_input, it is the
   primary source — incorporate their exact challenges, then enrich with
   operational context from web research (scale, customer type, product demands).
   If key_challenges_input is empty, synthesize from product type + infrastructure
   + company scale. Always produce company-specific, operational challenges.
2. cloud_providers: extract from infrastructure_location if provided; otherwise
   infer from web research if explicitly mentioned.
3. business_outcomes: derive from business model + customer type from web research.
4. target_customers: infer from company website, product pages, or marketing copy.
   Who pays for and uses their product? Be specific (e.g. "enterprise DevOps teams
   at Fortune 500 companies", "independent software vendors building on AWS").
5. operational_scale: infer from job postings, engineering blogs, case studies, or
   any quantitative public mentions (team size, request volume, service count).
   Empty list if no evidence found.

FIELD DEFINITIONS AND DEFAULT VALUES

company_name
  The company's official name as it appears publicly.

industry
  Single lowercase label. Examples: "saas", "fintech", "healthcare",
  "e-commerce", "cybersecurity", "devtools", "media", "logistics",
  "gaming", "edtech", "ai", "manufacturing"
  Default: "technology"

company_size
  Infer from employee count or funding signals.
    "startup"    = <100 employees or Seed/Series A
    "mid-market" = 100–999 employees or Series B/C/D
    "enterprise" = 1000+ employees or publicly traded
  Default: "mid-market"

products_summary
  2–3 sentences: what they build, who uses it, what problem it solves.
  Specific to this company — not a generic category description.
  Default: "Insufficient public information to summarize products."

target_customers
  Who pays for and uses this company's products or services.
  Specific to this company — not a generic category description.
  Good: "enterprise DevOps and platform engineering teams at Fortune 500 companies"
        "independent e-commerce merchants selling on Shopify"
        "mid-market financial institutions managing compliance workflows"
  Default: ""

builds_ai_products
  true  = company ships AI-powered features to their end customers.
  false = company uses AI internally only, or has no AI involvement.
  Default: false

cloud_providers
  Extract from prospect's infrastructure_location, normalize to lowercase.
  Valid values: "aws", "gcp", "azure", "cloudflare", "vercel", "heroku", "on-premises"
  If infrastructure_location was empty, infer from web research if mentioned.
  Default: []

key_challenges
  4–6 challenges SPECIFIC to this company.
  If key_challenges_input is provided: use as primary source, enrich with
  operational context (scale, customer SLAs, architecture complexity).
  If empty: synthesize from product category + infrastructure + customer type.
  Each challenge must be concrete and operational.
  Good: "maintaining sub-100ms latency for payment transactions across 3 AWS regions"
        "reducing on-call burden on a 5-person SRE team supporting 200+ services"
  Prohibited: "scaling challenges", "keeping up with technology", generic trends
  Default: []

business_outcomes
  4–6 measurable outcomes defining commercial success for this company.
  Examples by type:
    E-commerce:      ["checkout conversion rate", "cart abandonment rate", "delivery SLA"]
    Developer tools: ["time-to-first-integration", "SDK adoption rate", "API uptime SLA"]
    B2B SaaS:        ["monthly churn rate", "expansion MRR", "time-to-value"]
    Fintech:         ["transaction success rate", "fraud detection recall", "compliance pass rate"]
  Default: []

operational_scale
  A list of brief quantitative facts about the company's technical operations.
  Infer from job postings, engineering blogs, case studies, or public mentions.
  Good: ["processes 5B+ API requests per day across 200+ microservices",
         "500 engineers across 40+ product teams, 12 global data centers"]
  Default: [] (empty list — do not guess if no evidence found)

data_confidence
  "high"   = rich public presence, multiple independent confirming sources
  "medium" = some information found; some fields estimated
  "low"    = minimal public info; most fields from defaults or prospect input only
  REQUIRED.

research_notes
  One sentence noting anything significant. Empty string if nothing notable.
  Default: ""

news_insights
  2–4 sentences summarizing recent security, AI, observability, or cost signals
  discovered about the company from the news-focused search pass (Input 3),
  covering the past 30–60 days. Company-specific — not generic industry trends.
  Default: "" (empty string if nothing relevant found in that window)

observability_outcome
  Synthesized observability recommendations specific to this company, grounded
  in its operational_scale, key_challenges, and cloud_providers.
  Default: ""

sources
  A list of {title, url} pairs drawn from all search results actually used
  (Input 2 and Input 3 combined). Empty list if no usable sources were found.
  Default: []

RETURN EXACTLY THIS JSON — no preamble, no markdown fences, no explanation:
{
  "company_name": "string",
  "industry": "string",
  "company_size": "startup" | "mid-market" | "enterprise",
  "products_summary": "string",
  "target_customers": "string",
  "builds_ai_products": boolean,
  "cloud_providers": ["string"],
  "key_challenges": ["string"],
  "business_outcomes": ["string"],
  "operational_scale": ["string"],
  "data_confidence": "high" | "medium" | "low",
  "research_notes": "string",
  "news_insights": "string",
  "observability_outcome": "string",
  "sources": [{"title": "string", "url": "string"}]
}
```

### 1.3 Agent 2: Question Selection Agent

**File:** `backend/app/agents/question_selection_agent.py`

**When it runs:** In the **background**, as a task started immediately after `POST /select-pillar` returns. The assessment is created (or reused) first; Agent 2 begins running the moment the prospect selects a pillar on `PillarSelectPage`. `POST /confirm-research` — called immediately afterward, still on `PillarSelectPage`, before navigating to `AssessmentPage` — waits for Agent 2 to complete before returning questions. This is a standalone LangChain chain — not part of the LangGraph submit pipeline.

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
3. Company research context (from Agent 1):
{research_summary}

4. Prospect-provided context (direct input — treat as primary signal):
   Infrastructure & deployment: {infrastructure_location}
   Tech stack description:      {tech_stack_description}
   Current tools:               {current_tools}
   Key challenges they stated:  {key_challenges_input}
   Additional notes after research review: {prospect_additional_notes}
   (Empty fields above were not provided by the prospect)
   Note: prospect context fields come from the prospects table; additional notes from assessments.prospect_additional_notes

5. Candidate questions (JSON):
{candidate_questions_json}

Each question has: "id", "text", "is_general", "context_tags"

Your task: Select exactly {question_count} questions that best assess this prospect's
maturity in {pillar_name}.

MANDATORY RULES:
- Include ALL questions where "is_general" is true — no exceptions
- Select remaining questions ONLY from the provided list — never invent questions
- Return exactly {question_count} question IDs total

SELECTION GUIDANCE:
Use the prospect's directly stated context (Input 4) as the primary signal:
- Match questions whose context_tags align with tech mentioned in tech_stack_description
  or current_tools
- Prioritize questions that directly address challenges stated in key_challenges_input
- If prospect_additional_notes is provided, treat it as the highest-priority signal —
  it represents the prospect's own review and adjustment of the research
- Use the research profile (Input 3) for additional business context: key_challenges,
  business_outcomes, target_customers, and operational_scale
When prospect context is sparse, rely more heavily on the research profile and persona.

Return ONLY a valid JSON array of exactly {question_count} question IDs in presentation order.
No explanation, no markdown, no preamble — just the array:
["uuid-1", "uuid-2", ..., "uuid-N"]
```

**Fallback (if Agent 2 fails or times out):**
Falls back to all general + first (question_count − general_count) persona-eligible questions by `display_order`. Assessment always proceeds — Agent 2 is an enhancement, not a dependency.

**Output parsing:**
```python
import json
raw = llm_response.strip()
question_ids = json.loads(raw)  # expects list of question_count UUID strings
assert len(question_ids) == question_count
# validate all IDs exist in candidate pool (prevent hallucination)
valid_ids = {q.id for q in all_candidates}
question_ids = [qid for qid in question_ids if qid in valid_ids]
if len(question_ids) != question_count:
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
  - research_node        → reads from prospect.research_cache
                           (Agent 1 already fired at registration — do NOT re-trigger)
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

Timeout: 300 seconds total for Agent 3
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
  Headers: Authorization: Bearer <refresh_token>
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
  Body:    {company_name, company_website?}
  Returns: account object

GET    /api/accounts/{id}
  → account with list of prospects (registration status, assessment count per prospect)

DELETE /api/accounts/{id}
  → deletes the account (admin only; internal users cannot delete their own accounts)
  Note: `accounts` has no `is_active` column, so this is a hard delete — cascades to the account's
        prospects, assessments, assessment_answers, and reports. Confirm this destructive scope against
        the actual implementation before relying on it in production workflows.

GET    /api/accounts/{id}/aggregate
  → aggregate score view across all completed assessments for this account
  → Returns 404 if fewer than 2 assessments are completed across all prospects

GET    /api/accounts/all-prospects
  → list all prospects across every account visible to the current user (own accounts only for
    internal_user; all accounts for admin) — a flattened cross-account view, distinct from
    `GET /api/accounts/{id}/prospects` which is scoped to a single account
  → Each row includes: prospect id, email, name, account_id, company_name, registration status,
    assessment count

POST   /api/accounts/{id}/prospects
  Body:    {email: string, suggested_pillars?: uuid[]}
  Returns: {prospect_id, email, short_url_token, full_url, is_registered: false}
  Error:   409 if a prospect with this email already exists under this account
  Side effect: creates prospect record; generates short_url_token
  Note: Agent 1 does NOT fire here — it fires at registration (POST /register), once prospect-provided context is available

GET    /api/accounts/{id}/prospects
  → list all prospects for account with registration status and assessment summary

DELETE /api/accounts/{id}/prospects/{prospect_id}
  → deletes the prospect (hard delete — `prospects` has no `is_active` column); cascades to that
    prospect's assessments, assessment_answers, and reports
  Error:   404 if the prospect does not belong to this account

GET    /api/accounts/{id}/prospects/{prospect_id}
  → prospect detail: context fields, assessments list with status + scores

POST   /api/accounts/{id}/assessments
  Body:    {prospect_id: uuid, pillar_id: uuid}
  Returns: assessment object
  → Internal-user-initiated equivalent of the prospect's own `POST /select-pillar` — creates (or
    reuses, per the same upsert behavior) an assessment for a prospect + pillar directly from the
    dashboard, without requiring the prospect to click through the pillar card themselves
  Error:   404 if prospect_id does not belong to this account

GET    /api/accounts/{id}/assessments
  → list all assessments under this account, across all prospects, with status + score

DELETE /api/accounts/{id}/assessments/{assessment_id}
  → deletes the assessment (hard delete — `assessments` has no `is_active` column); cascades to
    assessment_answers and the associated report
  Error:   404 if the assessment does not belong to this account

GET    /api/assessments/{id}
  → assessment detail (prospect info + status)

POST   /api/assessments/{id}/reset
  Returns: assessment object with status reset to `pending`
  Side effect: deletes existing assessment_answers and the associated report for this assessment;
               clears research_confirmed_at and prospect_additional_notes on the assessment
  Note: allows an internal user to let a prospect retake a pillar from scratch without deleting the
        assessment row itself (preserves the assessment's history/id); distinct from the prospect-facing
        upsert-on-select-pillar behavior, which only resets status without clearing answers

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
    prospect_email: string,            -- pre-populate email field (read-only)
    is_registered: boolean,
    suggested_pillars: uuid[],
    available_pillars: [{id, name, description, is_gated, gate_question}],
    -- Present when is_registered=true, so the frontend can pre-populate the form:
    prospect_name?: string,
    prospect_role?: string,
    p3_gate_answered_yes?: boolean,
    p4_gate_answered_yes?: boolean,
    infrastructure_location?: string,
    tech_stack_description?: string,
    current_tools?: string,
    key_challenges_input?: string,
    prospect_additional_notes?: string,
    existing_assessments?: [{id, pillar_id, status}]
  }
  Error: 404 if token not found
  Note: does NOT return 410 for an already-registered prospect — returns 200 with is_registered:true and saved state instead

POST   /api/public/assess/{token}/register
  Body:    {
    prospect_name: string,
    prospect_role: string,              -- must match persona enum
    p3_gate_answered_yes?: boolean,     -- required if P3 is active
    p4_gate_answered_yes?: boolean,     -- required if P4 is active
    -- Optional prospect context (stored on prospects table, primary input to Agent 1):
    infrastructure_location?: string,
    tech_stack_description?: string,
    current_tools?: string,
    key_challenges_input?: string
    -- NOTE: email is NOT accepted — it is already set on the prospect record and is immutable
  }
  Returns: {session_token: string}  -- short-lived JWT (2hr) scoped to prospect_id
  Error:   409 if prospect is already registered (is_registered = TRUE)
  Side effect: sets prospect.is_registered = TRUE, prospect.registered_at = now()
  Side effect: saves prospect_role, gate answers, and optional context fields to prospects table
  Side effect: triggers Agent 1 in the background (first fire — see Section 1.2 for the input-hash/TTL skip logic)

GET    /api/public/assess/{token}/research-summary
  Headers: X-Session-Token: <session_token>
  Returns: {
    is_ready: boolean,
    -- Fields below present only when is_ready=true:
    company_name?: string,
    industry?: string,
    company_size?: string,
    products_summary?: string,
    target_customers?: string,
    builds_ai_products?: boolean,
    cloud_providers?: string[],
    key_challenges?: string[],
    business_outcomes?: string[],
    operational_scale?: string[],
    data_confidence?: "high" | "medium" | "low",
    research_notes?: string,
    news_insights?: string,
    observability_outcome?: string,
    sources?: [{title: string, url: string}]
  }
  Note: Agent 1 fires at registration, so this endpoint is polled from ResearchingPage
        immediately after POST /register returns. Poll every 3 seconds while is_ready=false.
        After 60s returns is_ready=true with empty fields to avoid blocking.

PUT    /api/public/assess/{token}/research-additional-notes
  Headers: X-Session-Token: <session_token>
  Body:    {additional_notes: string}
  Returns: {saved: true}
  Side effect: saves additional_notes to prospect.prospect_additional_notes immediately as the
               prospect types on ResearchSummaryPage (before pillar selection)
  Note: the same notes are copied to the assessment record at confirm-research time

POST   /api/public/assess/{token}/select-pillar
  Headers: X-Session-Token: <session_token>
  Body:    {pillar_id: uuid}
  Returns: {assessment_id: uuid}    ← returns immediately; PillarSelectPage then calls confirm-research
  Execution: NON-BLOCKING — creates or reuses assessment, starts Agent 2 in background
  Side effect: if no assessment exists for (account_id, pillar_id), creates one (status: in_progress,
               prospect_id from session); if one already exists, resets it to status: in_progress
               and reuses it (upsert behavior — allows re-entry into a previously-started assessment)
  Side effect: starts Agent 2 asynchronously; PillarSelectPage calls confirm-research immediately afterward, which waits for it to finish

POST   /api/public/assess/{token}/confirm-research
  Headers: X-Session-Token: <session_token>
  Body:    {assessment_id: uuid, additional_notes?: string}
  Returns: {
    questions: [{
      id: uuid,
      text: string,
      answer_options: [{id, text, display_order}]
    }]
  }
  Execution: SYNCHRONOUS — called from PillarSelectPage immediately after pillar selection, before navigating to AssessmentPage; waits for Agent 2 to complete
  Side effect: saves additional_notes to assessment.prospect_additional_notes
  Side effect: sets assessment.research_confirmed_at = now()
  Question selection sequence (Agent 2 was already running in background):
    1. Wait for background Agent 2 to complete (or use fallback if timed out)
    2. Fetch full question objects (text + answer_options) for the selected question IDs
    3. Return questions in Agent 2's selected order

POST   /api/public/assess/{token}/submit
  Headers: X-Session-Token: <session_token>
  Body:    {
    assessment_id: uuid,
    answers: [{question_id: uuid, answer_option_id: uuid}]
  }
  Validates: answer count matches pillar.question_count for this session, all question_ids match questions returned for this session
  Returns: {report_id: uuid}    ← returned after Agent 3 completes
  Execution: SYNCHRONOUS — blocks until the full pipeline below completes (up to 300s timeout for Agent 3); SubmittingPage is shown for the duration of this call
  Sequence:
    1. Save answers to assessment_answers
    2. Compute score synchronously (scoring_service)
    3. Create report record with score (executive_summary = '' initially)
    4. Set assessment.status = 'completed', assessment.completed_at = now()
    5. Trigger LangGraph orchestrator synchronously (up to 300s timeout for Agent 3)
    6. Update report with LLM narrative
    7. Return {report_id}
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

### 3.2 UI Consistency & Implementation Rules

These rules apply to every task that produces or modifies a frontend component. Verify each rule before opening a PR for any task that touches the UI.

---

#### 3.2.1 Navigation — Flows and Back Links

Every page in a sequential flow must show the user's current position (step indicator or breadcrumb). **The Landing Page is the main URL sent to the prospect and has no back navigation — it is the entry point.** Every other page in the prospect flow must provide a back link to the immediately preceding page. Forward navigation is always driven by a user action (button click, card selection) — never by the browser forward button.

**Prospect flow navigation:**

| Page | Back navigation | Forward navigation (action) |
|---|---|---|
| LandingPage | None — this is the main URL (entry point) | "Begin Assessment" → ResearchingPage |
| ResearchingPage | "← Back" → LandingPage | Auto-advances to ResearchSummaryPage once research is ready |
| ResearchSummaryPage | "← Back" → LandingPage | "Select Assessment →" → PillarSelectPage |
| PillarSelectPage | "← Back" → ResearchSummaryPage | Select a pillar card → (calls select-pillar + confirm-research) → AssessmentPage |
| AssessmentPage | "← Back" → PillarSelectPage (abandons in-progress assessment); prev/next between questions | "Submit" on last question → SubmittingPage |
| SubmittingPage | "← Back" → AssessmentPage (does not cancel an in-flight submit request) | Navigates directly to ReportPage once the synchronous submit call responds |
| ReportPage | "← Back" → PillarSelectPage | "Take another pillar" → PillarSelectPage |

**Internal user flow navigation:**

| Page | Back navigation | Forward navigation (action) |
|---|---|---|
| AccountsListPage | None — root page | Account row → AccountDetailPage |
| AccountDetailPage | "← Back to accounts" | Prospect row → ProspectDetailPage |
| ProspectDetailPage | "← Back to account" | Assessment row → ReportDetailPage |
| ReportDetailPage | "← Back to prospect" | None |

The Admin panel uses standard CRUD navigation; breadcrumbs required on all non-list views.

---

#### 3.2.2 Session-Persistent Form State

When a user navigates between pages using the back and forward navigation defined in Section 3.2.1, all previously entered form values on each page must still be populated exactly as left. This applies for the entire duration of the browser session.

Examples:
- Prospect fills in name, email, role, and optional context on LandingPage → proceeds forward → clicks "← Back" → all LandingPage fields are still populated
- Prospect answers questions 1–5 on AssessmentPage → clicks "← Prev" to review question 3 → question 3 shows their previously selected answer

**Implementation requirement:** Form state must persist via `sessionStorage` for the duration of the browser session. Never rely on component-local state alone — components unmount on navigation and local state is lost. Session data clears when the browser tab closes.

Fields that must be persisted per page:

| Page | Fields to persist |
|---|---|
| LandingPage | `prospect_name`, `prospect_email`, `prospect_role`, `p3_gate_answered_yes`, `p4_gate_answered_yes`, `infrastructure_location`, `tech_stack_description`, `current_tools`, `key_challenges_input` |
| ResearchSummaryPage | `prospect_additional_notes` |
| AssessmentPage | Selected answer option per question, keyed `question_id → answer_option_id` |

---

#### 3.2.3 Button and Link Color — Blue Throughout

All interactive elements use blue. This must be consistent across all pages in all three user flows (prospect, internal user, admin).

| Element | Light mode | Dark mode |
|---|---|---|
| Primary action button | `bg-blue-600 hover:bg-blue-700 text-white` | `dark:bg-blue-500 dark:hover:bg-blue-600` |
| Navigation link / back link | `text-blue-600 hover:text-blue-700 underline-offset-2` | `dark:text-blue-400 dark:hover:text-blue-300` |
| Ghost / outline button | `border border-blue-600 text-blue-600 hover:bg-blue-50` | `dark:border-blue-400 dark:text-blue-400 dark:hover:bg-blue-950` |
| Disabled button | `bg-gray-300 text-gray-500 cursor-not-allowed` | `dark:bg-gray-600 dark:text-gray-400` |
| **Destructive action only** | `bg-red-600 hover:bg-red-700 text-white` | `dark:bg-red-500 dark:hover:bg-red-600` |

Red is the only exception — Admin panel destructive actions (delete/remove) only.

---

#### 3.2.4 Dark Mode — No Black Text

`text-black` and hardcoded `#000000` are forbidden in all component files — they are invisible in dark mode. Every text element must use the paired light/dark pattern:

| Usage | Required classes |
|---|---|
| Primary body text | `text-gray-900 dark:text-white` |
| Secondary / muted text | `text-gray-600 dark:text-gray-400` |
| Placeholder text | `placeholder-gray-400 dark:placeholder-gray-500` |
| Page background | `bg-white dark:bg-gray-900` |
| Card / panel background | `bg-gray-50 dark:bg-gray-800` |
| Border | `border-gray-200 dark:border-gray-700` |

The class `dark:text-black` is explicitly forbidden.

---

#### 3.2.5 Prospect Flow Isolation

Pages under the `/assess/:token/*` route prefix must **never** contain a link, button, or redirect to `/login`, `/admin`, `/dashboard`, or any non-prospect route.

- Prospect page headers contain only assessment branding (logo, company name, assessment title) — no authentication links
- On session expiry within the prospect flow: show an inline error message, never redirect to `/login`
- Applies to all seven prospect pages: LandingPage, ResearchingPage, ResearchSummaryPage, PillarSelectPage, AssessmentPage, SubmittingPage, ReportPage

---

### 3.3 Prospect Flow — Page Specifications

**Landing Page (`/assess/:token`)**
- Company name displayed prominently (pulled from account via token)
- Heading: "Maturity Assessment" + brief one-paragraph explanation
- Form fields: First Name, Last Name, Email, Role (dropdown from persona enum)
- If `GET /assess/{token}` returns `is_registered: true`, pre-populate all fields (including optional context) from the response so the prospect can review/continue rather than re-enter everything
- Gate questions rendered below the role field, one per gated pillar that is `is_active=TRUE`:
  - P3 gate: "Is your organization currently building, deploying, or operating AI-powered applications or services?"
  - P4 gate: "Is your organization currently training, fine-tuning, or managing machine learning or foundation models in-house?"
  - Each gate question: yes/no radio buttons, only shown if the corresponding gated pillar is active
- **Optional context section** (collapsible, labeled "Help us personalize your assessment (optional)"):
  - Infrastructure & deployment (textarea): placeholder "e.g. AWS us-east-1, on-premises database, GCP for ML workloads"
  - Tech stack (textarea): placeholder "e.g. Python microservices, Kubernetes, PostgreSQL, Redis, Kafka"
  - Current tools (textarea): placeholder "e.g. Datadog, PagerDuty, GitHub Actions, Terraform"
  - Key challenges (textarea): placeholder "e.g. reducing alert noise across 300+ microservices, managing GPU costs for real-time inference" — label: "What are your biggest technology or operational challenges?"
  - Helper text beneath the section: "The more context you provide, the more relevant your questions and report will be"
- Primary CTA: "Begin Assessment"
- On submit: POST `/register` (including optional context fields, which triggers Agent 1 in the background), store session_token in sessionStorage, navigate to **ResearchingPage**
- Note: Email field is pre-populated (read-only) from the prospect record — the prospect cannot change it

**Researching Page (`/assess/:token/researching`)**
- Shows a back link ("← Back" → LandingPage)
- Full-page centered spinner + "Researching your company…"
- Polls `GET /research-summary` every 3 seconds
- On `is_ready: true`, automatically navigates to ResearchSummaryPage
- After 60s of polling, proceeds automatically even with an empty/partial profile (never blocks the prospect indefinitely)

**Research Summary Page (`/assess/:token/research`)**
- Shown immediately after registration, before pillar selection (prospect cannot skip this step)
- **Profile display:**
  - **Company overview:** products_summary, industry badge, company_size badge, target_customers
  - **Infrastructure & cloud:** cloud_providers (tag chips), operational_scale (bullet list)
  - **Key challenges:** bullet list from key_challenges[]
  - **Business outcomes:** bullet list from business_outcomes[]
  - **Recent news & signals:** news_insights (prose)
  - **Observability recommendations:** observability_outcome (prose)
  - **Sources** (collapsible, closed by default): list of {title, url} from sources[]
  - **Data confidence badge:** "High" (green) / "Medium" (yellow) / "Low" (grey)
  - research_notes shown as a small caption beneath the profile, if non-empty
- **Additional notes section** (collapsible, closed by default):
  - Label: "Something look off? Add notes or additional context"
  - Textarea: `prospect_additional_notes`
  - Saved via `PUT /research-additional-notes` as the prospect types (debounced) — not held only in session state
  - Helper text: "Your notes will be used to personalise your questions and final report"
- Primary CTA: "Select Assessment →"
- On confirm: navigates to PillarSelectPage (this page does not call `/confirm-research` — that happens on PillarSelectPage, immediately after a pillar is chosen)
- **Failure state** (if Agent 1 timed out or found little public information):
  - Show "We couldn't find much about [company name] — your assessment will proceed with the context you provided"
  - CTA still proceeds

**Pillar Selection Page (`/assess/:token/pillars`)**
- 2-column card grid of available pillars
- Each card: pillar name, 1-sentence description, "~8 minutes" time estimate
- Suggested pillars (from `prospect.suggested_pillars`): highlighted with "Recommended" badge
- P3 card: hidden if P3 gate answered No
- P4 card: hidden if P4 gate answered No OR if P4 `is_active = FALSE`
- Already-completed pillars: disabled card, shows score badge and "Completed" label
- Each card CTA: "Start Assessment"
- On click: POST `/select-pillar` (creates or reuses the assessment, starts Agent 2 in background) immediately followed by POST `/confirm-research` with `{assessment_id, additional_notes?}` — copies the prospect's additional notes onto the assessment and waits for Agent 2 to complete. Show an inline loading state on the card/page while this resolves. Once questions are returned, navigate to AssessmentPage with the questions already loaded

**Assessment Page (`/assess/:token/assessment/:assessmentId`)**
- Progress bar at top: "Question 4 of {question_count}" (dynamic — reflects pillar.question_count)
- One question displayed at a time — no scrolling through all questions
- Question text as heading, 4 radio button options below (ordered 1→4 by maturity level)
- "Back" and "Next" navigation buttons
- "Submit" button appears only on the last question (replaces "Next")
- No ability to skip questions — "Next" disabled until a radio option is selected
- All answers persisted via sessionStorage until Submit — not saved to DB until submission
- On submit: navigate to **SubmittingPage**, which makes the (synchronous, up to 300s) `POST /submit` call

**Submitting Page (`/assess/:token/submitting/:assessmentId`)**
- Shows a back link ("← Back" → AssessmentPage) — note: navigating back does not cancel an in-flight submit request
- Full-page centered loading indicator while the synchronous `POST /submit` call resolves (submit pipeline: Agent 3 + scoring + report generation; can take 15–45 seconds, up to a 300-second timeout)
- Rotating descriptive messages:
  1. "Analyzing your responses…"
  2. "Building your maturity profile…"
  3. "Generating your report…"
- On response, navigates directly to ReportPage with the returned `report_id`

**Report Page (`/assess/:token/report/:assessmentId`)**

The page is organized into **four tabs**: Report, Questions & Answers, Research Summary, Registration Context. "Report" is the default active tab. Footer actions ("Download PDF", "Take Another Pillar Assessment", "Back to Pillar Selection") are always visible below the tabs, regardless of which tab is active.

**Header (above the tabs, always visible):** Company name, pillar name, maturity level badge (color-coded by level), score (e.g., "2.7 / 4.0")

If the executive summary and strengths are both still empty (report narrative not yet generated), a banner is shown above the tabs: "Report narrative is still being generated. Please refresh in a moment or contact your administrator if this persists."

**"Report" tab (default active):**
1. Executive Summary — LLM-generated narrative paragraphs, rendered as prose; shown only if non-empty
2. Score chart — Recharts RadarChart showing pillar score; if pillar_breakdown JSONB contains sub-areas, show each sub-area as a radar axis
3. Strengths — card grid (2 columns), each card shows title + description with a checkmark icon; shown only if non-empty
4. Gap Analysis — table with columns: Gap, Current State, Target State, Impact (badge), Effort (badge). Ordered by impact (high first); shown only if non-empty
5. Recommended Next Steps — cards grouped by priority. Quick Wins first, then Strategic, then Foundational. Each card shows title, description, timeframe badge; shown only if non-empty

**"Questions & Answers" tab:**
Table of every answered question for this assessment: Question Text | Selected Answer | Maturity Level badge (L1–L4). Shows "No answers recorded." if empty.

**"Research Summary" tab:**
Shows the company research profile Agent 1 produced and Agent 3 reasoned from, as a read-only reference alongside the prospect's own report. Fields shown, each conditionally rendered only when present:
- Industry
- Company Size
- Data Confidence badge — color-coded: High = green, Medium = yellow, Low = grey
- Products/Summary
- Target Customers (hidden if value is `"unknown"`)
- Operational Scale
- Cloud Providers (chip pills)
- Key Challenges (bullet list)
- Business Outcomes (bullet list)
- News & Context (`news_insights`, prose)
- Observability Recommendations (`observability_outcome`, prose)
- Sources (collapsible, closed by default): list of {title, url} from `sources[]`

If no research data is available for this report, shows "No research data available."

Note: `builds_ai_products` is intentionally **not** shown on this prospect-facing tab — see the internal Report Detail spec below, where it does appear.

**"Registration Context" tab:**
Shows whichever of the following prospect-submitted fields are non-empty, one card each: Infrastructure & Deployment (`infrastructure_location`), Tech Stack (`tech_stack_description`), Current Tools (`current_tools`), Key Challenges — Self-reported (`key_challenges_input`), Additional Notes (`prospect_additional_notes`). If all are empty, shows "No registration context provided."

PDF download:
- Captures the report DOM element client-side (the "Report" tab content — not the other tabs)
- No backend dependency
- File name: `{company_name}-{pillar_name}-maturity-report.pdf`

"Take Another Pillar Assessment":
- Navigates back to pillar selection page (`/assess/:token/pillars`)
- Completed pillar shown as disabled on return

### 3.4 Internal User Dashboard — Page Specifications

**Accounts List (`/dashboard`)**
- Table columns: Company Name, Website, Prospects (total), Prospects Registered, Date Created, Actions
- "New Account" button → opens modal with fields: Company Name (required), Website (optional)
- Click row → navigate to Account Detail page

**Account Detail (`/dashboard/accounts/:id`)**

Account header section:
- Company name, website (linked), date created, created by (internal user name)

**Prospects section** (primary view):
- Table of prospects under this account:
```
Email                 | Name          | Registered | Pillars Done | Actions
jane@acme.com         | Jane Smith    | ✅ Yes      | 2 / 5        | [View] [Copy URL]
john@acme.com         | —             | ⏳ Pending  | 0 / 5        | [View] [Copy URL]
```
- "Create Prospect" button → opens inline form:
  - Company: {account.company_name} (read-only, shown for context)
  - Email (required): the prospect's email address
  - Suggested Pillars (optional multi-select from active pillars): pre-selected pillars shown with "Recommended" badge on the prospect's pillar menu
  - On submit: `POST /api/accounts/{id}/prospects` → displays generated URL with copy-to-clipboard
  - Error: 409 shown inline if email already exists under this account
- Click prospect row → Prospect Detail page

**Prospect Detail (`/dashboard/accounts/:id/prospects/:prospectId`)**
- Prospect header: email, name (if registered), registration status, date created
- Pillar status grid (all active pillars shown):
```
Pillar Name      | Score    | Status        | Action
P1 Observability | 2.4 / 4  | ✅ Complete    | [View Report]
P2 AIOps         | —        | ⏳ In Progress | —
P3 AI Apps       | —        | 📋 Not Started | —
P4 ML & Models   | —        | 🔒 Inactive    | [Admin Only]
P5 Security      | —        | 📋 Not Started | —
```
- "Aggregate View" tab: visible only when 2+ assessments completed for this prospect; radar chart of completed pillar scores; summary table: pillar name, score, maturity label

**Report Detail (`/dashboard/assessments/:id`)**

Same four tabs as the prospect-facing Report Page — Report, Questions & Answers, Research Summary, Registration Context — plus a header card above the tabs showing prospect name, role, email, and completion date.

"Report" tab:
- Identical report content to the prospect-facing "Report" tab (Executive Summary, Score chart, Strengths, Gap Analysis, Next Steps), read-only
- If the report has not yet been generated, shows "Report not yet generated."
- If the report failed to load (non-404 error), shows an inline error: "The report failed to load. Please try again or contact support if this persists."

"Questions & Answers" tab:
- Table: Question Text | Selected Answer | Maturity Level (1–4)
- One row per question answered (pillar.question_count rows total)

"Research Summary" tab:
- Same fields as the prospect page's Research Summary tab (industry, company size, data_confidence badge — color-coded High=green/Medium=yellow/Low=grey, products_summary, target_customers, operational_scale, cloud_providers, key_challenges, business_outcomes, news_insights, observability_outcome, sources)
- Plus **Builds AI Products** (Yes/No, from `builds_ai_products`) — shown here only; intentionally not shown on the prospect-facing tab

"Registration Context" tab:
- Same content and empty-state behavior as the prospect page's Registration Context tab

### 3.5 Admin Panel — Page Specifications

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
