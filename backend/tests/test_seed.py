"""
Tests for Task 4: Seed Data.

All tests run without a live database — DB interactions are mocked at the
session boundary using AsyncMock.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from app.seed.seed_data import PILLARS
from app.seed.runner import seed_all


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_db(existing_user=None, existing_pillar=None):
    db = AsyncMock()
    result_user = MagicMock()
    result_user.scalar_one_or_none.return_value = existing_user
    result_pillar = MagicMock()
    result_pillar.scalar_one_or_none.return_value = existing_pillar

    call_count = [0]

    async def execute_side_effect(stmt):
        call_count[0] += 1
        if call_count[0] == 1:
            return result_user
        return result_pillar

    db.execute = AsyncMock(side_effect=execute_side_effect)
    db.flush = AsyncMock()
    db.commit = AsyncMock()
    db.add = MagicMock()
    return db


# ---------------------------------------------------------------------------
# seed_data.py structure validation
# ---------------------------------------------------------------------------


def test_four_pillars_defined():
    assert len(PILLARS) == 4


def test_pillar_names():
    names = {p["name"] for p in PILLARS}
    assert "Full-Stack Observability" in names
    assert "AIOps & Intelligent Observability" in names
    assert "AI System Observability" in names
    assert "Security & DevSecOps" in names


def test_p3_is_gated():
    p3 = next(p for p in PILLARS if p["name"] == "AI System Observability")
    assert p3["is_gated"] is True
    assert p3["gate_question"] is not None
    assert len(p3["gate_question"]) > 0


def test_non_gated_pillars():
    for pillar in PILLARS:
        if pillar["name"] != "AI System Observability":
            assert pillar["is_gated"] is False


def test_p1_has_15_questions():
    p1 = next(p for p in PILLARS if p["name"] == "Full-Stack Observability")
    assert len(p1["questions"]) == 15


def test_p2_p3_p5_have_12_questions():
    for pillar in PILLARS:
        if pillar["name"] != "Full-Stack Observability":
            assert len(pillar["questions"]) == 12, f"{pillar['name']} should have 12 questions"


def test_each_pillar_has_4_general_questions():
    for pillar in PILLARS:
        general = [q for q in pillar["questions"] if q["general"]]
        assert len(general) == 4, f"{pillar['name']} should have 4 general questions"


def test_each_question_has_exactly_4_options():
    for pillar in PILLARS:
        for q in pillar["questions"]:
            assert len(q["options"]) == 4, f"Question '{q['text'][:40]}' must have 4 options"


def test_options_have_maturity_levels_1_to_4():
    for pillar in PILLARS:
        for q in pillar["questions"]:
            levels = {opt[0] for opt in q["options"]}
            assert levels == {1, 2, 3, 4}, f"Question '{q['text'][:40]}' missing maturity levels"


def test_general_questions_have_no_personas():
    for pillar in PILLARS:
        for q in pillar["questions"]:
            if q["general"]:
                assert q["personas"] == [], f"General question should have no personas"


def test_persona_specific_questions_have_at_least_one_persona():
    for pillar in PILLARS:
        for q in pillar["questions"]:
            if not q["general"]:
                assert len(q["personas"]) >= 1, f"Non-general question must have at least one persona"


def test_valid_persona_values():
    valid = {
        "cto_executive", "vp_engineering", "ciso_vp_security",
        "sre_platform_engineer", "devops_engineer", "ml_ai_engineer",
        "security_engineer", "software_developer",
    }
    for pillar in PILLARS:
        for q in pillar["questions"]:
            for persona, _ in q["personas"]:
                assert persona in valid, f"Invalid persona: {persona}"


def test_question_weights_are_valid():
    valid_weights = {1.0, 1.5, 2.0}
    for pillar in PILLARS:
        for q in pillar["questions"]:
            assert q["weight"] in valid_weights, f"Invalid weight {q['weight']}"


def test_display_orders_are_sequential_per_pillar():
    for pillar in PILLARS:
        orders = [q["display_order"] for q in pillar["questions"]]
        assert orders == list(range(1, len(orders) + 1)), f"{pillar['name']} display_order not sequential"


# ---------------------------------------------------------------------------
# runner.py — seed_all behaviour
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_seed_all_creates_admin_when_missing():
    db = _make_db(existing_user=None, existing_pillar=object())

    with patch("app.seed.runner.hash_password", AsyncMock(return_value="hashed")):
        await seed_all(db)

    db.add.assert_called()
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_seed_all_skips_admin_when_exists():
    existing_user = object()
    db = _make_db(existing_user=existing_user, existing_pillar=object())

    with patch("app.seed.runner.hash_password", AsyncMock(return_value="hashed")):
        await seed_all(db)

    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_seed_all_skips_pillar_when_exists():
    existing_user = object()
    existing_pillar = object()
    db = _make_db(existing_user=existing_user, existing_pillar=existing_pillar)

    with patch("app.seed.runner.hash_password", AsyncMock(return_value="hashed")):
        await seed_all(db)

    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_seed_all_commits_once():
    db = _make_db(existing_user=object(), existing_pillar=object())

    with patch("app.seed.runner.hash_password", AsyncMock(return_value="hashed")):
        await seed_all(db)

    assert db.commit.await_count == 1
