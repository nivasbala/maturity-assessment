"""
Agent 1: Research Agent

Runs at /register time (non-blocking background task).
Uses DuckDuckGo Search to build a structured company profile stored in
accounts.research_cache (JSONB, 7-day TTL).

Two inputs (spec §1.2):
  1. Web-searchable: company_name, company_website
  2. Prospect-provided (highest priority): infrastructure_location,
     tech_stack_description, current_tools

Output schema (drops technology_signals, adds target_customers,
operational_scale, data_confidence, research_notes per spec v1.6):
  industry, company_size, products_summary, target_customers,
  builds_ai_products, cloud_providers, key_challenges, business_outcomes,
  operational_scale, data_confidence, research_notes, news_insights

Cache behavior:
  - If accounts.research_cached_at is within 7 days, skip and use existing cache.
  - If cache is stale or NULL, run the search and update the cache.
  - If search or LLM fails, write a minimal profile so downstream steps always
    have something to work with.
"""
from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.llm_factory import get_llm
from app.models.prospect import Prospect

logger = logging.getLogger(__name__)

# Per-prospect lock for prospect-scoped research.
_prospect_research_locks: dict[str, asyncio.Lock] = {}

_SYSTEM_PROMPT = """\
You are a business intelligence analyst preparing a company profile for a \
technology maturity assessment. You have THREE inputs: direct context from \
the prospect, publicly available web information, and recent news articles \
(past 30-60 days). Synthesize all three into a precise, grounded profile.

ACCURACY RULE: Do not infer or fabricate. If a field cannot be determined \
from the inputs, use the exact default value specified. A missing value is \
better than an incorrect one.

INPUT 1 — PROSPECT-PROVIDED CONTEXT (highest priority — treat as ground truth)
The following was stated directly by the prospect:
  Infrastructure & deployment:  {infrastructure_location}
  Tech stack description:       {tech_stack_description}
  Current tools:                {current_tools}
  Key challenges they stated:   {key_challenges_input}

Empty fields above mean the prospect did not provide that information.

INPUT 2 — WEB RESEARCH (company profile)
{search_results}

Trusted sources: company website, LinkedIn, Crunchbase, press releases.
Ignore sources older than 3 years.

INPUT 3 — RECENT NEWS (past 30-60 days)
{news_results}

Topics searched: security incidents or investments, AI/ML initiatives, \
observability/monitoring investments, cost optimization or efficiency programs. \
If this section is empty or shows no results, no relevant recent news was found.

SYNTHESIS RULES
1. cloud_providers: extract from prospect's infrastructure_location (e.g. \
"AWS us-east-1 and GCP europe-west" → ["aws", "gcp"]). If empty, check web research.
2. key_challenges: if the prospect provided key_challenges_input, use \
those as-is or lightly paraphrase — they are authoritative. Supplement with \
challenges inferred from product type and company scale only if the prospect \
provided fewer than 3. Must be company-specific and operational.
3. business_outcomes: derive from business model + customer type from web research.
4. DO NOT include technology_signals — prospect tech context is passed separately \
to downstream agents as raw text. Do not duplicate it in this output.
5. DO NOT infer what technologies the company uses from web research.
6. news_insights: synthesize relevant signals from INPUT 3. Focus on: security \
posture and investments, AI/ML adoption or plans, observability/monitoring \
maturity signals, and operational efficiency programs. Frame ALL findings \
constructively and positively — a security incident becomes an opportunity to \
invest in resilience and secure-by-design practices; a cost-reduction program \
signals an operational excellence mindset and appetite for efficient tooling; \
AI investment signals a forward-thinking, innovation-led culture; observability \
investment signals engineering maturity and reliability focus. \
Write 2-4 sentences. Use empty string "" if INPUT 3 contains no relevant signals.

FIELD DEFINITIONS AND DEFAULT VALUES

company_name: The company's official name as it appears publicly.

industry: Single lowercase label. Examples: "saas", "fintech", "healthcare", \
"e-commerce", "cybersecurity", "devtools", "media", "logistics", \
"gaming", "edtech", "ai", "manufacturing", "telecom". Default: "technology"

company_size: Infer from employee count or funding signals.
  "startup"    = <100 employees or Seed/Series A
  "mid-market" = 100-999 employees or Series B/C/D
  "enterprise" = 1000+ employees or publicly traded
  Default: "mid-market"

products_summary: 2-3 sentences: what they build, who uses it, what problem \
it solves. Specific to this company — not a generic category description.
Default: "Insufficient public information to summarize products."

target_customers: Who the company sells to. Be specific about segment, size, \
and type. Default: "unknown"

builds_ai_products: true = company ships AI-powered features to end customers. \
false = uses AI internally only, or no AI involvement. Default: false

cloud_providers: Extracted from prospect's infrastructure_location, normalized \
to lowercase. Valid values: "aws", "gcp", "azure", "cloudflare", "vercel", \
"heroku", "on-premises". Default: []

key_challenges: 4-6 challenges SPECIFIC to this company. Each must be concrete \
and operational — not generic. Default: []

business_outcomes: 4-6 measurable outcomes defining commercial success. \
Tied to their specific business model and customer base. Default: []

operational_scale: 2-4 key scale indicators. Infer from job postings, engineering \
blogs, case studies. Default: []

data_confidence:
  "high"   = rich public presence, multiple independent confirming sources
  "medium" = some information found; some fields estimated from context
  "low"    = minimal public information; most fields from defaults or prospect input
  REQUIRED.

research_notes: One sentence noting anything significant about data quality or \
sourcing. Use empty string if nothing notable. Default: ""

news_insights: 2-4 sentences summarizing relevant signals found in recent news \
(past 30-60 days) related to security, AI/ML, observability, or cost/efficiency. \
Frame constructively and positively. Empty string "" if no relevant signals found.

observability_outcome: 2-4 sentences synthesizing what observability investments \
would deliver the most value for THIS company, drawn from ALL three inputs: \
(1) the prospect's stated key_challenges_input, (2) signals from web research \
(company scale, engineering complexity, AI product footprint), and (3) recent news \
(security incidents → security observability; AI/ML investment → LLM/model \
observability; cost programs → efficiency and SLO-driven alerting). \
Be specific to this company — name the outcome type (e.g. "real-user monitoring", \
"distributed tracing", "security signal correlation", "LLM cost and latency \
visibility"). Empty string "" only if there is genuinely no basis for any \
observability recommendation.

RETURN EXACTLY THIS JSON — no preamble, no markdown fences, no explanation:
{{
  "company_name": "string",
  "industry": "string",
  "company_size": "startup | mid-market | enterprise",
  "products_summary": "string",
  "target_customers": "string",
  "builds_ai_products": false,
  "cloud_providers": [],
  "key_challenges": [],
  "business_outcomes": [],
  "operational_scale": [],
  "data_confidence": "high | medium | low",
  "research_notes": "string",
  "news_insights": "string",
  "observability_outcome": "string"
}}"""


from app.core.json_utils import extract_json_object as _extract_json_object


async def run_research_agent_for_prospect(
    prospect_id: UUID,
    company_name: str,
    company_website: str | None,
    db: AsyncSession,
    infrastructure_location: str | None = None,
    tech_stack_description: str | None = None,
    current_tools: str | None = None,
    key_challenges_input: str | None = None,
) -> dict[str, Any]:
    """Research the company and store the result in prospects.research_cache.

    Prospect-scoped version of run_research_agent. Returns the cache dict.
    Raises no exceptions — failures are logged and a minimal profile returned.
    """
    lock = _prospect_research_locks.setdefault(str(prospect_id), asyncio.Lock())
    async with lock:
        return await _run_research_agent_for_prospect_locked(
            prospect_id,
            company_name,
            company_website,
            db,
            infrastructure_location,
            tech_stack_description,
            current_tools,
            key_challenges_input,
        )


async def _run_research_agent_for_prospect_locked(
    prospect_id: UUID,
    company_name: str,
    company_website: str | None,
    db: AsyncSession,
    infrastructure_location: str | None,
    tech_stack_description: str | None,
    current_tools: str | None,
    key_challenges_input: str | None = None,
) -> dict[str, Any]:
    prospect = (
        await db.execute(select(Prospect).where(Prospect.id == prospect_id))
    ).scalar_one_or_none()

    if not prospect:
        logger.warning("run_research_agent_for_prospect: prospect %s not found", prospect_id)
        return _build_minimal_profile(company_name)

    if not _should_refresh(prospect):
        logger.info(
            "run_research_agent_for_prospect: cache fresh for prospect_id=%s — skipping",
            prospect_id,
        )
        return prospect.research_cache  # type: ignore[return-value]

    # DuckDuckGo web search — two passes: general profile + recent news
    search_results = ""
    news_results = ""
    try:
        from ddgs import DDGS  # noqa: PLC0415

        general_queries = [
            f"{company_name} company products customers overview",
            f"{company_name} engineering technology stack infrastructure",
        ]
        if company_website:
            general_queries.append(f"{company_name} {company_website} funding size employees")

        news_queries = [
            f"{company_name} security breach cybersecurity incident investment 2025 2026",
            f"{company_name} artificial intelligence AI machine learning investment plan 2025 2026",
            f"{company_name} observability monitoring reliability infrastructure news 2025 2026",
            f"{company_name} cost reduction efficiency optimization layoffs 2025 2026",
        ]

        def _run_ddgs_search(
            qs: list[str], timelimit: str | None = None
        ) -> list[dict]:
            import concurrent.futures

            all_results: list[dict] = []
            seen_urls: set[str] = set()
            with DDGS() as ddgs, concurrent.futures.ThreadPoolExecutor(max_workers=1) as ex:
                for q in qs:
                    try:
                        kwargs: dict = {"max_results": 4}
                        if timelimit:
                            kwargs["timelimit"] = timelimit
                        future = ex.submit(list, ddgs.text(q, **kwargs))
                        results = future.result(timeout=10)
                        for r in results:
                            url = r.get("href", "")
                            if url not in seen_urls:
                                seen_urls.add(url)
                                all_results.append(r)
                    except concurrent.futures.TimeoutError:
                        logger.warning(
                            "run_research_agent_for_prospect: query %r timed out — skipping", q
                        )
                    except Exception as e:
                        logger.warning(
                            "run_research_agent_for_prospect: query %r failed — %s", q, e
                        )
            return all_results

        general_results = await asyncio.to_thread(_run_ddgs_search, general_queries, None)
        search_results = "\n\n".join(
            f"{r.get('title', '')}: {r.get('body', '')}" for r in general_results
        )

        # News pass: past month first; if sparse, retry without time limit for recent-year queries
        news_hits = await asyncio.to_thread(_run_ddgs_search, news_queries, "m")
        if len(news_hits) < 2:
            logger.info(
                "run_research_agent_for_prospect: sparse news with timelimit=m (%d hits) — retrying broader",
                len(news_hits),
            )
            news_hits = await asyncio.to_thread(_run_ddgs_search, news_queries, None)
        news_results = "\n\n".join(
            f"{r.get('title', '')}: {r.get('body', '')}" for r in news_hits
        ) or "No recent news found."

        # Collect deduplicated sources (title + url) from both passes for UI display
        seen_source_urls: set[str] = set()
        collected_sources: list[dict[str, str]] = []
        for r in general_results + news_hits:
            url = r.get("href", "")
            title = r.get("title", "")
            if url and url not in seen_source_urls:
                seen_source_urls.add(url)
                collected_sources.append({"title": title, "url": url})

        logger.info(
            "run_research_agent_for_prospect: search complete company=%s general=%d news=%d sources=%d",
            company_name,
            len(general_results),
            len(news_hits),
            len(collected_sources),
        )
    except Exception:
        logger.error(
            "run_research_agent_for_prospect: search failed for company=%s — proceeding without",
            company_name,
            exc_info=True,
        )
        collected_sources = []

    try:
        prompt = ChatPromptTemplate.from_messages(
            [
                ("system", _SYSTEM_PROMPT),
                (
                    "human",
                    "Company name: {company_name}\nWebsite: {company_website}\n\n"
                    "Return the JSON profile.",
                ),
            ]
        )
        chain = prompt | get_llm(json_mode=True) | StrOutputParser()
        raw = await chain.ainvoke(
            {
                "company_name": company_name,
                "company_website": company_website or "not provided",
                "infrastructure_location": infrastructure_location or "(not provided)",
                "tech_stack_description": tech_stack_description or "(not provided)",
                "current_tools": current_tools or "(not provided)",
                "key_challenges_input": key_challenges_input or "(not provided)",
                "search_results": search_results or "No search results available.",
                "news_results": news_results or "No recent news found.",
            }
        )
        profile = json.loads(_extract_json_object(raw))
        profile["sources"] = collected_sources

        prospect.research_cache = profile
        prospect.research_cached_at = datetime.now(timezone.utc)
        await db.commit()
        logger.info("run_research_agent_for_prospect: cached profile for prospect_id=%s", prospect_id)
        return profile  # type: ignore[return-value]

    except Exception:
        logger.error(
            "run_research_agent_for_prospect: LLM synthesis failed for company=%s",
            company_name,
            exc_info=True,
        )
        fallback = _build_minimal_profile(company_name)
        try:
            prospect.research_cache = fallback
            prospect.research_cached_at = datetime.now(timezone.utc)
            await db.commit()
        except Exception:
            logger.error(
                "run_research_agent_for_prospect: failed to persist fallback for prospect_id=%s",
                prospect_id,
                exc_info=True,
            )
        return fallback


def _should_refresh(account: Any) -> bool:
    """Return True if the research cache is absent or older than 7 days."""
    if not account.research_cache or not account.research_cached_at:
        return True
    cached_at = account.research_cached_at
    if cached_at.tzinfo is None:
        cached_at = cached_at.replace(tzinfo=timezone.utc)
    age = datetime.now(timezone.utc) - cached_at
    return age.total_seconds() > 7 * 24 * 3600


def _build_minimal_profile(company_name: str) -> dict[str, Any]:
    """Fallback profile when search or LLM fails."""
    return {
        "company_name": company_name,
        "industry": "technology",
        "company_size": "mid-market",
        "products_summary": "Insufficient public information to summarize products.",
        "target_customers": "unknown",
        "builds_ai_products": False,
        "cloud_providers": [],
        "key_challenges": [],
        "business_outcomes": [],
        "operational_scale": [],
        "data_confidence": "low",
        "research_notes": "Research could not be completed.",
        "news_insights": "",
        "observability_outcome": "",
        "sources": [],
    }
