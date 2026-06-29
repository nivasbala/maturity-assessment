---
title: Question Bank — Seed Data
version: 1.1
last_updated: 2026-06-28
---

# Question Bank — Seed Data

> **When to load this file:** Task 4 (seed data) and Task 7 (prospect landing flow — question selection logic). Do not load for any other task. P4 questions are included here but P4 is seeded with `is_active = FALSE` — seed them regardless, the pillar will not appear to prospects until activated via the admin panel.

---

## 1. QUESTION SELECTION RULES

For each assessment session, select 12 questions using this logic:

1. Select ALL questions where `is_general = TRUE` for this pillar (target: 4 questions)
2. Build persona-eligible pool: all active questions with the prospect's persona in `question_personas`
3. If `accounts.research_cache` is available (Agent 1 has completed):
   - Score each question in the persona pool using `context_tags` vs research signals (see `04-data-model.md` Section 8)
   - Select top 8 by score; ties broken by `display_order`
4. If research cache NOT available: select first 8 persona-eligible questions by `display_order`
5. If persona-eligible questions < 8: backfill with additional general questions
6. Final count: exactly 12 questions per session
7. Order: general questions first (by `display_order`), then persona-specific (by `display_order`)
8. Only select questions where `is_active = TRUE`

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

---

## 5. P3: AI SYSTEM OBSERVABILITY

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
