"""
Scoring Service

Implements the pillar scoring formula from spec/04-data-model.md Section 3.

  pillar_score = Σ(maturity_level × question_weight × persona_weight)
               / Σ(4 × question_weight × persona_weight)
               × 4

Rules:
  - is_general=TRUE → persona_weight = 1.0
  - persona-specific → use question_personas.persona_weight for this role
  - Result normalized to 1.00–4.00, rounded to 2 decimal places

Maturity level ranges (Section 2):
  1 Reactive   : 1.00 – 1.74
  2 Developing : 1.75 – 2.49
  3 Defined    : 2.50 – 3.24
  4 Optimized  : 3.25 – 4.00
"""
from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.question import AnswerOption, Question

logger = logging.getLogger(__name__)

_MATURITY_RANGES = [
    (1.75, 1, "Reactive"),
    (2.50, 2, "Developing"),
    (3.25, 3, "Defined"),
    (float("inf"), 4, "Optimized"),
]

# Map question_weight → sub-area label for the radar chart breakdown
_WEIGHT_TIER_NAMES = {
    1.0: "Core",
    1.5: "Key Skills",
    2.0: "Advanced",
}


def _score_to_label(score: float) -> tuple[int, str]:
    for threshold, level, label in _MATURITY_RANGES:
        if score < threshold:
            return level, label
    return 4, "Optimized"


async def compute_pillar_score(
    db: AsyncSession,
    answer_pairs: list[tuple[UUID, UUID]],
    persona: str,
) -> tuple[float, int, str, dict[str, float]]:
    """Compute the pillar maturity score from submitted answers.

    Args:
        db: Async database session.
        answer_pairs: List of (question_id, answer_option_id) from the submission.
        persona: Prospect's persona enum value (e.g. 'sre_platform_engineer').

    Returns:
        Tuple of (pillar_score, maturity_level, maturity_label, pillar_breakdown).
        pillar_breakdown maps sub-area names to their weighted scores (3 tiers by question_weight).
    """
    if not answer_pairs:
        logger.warning("compute_pillar_score called with no answers — returning minimum score")
        return 1.0, 1, "Reactive", {}

    question_ids = [pair[0] for pair in answer_pairs]
    answer_option_ids = [pair[1] for pair in answer_pairs]

    questions = {
        q.id: q
        for q in (
            await db.execute(
                select(Question)
                .options(selectinload(Question.personas))
                .where(Question.id.in_(question_ids))
            )
        )
        .scalars()
        .all()
    }

    answer_options = {
        ao.id: ao
        for ao in (
            await db.execute(select(AnswerOption).where(AnswerOption.id.in_(answer_option_ids)))
        )
        .scalars()
        .all()
    }

    numerator = 0.0
    denominator = 0.0

    # Track per-tier numerators and denominators for pillar_breakdown
    tier_num: dict[float, float] = {1.0: 0.0, 1.5: 0.0, 2.0: 0.0}
    tier_den: dict[float, float] = {1.0: 0.0, 1.5: 0.0, 2.0: 0.0}

    for question_id, answer_option_id in answer_pairs:
        q = questions.get(question_id)
        ao = answer_options.get(answer_option_id)
        if q is None or ao is None:
            logger.error(
                "compute_pillar_score: missing question_id=%s or answer_option_id=%s",
                question_id,
                answer_option_id,
            )
            continue

        if q.is_general:
            persona_weight = 1.0
        else:
            persona_entry = next((p for p in q.personas if p.persona == persona), None)
            persona_weight = float(persona_entry.persona_weight) if persona_entry else 1.0

        q_weight = float(q.question_weight)
        contrib_num = ao.maturity_level * q_weight * persona_weight
        contrib_den = 4 * q_weight * persona_weight

        numerator += contrib_num
        denominator += contrib_den

        tier = round(q_weight, 1)
        if tier in tier_num:
            tier_num[tier] += contrib_num
            tier_den[tier] += contrib_den

    if denominator == 0:
        logger.warning("compute_pillar_score: zero denominator — returning minimum score")
        return 1.0, 1, "Reactive", {}

    raw_score = (numerator / denominator) * 4
    score = round(max(1.0, min(4.0, raw_score)), 2)
    level, label = _score_to_label(score)

    # Compute per-tier scores; tiers with no answered questions fall back to overall score
    pillar_breakdown: dict[str, float] = {}
    for tier_weight, tier_name in _WEIGHT_TIER_NAMES.items():
        if tier_den[tier_weight] > 0:
            raw_tier = (tier_num[tier_weight] / tier_den[tier_weight]) * 4
            pillar_breakdown[tier_name] = round(max(1.0, min(4.0, raw_tier)), 2)
        else:
            pillar_breakdown[tier_name] = score

    logger.info(
        "compute_pillar_score: persona=%s score=%.2f level=%d label=%s breakdown=%s",
        persona,
        score,
        level,
        label,
        pillar_breakdown,
    )
    return score, level, label, pillar_breakdown
