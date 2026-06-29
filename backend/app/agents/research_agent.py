"""
Agent 1: Research Agent

Runs at /register time (non-blocking background task).
Uses DuckDuckGo Search to build a structured company profile stored in
accounts.research_cache (JSONB, 7-day TTL).

This agent's output is consumed by two downstream steps:
  1. question_selection_agent.py  — ranks persona-eligible questions
  2. report_agent.py              — personalises the maturity report narrative

Cache behavior:
  - If accounts.research_cached_at is within 7 days, skip and use existing cache.
  - If cache is stale or NULL, run the search and update the cache.
  - If search fails entirely, write a minimal profile from company_name alone so
    downstream steps always have something to work with.
"""
from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

logger = logging.getLogger(__name__)


async def run_research_agent(
    account_id: UUID,
    company_name: str,
    company_website: str | None,
    db: Any,
) -> dict[str, Any]:
    """Research the company and store the result in accounts.research_cache.

    Returns the cache dict so the caller can use it immediately if needed.
    Raises no exceptions — failures are logged and a minimal profile returned.
    """
    raise NotImplementedError("Implemented in Task 9 — LLM Agents")


def _build_minimal_profile(company_name: str) -> dict[str, Any]:
    """Fallback profile when search fails."""
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
