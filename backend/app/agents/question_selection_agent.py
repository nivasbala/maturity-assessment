"""
Question Selection Agent

Uses the research cache produced by Agent 1 (research_agent.py) to rank and
select the 12 questions shown to a prospect:
  - Step 1: always include all general questions (is_general=TRUE) → 4 questions
  - Step 2: build persona-eligible pool (question_personas join for this persona)
  - Step 3a (cache ready): score each question by matching context_tags against
    tech_signals + cloud_providers from research_cache
    (score = 1.0 + 0.5 per matching tag), select top 8
  - Step 3b (cache absent): select first 8 by display_order (persona-only fallback)

Returns exactly 12 questions regardless of whether the research cache is populated.
No LLM is called here — this is a deterministic ranking algorithm.

The scoring helper lives in services/question_service.py (per 04-data-model.md §8).
Import it from there; do not duplicate it here.
"""
from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from app.services.question_service import score_question  # noqa: F401 — re-exported for callers

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
