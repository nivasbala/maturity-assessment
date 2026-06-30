"""
Tests for the public prospect endpoints (Task 7).

These tests run without a live database. DB calls are stubbed via monkeypatching
or by mocking the service layer so that only the business logic is exercised.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest

from app.core.security import create_session_token, decode_session_token
from app.services.scoring_service import compute_pillar_score, _score_to_label


# ── Session token ─────────────────────────────────────────────────────────────


def test_create_and_decode_session_token():
    payload = {
        "account_id": str(uuid4()),
        "short_url_token": "abc12345",
        "prospect_name": "Jane Smith",
        "prospect_email": "jane@example.com",
        "prospect_role": "sre_platform_engineer",
        "p3_gate": True,
        "p4_gate": False,
    }
    token = create_session_token(payload)
    decoded = decode_session_token(token)
    assert decoded["account_id"] == payload["account_id"]
    assert decoded["prospect_role"] == "sre_platform_engineer"
    assert decoded["p3_gate"] is True
    assert decoded["p4_gate"] is False
    assert decoded["type"] == "session"


def test_session_token_type_enforcement():
    from app.core.security import create_access_token
    from fastapi import HTTPException
    # An access token must NOT decode as a session token
    access_token = create_access_token({"sub": "user-id"})
    with pytest.raises(HTTPException) as exc_info:
        decode_session_token(access_token)
    assert exc_info.value.status_code == 401


# ── Scoring ───────────────────────────────────────────────────────────────────


def test_score_to_label():
    assert _score_to_label(1.00) == (1, "Reactive")
    assert _score_to_label(1.74) == (1, "Reactive")
    assert _score_to_label(1.75) == (2, "Developing")
    assert _score_to_label(2.49) == (2, "Developing")
    assert _score_to_label(2.50) == (3, "Defined")
    assert _score_to_label(3.24) == (3, "Defined")
    assert _score_to_label(3.25) == (4, "Optimized")
    assert _score_to_label(4.00) == (4, "Optimized")


@pytest.mark.asyncio
async def test_compute_pillar_score_all_level1():
    """All Level-1 answers → pillar_score = 1.0."""
    q_id = uuid4()
    ao_id = uuid4()

    mock_question = MagicMock()
    mock_question.id = q_id
    mock_question.question_weight = 1.0
    mock_question.is_general = True
    mock_question.personas = []

    mock_option = MagicMock()
    mock_option.id = ao_id
    mock_option.maturity_level = 1

    db = AsyncMock()
    mock_q_result = MagicMock()
    mock_q_result.scalars.return_value.all.return_value = [mock_question]
    mock_ao_result = MagicMock()
    mock_ao_result.scalars.return_value.all.return_value = [mock_option]
    db.execute.side_effect = [mock_q_result, mock_ao_result]

    score, level, label = await compute_pillar_score(db, [(q_id, ao_id)], "sre_platform_engineer")
    assert score == 1.0
    assert level == 1
    assert label == "Reactive"


@pytest.mark.asyncio
async def test_compute_pillar_score_all_level4():
    """All Level-4 answers → pillar_score = 4.0."""
    q_id = uuid4()
    ao_id = uuid4()

    mock_question = MagicMock()
    mock_question.id = q_id
    mock_question.question_weight = 1.0
    mock_question.is_general = True
    mock_question.personas = []

    mock_option = MagicMock()
    mock_option.id = ao_id
    mock_option.maturity_level = 4

    db = AsyncMock()
    mock_q_result = MagicMock()
    mock_q_result.scalars.return_value.all.return_value = [mock_question]
    mock_ao_result = MagicMock()
    mock_ao_result.scalars.return_value.all.return_value = [mock_option]
    db.execute.side_effect = [mock_q_result, mock_ao_result]

    score, level, label = await compute_pillar_score(db, [(q_id, ao_id)], "sre_platform_engineer")
    assert score == 4.0
    assert level == 4
    assert label == "Optimized"


@pytest.mark.asyncio
async def test_compute_pillar_score_mixed():
    """Mixed answers produce a score between 1.0 and 4.0."""
    pairs = [(uuid4(), uuid4()) for _ in range(4)]
    levels = [1, 2, 3, 4]

    questions = []
    options = []
    for (q_id, ao_id), lv in zip(pairs, levels):
        q = MagicMock()
        q.id = q_id
        q.question_weight = 1.0
        q.is_general = True
        q.personas = []
        questions.append(q)

        ao = MagicMock()
        ao.id = ao_id
        ao.maturity_level = lv
        options.append(ao)

    db = AsyncMock()
    mock_q_result = MagicMock()
    mock_q_result.scalars.return_value.all.return_value = questions
    mock_ao_result = MagicMock()
    mock_ao_result.scalars.return_value.all.return_value = options
    db.execute.side_effect = [mock_q_result, mock_ao_result]

    score, level, label = await compute_pillar_score(db, pairs, "sre_platform_engineer")
    assert 1.0 <= score <= 4.0
    # Average of 1+2+3+4=10 / (4*4=16) * 4 = 2.5
    assert score == 2.5
    assert level == 3
    assert label == "Defined"


@pytest.mark.asyncio
async def test_compute_pillar_score_applies_persona_weight():
    """Persona weight is applied for non-general questions."""
    q_id = uuid4()
    ao_id = uuid4()

    mock_persona = MagicMock()
    mock_persona.persona = "sre_platform_engineer"
    mock_persona.persona_weight = 1.2

    mock_question = MagicMock()
    mock_question.id = q_id
    mock_question.question_weight = 2.0
    mock_question.is_general = False
    mock_question.personas = [mock_persona]

    mock_option = MagicMock()
    mock_option.id = ao_id
    mock_option.maturity_level = 4

    db = AsyncMock()
    mock_q_result = MagicMock()
    mock_q_result.scalars.return_value.all.return_value = [mock_question]
    mock_ao_result = MagicMock()
    mock_ao_result.scalars.return_value.all.return_value = [mock_option]
    db.execute.side_effect = [mock_q_result, mock_ao_result]

    score, level, label = await compute_pillar_score(db, [(q_id, ao_id)], "sre_platform_engineer")
    # numerator = 4 * 2.0 * 1.2 = 9.6; denominator = 4 * 2.0 * 1.2 = 9.6; score = 4.0
    assert score == 4.0


# ── Question fallback selection ────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_question_selection_fallback_no_duplicates():
    """Fallback question selection must not return duplicate question IDs."""
    from app.services.public_service import _select_questions_fallback

    pillar_id = uuid4()
    persona = "sre_platform_engineer"

    def make_question(qid: UUID, is_general: bool, display_order: int) -> MagicMock:
        q = MagicMock()
        q.id = qid
        q.is_general = is_general
        q.display_order = display_order
        q.answer_options = []
        q.personas = []
        return q

    general_ids = [uuid4() for _ in range(4)]
    persona_ids = [uuid4() for _ in range(4)]

    general_qs = [make_question(qid, True, i + 1) for i, qid in enumerate(general_ids)]
    persona_qs = [make_question(qid, False, i + 10) for i, qid in enumerate(persona_ids)]

    db = AsyncMock()

    def make_result(items):
        r = MagicMock()
        r.scalars.return_value.all.return_value = items
        return r

    db.execute.side_effect = [make_result(general_qs), make_result(persona_qs)]

    questions = await _select_questions_fallback(db, pillar_id, persona)

    question_ids = [q.id for q in questions]
    assert len(question_ids) == len(set(question_ids)), "Duplicate question IDs found in selection"


@pytest.mark.asyncio
async def test_question_selection_fallback_includes_all_general():
    """All general questions must be included in the fallback selection."""
    from app.services.public_service import _select_questions_fallback

    pillar_id = uuid4()
    persona = "cto_executive"

    def make_question(qid: UUID, is_general: bool, display_order: int) -> MagicMock:
        q = MagicMock()
        q.id = qid
        q.is_general = is_general
        q.display_order = display_order
        q.answer_options = []
        q.personas = []
        return q

    general_ids = [uuid4() for _ in range(4)]
    persona_ids = [uuid4() for _ in range(8)]

    general_qs = [make_question(qid, True, i + 1) for i, qid in enumerate(general_ids)]
    persona_qs = [make_question(qid, False, i + 10) for i, qid in enumerate(persona_ids)]

    db = AsyncMock()

    def make_result(items):
        r = MagicMock()
        r.scalars.return_value.all.return_value = items
        return r

    db.execute.side_effect = [make_result(general_qs), make_result(persona_qs)]

    questions = await _select_questions_fallback(db, pillar_id, persona)
    returned_ids = {q.id for q in questions}
    for g in general_qs:
        assert g.id in returned_ids, f"General question {g.id} missing from selection"


# ── Gate validation ───────────────────────────────────────────────────────────


def test_gate_validation_blocks_gated_pillar():
    """P3 pillar should be blocked when p3_gate is False."""
    from app.services.public_service import _validate_pillar_gate
    from fastapi import HTTPException

    pillar = MagicMock()
    pillar.is_active = True
    pillar.is_gated = True
    pillar.display_order = 3

    session = {"p3_gate": False, "p4_gate": True}
    with pytest.raises(HTTPException) as exc_info:
        _validate_pillar_gate(pillar, session)
    assert exc_info.value.status_code == 403


def test_gate_validation_allows_when_yes():
    """P3 pillar should be allowed when p3_gate is True."""
    from app.services.public_service import _validate_pillar_gate

    pillar = MagicMock()
    pillar.is_active = True
    pillar.is_gated = True
    pillar.display_order = 3

    session = {"p3_gate": True, "p4_gate": True}
    # Should not raise
    _validate_pillar_gate(pillar, session)


def test_gate_validation_blocks_inactive_pillar():
    """Inactive pillar should always be blocked."""
    from app.services.public_service import _validate_pillar_gate
    from fastapi import HTTPException

    pillar = MagicMock()
    pillar.is_active = False
    pillar.is_gated = False
    pillar.display_order = 4

    session = {"p3_gate": True, "p4_gate": True}
    with pytest.raises(HTTPException) as exc_info:
        _validate_pillar_gate(pillar, session)
    assert exc_info.value.status_code == 403


def test_gate_validation_non_gated_always_allowed():
    """Non-gated pillar should always pass gate validation when active."""
    from app.services.public_service import _validate_pillar_gate

    pillar = MagicMock()
    pillar.is_active = True
    pillar.is_gated = False

    session = {"p3_gate": False, "p4_gate": False}
    # Should not raise
    _validate_pillar_gate(pillar, session)


# ── Persona validation ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_register_rejects_invalid_persona():
    """Registration with an invalid persona should raise 422."""
    from app.services.public_service import register_prospect
    from app.schemas.public import RegisterRequest
    from fastapi import HTTPException

    body = RegisterRequest(
        prospect_name="Test User",
        prospect_email="test@example.com",
        prospect_role="invalid_role_xyz",
    )

    db = AsyncMock()
    mock_result = MagicMock()
    mock_assessment = MagicMock()
    mock_account = MagicMock()
    mock_account.id = uuid4()
    mock_account.company_name = "Test Corp"
    mock_account.company_website = None
    mock_assessment.account = mock_account
    mock_result.scalar_one_or_none.return_value = mock_assessment
    db.execute.return_value = mock_result

    with pytest.raises(HTTPException) as exc_info:
        await register_prospect("sometoken", body, db)
    assert exc_info.value.status_code == 422
