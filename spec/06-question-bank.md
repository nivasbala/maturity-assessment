---
title: Question Bank — Seed Data
version: 1.4
last_updated: 2026-06-28
---

# Question Bank — Seed Data

> **When to load this file:** Task 4 (seed data) and Task 7 (prospect landing flow). Do not load for any other task. P4 questions are included here but P4 is seeded with `is_active = FALSE` — seed them regardless, the pillar will not appear to prospects until activated via the admin panel.

---

## 1. QUESTION SELECTION — HOW IT WORKS

Question selection is performed by **Agent 2 (Question Selection Agent)** — an LLM that selects the 12 most diagnostic questions for this prospect and company. See `05-architecture-api.md` Section 1.3 for the full agent specification.

### What Agent 2 receives from the DB

For a given pillar + persona, the service fetches:
- All **general questions** (`is_general = TRUE`, `is_active = TRUE`) — Agent 2 MUST include all of these
- All **persona-eligible questions** for this role (via `question_personas`, `is_active = TRUE`)
- Each question carries: `id`, `text`, `is_general`, `question_weight`, `context_tags`

### What Agent 2 decides

Agent 2 uses the research cache (from Agent 1) + the prospect's persona to select the most diagnostic questions up to `pillar.question_count`:
- When research is available: Agent 2 prioritizes questions whose `context_tags` match the company's technology stack, cloud providers, industry, and business outcomes
- When research is empty: Agent 2 selects based on what matters most to this persona in this pillar
- Result: exactly `pillar.question_count` question IDs in presentation order

### Fallback (if Agent 2 fails)

If Agent 2 raises an exception, times out, or returns invalid output, the service falls back to:
1. All general questions (target: 4)
2. First `(question_count − general_count)` persona-eligible questions by `display_order`
3. Backfill from general pool if persona pool < 8

The assessment always proceeds — Agent 2 is an enhancement, not a dependency. All questions must be `is_active = TRUE`.

---

## 2. SEED DATA FORMAT

Each question entry specifies:
- `weight` → `question_weight` value (1.0 | 1.5 | 2.0)
- `general` → `is_general` (true/false)
- `personas` → list of persona enum values for `question_personas` rows
- `persona_weight` → applied to all listed personas uniformly (unless noted per-persona)
- `context_tags` → optional list of lowercase technology signal strings used for research-informed selection (e.g. `["kubernetes", "aws", "microservices"]`). Omit for questions with no technology specificity.
- Answer options listed in maturity order (1=Reactive → 4=Optimized)

---

## 3. P1: FULL-STACK OBSERVABILITY

### General Questions (is_general = TRUE)

```
Q1 | weight: 1.5 | general: true
Text: How would you describe your organization's current approach to monitoring production systems?
Options:
  1 (Reactive)   → We react to issues only when customers or operations report them
  2 (Developing) → We have basic uptime monitoring and some manual dashboards
  3 (Defined)    → We collect metrics, logs, and traces and can correlate issues across services
  4 (Optimized)  → Unified, proactive observability with automatic anomaly detection and full-stack visibility

Q2 | weight: 1.0 | general: true
Text: What percentage of your production services have any form of monitoring today?
Options:
  1 → Less than 25%
  2 → 25–50%
  3 → 50–80%
  4 → More than 80% with standardized monitoring across all environments

Q3 | weight: 1.5 | general: true
Text: How does your team currently get notified about production incidents?
Options:
  1 → Customers tell us, or we notice manually
  2 → Basic threshold alerts via email or Slack
  3 → Alerting with on-call rotation and runbooks, but still high noise
  4 → Intelligent alerting with noise reduction, on-call routing, and automated runbooks

Q4 | weight: 1.0 | general: true
Text: How are your infrastructure, application, and user experience monitoring tools managed?
Options:
  1 → Each team uses different tools with no central view
  2 → Some consolidation but still multiple disconnected tools
  3 → Most teams use a shared platform with unified dashboards
  4 → Single observability platform with full-stack correlation from infrastructure to end-user experience
```

### Persona-Specific Questions

```
Q5 | weight: 2.0 | personas: [sre_platform_engineer] | persona_weight: 1.2
Text: Does your organization have defined Service Level Objectives (SLOs)?
Options:
  1 → No SLOs defined internally
  2 → SLOs exist informally or only for a few services
  3 → SLOs defined for major services with error budgets tracked
  4 → SLOs for all critical services with automated error budget burn alerting and reporting

Q6 | weight: 1.5 | personas: [sre_platform_engineer, devops_engineer] | persona_weight: 1.2 | context_tags: ["microservices", "kubernetes", "cloud_native"]
Text: What percentage of your services have distributed tracing implemented end-to-end?
Options:
  1 → 0% — no distributed tracing
  2 → Less than 25% (critical paths only)
  3 → 25–75% of services
  4 → More than 75% with full service dependency mapping

Q7 | weight: 1.5 | personas: [sre_platform_engineer] | persona_weight: 1.2
Text: What is your team's typical Mean Time to Resolve (MTTR) for P1 incidents?
Options:
  1 → More than 4 hours
  2 → 1–4 hours
  3 → 30 minutes to 1 hour
  4 → Less than 30 minutes with AI-assisted investigation

Q8 | weight: 1.0 | personas: [sre_platform_engineer, devops_engineer] | persona_weight: 1.1 | context_tags: ["aws", "gcp", "azure", "terraform", "infrastructure"]
Text: How is your infrastructure currently managed?
Options:
  1 → Manual provisioning with no version control
  2 → Some scripting but infrastructure changes are not consistently tracked
  3 → Infrastructure as Code (Terraform, CloudFormation) for most resources
  4 → Full GitOps with automated drift detection and policy enforcement

Q9 | weight: 1.5 | personas: [devops_engineer] | persona_weight: 1.2 | context_tags: ["ci_cd", "devops", "github", "gitlab"]
Text: How mature is your CI/CD pipeline?
Options:
  1 → Manual deployments with no pipeline
  2 → Basic pipeline for some services, manual steps still required
  3 → Automated CI/CD with deployment gates and test integration
  4 → Full pipeline automation with feature flags, canary deployments, and automated rollbacks

Q10 | weight: 1.0 | personas: [devops_engineer] | persona_weight: 1.1
Text: How do you monitor your CI/CD pipeline health and deployment performance?
Options:
  1 → We don't monitor pipelines
  2 → Basic success/fail notifications
  3 → Pipeline metrics tracked with DORA-style reporting
  4 → Full DORA metrics (deployment frequency, lead time, MTTR, change failure rate) with trend analysis

Q11 | weight: 2.0 | personas: [cto_executive, vp_engineering] | persona_weight: 0.9
Text: How does your organization approach platform engineering and developer self-service?
Options:
  1 → No internal platform — each team provisions its own infrastructure
  2 → Shared scripts and runbooks but no self-service capability
  3 → Internal platform with self-service for common workflows
  4 → Full Internal Developer Platform with golden paths, service catalog, and automated onboarding

Q12 | weight: 1.5 | personas: [cto_executive, vp_engineering] | persona_weight: 0.9
Text: How do you monitor end-user experience in production?
Options:
  1 → We don't actively monitor end-user experience
  2 → Server-side error tracking only
  3 → Real User Monitoring (RUM) for web applications
  4 → Full digital experience monitoring: RUM, Synthetic testing, mobile monitoring, and session replay

Q13 | weight: 1.0 | personas: [software_developer] | persona_weight: 1.0
Text: How does your team instrument application code for observability?
Options:
  1 → No instrumentation — we rely on logs only
  2 → Basic logging with some manual metrics
  3 → Structured logging, custom metrics, and basic APM integration
  4 → Auto-instrumentation with custom spans, business metrics, and distributed context propagation

Q14 | weight: 1.0 | personas: [ml_ai_engineer] | persona_weight: 1.0
Text: How do you monitor AI/ML models in production?
Options:
  1 → We don't monitor models post-deployment
  2 → Basic uptime and error rate monitoring only
  3 → Performance metrics tracked (latency, throughput) but not model quality
  4 → Full model observability: latency, drift, accuracy degradation, and business impact metrics

Q15 | weight: 1.0 | personas: [ciso_vp_security, security_engineer] | persona_weight: 1.0
Text: How is security visibility integrated into your observability platform?
Options:
  1 → Security monitoring is completely separate from operational observability
  2 → Some log correlation between security and ops tools
  3 → Security events visible in the same platform used by engineering
  4 → Unified security and operational observability with correlated threat detection and audit trails
```

### Additional Questions — Q16–Q20: Strategic | Q21–Q25: Tactical

> **Strategic questions** address organizational decisions, investment justification, governance, and business impact. Relevant personas: CTO, VP Engineering.
> **Tactical questions** address day-to-day operations, hands-on debugging, implementation, and real incident scenarios. Relevant personas: SRE, DevOps Engineer, Software Developer.

```
Q16 | weight: 1.5 | strategic | personas: [cto_executive, vp_engineering] | persona_weight: 0.9
Text: Your engineering team has had 3 major customer-impacting outages this quarter. Post-mortems show warning signals existed in monitoring data hours before each incident but went undetected. How does your organization respond to this pattern?
Options:
  1 → We assign accountability per incident and move on — no systemic changes are made to monitoring practices
  2 → We add threshold alerts targeting the specific failure modes identified in the post-mortems
  3 → We commission a structured observability gap analysis and retune alerting based on findings across all three incidents
  4 → We implement proactive anomaly detection on identified risk areas, set MTTR reduction as an engineering OKR, and run quarterly observability maturity reviews with executive sponsorship

Q17 | weight: 1.5 | strategic | personas: [cto_executive, vp_engineering] | persona_weight: 0.9
Text: A product team is about to launch a new microservice that will handle payment transactions for the first time. How does your organization ensure observability readiness before go-live?
Options:
  1 → The team ships first and adds monitoring later if something breaks in production
  2 → Basic uptime checks and error rate alerts are added a day before launch
  3 → We have a pre-launch observability checklist: structured logs, key metrics, distributed tracing, and a runbook reviewed before go-live
  4 → Observability is built into the service template: golden signals, SLO targets, synthetic transaction monitoring, and error budget alerting — all provisioned automatically via our internal platform before the first line of business logic is written

Q18 | weight: 1.5 | strategic | personas: [cto_executive, vp_engineering] | persona_weight: 0.9
Text: How does your organization quantify the business value of observability investments to justify continued platform spend to finance and leadership?
Options:
  1 → Observability is treated as a fixed operational cost — ROI is not quantified
  2 → We point to reduced incident frequency as justification but have no financial model
  3 → We track MTTR trends and on-call engineer hours and use these to estimate cost avoidance quarterly
  4 → We have a formal value model: MTTR reduction × average hourly revenue impact × incident frequency, reviewed quarterly and presented to leadership alongside engineering productivity metrics

Q19 | weight: 2.0 | strategic | personas: [cto_executive, vp_engineering] | persona_weight: 0.9
Text: A major enterprise customer reports degraded performance but your team has zero per-customer observability. How does your organization address both the immediate issue and the underlying architectural blind spot?
Options:
  1 → We manually reproduce the issue and fix it reactively — there is no plan to add customer-level visibility
  2 → We add customer-specific logging for this customer as a targeted one-off fix
  3 → We have partial tenant-level metrics and can filter some dashboards by customer, but coverage is incomplete
  4 → We have full tenant observability: per-customer SLOs, RUM correlated to backend traces, and proactive alerting when specific customers experience degraded experience — built into the multi-tenant architecture

Q20 | weight: 1.0 | strategic | personas: [cto_executive, vp_engineering] | persona_weight: 0.9
Text: Your organization is evaluating consolidating 4 separate monitoring tools into a unified observability platform. What drives the decision and how is it made?
Options:
  1 → Teams use whatever tools they prefer — consolidation hasn't been formally considered
  2 → Engineering managers raise tool sprawl concerns occasionally but no formal evaluation process exists
  3 → We conduct a structured evaluation covering TCO, integration coverage, and developer experience before deciding
  4 → We run a formal RFP with quantitative success criteria: cost, coverage gaps, migration risk, and engineer NPS scores — decided jointly by SRE, platform engineering, and finance with a documented migration plan

Q21 | weight: 1.5 | tactical | personas: [sre_platform_engineer, devops_engineer] | persona_weight: 1.2 | context_tags: ["kubernetes", "microservices"]
Text: A cascading failure is spreading across multiple Kubernetes services during peak traffic. You are paged at 2am. What does your investigation look like in the first 5 minutes?
Options:
  1 → I SSH into individual pods and read logs manually — it takes 20+ minutes to get any picture of what's failing
  2 → I check basic dashboards but struggle to distinguish the root cause service from downstream victims
  3 → I have service dependency maps and structured runbooks — I can usually identify the origin service within 5 minutes
  4 → My observability platform shows correlated spikes across traces, logs, and metrics; automated root cause analysis surfaces the originating service within 2 minutes, and I execute a pre-generated remediation suggestion

Q22 | weight: 1.5 | tactical | personas: [sre_platform_engineer] | persona_weight: 1.2
Text: Your error budget for a critical API is burning at 3× the expected rate this week. What process does your team follow?
Options:
  1 → We don't have error budgets — we wait for services to visibly degrade before acting
  2 → We notice the elevated error rate on dashboards but have no formal response process
  3 → An error budget alert pages on-call; the engineer investigates, opens a ticket, and the team prioritizes it in the next sprint
  4 → We have a tiered burn rate response: 2% and 5% burn rates trigger different escalation paths; a critical burn triggers an immediate deploy freeze and a dedicated investigation war room

Q23 | weight: 1.0 | tactical | personas: [software_developer] | persona_weight: 1.0 | context_tags: ["apm", "tracing"]
Text: You deploy a new feature and 2 hours later notice a 15% increase in p99 latency on the checkout API. How do you diagnose this without an immediate rollback?
Options:
  1 → I roll back immediately — I don't have tools to diagnose further without disrupting users
  2 → I check error logs for obvious exceptions but struggle to isolate the specific cause to my change
  3 → I use APM to trace slow requests and identify which database query or downstream call regressed
  4 → I compare distributed trace profiles before and after my deploy, isolate the specific span that regressed, and fix the root cause without a rollback — completing the investigation in under 15 minutes

Q24 | weight: 1.0 | tactical | personas: [devops_engineer] | persona_weight: 1.1 | context_tags: ["ci_cd", "deployment"]
Text: Your team ships 20 deploys per day. How do you catch a bad deploy before it reaches 100% of users and causes a full incident?
Options:
  1 → We don't — we find out from user reports or the on-call engineer notices error spikes the next morning
  2 → We manually watch error rates after each deploy, but coverage is inconsistent and depends on who is on shift
  3 → Deployment markers in monitoring let us correlate metric changes to specific deploys for faster post-incident diagnosis
  4 → Every deploy triggers automated canary analysis: traffic is split, metrics are compared against baseline, and an auto-rollback fires if error rate or latency exceeds threshold within 10 minutes of deployment

Q25 | weight: 1.0 | tactical | personas: [sre_platform_engineer, devops_engineer] | persona_weight: 1.1 | context_tags: ["infrastructure", "capacity"]
Text: You are asked to plan infrastructure capacity for the next 6 months. What does your observability platform give you to support this decision?
Options:
  1 → We make estimates based on intuition and past incidents — we don't have reliable historical growth data
  2 → We export metric history to spreadsheets and project trends manually in a quarterly exercise
  3 → We have historical trend data and use it to project resource needs with reasonable but imprecise confidence
  4 → Our platform provides ML-based capacity forecasting: projected runway per resource type, cost modeling per growth scenario, and automated alerts when actual growth deviates from the forecast
```

---

## 4. P2: AIOPS & INTELLIGENT OBSERVABILITY

### General Questions (is_general = TRUE)

```
Q1 | weight: 2.0 | general: true
Text: How does your team currently handle alert noise and alert fatigue?
Options:
  1 → We receive a high volume of alerts and triage manually — alert fatigue is a serious problem
  2 → We've manually tuned some thresholds but alert noise is still significant
  3 → Alerts are grouped and prioritized; on-call burden is manageable
  4 → AI/ML-powered alert correlation with automated noise reduction and intelligent grouping

Q2 | weight: 1.5 | general: true
Text: How does your organization detect anomalies in production systems?
Options:
  1 → Manual investigation after an incident is reported
  2 → Static threshold-based alerts only
  3 → Dynamic thresholds with some baseline comparison
  4 → ML-based anomaly detection with automatic root cause analysis and correlated signals

Q3 | weight: 1.0 | general: true
Text: How much of your incident investigation process is automated today?
Options:
  1 → Fully manual — engineers investigate everything from scratch
  2 → We have runbooks but execution is manual
  3 → Some automated diagnostics (log search, metric snapshots) triggered by alerts
  4 → AI-assisted investigation that surfaces probable root cause, impacted services, and suggested remediation automatically

Q4 | weight: 1.5 | general: true
Text: How do you currently correlate events across your infrastructure and applications to identify root cause?
Options:
  1 → We don't — teams investigate in silos using separate tools
  2 → Manual correlation across multiple dashboards during incidents
  3 → Some automated event correlation within our observability platform
  4 → AI-driven unified correlation across metrics, traces, logs, and events with automatic service impact mapping
```

### Persona-Specific Questions

```
Q5 | weight: 2.0 | personas: [sre_platform_engineer] | persona_weight: 1.2 | context_tags: ["aiops", "machine_learning", "ai"]
Text: Does your team use AI or ML-powered features to automatically detect, triage, or resolve incidents?
  1 → No AI/ML in our incident workflows
  2 → We are evaluating or piloting AI tools
  3 → AI tools are used by some teams for specific tasks
  4 → AI-assisted workflows are standard: automatic triage, probable root cause, and suggested remediation are part of every incident

Q6 | weight: 1.5 | personas: [sre_platform_engineer] | persona_weight: 1.2
Text: How are on-call handoffs and incident context documented?
Options:
  1 → Ad-hoc — engineers write notes in chat or nowhere
  2 → Incident tickets created manually with basic information
  3 → Structured incident records with timeline, affected services, and resolution steps
  4 → AI-generated incident summaries with automated postmortem drafts and action item tracking

Q7 | weight: 1.0 | personas: [sre_platform_engineer, devops_engineer] | persona_weight: 1.1
Text: How do you use historical incident data to prevent future incidents?
Options:
  1 → We don't systematically use historical data
  2 → Manual postmortems, but insights rarely feed back into monitoring improvements
  3 → Postmortem action items are tracked and some monitoring improvements result
  4 → AI analysis of historical incidents drives proactive monitoring and automated remediation playbooks

Q8 | weight: 1.5 | personas: [cto_executive, vp_engineering] | persona_weight: 0.9
Text: How does your organization measure the business impact of observability investments?
Options:
  1 → We don't measure ROI on observability
  2 → Anecdotal feedback from engineering teams only
  3 → MTTR and incident frequency are tracked and improving
  4 → Full business impact measurement: MTTR, change failure rate, customer impact hours, and revenue impact correlated with observability maturity

Q9 | weight: 1.0 | personas: [cto_executive, vp_engineering] | persona_weight: 0.9
Text: To what extent does your organization use AIOps to proactively prevent incidents before they occur?
Options:
  1 → We don't use AI for proactive monitoring
  2 → Basic capacity planning using historical metrics
  3 → Predictive alerting for known patterns (traffic spikes, disk fill)
  4 → AI-powered proactive incident prevention with forecasting, anomaly prediction, and automated remediation

Q10 | weight: 1.0 | personas: [devops_engineer] | persona_weight: 1.1
Text: How does your deployment pipeline integrate with your observability platform?
Options:
  1 → No integration — deployments and monitoring are completely separate
  2 → Deployment events are manually correlated with monitoring during incidents
  3 → Deployment markers are visible in monitoring dashboards for correlation
  4 → Full deployment intelligence: automated canary analysis, deployment-correlated anomaly detection, and automatic rollback triggers

Q11 | weight: 1.0 | personas: [software_developer] | persona_weight: 1.0
Text: Have you used AI-powered tools to help debug or diagnose production issues?
Options:
  1 → Never — we debug manually using logs and dashboards
  2 → Occasionally, but not as a standard practice
  3 → AI debugging tools are available and used by most engineers
  4 → AI-assisted debugging is standard: natural language log search, AI-suggested fixes, and code-correlated tracing

Q12 | weight: 1.5 | personas: [ml_ai_engineer] | persona_weight: 1.1
Text: How does your team use ML to optimize your observability data pipeline (log parsing, intelligent sampling)?
Options:
  1 → We don't use ML in our observability data pipeline
  2 → Basic automated log parsing only
  3 → Intelligent sampling and dynamic retention policies in place
  4 → Full ML-driven pipeline: adaptive sampling, intelligent log pattern extraction, and cost-optimized data retention
```

### Additional Questions — Q13–Q18: Strategic | Q19–Q25: Tactical

> **Strategic questions** address AIOps investment decisions, organizational readiness, and measurable business outcomes.
> **Tactical questions** address real incident investigation, alert quality improvement, and hands-on operational scenarios.

```
Q13 | weight: 2.0 | strategic | personas: [cto_executive, vp_engineering] | persona_weight: 0.9
Text: Your on-call engineers are receiving 200+ alerts per week and fewer than 15% require any action. Burnout is rising and attrition is a risk. An executive gives you one quarter to fix this. How do you approach it?
Options:
  1 → We ask engineers to manually tune thresholds — this has been tried before and the noise returns within weeks
  2 → We buy an alert suppression tool that deduplicates obviously related alerts without changing the underlying signal
  3 → We run an alert audit: identify the top 20 noisiest alerts, retune them, and add correlation rules for known related symptoms
  4 → We implement ML-based anomaly detection with dynamic baselines and intelligent grouping, targeting a 70% reduction in actionable alert volume within 90 days — measured by on-call ticket volume with a defined weekly tracking metric

Q14 | weight: 1.5 | strategic | personas: [cto_executive, vp_engineering] | persona_weight: 0.9
Text: Your CTO asks you to demonstrate that your AIOps investment is actively reducing operational risk — not just generating dashboards. What evidence can you present?
Options:
  1 → I can show we have dashboards but cannot quantify what risk they have actually prevented
  2 → I can show MTTR has improved year-over-year, though the connection to specific AIOps investments is unclear
  3 → I have a quarterly observability report with MTTR, MTTD, and change failure rate trends tied to specific platform improvements
  4 → I present an AI-assisted risk dashboard: predicted failure probability by service, near-misses caught proactively in the last 90 days, and a financial model linking MTTR reduction to avoided revenue loss with quarterly trends

Q15 | weight: 1.5 | strategic | personas: [cto_executive, vp_engineering] | persona_weight: 0.9
Text: A new VP of Engineering joins and asks what AI is doing to reduce engineering operational toil. How do you respond and what can you demonstrate live in that first meeting?
Options:
  1 → We acknowledge the gap and have no concrete initiatives to show
  2 → We've evaluated some AIOps tools but haven't made a commitment or deployment yet
  3 → We have AI-powered alerting and anomaly detection in production — I can walk through alert reduction metrics
  4 → I demonstrate a live AIOps system: correlated alert clusters, auto-generated incident summaries, a dashboard showing proactively-detected incidents versus reactively-discovered ones, and a time-to-detect improvement trend compared with the prior year

Q16 | weight: 1.5 | strategic | personas: [cto_executive] | persona_weight: 0.9
Text: After a major outage that cost $2M in lost revenue, the board asks what engineering is doing with AI to prevent a recurrence. How do you respond?
Options:
  1 → We have better monitoring now but cannot show a direct link between current tooling and preventing that specific failure class
  2 → We implemented better alerting after the incident and have not had a recurrence in the months since
  3 → We retroactively tested our current detection against historical data and showed it would have caught precursor signals 45 minutes earlier
  4 → We have a proactive incident prevention program: AI-based precursor pattern detection trained on historical incidents, tested quarterly against past outages, with documented evidence showing it would have prevented the $2M event — tracked and reported to the board quarterly

Q17 | weight: 1.0 | strategic | personas: [cto_executive, vp_engineering] | persona_weight: 0.9
Text: You are choosing between two observability vendors — one with proven rule-based alerting and one with AI/ML anomaly detection at significantly higher cost. How does your organization make this decision?
Options:
  1 → We choose the lower-cost option — we don't have a framework to evaluate AI observability ROI
  2 → We evaluate based on feature lists and pricing comparisons alone
  3 → We run a proof of concept and compare false positive rates and on-call engineer satisfaction before deciding
  4 → We run a structured PoC with quantitative success criteria: false positive rate, MTTD measured against replayed historical incidents, engineer satisfaction score, and 3-year TCO — with a documented recommendation presented to leadership

Q18 | weight: 1.0 | strategic | personas: [vp_engineering] | persona_weight: 0.9
Text: Your engineering organization spans 3 time zones. Incident handoffs between on-call rotations regularly lose context, causing duplicate investigation steps and extended MTTR. How does AIOps address this?
Options:
  1 → We accept this as an unavoidable cost of distributed teams — engineers just need to read the Slack backlog
  2 → We have an incident template that outgoing on-call engineers are supposed to fill in, but compliance is inconsistent
  3 → We use a shared incident timeline tool where all findings are logged and the incoming engineer reads before taking over
  4 → Our AIOps system generates automatic incident summaries at handoff time: current status, investigation steps taken, top root cause hypotheses, and suggested next actions — reducing handoff ramp-up time by 80% on average

Q19 | weight: 1.5 | tactical | personas: [sre_platform_engineer] | persona_weight: 1.2
Text: You are paged at 3am with an alert: "anomaly detected on payment-service." No context is included. What does your investigation look like?
Options:
  1 → I log into multiple dashboards one by one to build a picture — this typically takes 20–30 minutes
  2 → I check the alert's linked metric and try to determine severity from the raw numbers — usually 10–15 minutes
  3 → The alert links to correlated metrics and a runbook — I can assess severity and next steps within 5 minutes
  4 → The alert includes AI-generated context: probable root cause, impacted downstream services, similar past incidents with resolution time, and a suggested first action — I make a go/no-go escalation decision within 90 seconds

Q20 | weight: 1.5 | tactical | personas: [sre_platform_engineer, devops_engineer] | persona_weight: 1.1
Text: Your team is tasked with reducing mean time to detect (MTTD) for production issues from 45 minutes to under 10 minutes. What approach do you take?
Options:
  1 → We add more sensitive alerts — this has historically just increased false positives and made alert fatigue worse
  2 → We lower all static thresholds across the board, accepting higher noise volume as a necessary trade-off
  3 → We implement dynamic baseline alerting so anomalies are detected relative to each service's normal behavior pattern
  4 → We deploy ML-based anomaly detection on golden signals for all critical services, validate against 90 days of historical incidents to tune sensitivity, and track MTTD weekly — hitting the 10-minute target within 6 weeks

Q21 | weight: 1.0 | tactical | personas: [devops_engineer] | persona_weight: 1.1 | context_tags: ["ci_cd", "deployment"]
Text: A deployment caused a latency spike that went undetected for 3 hours and breached an SLA. How would you use AIOps capabilities to prevent this class of problem in future?
Options:
  1 → I would add a manual post-deploy check — but with 20 deploys per day this is not sustainable
  2 → I would add a latency alert with a tighter threshold and a 30-minute post-deploy monitoring window
  3 → I would implement automated canary analysis comparing key metrics against a dynamic pre-deploy baseline
  4 → I would configure deployment-correlated anomaly detection: the AI baseline resets relative to pre-deploy state, flags statistical deviations within minutes, and triggers automated rollback if deviation exceeds a configured confidence threshold

Q22 | weight: 1.5 | tactical | personas: [sre_platform_engineer] | persona_weight: 1.2
Text: During a Black Friday traffic surge, you need to distinguish expected load-related slowdown from an actual incident requiring response. How does your tooling help you make that judgment call accurately?
Options:
  1 → We rely on engineer experience and gut feel — we regularly declare false incidents or miss real ones during high traffic
  2 → We have capacity planning docs showing expected performance at load levels — we compare them manually during the event
  3 → Our alerting uses traffic-correlated baselines that suppress alerts for expected behavior during high-traffic windows
  4 → Our AIOps system auto-adjusts anomaly thresholds during high-traffic events, correlates per-service load against pre-modeled capacity curves, and pages only for statistically significant deviations — reducing false incident declarations by 80% during surge events

Q23 | weight: 1.0 | tactical | personas: [software_developer] | persona_weight: 1.0
Text: You suspect a gradual memory leak is slowly degrading your service's performance over weeks. The pattern is invisible on any single dashboard view. How do you investigate it?
Options:
  1 → I restart the service on a schedule as a workaround and accept I cannot find the root cause
  2 → I export memory metrics to a spreadsheet and look for trends manually across deployment dates
  3 → I use our observability platform to chart memory usage over time and correlate spikes with deployment events
  4 → I query our AI observability assistant for a 30-day analysis of memory, GC, and heap metrics — it surfaces the trend, correlates it to a specific deployment via profiling data, and identifies the responsible code path

Q24 | weight: 1.0 | tactical | personas: [devops_engineer, sre_platform_engineer] | persona_weight: 1.1
Text: Your team receives 150 alerts per week. How do you systematically measure and improve alert quality over time rather than just reacting to the loudest complaints?
Options:
  1 → We don't measure it — we know the noise is a problem but prioritize feature work over alert hygiene
  2 → We delete or silence alerts when engineers complain loudly enough — no data-driven process
  3 → We run a monthly alert hygiene review: alert-to-action ratio is measured and the worst offenders are retuned
  4 → We have automated alert quality scoring: every alert is tracked for time-to-action, false positive rate, and engineer feedback — low-quality alerts are surfaced automatically and our AI system proposes specific tuning changes based on historical response patterns

Q25 | weight: 1.5 | tactical | personas: [sre_platform_engineer] | persona_weight: 1.2
Text: A complex incident spans 12 microservices and 3 database clusters simultaneously. How does your team coordinate investigation and identify root cause without hours of duplicated effort?
Options:
  1 → Engineers investigate separately in their areas and share findings in Slack — we regularly duplicate work and miss connections between symptoms
  2 → A war room forms and engineers share findings verbally — context gets lost as the incident drags on for hours
  3 → We use a shared incident timeline tool where the incident commander tracks all investigation threads and findings
  4 → Our AIOps platform auto-correlates cross-service signals, builds a ranked hypothesis list with supporting evidence for each, assigns investigation tracks to team members, and generates a draft root cause summary for engineer validation — reducing the investigation phase by 60% versus our pre-AIOps baseline
```

---

## 5. P3: AI APPLICATION OBSERVABILITY

> **Note:** This pillar is gated. Only shown to prospects who answer "Yes" to the gate question: "Is your organization currently building, deploying, or operating AI-powered applications or services?"

### General Questions (is_general = TRUE)

```
Q1 | weight: 2.0 | general: true
Text: How do you currently monitor the behavior and performance of your LLM-powered applications in production?
Options:
  1 → We don't monitor LLM applications beyond basic uptime
  2 → We track API error rates and latency only
  3 → We track LLM-specific metrics: token usage, latency per call, and cost per request
  4 → Full LLM observability: request tracing, prompt/response logging, cost tracking, quality scoring, and drift detection

Q2 | weight: 1.5 | general: true
Text: How do you detect and respond to quality degradation in your AI systems (hallucinations, accuracy drift)?
Options:
  1 → We don't — issues are discovered by end users reporting problems
  2 → Manual review of a sample of LLM outputs periodically
  3 → Automated evaluation pipeline for a subset of critical outputs
  4 → Continuous automated quality evaluation with drift detection, alerting, and version-correlated analysis

Q3 | weight: 1.5 | general: true
Text: How do you currently track and optimize the cost of running your LLM applications?
Options:
  1 → We don't track LLM costs beyond the monthly invoice
  2 → High-level cost tracking by service or team
  3 → Per-request cost tracking with optimization guidelines
  4 → Real-time cost optimization: per-user, per-feature, per-model cost tracking with automated budget alerting and model routing

Q4 | weight: 1.0 | general: true
Text: How do you manage and version prompts in your LLM applications?
Options:
  1 → Prompts are hardcoded with no version control
  2 → Prompts are stored in config files with basic version control
  3 → Prompt versioning with A/B testing capabilities
  4 → Full prompt lifecycle management: versioned, tested, evaluated, and deployed with CI/CD integration
```

### Persona-Specific Questions

```
Q5 | weight: 2.0 | personas: [ml_ai_engineer] | persona_weight: 1.2 | context_tags: ["llm", "ai_agents", "langchain", "openai", "anthropic"]
Text: How do you trace and debug requests through your AI agent or LLM pipeline?
  1 → No tracing — we log inputs and outputs only
  2 → Basic logging at entry and exit points of the pipeline
  3 → Step-level tracing of agent actions and LLM calls
  4 → Full distributed tracing across agent steps, tool calls, and LLM requests with latency breakdown and token attribution

Q6 | weight: 1.5 | personas: [ml_ai_engineer] | persona_weight: 1.2
Text: How do you evaluate and benchmark your LLM models or pipelines before deploying changes?
Options:
  1 → Manual testing of a few example inputs
  2 → Basic regression tests against expected outputs
  3 → Automated evaluation suite with defined quality metrics
  4 → Continuous evaluation pipeline with automated benchmarking, regression detection, and human-in-the-loop review for significant changes

Q7 | weight: 1.0 | personas: [ml_ai_engineer, devops_engineer] | persona_weight: 1.1
Text: How do you manage the lifecycle of AI agents (deployment, versioning, rollback)?
Options:
  1 → No formal lifecycle management
  2 → Manual deployment with basic version tracking
  3 → Automated deployment with versioning and staged rollouts
  4 → Full MLOps for agents: automated CI/CD, canary deployments, and automated rollback triggered by quality or performance degradation

Q8 | weight: 1.5 | personas: [cto_executive, vp_engineering] | persona_weight: 0.9
Text: How does your organization govern AI and LLM use in production applications (safety, compliance, data privacy)?
Options:
  1 → No formal AI governance
  2 → Informal guidelines exist but are not enforced
  3 → Documented AI policies with security review for new AI features
  4 → Formal AI governance framework: PII detection in prompts/responses, model access controls, audit logging, and compliance reporting

Q9 | weight: 1.0 | personas: [cto_executive, vp_engineering] | persona_weight: 0.9
Text: How do you measure the business impact of your AI-powered features?
Options:
  1 → We don't track AI-specific business metrics
  2 → Basic usage metrics only (requests, active users)
  3 → Feature-level metrics tied to business outcomes
  4 → Full AI ROI measurement: quality scores, user satisfaction, cost per value delivered, and business outcome correlation

Q10 | weight: 1.0 | personas: [software_developer] | persona_weight: 1.0
Text: How do you test AI-powered features during development before deploying to production?
Options:
  1 → Manual testing only with a few example inputs
  2 → Unit tests for non-AI components, manual validation for AI behavior
  3 → Automated tests with fixed test cases for AI components
  4 → Property-based testing and automated LLM evaluation integrated into CI pipeline

Q11 | weight: 1.5 | personas: [sre_platform_engineer, devops_engineer] | persona_weight: 1.1
Text: How do you handle reliability for AI services that depend on external LLM APIs?
Options:
  1 → No fallback — if the API is down, the feature is down
  2 → Basic error handling and user-facing error messages
  3 → Retry logic and fallback to degraded mode
  4 → Multi-provider routing with automatic failover, circuit breakers, and graceful degradation

Q12 | weight: 1.0 | personas: [devops_engineer, sre_platform_engineer] | persona_weight: 1.1
Text: How is the infrastructure for your AI workloads managed and scaled?
Options:
  1 → Manual, ad-hoc provisioning
  2 → Fixed infrastructure with manual scaling
  3 → Auto-scaling configured for AI inference workloads
  4 → Intelligent infrastructure management: GPU-aware scheduling, cost-optimized model serving, and automated scaling based on queue depth and latency targets
```

### Additional Questions — Q13–Q18: Strategic | Q19–Q25: Tactical

> **Strategic questions** address AI governance, organizational readiness, investment decisions, and business impact of LLM applications.
> **Tactical questions** address real debugging scenarios, deployment decisions, and hands-on LLM operations.

```
Q13 | weight: 2.0 | strategic | personas: [cto_executive, vp_engineering] | persona_weight: 0.9 | context_tags: ["llm", "ai_governance"]
Text: Your LLM-powered customer support chatbot is occasionally giving confidently incorrect information to customers. An executive asks what real-time controls exist to detect and respond to this. What do you say?
Options:
  1 → We rely on customers to report issues — we have no automated detection of incorrect outputs
  2 → We sample a small percentage of conversations and manually review them on a weekly basis
  3 → We have automated quality scoring on a subset of outputs with alerts when scores drop below a threshold
  4 → Every response is scored in real time for accuracy and policy compliance; harmful outputs trigger immediate suppression and human review, with a complete audit trail available for compliance and legal review

Q14 | weight: 1.5 | strategic | personas: [cto_executive, vp_engineering] | persona_weight: 0.9 | context_tags: ["llm", "ai_governance"]
Text: Your organization wants to deploy a new LLM feature that processes sensitive customer financial data. What governance process determines whether it goes to production?
Options:
  1 → It goes through standard code review and QA — we treat it the same as any other feature
  2 → We add a security review but have no specific AI governance processes or launch criteria
  3 → We have an AI feature launch checklist: data privacy review, output quality testing, monitoring plan, and defined rollback criteria
  4 → We have a formal AI governance gate: PII detection validation in prompt and response flows, bias and safety evaluation, legal data use review, monitoring SLOs defined before launch, and a staged rollout with human-in-the-loop review for the first batch of live interactions

Q15 | weight: 1.5 | strategic | personas: [cto_executive, vp_engineering] | persona_weight: 0.9 | context_tags: ["llm", "ai"]
Text: Your LLM application costs are growing 40% month-over-month while usage grows only 15%. A board member asks what is causing the cost discrepancy. How do you respond?
Options:
  1 → We cannot answer with data — we have no cost attribution below the total monthly invoice
  2 → We know total API costs but cannot break them down by feature, user cohort, or model version
  3 → We have per-feature cost tracking and can identify the top cost drivers, though optimization remains manual
  4 → I present a real-time cost attribution dashboard: cost per feature, per user cohort, and per model — with anomaly alerts when cost-per-request drifts above baseline, and a summary showing the three routing decisions last month that reduced spend by 22%

Q16 | weight: 1.0 | strategic | personas: [cto_executive, vp_engineering] | persona_weight: 0.9 | context_tags: ["llm", "ai"]
Text: How does your organization decide when a production LLM should be retrained, fine-tuned, or replaced with a newer model version?
Options:
  1 → We retrain on a fixed calendar schedule regardless of observed quality or performance signals
  2 → We retrain when users complain or we notice obvious quality degradation in production
  3 → We track quality metrics over time and retrain when they fall below a defined threshold
  4 → We have a model lifecycle policy: continuous drift monitoring flags a retraining candidate, automated evaluation compares the candidate against the incumbent on a held-out benchmark, and production promotion requires passing quality gates and a documented human sign-off

Q17 | weight: 1.5 | strategic | personas: [cto_executive] | persona_weight: 0.9 | context_tags: ["llm", "ai"]
Text: A competitor announces their AI product is significantly more accurate than yours. Your CTO asks how quickly you can measure your current accuracy and identify exactly where you are falling short. What is your answer?
Options:
  1 → Weeks — we would need to design an evaluation framework from scratch before we could answer this question
  2 → Several days — we have some evaluation tooling but it requires manual configuration and runs
  3 → A day or two — we have an evaluation suite we can run against a benchmark dataset on request
  4 → Hours — we have a continuous evaluation pipeline with automated benchmarking; a full quality audit with feature-level accuracy breakdown and gap analysis can be triggered and delivered within the same business day

Q18 | weight: 1.0 | strategic | personas: [cto_executive, vp_engineering] | persona_weight: 0.9 | context_tags: ["llm", "ai"]
Text: Your organization is expanding from one to five LLM-powered features over the next year. How does your AI observability infrastructure scale to support this without proportional platform team growth?
Options:
  1 → We will add monitoring feature by feature — there is no platform-level observability strategy yet
  2 → We will reuse the same ad-hoc approach from our first feature and scale it manually
  3 → We have an LLM observability platform that new features can onboard to using a standard integration pattern
  4 → We have a self-service LLM observability platform: teams onboard via SDK in under a day, inherit standard dashboards, cost tracking, quality evaluation, and alerting automatically — adding a new feature requires no platform team involvement

Q19 | weight: 2.0 | tactical | personas: [ml_ai_engineer] | persona_weight: 1.2 | context_tags: ["llm", "ai_agents", "tracing"]
Text: Users are reporting your RAG-based search feature returns irrelevant results for certain query types. You need to identify where in the pipeline the failure is occurring. How do you investigate?
Options:
  1 → I add print statements and manually rerun sample queries to observe the behavior step by step
  2 → I look at input and output logs but cannot see what happened inside the retrieval or generation steps
  3 → I have structured logging showing the query, retrieved documents, and final response for each request
  4 → I use distributed LLM tracing to see query embedding, retrieval scores per document, prompt construction, and generation with token-level attribution — I identify whether the failure is retrieval quality, prompt formatting, or model hallucination within minutes

Q20 | weight: 1.5 | tactical | personas: [ml_ai_engineer] | persona_weight: 1.2 | context_tags: ["llm", "ai"]
Text: Your LLM application's average latency has increased from 800ms to 2.1 seconds over two weeks with no code changes deployed. How do you diagnose this?
Options:
  1 → I assume it's an upstream provider issue and open a support ticket — I have no other visibility into the cause
  2 → I check overall API latency metrics but cannot isolate where in the pipeline the time is being spent
  3 → I have per-step latency tracking (retrieval, prompt generation, LLM inference) and can see which step regressed
  4 → I compare distributed trace profiles from two weeks ago against today: the LLM inference step increased 60% in P95, correlated with a silent model version change on the provider side — I switch to a secondary model endpoint using multi-provider routing within 10 minutes

Q21 | weight: 1.0 | tactical | personas: [ml_ai_engineer] | persona_weight: 1.2 | context_tags: ["llm", "ai"]
Text: Your team wants to test whether a new prompt template produces better output quality before fully rolling it out to all users. How do you run this comparison rigorously?
Options:
  1 → We deploy the new prompt and observe whether user feedback or downstream metrics improve — no structured comparison
  2 → We test both prompts on a fixed offline dataset and choose whichever scores better on that benchmark
  3 → We run an A/B test in staging with synthetic traffic and compare quality scores before promoting to production
  4 → We route a percentage of live traffic to the new prompt, compare quality, cost, and latency in real time against the incumbent, with automatic rollback if the new prompt underperforms on any key metric within a defined observation window

Q22 | weight: 1.5 | tactical | personas: [ml_ai_engineer, devops_engineer] | persona_weight: 1.1 | context_tags: ["llm", "mlops"]
Text: A new version of your prompt chain has been tested and is ready to deploy. It performed well offline but you have uncertainty about behavior on real production traffic. What does your deployment process look like?
Options:
  1 → We update the code and deploy — no special deployment process exists for LLM pipeline changes
  2 → We run manual tests on a representative set of inputs and deploy if they look good
  3 → We have a staging environment where automated regression tests run on a fixed test suite before promoting
  4 → We have a full LLM CI/CD pipeline: automated quality regression, cost and latency comparison against the current version, canary deployment with live traffic comparison, and automated rollback triggered by quality degradation beyond a configured threshold

Q23 | weight: 1.0 | tactical | personas: [sre_platform_engineer, devops_engineer] | persona_weight: 1.1 | context_tags: ["llm", "ai_agents"]
Text: Your AI agent application depends on three external LLM API providers. One experiences a major outage during peak usage. What happens and how does your system respond?
Options:
  1 → The feature breaks and users see errors until the provider recovers — there is no fallback in place
  2 → We catch the API error and show a graceful degradation message, but the feature is fully unavailable
  3 → We have retry logic and a secondary model endpoint that activates for critical paths
  4 → We have multi-provider routing with circuit breaking: failed calls are detected in real time, traffic is rerouted to a secondary provider within seconds, the on-call engineer is alerted with full context, and an automated post-incident report captures the cost and quality impact of the failover

Q24 | weight: 1.0 | tactical | personas: [software_developer] | persona_weight: 1.0 | context_tags: ["llm", "ai"]
Text: You are building a new feature that calls an LLM API. Your manager asks you to make it fully observable. What exactly do you instrument?
Options:
  1 → I log the input and output — I don't know what else is needed for an LLM call
  2 → I log input, output, latency, and HTTP errors from the API provider
  3 → I implement structured logging: request ID, model name, token counts, latency, and response status code
  4 → I instrument the full chain with a distributed trace ID, token usage split by prompt and completion, latency per pipeline step, model version, cost per call, an automated quality score, and a circuit breaker that routes to a fallback model if the primary exceeds latency or error thresholds

Q25 | weight: 1.5 | tactical | personas: [ml_ai_engineer] | persona_weight: 1.2 | context_tags: ["llm", "ai", "langchain"]
Text: A customer reports your AI assistant gave them confidently incorrect information about their account. You need to understand exactly what led to that response. How do you investigate?
Options:
  1 → I can see the final response in our logs but cannot trace what reasoning or context produced it
  2 → I can see the prompt sent and the response received but not the intermediate steps or retrieved context
  3 → I have the full prompt including retrieved context documents, the model response, and the quality score for that session
  4 → I replay the full trace: retrieved documents with relevance scores, prompt construction steps, model reasoning chain, token attribution showing which context influenced the answer, and comparison against ground truth — I identify the failure as a retrieval hallucination and file a targeted fix within the same business day
```

---

## 6. P4: ML & FOUNDATION MODEL OPERATIONS

> **Note:** This pillar is gated. Only shown to prospects who answer "Yes" to the gate question: "Is your organization currently training, fine-tuning, or managing machine learning or foundation models in-house?"
>
> **Seed with `is_active = FALSE`.** The pillar is fully defined and its questions must be seeded, but the pillar will not appear to prospects until activated via the admin panel.

### General Questions (is_general = TRUE)

```
Q1 | weight: 2.0 | general: true
Text: How mature is your organization's approach to operationalizing machine learning — moving models from development to production reliably?
Options:
  1 → We have no formal process — models are deployed manually with no standardization
  2 → We have ad-hoc deployment processes for some models, but no consistent MLOps practices
  3 → Standardized MLOps pipelines exist for major models with version control and basic monitoring
  4 → Full MLOps maturity: automated training, evaluation, deployment, monitoring, and retraining pipelines

Q2 | weight: 1.5 | general: true
Text: How does your organization manage and track the cost of ML compute (GPU/TPU/CPU clusters)?
Options:
  1 → We don't track ML compute costs separately — it's part of the general cloud bill
  2 → High-level cost tracking by team or project, reviewed monthly
  3 → Per-job and per-model cost tracking with budget alerts
  4 → Real-time compute cost optimization: per-experiment cost attribution, idle GPU detection, spot instance orchestration, and cost-per-trained-model tracking

Q3 | weight: 1.5 | general: true
Text: How do you track, compare, and select ML experiments before promoting a model to production?
Options:
  1 → We don't track experiments formally — results are in notebooks or spreadsheets
  2 → Some logging of metrics per experiment, but no centralized tracking
  3 → Experiment tracking platform in use with metric comparison and artifact storage
  4 → Full experiment lifecycle management: automated metric logging, model registry integration, reproducibility guarantees, and governance-based promotion policies

Q4 | weight: 1.0 | general: true
Text: How does your organization monitor ML model performance after deployment to production?
Options:
  1 → We don't monitor models post-deployment — issues are found by end users
  2 → Basic uptime and API error rate monitoring only
  3 → Model performance metrics tracked (latency, throughput, accuracy on known test sets)
  4 → Full production model observability: concept drift detection, data quality monitoring, performance degradation alerting, and automated retraining triggers
```

### Persona-Specific Questions

```
Q5 | weight: 2.0 | personas: [ml_ai_engineer] | persona_weight: 1.2 | context_tags: ["gpu", "cuda", "model_training", "nvidia"]
Text: How do you monitor GPU utilization and efficiency during model training?
  1 → We don't monitor GPU utilization during training
  2 → Basic GPU utilization metrics available but not actively monitored
  3 → GPU utilization, memory usage, and job throughput tracked per training run
  4 → Full GPU observability: real-time utilization, memory efficiency, bottleneck detection, and automated alerts for idle or underutilized compute

Q6 | weight: 1.5 | personas: [ml_ai_engineer] | persona_weight: 1.2
Text: How do you manage model versioning, registration, and promotion through your ML lifecycle?
Options:
  1 → No formal versioning — models are saved as files with manual naming
  2 → Basic version control for model artifacts, but no formal registry
  3 → Centralized model registry with versioning and stage tracking (staging, production, archived)
  4 → Full model lifecycle management: automated registration, metadata tracking, lineage tracing, governance policies, and audit trails for every production change

Q7 | weight: 1.5 | personas: [ml_ai_engineer] | persona_weight: 1.2
Text: How do you ensure reproducibility of ML training runs?
Options:
  1 → Reproducibility is not a priority — we can't reliably recreate past training results
  2 → Code is version-controlled, but data and environment versions are not consistently tracked
  3 → Code, data versions, and key hyperparameters are logged per run
  4 → Full reproducibility: code, data, environment (Docker/conda), hyperparameters, and random seeds captured per run with one-click rerun capability

Q8 | weight: 1.0 | personas: [ml_ai_engineer, devops_engineer] | persona_weight: 1.1
Text: How integrated are your ML training pipelines with your standard CI/CD processes?
Options:
  1 → ML pipelines are completely separate from software CI/CD
  2 → Some shared infrastructure, but ML pipelines are managed manually
  3 → ML pipelines are triggered automatically on code or data changes
  4 → Full ML CI/CD: automated training, evaluation, comparison against baseline, and deployment gating on model quality metrics

Q9 | weight: 1.5 | personas: [cto_executive, vp_engineering] | persona_weight: 0.9
Text: How does your organization measure and optimize the ROI of ML compute investments?
Options:
  1 → We don't measure ML compute ROI
  2 → High-level budget tracking — we know the total spend but not the value delivered
  3 → Cost-per-model or cost-per-experiment tracked alongside model business impact
  4 → Full ML investment optimization: compute cost attributed to business outcomes, automated rightsizing recommendations, and executive dashboards linking ML spend to product metrics

Q10 | weight: 1.5 | personas: [cto_executive, vp_engineering] | persona_weight: 0.9
Text: How does your organization govern which ML models are deployed to production and who can access or modify them?
Options:
  1 → No formal governance — any engineer can deploy a model
  2 → Informal review process before deployment
  3 → Defined approval workflow with documented owners and review criteria
  4 → Automated governance: model cards required, approval workflows enforced, access controls by model, and full audit trail from training to production

Q11 | weight: 1.5 | personas: [sre_platform_engineer] | persona_weight: 1.1 | context_tags: ["gpu", "kubernetes", "cloud_compute", "aws", "gcp", "azure"]
Text: How is your GPU and ML compute infrastructure managed and scaled?
  1 → Manual provisioning — engineers request compute ad-hoc
  2 → Fixed compute clusters with manual scaling when capacity runs out
  3 → Auto-scaling GPU clusters with queue-based job scheduling
  4 → Intelligent compute orchestration: multi-cloud GPU scheduling, spot/preemptible instance management, priority queuing, and cost-optimized autoscaling

Q12 | weight: 1.0 | personas: [sre_platform_engineer, devops_engineer] | persona_weight: 1.1
Text: How do you monitor model serving infrastructure for reliability and performance?
Options:
  1 → No dedicated monitoring for model serving — same as generic application monitoring
  2 → Basic uptime and latency monitoring for model endpoints
  3 → Model-specific SLOs for latency and throughput with alerting
  4 → Full model serving observability: per-model SLOs, traffic-based autoscaling, A/B traffic splitting, shadow mode deployment, and automated rollback on performance degradation

Q13 | weight: 1.0 | personas: [software_developer] | persona_weight: 1.0
Text: How do developers in your organization consume ML models in production applications?
Options:
  1 → Models are accessed through ad-hoc scripts or direct file loading
  2 → REST APIs exist for some models, but discovery and documentation are poor
  3 → Centralized model serving platform with versioned APIs and SDK
  4 → Self-service ML platform: model catalog with documentation, versioned APIs, usage tracking, and automated deprecation notices
```

### Additional Questions — Q14–Q19: Strategic | Q20–Q25: Tactical

> **Strategic questions** address compute investment, governance, model lifecycle decisions, and business ROI of ML operations.
> **Tactical questions** address real training failure scenarios, GPU debugging, experiment reproducibility, and production serving.

```
Q14 | weight: 2.0 | strategic | personas: [cto_executive, vp_engineering] | persona_weight: 0.9 | context_tags: ["gpu", "model_training"]
Text: Your ML team's GPU cluster is running at 95% utilization and training jobs are queuing for 48+ hours. Engineers are losing days of productivity waiting for compute. How does your organization respond?
Options:
  1 → We tell engineers to be patient — there is no defined process for reactive capacity requests
  2 → We add more GPU nodes after engineers escalate the problem through management escalation channels
  3 → We have a capacity review process that triggers a formal purchase evaluation when queue time exceeds a defined SLA
  4 → We have automated capacity monitoring: when queue SLA is breached, an automated capacity request is generated with cost modeling, utilization forecasting, and a spot vs reserved recommendation — approved within 48 hours through a defined finance-engineering escalation path

Q15 | weight: 1.5 | strategic | personas: [cto_executive, vp_engineering] | persona_weight: 0.9 | context_tags: ["mlops", "model_training"]
Text: Your organization just spent $500K training a large foundation model. How do you protect that investment and ensure the model can be reliably reproduced, audited, and improved in the future?
Options:
  1 → Model weights are saved to a shared drive — we would need to fully retrain to reproduce it reliably
  2 → We version control model weights and keep training scripts in a git repository
  3 → We have a model registry with versioned artifacts, training configurations, and dataset snapshots
  4 → We have a full ML asset governance system: model cards, complete data lineage, training environment snapshots (pinned Docker image + dependencies), evaluation results, and a one-click retraining pipeline that reproduces results within 5% performance variance

Q16 | weight: 1.5 | strategic | personas: [cto_executive, vp_engineering] | persona_weight: 0.9 | context_tags: ["gpu", "model_training"]
Text: Finance asks you to reduce ML compute costs by 30% without impacting model quality or research velocity. How do you approach this?
Options:
  1 → We don't have enough cost visibility to know where to start — the ask cannot be answered with data
  2 → We review cloud bills and manually identify the most expensive training jobs to optimize one by one
  3 → We run a compute audit: identify underutilized GPU capacity, shift non-urgent jobs to spot instances, and implement a job scheduler
  4 → We run a comprehensive cost optimization program: per-experiment cost attribution, automated spot instance management with checkpointing, mixed-precision training enforcement, idle GPU termination, and a cost-vs-quality Pareto dashboard showing optimization opportunities — achieving the 30% target within 6 weeks

Q17 | weight: 1.0 | strategic | personas: [cto_executive, vp_engineering] | persona_weight: 0.9 | context_tags: ["mlops"]
Text: A regulatory audit requires proof that your production ML model does not exhibit bias against protected demographic groups. How quickly can your team produce this evidence?
Options:
  1 → We would need weeks to design and run the analysis — our models have not been instrumented for bias evaluation
  2 → We can produce offline bias evaluation reports but they are run manually and may not reflect the current production model
  3 → We run bias evaluations as part of our model release process and have reports for the current production model
  4 → We have continuous bias monitoring in production: real-time fairness metrics across demographic segments, automated alerts when metrics diverge from baseline, and audit-ready reports exportable for regulatory review in under 30 minutes

Q18 | weight: 1.5 | strategic | personas: [cto_executive, vp_engineering] | persona_weight: 0.9 | context_tags: ["mlops", "model_training"]
Text: Your organization wants to double ML experiment throughput over the next year to accelerate research. What infrastructure and process changes does this require?
Options:
  1 → We tell the team to run experiments sequentially and wait — we don't have infrastructure to parallelize them
  2 → We add more compute and hope the experiment tracking and coordination scales with it organically
  3 → We invest in better job scheduling, additional compute capacity, and improved experiment tracking tooling
  4 → We implement a full ML platform redesign: elastic compute with intelligent queue management, parallel experiment scheduling with resource isolation, automated hyperparameter sweep support, and infrastructure-as-code compute templates — enabling 2× experiment throughput without proportional cost increase

Q19 | weight: 1.0 | strategic | personas: [cto_executive] | persona_weight: 0.9 | context_tags: ["gpu", "model_training"]
Text: The board asks how your organization ensures GPU infrastructure spend is tied to measurable business outcomes rather than just engineering activity. How do you respond?
Options:
  1 → We cannot connect compute costs to business outcomes — the data does not exist in a usable form
  2 → We track total compute costs alongside model deployment frequency as a rough proxy for productive spend
  3 → We have cost-per-experiment and cost-per-deployed-model metrics reviewed in quarterly engineering reviews
  4 → We present a GPU investment dashboard: compute cost attributed per ML product line, model performance improvement per dollar spent, and a forward-looking roadmap showing expected business impact from experiments currently in training — reviewed monthly by engineering and product leadership

Q20 | weight: 2.0 | tactical | personas: [ml_ai_engineer] | persona_weight: 1.2 | context_tags: ["gpu", "model_training", "cuda"]
Text: A training job that normally completes in 8 hours is now taking 18 hours. No code changes were made. How do you diagnose the slowdown?
Options:
  1 → I restart the job and hope it resolves — I don't have tools to diagnose GPU performance bottlenecks
  2 → I check GPU utilization in the cloud console and see it's lower than expected, but cannot pinpoint why
  3 → I have per-epoch timing metrics and can identify when the slowdown started — I check for data pipeline bottlenecks manually
  4 → My ML training observability dashboard tracks GPU utilization, memory bandwidth, data loading throughput, and gradient computation time per step — I immediately see data loading efficiency dropped to 30%, drill into the DataLoader profiling trace, find a misconfigured prefetch setting from a recent infrastructure update, and fix it in 20 minutes

Q21 | weight: 1.5 | tactical | personas: [ml_ai_engineer] | persona_weight: 1.2 | context_tags: ["mlops", "model_training"]
Text: You are training a large model and the training loss suddenly spikes at epoch 47 and never recovers. You need to understand what happened and resume training without starting over. How do you handle this?
Options:
  1 → I stop the run and start from scratch — I don't have enough logged information to diagnose what happened
  2 → I review loss curves and guess it might be a learning rate issue or a corrupted data batch
  3 → I review training logs: gradient norms, learning rate schedule, and per-batch loss to identify the anomalous step
  4 → My training monitoring system flags the spike, correlates it with gradient norm explosion in that specific step, identifies the data shard that caused the instability via data lineage logging, and I resume from the last healthy checkpoint — with the offending shard excluded — within 10 minutes

Q22 | weight: 1.0 | tactical | personas: [ml_ai_engineer, devops_engineer] | persona_weight: 1.1 | context_tags: ["mlops", "model_training", "gpu"]
Text: Your team runs 50 training experiments per week across multiple researchers. How do you ensure reproducibility and prevent results that cannot be reproduced by anyone else on the team?
Options:
  1 → We accept that experiments vary — some irreproducibility is considered a normal part of ML research work
  2 → We document key hyperparameters in a shared spreadsheet that researchers maintain manually
  3 → We use an experiment tracking tool to log parameters, metrics, and artifacts per run automatically
  4 → Every experiment is containerized with a pinned Docker image, training data is versioned and checksummed, all hyperparameters and random seeds are logged, and any experiment can be relaunched with a single CLI command that reproduces results within a defined variance threshold

Q23 | weight: 1.5 | tactical | personas: [ml_ai_engineer] | persona_weight: 1.2 | context_tags: ["gpu", "model_training"]
Text: You are running a distributed training job across 32 GPUs and a node failure crashes the entire job after 12 hours of compute. What is the actual business impact and how do you recover?
Options:
  1 → We lose all training progress and restart from scratch — this has now happened three times this quarter
  2 → We lose several hours of training and restart from the beginning because checkpoints are not in place
  3 → We have hourly checkpoints so we restart from the last checkpoint, losing at most one hour of compute time
  4 → We have fault-tolerant distributed training: elastic checkpointing every 15 minutes, automatic node replacement, monitoring that detects node failure within 60 seconds, and training resumes automatically on a replacement node with minimal compute waste

Q24 | weight: 1.0 | tactical | personas: [sre_platform_engineer, devops_engineer] | persona_weight: 1.1 | context_tags: ["kubernetes", "gpu", "model_training"]
Text: Your organization runs ML training workloads on the same Kubernetes cluster as production inference. A poorly scoped training job is consuming excessive resources and causing production inference latency to spike. What happens?
Options:
  1 → We manually kill the training job when someone notices inference is degraded — this typically takes 20+ minutes
  2 → We schedule training jobs during off-peak hours to minimize the chance of resource overlap
  3 → We use Kubernetes namespace quotas to limit training job resource consumption
  4 → We have a fully isolated ML compute tier: dedicated node pools for training, priority classes that preempt training under production pressure, real-time cost attribution per workload type, and automated alerts when production inference SLOs are threatened by resource contention

Q25 | weight: 1.5 | tactical | personas: [ml_ai_engineer] | persona_weight: 1.2 | context_tags: ["gpu", "model_training", "cuda"]
Text: GPU utilization on your training cluster averages 45% despite being fully booked. Engineers are confident their jobs are running efficiently. How do you identify the waste and fix it?
Options:
  1 → We don't have enough visibility to know whether 45% is efficient or wasteful for our specific workloads
  2 → We look at average utilization in the cloud console and accept some inefficiency as unavoidable
  3 → We profile individual training jobs to identify data loading bottlenecks and underutilized GPU time per job
  4 → We have a GPU efficiency observability dashboard: per-job breakdown by compute, memory, I/O, and idle time — automated recommendations flag jobs below 60% compute utilization and suggest specific fixes (mixed precision, larger batch size, DataLoader tuning) — applying them raised average utilization to 78% and cut cost per experiment by 35%
```

---

## 7. P5: SECURITY & DEVSECOPS

### General Questions (is_general = TRUE)

```
Q1 | weight: 2.0 | general: true
Text: How is security currently integrated into your software development lifecycle (SDLC)?
Options:
  1 → Security is reviewed only at release or after deployment
  2 → Penetration testing and security reviews happen, but late in the cycle
  3 → Security scanning integrated into CI/CD; developers get feedback during development
  4 → Shift-left security is the standard: SAST, DAST, SCA, and IaC scanning run on every commit with developer-facing remediation guidance

Q2 | weight: 1.5 | general: true
Text: How do you manage vulnerabilities in your software supply chain (open source dependencies, container images)?
Options:
  1 → We don't actively track open-source vulnerabilities
  2 → Scans run occasionally with slow, manual remediation
  3 → Automated SCA scans with defined SLAs for remediation by severity
  4 → Continuous SCA with auto-remediation PRs, SBOM generation, and runtime enforcement of approved packages

Q3 | weight: 1.5 | general: true
Text: How does your organization detect and respond to threats in your cloud or production environment at runtime?
Options:
  1 → No runtime security monitoring
  2 → Basic WAF and network-level controls only
  3 → Agent-based runtime monitoring for known threat signatures
  4 → Behavioral-based workload protection with AI-powered threat detection, anomaly identification, and automated response playbooks

Q4 | weight: 1.0 | general: true
Text: How do you manage cloud security posture (misconfiguration detection, identity and entitlement management)?
Options:
  1 → We rely on cloud provider defaults with no active posture management
  2 → Periodic manual security audits
  3 → CSPM tool in place with regular review cycles
  4 → Continuous CSPM and CIEM with automated drift detection, policy enforcement, and compliance reporting
```

### Persona-Specific Questions

```
Q5 | weight: 2.0 | personas: [ciso_vp_security] | persona_weight: 1.2
Text: How mature is your organization's approach to security compliance and regulatory requirements?
Options:
  1 → No formal compliance program
  2 → Compliance requirements addressed reactively when audits occur
  3 → Defined compliance program with regular assessments and documented controls
  4 → Continuous compliance monitoring with automated evidence collection, audit-ready reporting, and proactive gap remediation

Q6 | weight: 1.5 | personas: [ciso_vp_security] | persona_weight: 1.2
Text: How does your organization manage the security of APIs and applications exposed to external users or partners?
Options:
  1 → No application-level security controls beyond network firewalls
  2 → Basic WAF rules and rate limiting
  3 → API security scanning and access controls with regular review
  4 → Full API and application protection: behavioral threat detection, automated bot management, API discovery, and real-time abuse prevention

Q7 | weight: 1.0 | personas: [ciso_vp_security, security_engineer] | persona_weight: 1.1
Text: How does your organization manage secrets, credentials, and access keys?
Options:
  1 → Secrets are stored in code or shared via email and messaging tools
  2 → Centralized secrets manager in place but not consistently used
  3 → Secrets manager enforced for all production systems with rotation policies
  4 → Automated secret scanning in CI/CD, zero-trust secrets management, automated rotation, and full audit logging

Q8 | weight: 1.5 | personas: [security_engineer] | persona_weight: 1.2
Text: At what stage does security scanning occur in your deployment pipeline?
Options:
  1 → Post-deployment only, or never
  2 → Pre-release (staging or QA) only
  3 → CI pipeline on every PR or merge
  4 → Pre-commit hooks, CI pipeline scanning, and continuous runtime scanning

Q9 | weight: 1.0 | personas: [security_engineer, devops_engineer] | persona_weight: 1.1
Text: How are security findings from scanning tools tracked and remediated?
Options:
  1 → Findings are generated but not systematically tracked or actioned
  2 → Findings reviewed manually by the security team periodically
  3 → Findings ticketed with assigned owners and SLA-based remediation
  4 → Automated vulnerability management: findings triaged by severity and context, routed to owning teams, tracked to closure with SLA enforcement

Q10 | weight: 1.0 | personas: [devops_engineer, sre_platform_engineer] | persona_weight: 1.1 | context_tags: ["kubernetes", "containers", "docker"]
Text: How is container and Kubernetes security currently managed?
  1 → No container-specific security controls
  2 → Basic image scanning before deployment
  3 → Image scanning, admission control policies, and network policies in place
  4 → Full container security: image signing, runtime behavioral monitoring, automated policy enforcement, and continuous compliance scanning of running workloads

Q11 | weight: 1.5 | personas: [cto_executive, vp_engineering] | persona_weight: 0.9
Text: How does your engineering culture approach security ownership?
Options:
  1 → Security is solely the security team's responsibility; developers are not involved
  2 → Security requirements are handed off to developers at the end of sprints
  3 → Security champions embedded in engineering teams with shared ownership
  4 → Security is a shared engineering responsibility: developers own remediation, security provides tooling and guardrails, and security metrics are part of engineering KPIs

Q12 | weight: 1.0 | personas: [software_developer] | persona_weight: 1.0
Text: How confident are you in your ability to identify and fix common security vulnerabilities in your code?
Options:
  1 → I rely entirely on the security team to identify vulnerabilities
  2 → I am aware of common vulnerabilities but have limited tooling support
  3 → Security linting and IDE plugins flag common issues during development
  4 → Security feedback is integrated into my IDE, PR review, and CI pipeline with context-aware guidance for every flagged issue
```

### Additional Questions — Q13–Q18: Strategic | Q19–Q25: Tactical

> **Strategic questions** address security program governance, investment decisions, board-level risk communication, and organizational culture change.
> **Tactical questions** address real incident response scenarios, hands-on vulnerability management, and day-to-day security engineering.

```
Q13 | weight: 2.0 | strategic | personas: [ciso_vp_security] | persona_weight: 1.2 | context_tags: ["devsecops", "compliance"]
Text: Your organization suffers a supply chain attack where a compromised open source package exfiltrates credentials from your CI/CD pipeline. The board asks what systemic changes you will make to prevent recurrence. How do you respond?
Options:
  1 → We manually review our top 50 dependencies and update them — no systemic process changes are made
  2 → We implement a dependency scanning tool and aim to catch similar issues in future builds
  3 → We implement SCA scanning in CI/CD, conduct a full dependency audit, and add a vendor risk review process for new packages
  4 → We implement a comprehensive supply chain security program: signed commits, dependency pinning with cryptographic verification, SBOM generation on every build, runtime allow-listing, secrets scanning with pre-commit hooks, and a vendor risk register — presented to the board with a 90-day remediation roadmap and ongoing quarterly tracking

Q14 | weight: 1.5 | strategic | personas: [ciso_vp_security] | persona_weight: 1.2
Text: A new regulation requires continuous evidence of security control enforcement rather than point-in-time annual audit results. How does your organization shift to continuous compliance?
Options:
  1 → We schedule more frequent audits — quarterly instead of annually — and document more carefully
  2 → We run automated security scans monthly and save the results as compliance evidence
  3 → We implement continuous compliance scanning with automated evidence collection and a posture dashboard
  4 → We have a continuous compliance platform: automated control testing runs daily, evidence is mapped to regulatory frameworks (SOC 2, ISO 27001, PCI-DSS), gap alerts trigger remediation tickets, and we can generate a complete audit package on demand — reducing audit preparation from 6 weeks to 3 days

Q15 | weight: 1.5 | strategic | personas: [ciso_vp_security, cto_executive] | persona_weight: 1.1
Text: The board asks your CISO to quantify the organization's current cybersecurity risk in financial terms. How does your security team approach this?
Options:
  1 → We cannot quantify it — we describe our security posture qualitatively and hope that satisfies the board
  2 → We use industry benchmarks to produce a rough exposure estimate without company-specific data
  3 → We have a risk register with severity and likelihood ratings that we translate to estimated financial impact ranges
  4 → We use a quantitative risk framework: each significant risk has a modeled annual loss expectancy based on asset value, threat frequency, and control effectiveness — presented to the board quarterly with trend analysis and scenario modeling

Q16 | weight: 1.5 | strategic | personas: [cto_executive, vp_engineering] | persona_weight: 0.9
Text: Engineering teams complain that security scanning adds 8–12 minutes to every CI/CD build and is slowing down delivery. The CISO insists on full scanning coverage. How does your organization resolve this tension?
Options:
  1 → We remove security scans from the critical build path to unblock engineers — coverage becomes a secondary concern
  2 → We keep all scans and accept the slowdown — engineers are frustrated but compliant
  3 → We parallelize some scans and move slower ones like DAST to nightly scheduled runs instead of every commit
  4 → We implement tiered scanning: fast SAST and secret scanning run on every PR in under 2 minutes, while full SCA and DAST run in a parallel async pipeline — results are non-blocking on PR open but blocking on merge to main, achieving full coverage with under 90 seconds of developer-facing impact

Q17 | weight: 1.0 | strategic | personas: [ciso_vp_security] | persona_weight: 1.2
Text: Your organization is acquiring a company and must assess the security posture of their engineering codebase and cloud infrastructure within 30 days before deal close. How do you approach this?
Options:
  1 → We send a security questionnaire and accept their answers at face value within the timeline
  2 → We manually review their key repositories and spot-check their cloud configuration
  3 → We run automated SAST, SCA, and CSPM scans against their codebase and cloud accounts and produce a risk report
  4 → We run comprehensive security due diligence: automated scanning plus threat modeling of their architecture, comparison against our internal security baseline, a prioritized risk register with remediation timelines, and a post-acquisition hardening roadmap — completed within the 30-day window

Q18 | weight: 1.0 | strategic | personas: [cto_executive, vp_engineering] | persona_weight: 0.9 | context_tags: ["devsecops"]
Text: How does your organization track security debt across the engineering codebase and ensure it gets addressed alongside feature work rather than accumulating indefinitely?
Options:
  1 → Security debt is invisible to us — we only become aware of it during audits or after incidents
  2 → Security findings accumulate in a backlog that rarely gets prioritized against feature work
  3 → Security debt is tracked in the engineering backlog with severity tags and reviewed during sprint planning
  4 → Security debt is a first-class engineering metric: tracked per team with aging and SLA breach dashboards, integrated into sprint velocity reporting, and automatically escalated when critical findings remain unresolved past SLA — reviewed monthly by engineering leadership

Q19 | weight: 2.0 | tactical | personas: [security_engineer, devops_engineer] | persona_weight: 1.2 | context_tags: ["devsecops", "ci_cd"]
Text: During a Friday afternoon deployment, an automated scan detects a critical CVE in a base Docker image used across 12 production services. What is your response process?
Options:
  1 → We file a ticket for next week and hope nothing gets exploited over the weekend
  2 → We assess the CVE manually from its written description and decide whether to patch based on our judgment
  3 → We have a severity SLA: critical findings block deployment and require same-day remediation or a documented exception with approver sign-off
  4 → Our automated vulnerability platform triggers a P1 incident: it identifies all affected services, generates a remediation plan with updated base images, opens automated PRs for affected repos, and assigns owners — all within 15 minutes; the on-call security engineer reviews and approves, with all services patched before end of day

Q20 | weight: 1.5 | tactical | personas: [security_engineer] | persona_weight: 1.2 | context_tags: ["devsecops", "ci_cd"]
Text: A developer accidentally committed AWS credentials to a public GitHub repository 30 minutes ago. What is your detection and response process and how long does it take?
Options:
  1 → We find out when someone exploits the credentials or when a developer notices the commit by chance
  2 → The developer self-reports the mistake; we manually rotate the credentials through the AWS console
  3 → We have secret scanning in CI that catches future pushes to internal repos, but not retroactive public exposure
  4 → GitHub secret scanning detects the committed credential within seconds; an automated incident opens; the secret is revoked via AWS IAM automation; affected resources are audited; the developer receives guided remediation steps — total time from commit to credential revocation under 3 minutes

Q21 | weight: 1.5 | tactical | personas: [security_engineer, sre_platform_engineer] | persona_weight: 1.1
Text: Your SIEM generates 500 security alerts per day but only around 20 require actual action. How does your team handle this volume without analyst burnout?
Options:
  1 → Every alert is manually triaged by analysts — the team is overwhelmed and high-severity alerts regularly get delayed
  2 → We use experience to quickly close obviously benign alerts, but the process is undocumented and person-dependent
  3 → Correlation rules and suppression policies reduce noise to around 80 per day with a documented triage workflow
  4 → We use AI-powered SIEM with behavioral analytics: alerts are automatically scored for risk, enriched with asset criticality and threat intelligence, and only 15–20 high-confidence alerts reach analysts per day — each with pre-populated investigation context reducing average triage time from 15 minutes to under 3 minutes

Q22 | weight: 1.0 | tactical | personas: [devops_engineer, security_engineer] | persona_weight: 1.1 | context_tags: ["kubernetes", "containers", "devsecops"]
Text: A security scan finds several production Kubernetes pods running as root with excessive Linux capabilities. How does your team remediate this and prevent it from recurring in future deployments?
Options:
  1 → We note it in a spreadsheet and plan to fix it eventually — it hasn't caused a visible incident yet
  2 → We manually update the affected pod security contexts to run as non-root
  3 → We fix the affected pods and update our deployment templates to include security context defaults going forward
  4 → We treat it as a systemic gap: implement OPA/Gatekeeper admission control that rejects non-compliant pods at deploy time, retroactively remediate all violations via automated PR generation, add a policy compliance gate to CI/CD, and track compliance percentage as a KPI in our security dashboard — reaching 100% within 2 sprints

Q23 | weight: 1.0 | tactical | personas: [software_developer] | persona_weight: 1.0 | context_tags: ["devsecops"]
Text: Your IDE flags a SQL injection vulnerability in code you just wrote. You've never remediated one before. What process and tooling exists to help you fix it correctly without waiting for a security review?
Options:
  1 → I search online for how to fix SQL injection and do my best — there's no internal support or structured guidance
  2 → I flag it in the PR and wait for someone from the security team to fix it or advise me
  3 → The IDE provides documentation explaining the vulnerability and how to remediate it in general terms
  4 → The security tooling provides in-context remediation guidance with a code example specific to my framework, links to our internal secure coding standards, and a one-click option to request a security review — I fix it and verify before the PR reaches a reviewer

Q24 | weight: 1.0 | tactical | personas: [security_engineer, ciso_vp_security] | persona_weight: 1.2
Text: An enterprise prospect asks your sales team to prove that their data will be completely isolated from other tenants before they sign. What evidence can your security team provide within 24 hours?
Options:
  1 → We can describe the architecture verbally but have no documentation or automated verification to share quickly
  2 → We have architecture documentation that describes tenant isolation at the database and application layer
  3 → We have architecture docs and automated tests that verify tenant isolation and run in our CI pipeline
  4 → We have a trust portal: continuous tenant isolation verification tests run after every deploy, penetration test results from the last 90 days are published, and real-time monitoring alerts if any API request accesses data outside the authenticated tenant — enterprise prospects access this portal directly during due diligence

Q25 | weight: 1.5 | tactical | personas: [ciso_vp_security, security_engineer] | persona_weight: 1.2
Text: Your endpoint detection system catches a ransomware attempt on a developer laptop at 11pm. How does your incident response process activate and what happens in the first 30 minutes?
Options:
  1 → The security team finds out the next morning when someone reads the overnight alert digest
  2 → An on-call engineer is paged and begins investigating manually — there is no documented IR playbook to follow
  3 → We have an IR runbook and a security on-call rotation; the engineer follows the playbook step by step
  4 → Automated SOAR triggers within 60 seconds: the endpoint is isolated, the on-call engineer is paged with full attack context including MITRE ATT&CK mapping and blast radius estimate, lateral movement detection activates across the estate, and a war room is created in Slack with relevant logs and the incident playbook attached — all before a human makes their first decision
```
