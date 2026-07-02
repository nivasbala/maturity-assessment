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


def test_five_pillars_defined():
    assert len(PILLARS) == 5


def test_pillar_names():
    names = {p["name"] for p in PILLARS}
    assert "Full-Stack Observability" in names
    assert "AIOps & Intelligent Observability" in names
    assert "AI Application Observability" in names
    assert "ML & Foundation Model Operations" in names
    assert "Security & DevSecOps" in names


def test_p3_is_gated():
    p3 = next(p for p in PILLARS if p["name"] == "AI Application Observability")
    assert p3["is_gated"] is True
    assert p3["gate_question"] is not None
    assert len(p3["gate_question"]) > 0


def test_p4_is_gated():
    p4 = next(p for p in PILLARS if p["name"] == "ML & Foundation Model Operations")
    assert p4["is_gated"] is True
    assert p4["gate_question"] is not None
    assert len(p4["gate_question"]) > 0


def test_p4_is_inactive():
    p4 = next(p for p in PILLARS if p["name"] == "ML & Foundation Model Operations")
    assert p4["is_active"] is False


def test_non_gated_pillars():
    gated_names = {"AI Application Observability", "ML & Foundation Model Operations"}
    for pillar in PILLARS:
        if pillar["name"] not in gated_names:
            assert pillar["is_gated"] is False


def test_all_pillars_have_is_active_key():
    for pillar in PILLARS:
        assert "is_active" in pillar, f"{pillar['name']} missing is_active"


def test_active_pillars():
    inactive = [p["name"] for p in PILLARS if not p["is_active"]]
    assert inactive == ["ML & Foundation Model Operations"]


def test_p1_has_25_questions():
    p1 = next(p for p in PILLARS if p["name"] == "Full-Stack Observability")
    assert len(p1["questions"]) == 25


def test_p4_has_25_questions():
    p4 = next(p for p in PILLARS if p["name"] == "ML & Foundation Model Operations")
    assert len(p4["questions"]) == 25


def test_p2_p3_p5_have_25_questions():
    twenty_five_q_pillars = {"AIOps & Intelligent Observability", "AI Application Observability", "Security & DevSecOps"}
    for pillar in PILLARS:
        if pillar["name"] in twenty_five_q_pillars:
            assert len(pillar["questions"]) == 25, f"{pillar['name']} should have 25 questions"


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


def test_all_questions_have_context_tags_key():
    for pillar in PILLARS:
        for q in pillar["questions"]:
            assert "context_tags" in q, f"Question '{q['text'][:40]}' missing context_tags"


def test_context_tags_is_list_on_all_questions():
    for pillar in PILLARS:
        for q in pillar["questions"]:
            assert isinstance(q["context_tags"], list), f"context_tags must be a list: '{q['text'][:40]}'"


def test_known_questions_have_non_empty_context_tags():
    tag_checks = {
        "Full-Stack Observability": {
            6: ["microservices", "kubernetes", "cloud_native"],
            8: ["aws", "gcp", "azure", "terraform", "infrastructure"],
            9: ["ci_cd", "devops", "github", "gitlab"],
        },
        "AIOps & Intelligent Observability": {
            5: ["aiops", "machine_learning", "ai"],
        },
        "AI System Observability": {
            5: ["llm", "ai_agents", "langchain", "openai", "anthropic"],
        },
        "ML & Foundation Model Operations": {
            5: ["gpu", "cuda", "model_training", "nvidia"],
            11: ["gpu", "kubernetes", "cloud_compute", "aws", "gcp", "azure"],
        },
        "Security & DevSecOps": {
            10: ["kubernetes", "containers", "docker"],
        },
    }
    for pillar in PILLARS:
        checks = tag_checks.get(pillar["name"], {})
        for q in pillar["questions"]:
            expected = checks.get(q["display_order"])
            if expected is not None:
                assert q["context_tags"] == expected, (
                    f"{pillar['name']} Q{q['display_order']} context_tags mismatch: "
                    f"got {q['context_tags']}"
                )


def test_pillar_display_orders_are_sequential():
    orders = sorted(p["display_order"] for p in PILLARS)
    assert orders == list(range(1, len(PILLARS) + 1))


def test_p5_display_order_is_5():
    p5 = next(p for p in PILLARS if p["name"] == "Security & DevSecOps")
    assert p5["display_order"] == 5


def test_p4_display_order_is_4():
    p4 = next(p for p in PILLARS if p["name"] == "ML & Foundation Model Operations")
    assert p4["display_order"] == 4


def test_p2_overall_weight():
    p2 = next(p for p in PILLARS if p["name"] == "AIOps & Intelligent Observability")
    assert p2["overall_weight"] == 0.9


def test_p3_overall_weight():
    p3 = next(p for p in PILLARS if p["name"] == "AI Application Observability")
    assert p3["overall_weight"] == 0.85


# ---------------------------------------------------------------------------
# runner.py — seed_all behaviour
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_seed_all_creates_admin_when_missing():
    db = _make_db(existing_user=None, existing_pillar=MagicMock())

    with patch("app.seed.runner.hash_password", AsyncMock(return_value="hashed")):
        await seed_all(db)

    db.add.assert_called()
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_seed_all_skips_admin_when_exists():
    existing_user = object()
    db = _make_db(existing_user=existing_user, existing_pillar=MagicMock())

    with patch("app.seed.runner.hash_password", AsyncMock(return_value="hashed")):
        await seed_all(db)

    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_seed_all_skips_pillar_when_exists():
    existing_user = object()
    existing_pillar = MagicMock()
    db = _make_db(existing_user=existing_user, existing_pillar=existing_pillar)

    with patch("app.seed.runner.hash_password", AsyncMock(return_value="hashed")):
        await seed_all(db)

    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_seed_all_commits_once():
    db = _make_db(existing_user=object(), existing_pillar=MagicMock())

    with patch("app.seed.runner.hash_password", AsyncMock(return_value="hashed")):
        await seed_all(db)

    assert db.commit.await_count == 1
