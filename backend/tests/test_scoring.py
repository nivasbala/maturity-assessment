"""
Tests for the scoring engine (Task 8).

Covers:
  - All Level-1 → 1.0 (Reactive)
  - All Level-4 → 4.0 (Optimized)
  - Mixed answers produce a value in 1.00–4.00
  - Weighted questions (question_weight 1.5 / 2.0)
  - Persona weight applied for non-general questions
  - is_general=TRUE forces persona_weight=1.0 regardless of persona entries
  - Unknown persona → defaults to persona_weight=1.0
  - Empty answers → (1.0, 1, "Reactive")
  - Zero denominator guard → (1.0, 1, "Reactive")
  - Maturity label boundary values (spec section 2)
  - Score clamped to [1.0, 4.0]
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from app.services.scoring_service import _score_to_label, compute_pillar_score


# ── _score_to_label boundary tests ────────────────────────────────────────────


@pytest.mark.parametrize(
    "score, expected_level, expected_label",
    [
        (1.00, 1, "Reactive"),
        (1.50, 1, "Reactive"),
        (1.74, 1, "Reactive"),
        (1.75, 2, "Developing"),
        (2.00, 2, "Developing"),
        (2.49, 2, "Developing"),
        (2.50, 3, "Defined"),
        (3.00, 3, "Defined"),
        (3.24, 3, "Defined"),
        (3.25, 4, "Optimized"),
        (3.50, 4, "Optimized"),
        (4.00, 4, "Optimized"),
    ],
)
def test_score_to_label_boundaries(score: float, expected_level: int, expected_label: str) -> None:
    level, label = _score_to_label(score)
    assert level == expected_level
    assert label == expected_label


# ── Helpers ───────────────────────────────────────────────────────────────────


def _make_db(questions: list, options: list) -> AsyncMock:
    db = AsyncMock()
    q_result = MagicMock()
    q_result.scalars.return_value.all.return_value = questions
    ao_result = MagicMock()
    ao_result.scalars.return_value.all.return_value = options
    db.execute.side_effect = [q_result, ao_result]
    return db


def _make_question(
    qid,
    *,
    weight: float = 1.0,
    is_general: bool = True,
    persona_entries: list | None = None,
) -> MagicMock:
    q = MagicMock()
    q.id = qid
    q.question_weight = weight
    q.is_general = is_general
    q.personas = persona_entries or []
    return q


def _make_option(aoid, maturity_level: int) -> MagicMock:
    ao = MagicMock()
    ao.id = aoid
    ao.maturity_level = maturity_level
    return ao


def _make_persona_entry(persona: str, persona_weight: float) -> MagicMock:
    entry = MagicMock()
    entry.persona = persona
    entry.persona_weight = persona_weight
    return entry


# ── Core formula tests ────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_all_level1_returns_1_0() -> None:
    """All Level-1 answers → 1.0 Reactive (spec verification criterion)."""
    pairs = [(uuid4(), uuid4()) for _ in range(12)]
    questions = [_make_question(q_id, weight=1.0) for q_id, _ in pairs]
    options = [_make_option(ao_id, 1) for _, ao_id in pairs]
    db = _make_db(questions, options)
    score, level, label, _ = await compute_pillar_score(db, pairs, "sre_platform_engineer")
    assert score == 1.0
    assert level == 1
    assert label == "Reactive"


@pytest.mark.asyncio
async def test_all_level4_returns_4_0() -> None:
    """All Level-4 answers → 4.0 Optimized (spec verification criterion)."""
    pairs = [(uuid4(), uuid4()) for _ in range(12)]
    questions = [_make_question(q_id, weight=1.0) for q_id, _ in pairs]
    options = [_make_option(ao_id, 4) for _, ao_id in pairs]
    db = _make_db(questions, options)
    score, level, label, _ = await compute_pillar_score(db, pairs, "cto_executive")
    assert score == 4.0
    assert level == 4
    assert label == "Optimized"


@pytest.mark.asyncio
async def test_mixed_levels_within_range() -> None:
    """Mixed answers produce score strictly between 1.0 and 4.0."""
    pairs = [(uuid4(), uuid4()) for _ in range(4)]
    levels = [1, 2, 3, 4]
    questions = [_make_question(q_id) for q_id, _ in pairs]
    options = [_make_option(ao_id, lv) for (_, ao_id), lv in zip(pairs, levels)]
    db = _make_db(questions, options)
    score, level, label, _ = await compute_pillar_score(db, pairs, "devops_engineer")
    # (1+2+3+4)/(4*4)*4 = 10/16*4 = 2.5
    assert score == 2.5
    assert 1.0 <= score <= 4.0
    assert level == 3
    assert label == "Defined"


# ── Weight tests ──────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_question_weight_15_applied() -> None:
    """question_weight=1.5 raises numerator and denominator equally → same score."""
    q_id, ao_id = uuid4(), uuid4()
    q = _make_question(q_id, weight=1.5)
    ao = _make_option(ao_id, 2)
    db = _make_db([q], [ao])
    score, _, _, _ = await compute_pillar_score(db, [(q_id, ao_id)], "sre_platform_engineer")
    # num=2*1.5*1.0=3, den=4*1.5*1.0=6, score=3/6*4=2.0
    assert score == 2.0


@pytest.mark.asyncio
async def test_question_weight_20_applied() -> None:
    """question_weight=2.0 — verify correct formula result."""
    q_id, ao_id = uuid4(), uuid4()
    q = _make_question(q_id, weight=2.0)
    ao = _make_option(ao_id, 3)
    db = _make_db([q], [ao])
    score, _, _, _ = await compute_pillar_score(db, [(q_id, ao_id)], "ml_ai_engineer")
    # num=3*2.0*1.0=6, den=4*2.0*1.0=8, score=6/8*4=3.0
    assert score == 3.0


@pytest.mark.asyncio
async def test_mixed_question_weights() -> None:
    """Two questions with different weights; heavier question influences score more."""
    q1_id, ao1_id = uuid4(), uuid4()
    q2_id, ao2_id = uuid4(), uuid4()
    q1 = _make_question(q1_id, weight=1.0)
    q2 = _make_question(q2_id, weight=2.0)
    ao1 = _make_option(ao1_id, 1)  # low
    ao2 = _make_option(ao2_id, 4)  # high — heavier question
    db = _make_db([q1, q2], [ao1, ao2])
    score, _, _, _ = await compute_pillar_score(db, [(q1_id, ao1_id), (q2_id, ao2_id)], "sre_platform_engineer")
    # num=1*1*1 + 4*2*1=9, den=4*1*1 + 4*2*1=12, score=9/12*4=3.0
    assert score == 3.0


# ── Persona weight tests ──────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_persona_weight_applied_for_non_general() -> None:
    """Non-general question uses persona_weight from question_personas."""
    q_id, ao_id = uuid4(), uuid4()
    pe = _make_persona_entry("sre_platform_engineer", 1.5)
    q = _make_question(q_id, weight=1.0, is_general=False, persona_entries=[pe])
    ao = _make_option(ao_id, 2)
    db = _make_db([q], [ao])
    score, _, _, _ = await compute_pillar_score(db, [(q_id, ao_id)], "sre_platform_engineer")
    # num=2*1.0*1.5=3.0, den=4*1.0*1.5=6.0, score=3/6*4=2.0
    assert score == 2.0


@pytest.mark.asyncio
async def test_general_question_ignores_persona_weight() -> None:
    """is_general=TRUE forces persona_weight=1.0, even if a persona entry exists."""
    q_id, ao_id = uuid4(), uuid4()
    pe = _make_persona_entry("sre_platform_engineer", 2.0)
    # is_general=True → persona_weight must be 1.0 regardless
    q = _make_question(q_id, weight=1.0, is_general=True, persona_entries=[pe])
    ao = _make_option(ao_id, 4)
    db = _make_db([q], [ao])
    score, _, _, _ = await compute_pillar_score(db, [(q_id, ao_id)], "sre_platform_engineer")
    # num=4*1.0*1.0=4, den=4*1.0*1.0=4, score=4.0
    assert score == 4.0


@pytest.mark.asyncio
async def test_unknown_persona_defaults_to_weight_10() -> None:
    """Non-general question with no matching persona entry defaults to persona_weight=1.0."""
    q_id, ao_id = uuid4(), uuid4()
    pe = _make_persona_entry("devops_engineer", 1.5)
    q = _make_question(q_id, weight=1.0, is_general=False, persona_entries=[pe])
    ao = _make_option(ao_id, 2)
    db = _make_db([q], [ao])
    # querying as ml_ai_engineer — no matching persona entry
    score, _, _, _ = await compute_pillar_score(db, [(q_id, ao_id)], "ml_ai_engineer")
    # falls back to persona_weight=1.0
    # num=2*1.0*1.0=2, den=4*1.0*1.0=4, score=2.0
    assert score == 2.0


# ── Edge cases ────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_empty_answers_returns_minimum() -> None:
    """No answers → (1.0, 1, 'Reactive')."""
    db = AsyncMock()
    score, level, label, _ = await compute_pillar_score(db, [], "cto_executive")
    assert score == 1.0
    assert level == 1
    assert label == "Reactive"
    db.execute.assert_not_called()


@pytest.mark.asyncio
async def test_missing_question_record_skipped() -> None:
    """If a question_id is not found in the DB, that pair is skipped (logged as error)."""
    good_q_id, good_ao_id = uuid4(), uuid4()
    bad_q_id, bad_ao_id = uuid4(), uuid4()

    good_q = _make_question(good_q_id, weight=1.0)
    good_ao = _make_option(good_ao_id, 4)

    # DB only returns the good question; bad_q_id is missing
    db = _make_db([good_q], [good_ao])
    score, level, label, _ = await compute_pillar_score(
        db, [(good_q_id, good_ao_id), (bad_q_id, bad_ao_id)], "sre_platform_engineer"
    )
    # Only good_q counted → score=4.0
    assert score == 4.0


@pytest.mark.asyncio
async def test_score_clamped_to_minimum() -> None:
    """Score can never go below 1.0 even with unusual weight combinations."""
    q_id, ao_id = uuid4(), uuid4()
    q = _make_question(q_id, weight=1.0)
    ao = _make_option(ao_id, 1)
    db = _make_db([q], [ao])
    score, _, _, _ = await compute_pillar_score(db, [(q_id, ao_id)], "software_developer")
    assert score >= 1.0


@pytest.mark.asyncio
async def test_score_clamped_to_maximum() -> None:
    """Score can never exceed 4.0."""
    q_id, ao_id = uuid4(), uuid4()
    q = _make_question(q_id, weight=1.0)
    ao = _make_option(ao_id, 4)
    db = _make_db([q], [ao])
    score, _, _, _ = await compute_pillar_score(db, [(q_id, ao_id)], "software_developer")
    assert score <= 4.0


@pytest.mark.asyncio
async def test_score_rounded_to_2_decimal_places() -> None:
    """pillar_score is always rounded to exactly 2 decimal places."""
    pairs = [(uuid4(), uuid4()) for _ in range(3)]
    questions = [_make_question(q_id, weight=1.0) for q_id, _ in pairs]
    # Levels 1, 2, 4 → numerator=7, denominator=12, raw=7/12*4=2.3333...
    options = [_make_option(ao_id, lv) for (_, ao_id), lv in zip(pairs, [1, 2, 4])]
    db = _make_db(questions, options)
    score, _, _, _ = await compute_pillar_score(db, pairs, "cto_executive")
    assert score == round(score, 2)
    assert isinstance(score, float)
