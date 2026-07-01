"""
Agent 1: Research Agent

Runs at /register time (non-blocking background task).
Uses DuckDuckGo Search to build a structured company profile stored in
accounts.research_cache (JSONB, 7-day TTL).

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

# Per-account lock prevents concurrent Agent 1 runs for the same account (e.g. background
# task from /register racing with orchestrator re-run when cache is NULL at /submit time).
_research_locks: dict[str, asyncio.Lock] = {}

_SYSTEM_PROMPT = """You are a technology analyst researching companies for a maturity assessment.
Given a company name, website, and search results, return a structured JSON company profile.
Focus on:
- What the company does (products/services)
- Industry vertical
- Company size (employees, funding stage if startup)
- Technology signals (cloud providers, programming languages, open source tools)
- Whether they appear to be building AI-powered products
- Key technology challenges their industry typically faces
- Business outcomes that define success for this company — based on what they build and who
  they serve (e.g., an e-commerce company: increased sales conversion, customer retention;
  a SaaS company: churn reduction, expansion revenue, uptime).

Return ONLY valid JSON with this exact structure, no preamble, no markdown:
{{
  "company_name": string,
  "industry": string,
  "company_size": "startup" | "mid-market" | "enterprise",
  "products_summary": string,
  "technology_signals": string[],
  "builds_ai_products": boolean,
  "cloud_providers": string[],
  "key_challenges": string[],
  "business_outcomes": string[]
}}"""


def _should_refresh(account: Account) -> bool:
    if account.research_cache is None:
        return True
    if account.research_cached_at is None:
        return True
    age = datetime.now(timezone.utc) - account.research_cached_at
    return age > timedelta(days=7)


def _strip_markdown_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        # drop opening fence (```json or ```)
        lines = lines[1:]
        # drop closing fence
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    return text


async def run_research_agent(
    account_id: UUID,
    company_name: str,
    company_website: str | None,
    db: AsyncSession,
) -> dict[str, Any]:
    """Research the company and store the result in accounts.research_cache.

    Returns the cache dict so the caller can use it immediately if needed.
    Raises no exceptions — failures are logged and a minimal profile returned.
    """
    lock = _research_locks.setdefault(str(account_id), asyncio.Lock())
    async with lock:
        return await _run_research_agent_locked(account_id, company_name, company_website, db)


async def _run_research_agent_locked(
    account_id: UUID,
    company_name: str,
    company_website: str | None,
    db: AsyncSession,
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

    # DuckDuckGo search for company signals
    search_results = ""
    try:
        from langchain_community.tools import DuckDuckGoSearchRun  # noqa: PLC0415

        tool = DuckDuckGoSearchRun()
        query = f"{company_name} technology stack engineering"
        if company_website:
            query = f"{company_name} {company_website} products technology"
        search_results = await asyncio.to_thread(tool.run, query)
        logger.info("run_research_agent: search complete for company=%s", company_name)
    except Exception:
        logger.error(
            "run_research_agent: search failed for company=%s — proceeding without results",
            company_name,
            exc_info=True,
        )

    # LLM synthesis
    try:
        prompt = ChatPromptTemplate.from_messages(
            [
                ("system", _SYSTEM_PROMPT),
                (
                    "human",
                    "Company name: {company_name}\n"
                    "Website: {company_website}\n\n"
                    "Search results:\n{search_results}\n\n"
                    "Return the JSON profile.",
                ),
            ]
        )
        chain = prompt | get_llm() | StrOutputParser()
        raw = await chain.ainvoke(
            {
                "company_name": company_name,
                "company_website": company_website or "not provided",
                "search_results": search_results or "No search results available.",
            }
        )
        profile = json.loads(_strip_markdown_fences(raw))

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
        "industry": "unknown",
        "company_size": "unknown",
        "products_summary": "",
        "technology_signals": [],
        "builds_ai_products": False,
        "cloud_providers": [],
        "key_challenges": [],
        "business_outcomes": [],
    }
