---
title: Domain Model — Personas, User Roles & Pillar Definitions
version: 1.0
last_updated: 2026-06-27
---

# Domain Model — Personas, User Roles & Pillar Definitions

> **When to load this file:** Any task that touches user roles, persona logic, permission enforcement, or pillar definitions. See `00-index.md` Agent Context Map for the full list.

---

## 1. USER ROLES & PERMISSIONS

### 1.1 Role Matrix

| Action | Prospect (unauthenticated) | Internal User (JWT) | Admin (JWT) |
|--------|---------------------------|---------------------|-------------|
| Access assessment via short URL | ✅ | — | — |
| Submit assessment answers | ✅ | — | — |
| View own report on screen | ✅ | — | — |
| Download own report as PDF | ✅ | — | — |
| Create accounts | — | ✅ | ✅ |
| Generate short URLs | — | ✅ | ✅ |
| View own accounts + assessments | — | ✅ | — |
| View raw answers for own assessments | — | ✅ | — |
| View all accounts + assessments | — | — | ✅ |
| CRUD pillars | — | — | ✅ |
| CRUD questions | — | — | ✅ |
| CRUD internal users | — | — | ✅ |

**Critical constraint:** An internal user query for accounts, assessments, or reports MUST filter by `accounts.internal_user_id = current_user.id`. This is enforced at the service layer, not just the route layer.

---

### 1.2 Persona Enum (Prospect Role)

When a prospect enters their role, they select from this fixed list. The selection determines which questions they receive.

```
cto_executive          → CTO, CEO, C-Suite
vp_engineering         → VP Engineering, Director of Engineering, Head of Engineering
ciso_vp_security       → CISO, VP Security, Head of Security
sre_platform_engineer  → SRE, Platform Engineer, Infrastructure Engineer
devops_engineer        → DevOps Engineer, Site Reliability, Cloud Engineer
ml_ai_engineer         → ML Engineer, AI Engineer, Data Scientist, MLOps Engineer
security_engineer      → Security Engineer, AppSec, Security Analyst
software_developer     → Software Developer, Software Engineer, Full Stack Developer
```

---

### 1.3 Persona → Pillar Relevance

Not all personas carry equal weight across all pillars. This is reflected in `question_personas.persona_weight` in the data model. The table below is a guide for content and scoring interpretation — it is not enforced as a hard filter in the UI. All personas may take any non-gated pillar.

| Persona | P1: Observability | P2: AIOps | P3: AI Systems | P5: Security |
|---|---|---|---|---|
| CTO / C-Suite | Strategic | Strategic | Strategic | Strategic |
| VP Engineering | Deep | Deep | Moderate | Moderate |
| CISO / VP Security | Light | — | — | Deep |
| SRE / Platform Eng | Deep | Deep | Light | Moderate |
| DevOps Engineer | Deep | Moderate | Light | Moderate |
| ML / AI Engineer | Light | Moderate | Deep | — |
| Security Engineer | Light | — | — | Deep |
| Software Developer | Moderate | Light | Moderate | Light |

---

## 2. PILLAR DEFINITIONS

All four pillars below are in scope for MVP. Pillar 4 (ML & Foundation Model Operations) is Phase 2 and must not be built in MVP.

Adding a new pillar requires only a new row in the `pillars` database table and questions in the `questions` table. No code changes are required. This is a hard architectural constraint.

---

### P1: Full-Stack Observability

**Narrative:** "Can you see everything?"

**Covers:** Infrastructure monitoring, APM, log management, Real User Monitoring (RUM), Synthetic monitoring, SRE practices (SLOs, error budgets), Platform Engineering, CI/CD, DORA metrics

**Is Gated:** No

**Overall Weight:** 1.0

**Display Order:** 1

---

### P2: AIOps & Intelligent Observability

**Narrative:** "Are you using AI to make observability easier?"

**Covers:** AI-powered alerting, anomaly detection, automated root cause analysis, alert noise reduction, AI-assisted incident investigation, proactive incident prevention

**Is Gated:** No

**Overall Weight:** 0.9

**Display Order:** 2

---

### P3: AI System Observability

**Narrative:** "Can you observe the AI you're building?"

**Covers:** LLM/Agent observability, LLMOps, prompt tracing, token cost tracking, quality evaluation, drift detection, AI governance

**Is Gated:** Yes

**Gate Question:** "Is your organization currently building, deploying, or operating AI-powered applications or services (e.g., LLM applications, AI agents, RAG pipelines)?"

**Gate Logic:** If the prospect answers "No" to the gate question, do not show P3 in the pillar menu. Suggest P1, P2, or P5 instead. The gate question is asked once on the landing page before the pillar menu is shown.

**Overall Weight:** 0.85

**Display Order:** 3

---

### P5: Security & DevSecOps

**Narrative:** "Is security built in, or bolted on?"

**Covers:** SAST, DAST, SCA, IaC security, runtime workload protection, CSPM, Cloud SIEM, application and API protection, secrets management, compliance

**Is Gated:** No

**Overall Weight:** 1.0

**Display Order:** 4

---

## 3. MATURITY LEVEL DEFINITIONS

| Level | Label | Description |
|-------|-------|-------------|
| 1 | Reactive | Ad-hoc, manual processes. No formal tooling or strategy. Firefighting is the norm. |
| 2 | Developing | Some tooling and processes in place, but inconsistent. Siloed adoption, limited visibility. |
| 3 | Defined | Standardized practices with broad adoption. Automation present, teams aligned on workflows. |
| 4 | Optimized | Data-driven, AI-augmented operations. Continuous improvement loops. Platform thinking. |

These labels are used throughout the application: in answer options, in report generation, in dashboard badges, and in the scoring output. Use exactly these strings — no variations.
