"""
Question Selection Agent (Agent 2)

LLM-based agent that selects the 12 most diagnostic questions for a prospect.
Runs synchronously at /select-pillar time (~3–8 seconds). Implemented in Task 9.

Architecture (05-architecture-api.md §1.3):
  - Input: prospect persona, pillar context, research_cache from Agent 1,
    candidate question list (general + persona-eligible) with id/text/context_tags
  - LLM selects 12 question IDs ordered for maximum diagnostic value
  - When research_cache is populated: prefers questions whose context_tags match
    company tech stack, cloud providers, industry, and business outcomes
  - When research_cache is empty: selects based on persona expertise only
  - Fallback (if LLM fails/times out): 4 general + 8 persona-eligible by display_order

The rule-based fallback scoring helper lives in services/question_service.py.
"""
from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

logger = logging.getLogger(__name__)


async def select_questions(
    pillar_id: UUID,
    persona: str,
    research_cache: dict[str, Any] | None,
    db: Any,
) -> list[dict[str, Any]]:
    """Return 12 questions for the given pillar and persona.

    Args:
        pillar_id: UUID of the selected pillar.
        persona: Prospect's role string (must match persona enum).
        research_cache: Parsed accounts.research_cache JSONB, or None if not ready.
        db: Async SQLAlchemy session.

    Returns:
        List of 12 question dicts with answer_options, ordered for display.
    """
    raise NotImplementedError("Implemented in Task 9 — LLM Agents")
