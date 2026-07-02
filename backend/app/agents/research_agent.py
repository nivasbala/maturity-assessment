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
  operational_scale, data_confidence, research_notes

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
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.llm_factory import get_llm
from app.models.account import Account

logger = logging.getLogger(__name__)

# Per-account lock prevents concurrent Agent 1 runs for the same account.
_research_locks: dict[str, asyncio.Lock] = {}

_SYSTEM_PROMPT = """\
You are a business intelligence analyst preparing a company profile for a \
technology maturity assessment. You have TWO inputs: publicly available \
web information AND direct context provided by the prospect. Synthesize \
both into a precise, grounded profile.

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

INPUT 2 — WEB RESEARCH
Search results:
{search_results}

Trusted sources: company website, LinkedIn, Crunchbase, press releases.
Ignore sources older than 3 years.

SYNTHESIS RULES
1. cloud_providers: extract from prospect's infrastructure_location (e.g. \
"AWS us-east-1 and GCP europe-west" → ["aws", "gcp"]). If empty, check web research.
2. key_challenges: if the prospect provided key_challenges they mentioned, use \
those as-is or lightly paraphrase — they are authoritative. Supplement with \
challenges inferred from product type and company scale only if the prospect \
provided fewer than 3. Must be company-specific and operational.
3. business_outcomes: derive from business model + customer type from web research.
4. DO NOT include technology_signals — prospect tech context is passed separately \
to downstream agents as raw text. Do not duplicate it in this output.
5. DO NOT infer what technologies the company uses from web research.

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

research_notes: One sentence noting anything significant. Use empty string if \
nothing notable. Default: ""

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
  "research_notes": "string"
}}"""


def _should_refresh(account: Account) -> bool:
    if account.research_cache is None:
        return True
    if account.research_cached_at is None:
        return True
    age = datetime.now(timezone.utc) - account.research_cached_at
    return age > timedelta(days=7)


def _extract_json_object(text: str) -> str:
    """Extract the first complete JSON object from text, handling prose preamble."""
    text = text.strip()
    start = text.find("{")
    if start == -1:
        raise ValueError("No JSON object found in LLM response")
    # Find matching closing brace tracking depth and string context
    depth = 0
    in_string = False
    escape_next = False
    for i, ch in enumerate(text[start:], start):
        if escape_next:
            escape_next = False
            continue
        if ch == "\\" and in_string:
            escape_next = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return text[start : i + 1]
    raise ValueError("Incomplete JSON object in LLM response")


async def run_research_agent(
    account_id: UUID,
    company_name: str,
    company_website: str | None,
    db: AsyncSession,
    infrastructure_location: str | None = None,
    tech_stack_description: str | None = None,
    current_tools: str | None = None,
    key_challenges_input: str | None = None,
) -> dict[str, Any]:
    """Research the company and store the result in accounts.research_cache.

    Returns the cache dict so the caller can use it immediately if needed.
    Raises no exceptions — failures are logged and a minimal profile returned.
    """
    lock = _research_locks.setdefault(str(account_id), asyncio.Lock())
    async with lock:
        return await _run_research_agent_locked(
            account_id,
            company_name,
            company_website,
            db,
            infrastructure_location,
            tech_stack_description,
            current_tools,
            key_challenges_input,
        )


async def _run_research_agent_locked(
    account_id: UUID,
    company_name: str,
    company_website: str | None,
    db: AsyncSession,
    infrastructure_location: str | None,
    tech_stack_description: str | None,
    current_tools: str | None,
    key_challenges_input: str | None = None,
) -> dict[str, Any]:
    account = (
        await db.execute(select(Account).where(Account.id == account_id))
    ).scalar_one_or_none()

    if not account:
        logger.warning("run_research_agent: account %s not found", account_id)
        return _build_minimal_profile(company_name)

    if not _should_refresh(account):
        logger.info("run_research_agent: cache hit for account_id=%s", account_id)
        return account.research_cache  # type: ignore[return-value]

    # DuckDuckGo web search — 2-3 queries for richer coverage, run in a thread
    # to avoid blocking the async event loop with synchronous HTTP calls.
    search_results = ""
    try:
        from ddgs import DDGS  # noqa: PLC0415

        queries = [
            f"{company_name} company products customers overview",
            f"{company_name} engineering technology stack infrastructure",
        ]
        if company_website:
            queries.append(f"{company_name} {company_website} funding size employees")

        def _run_ddgs_search(qs: list[str]) -> list[dict]:
            all_results: list[dict] = []
            seen_urls: set[str] = set()
            with DDGS() as ddgs:
                for q in qs:
                    try:
                        for r in ddgs.text(q, max_results=4):
                            url = r.get("href", "")
                            if url not in seen_urls:
                                seen_urls.add(url)
                                all_results.append(r)
                    except Exception as e:
                        logger.warning(
                            "run_research_agent: query %r failed — %s", q, e
                        )
            return all_results

        all_results = await asyncio.to_thread(_run_ddgs_search, queries)
        search_results = "\n\n".join(
            f"{r.get('title', '')}: {r.get('body', '')}" for r in all_results
        )
        logger.info(
            "run_research_agent: search complete for company=%s results=%d",
            company_name,
            len(all_results),
        )
    except Exception:
        logger.error(
            "run_research_agent: search failed for company=%s — proceeding without results",
            company_name,
            exc_info=True,
        )

    # LLM synthesis with dual inputs
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
            }
        )
        profile = json.loads(_extract_json_object(raw))

        account.research_cache = profile
        account.research_cached_at = datetime.now(timezone.utc)
        await db.commit()
        logger.info("run_research_agent: cached profile for account_id=%s", account_id)
        return profile  # type: ignore[return-value]

    except Exception:
        logger.error(
            "run_research_agent: LLM synthesis failed for company=%s",
            company_name,
            exc_info=True,
        )
        fallback = _build_minimal_profile(company_name)
        try:
            account.research_cache = fallback
            account.research_cached_at = datetime.now(timezone.utc)
            await db.commit()
        except Exception:
            logger.error(
                "run_research_agent: failed to persist fallback cache for account_id=%s",
                account_id,
                exc_info=True,
            )
        return fallback


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
    }
