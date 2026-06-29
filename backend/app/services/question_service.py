"""
Question selection and scoring service.

Implements the research-informed question selection algorithm described in
04-data-model.md §8. Called by the /select-pillar endpoint (Task 7) and
the LangGraph orchestrator (Task 9).
"""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


def score_question(
    context_tags: list[str],
    tech_signals: list[str] | None,
    cloud_providers: list[str] | None,
) -> float:
    """Score a question by matching its context_tags against research signals.

    Base score 1.0, +0.5 per matching tag. Returns 1.0 when context_tags is
    empty (question is universally applicable) or when no signals are available.

    Args:
        context_tags: Lowercase technology signal strings on the question.
        tech_signals: technology_signals from accounts.research_cache, or None.
        cloud_providers: cloud_providers from accounts.research_cache, or None.
    """
    if not context_tags:
        return 1.0
    signal_set = {s.lower() for s in (tech_signals or []) + (cloud_providers or [])}
    if not signal_set:
        return 1.0
    matches = sum(1 for tag in context_tags if tag.lower() in signal_set)
    return 1.0 + 0.5 * matches
