"""
Tests for the research summary flow:
  - GET /research-summary endpoint
  - POST /confirm-research endpoint
  - Agent 1 dual-input prompt construction
  - Agent 2 dual-input (prospect context passed through)
  - ResearchSummaryOut schema
"""
from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest


# ── json_utils ───────────────────────────────────────────────────────────────


def test_extract_json_array_plain():
    from app.core.json_utils import extract_json_array

    assert extract_json_array('["a", "b"]') == '["a", "b"]'


def test_extract_json_array_with_preamble():
    from app.core.json_utils import extract_json_array

    assert extract_json_array('Here are the IDs:\n["id1", "id2"]') == '["id1", "id2"]'


def test_extract_json_array_stops_at_first_closing_bracket():
    """rfind-based extraction would return the wrong slice; depth-tracking stops correctly."""
    from app.core.json_utils import extract_json_array

    raw = '["id1", "id2"] Note: [ranked by relevance]'
    result = extract_json_array(raw)
    assert result == '["id1", "id2"]'


def test_extract_json_array_nested():
    from app.core.json_utils import extract_json_array

    assert extract_json_array('[["a"], ["b"]]') == '[["a"], ["b"]]'


def test_extract_json_array_no_array_raises():
    from app.core.json_utils import extract_json_array

    with pytest.raises(ValueError, match="No JSON array"):
        extract_json_array("no array here")


# ── Research Summary Service ──────────────────────────────────────────────────


def _make_mock_prospect(prospect_id, research_cache=None, research_started_at=None, account_name="Acme Corp"):
    """Create a mock Prospect with the fields used by get_research_summary."""
    mock_prospect = MagicMock()
    mock_prospect.id = prospect_id
    mock_prospect.research_cache = research_cache
    mock_prospect.research_started_at = research_started_at or datetime.now(timezone.utc)
    mock_prospect.created_at = datetime.now(timezone.utc)
    mock_account = MagicMock()
    mock_account.company_name = account_name
    mock_prospect.account = mock_account
    return mock_prospect


def _make_prospect_db(mock_prospect):
    """Return an AsyncMock DB whose execute always returns the given prospect."""
    db = AsyncMock()
    result = MagicMock()
    result.scalar_one_or_none.return_value = mock_prospect
    db.execute.return_value = result
    return db


@pytest.mark.asyncio
async def test_get_research_summary_not_ready_when_cache_null():
    """Returns is_ready=False when research_cache is NULL (Agent 1 still running)."""
    from app.services.public_service import get_research_summary

    prospect_id = uuid4()
    account_id = uuid4()
    token = "test_token"
    session = {"account_id": str(account_id), "prospect_id": str(prospect_id)}

    mock_prospect = _make_mock_prospect(
        prospect_id,
        research_cache=None,
        research_started_at=datetime.now(timezone.utc),
    )
    db = _make_prospect_db(mock_prospect)

    result = await get_research_summary(token, session, db)

    assert result.is_ready is False


@pytest.mark.asyncio
async def test_get_research_summary_not_ready_uses_research_started_at_not_created_at():
    """Timeout window is anchored to research_started_at, not prospect.created_at.

    An old prospect (created_at days ago) should still return is_ready=False when
    research_started_at is recent.
    """
    from datetime import timedelta

    from app.services.public_service import get_research_summary

    prospect_id = uuid4()
    account_id = uuid4()
    token = "test_token"
    session = {"account_id": str(account_id), "prospect_id": str(prospect_id)}

    mock_prospect = _make_mock_prospect(
        prospect_id,
        research_cache=None,
        research_started_at=datetime.now(timezone.utc),
    )
    mock_prospect.created_at = datetime.now(timezone.utc) - timedelta(days=2)
    db = _make_prospect_db(mock_prospect)

    result = await get_research_summary(token, session, db)

    assert result.is_ready is False


@pytest.mark.asyncio
async def test_get_research_summary_ready_with_full_profile():
    """Returns is_ready=True with all profile fields when cache is populated."""
    from app.services.public_service import get_research_summary

    prospect_id = uuid4()
    account_id = uuid4()
    token = "test_token"
    session = {"account_id": str(account_id), "prospect_id": str(prospect_id)}

    cache = {
        "company_name": "Acme Corp",
        "industry": "saas",
        "company_size": "mid-market",
        "products_summary": "B2B analytics platform.",
        "target_customers": "enterprise teams",
        "builds_ai_products": True,
        "cloud_providers": ["aws", "gcp"],
        "key_challenges": ["latency", "scale"],
        "business_outcomes": ["churn reduction"],
        "operational_scale": ["500+ microservices"],
        "data_confidence": "high",
        "research_notes": "",
    }

    mock_prospect = _make_mock_prospect(prospect_id, research_cache=cache, account_name="Acme Corp")
    db = _make_prospect_db(mock_prospect)

    result = await get_research_summary(token, session, db)

    assert result.is_ready is True
    assert result.industry == "saas"
    assert result.cloud_providers == ["aws", "gcp"]
    assert result.data_confidence == "high"
    assert result.key_challenges == ["latency", "scale"]


@pytest.mark.asyncio
async def test_get_research_summary_maps_observability_outcome_from_cache():
    """observability_outcome is returned from cache when present."""
    from app.services.public_service import get_research_summary

    prospect_id = uuid4()
    token = "test_token"
    session = {"account_id": str(uuid4()), "prospect_id": str(prospect_id)}

    cache = {
        "company_name": "Acme Corp",
        "industry": "saas",
        "company_size": "mid-market",
        "products_summary": "B2B analytics.",
        "target_customers": "enterprise teams",
        "builds_ai_products": True,
        "cloud_providers": ["aws"],
        "key_challenges": ["latency"],
        "business_outcomes": ["uptime"],
        "operational_scale": ["200 services"],
        "data_confidence": "high",
        "research_notes": "",
        "news_insights": "",
        "observability_outcome": "Distributed tracing and LLM cost visibility would address Acme's latency challenges and AI product footprint.",
    }

    mock_prospect = _make_mock_prospect(prospect_id, research_cache=cache)
    db = _make_prospect_db(mock_prospect)

    result = await get_research_summary(token, session, db)

    assert result.is_ready is True
    assert result.observability_outcome == "Distributed tracing and LLM cost visibility would address Acme's latency challenges and AI product footprint."


@pytest.mark.asyncio
async def test_get_research_summary_observability_outcome_defaults_empty_when_missing():
    """observability_outcome defaults to '' when the cache key is absent (legacy cache records)."""
    from app.services.public_service import get_research_summary

    prospect_id = uuid4()
    token = "test_token"
    session = {"account_id": str(uuid4()), "prospect_id": str(prospect_id)}

    cache = {
        "company_name": "OldCo",
        "industry": "fintech",
        "company_size": "startup",
        "products_summary": "Payments API.",
        "target_customers": "banks",
        "builds_ai_products": False,
        "cloud_providers": [],
        "key_challenges": [],
        "business_outcomes": [],
        "operational_scale": [],
        "data_confidence": "medium",
        "research_notes": "",
        "news_insights": "",
        # intentionally omitting "observability_outcome" to simulate a legacy cache record
    }

    mock_prospect = _make_mock_prospect(prospect_id, research_cache=cache)
    db = _make_prospect_db(mock_prospect)

    result = await get_research_summary(token, session, db)

    assert result.is_ready is True
    assert result.observability_outcome == ""


@pytest.mark.asyncio
async def test_get_research_summary_access_denied_for_wrong_prospect():
    """Returns 403 when session prospect_id does not match the prospect's id."""
    from app.services.public_service import get_research_summary
    from fastapi import HTTPException

    prospect_id = uuid4()
    other_prospect_id = uuid4()
    account_id = uuid4()
    token = "test_token"
    session = {"account_id": str(account_id), "prospect_id": str(other_prospect_id)}

    mock_prospect = _make_mock_prospect(prospect_id)
    db = _make_prospect_db(mock_prospect)

    with pytest.raises(HTTPException) as exc_info:
        await get_research_summary(token, session, db)
    assert exc_info.value.status_code == 403


# ── Confirm Research Service ──────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_confirm_research_sets_timestamp():
    """confirm_research sets research_confirmed_at on the assessment."""
    from app.services.public_service import confirm_research
    from app.schemas.public import ConfirmResearchRequest

    prospect_id = uuid4()
    account_id = uuid4()
    assessment_id = uuid4()
    token = "test_token"
    session = {
        "account_id": str(account_id),
        "prospect_id": str(prospect_id),
        "prospect_role": "sre_platform_engineer",
    }
    body = ConfirmResearchRequest(assessment_id=assessment_id, additional_notes=None)

    mock_prospect = _make_mock_prospect(prospect_id)

    mock_pillar = MagicMock()
    mock_pillar.question_count = 2

    mock_assessment = MagicMock()
    mock_assessment.id = assessment_id
    mock_assessment.prospect_id = prospect_id
    mock_assessment.pillar_id = uuid4()
    mock_assessment.pillar = mock_pillar
    mock_assessment.prospect_additional_notes = None
    mock_assessment.research_confirmed_at = None

    db = AsyncMock()
    prospect_result = MagicMock()
    prospect_result.scalar_one_or_none.return_value = mock_prospect
    assessment_result = MagicMock()
    assessment_result.scalar_one_or_none.return_value = mock_assessment
    db.execute.side_effect = [prospect_result, assessment_result]

    with patch(
        "app.services.public_service._select_questions_fallback",
        new_callable=AsyncMock,
        return_value=[],
    ):
        result = await confirm_research(token, session, body, db)

    assert result.confirmed is True
    assert mock_assessment.research_confirmed_at is not None
    db.commit.assert_called_once()


@pytest.mark.asyncio
async def test_confirm_research_saves_additional_notes_when_provided():
    """confirm_research saves non-empty additional_notes to assessment.prospect_additional_notes."""
    from app.services.public_service import confirm_research
    from app.schemas.public import ConfirmResearchRequest

    prospect_id = uuid4()
    account_id = uuid4()
    assessment_id = uuid4()
    token = "test_token"
    session = {
        "account_id": str(account_id),
        "prospect_id": str(prospect_id),
        "prospect_role": "sre_platform_engineer",
    }
    body = ConfirmResearchRequest(assessment_id=assessment_id, additional_notes="We are on Azure, not AWS.")

    mock_prospect = _make_mock_prospect(prospect_id)

    mock_pillar = MagicMock()
    mock_pillar.question_count = 2

    mock_assessment = MagicMock()
    mock_assessment.id = assessment_id
    mock_assessment.prospect_id = prospect_id
    mock_assessment.pillar_id = uuid4()
    mock_assessment.pillar = mock_pillar
    mock_assessment.prospect_additional_notes = None
    mock_assessment.research_confirmed_at = None

    db = AsyncMock()
    prospect_result = MagicMock()
    prospect_result.scalar_one_or_none.return_value = mock_prospect
    assessment_result = MagicMock()
    assessment_result.scalar_one_or_none.return_value = mock_assessment
    db.execute.side_effect = [prospect_result, assessment_result]

    with patch(
        "app.services.public_service._select_questions_fallback",
        new_callable=AsyncMock,
        return_value=[],
    ):
        await confirm_research(token, session, body, db)

    assert mock_assessment.prospect_additional_notes == "We are on Azure, not AWS."


@pytest.mark.asyncio
async def test_confirm_research_does_not_overwrite_when_additional_notes_empty():
    """Empty/None additional_notes do not overwrite existing prospect_additional_notes."""
    from app.services.public_service import confirm_research
    from app.schemas.public import ConfirmResearchRequest

    prospect_id = uuid4()
    account_id = uuid4()
    assessment_id = uuid4()
    token = "test_token"
    session = {
        "account_id": str(account_id),
        "prospect_id": str(prospect_id),
        "prospect_role": "sre_platform_engineer",
    }
    body = ConfirmResearchRequest(assessment_id=assessment_id, additional_notes="   ")

    mock_prospect = _make_mock_prospect(prospect_id)

    mock_pillar = MagicMock()
    mock_pillar.question_count = 2

    mock_assessment = MagicMock()
    mock_assessment.id = assessment_id
    mock_assessment.prospect_id = prospect_id
    mock_assessment.pillar_id = uuid4()
    mock_assessment.pillar = mock_pillar
    mock_assessment.prospect_additional_notes = "previous corrections"
    mock_assessment.research_confirmed_at = None

    db = AsyncMock()
    prospect_result = MagicMock()
    prospect_result.scalar_one_or_none.return_value = mock_prospect
    assessment_result = MagicMock()
    assessment_result.scalar_one_or_none.return_value = mock_assessment
    db.execute.side_effect = [prospect_result, assessment_result]

    with patch(
        "app.services.public_service._select_questions_fallback",
        new_callable=AsyncMock,
        return_value=[],
    ):
        await confirm_research(token, session, body, db)

    # Should not have overwritten existing value
    assert mock_assessment.prospect_additional_notes == "previous corrections"


# ── Agent 1: minimal profile schema ──────────────────────────────────────────


def test_research_agent_minimal_profile_has_new_fields():
    """_build_minimal_profile includes all new fields from spec v1.6."""
    from app.agents.research_agent import _build_minimal_profile

    profile = _build_minimal_profile("Acme Corp")

    assert "target_customers" in profile
    assert "operational_scale" in profile
    assert "data_confidence" in profile
    assert profile["data_confidence"] == "low"
    assert "research_notes" in profile
    assert "technology_signals" not in profile  # dropped in v1.6


def test_research_agent_minimal_profile_no_technology_signals():
    """technology_signals must NOT appear in the output (spec v1.6)."""
    from app.agents.research_agent import _build_minimal_profile

    profile = _build_minimal_profile("Test Co")
    assert "technology_signals" not in profile


def test_research_agent_minimal_profile_includes_observability_outcome():
    """_build_minimal_profile includes observability_outcome defaulting to empty string."""
    from app.agents.research_agent import _build_minimal_profile

    profile = _build_minimal_profile("Test Co")
    assert "observability_outcome" in profile
    assert profile["observability_outcome"] == ""


# ── Agent 2: research summary builder ────────────────────────────────────────


def test_question_selection_research_summary_includes_new_fields():
    """_build_research_summary includes operational_scale and data_confidence."""
    from app.agents.question_selection_agent import _build_research_summary

    cache = {
        "industry": "saas",
        "company_size": "mid-market",
        "products_summary": "Analytics platform.",
        "target_customers": "enterprise teams",
        "cloud_providers": ["aws"],
        "key_challenges": ["scaling"],
        "business_outcomes": ["churn reduction"],
        "operational_scale": ["500+ microservices"],
        "data_confidence": "medium",
    }

    summary = _build_research_summary(cache)

    assert "Operational scale" in summary
    assert "500+ microservices" in summary
    assert "Data confidence" in summary
    assert "medium" in summary
    # technology_signals should not appear
    assert "technology_signals" not in summary


def test_question_selection_research_summary_empty_cache():
    """Returns fallback text when cache is None."""
    from app.agents.question_selection_agent import _build_research_summary

    result = _build_research_summary(None)
    assert result == "No research data available."


# ── RegisterRequest schema: new optional fields ───────────────────────────────


def test_register_request_accepts_optional_context_fields():
    """RegisterRequest accepts the three new optional context fields."""
    from app.schemas.public import RegisterRequest

    req = RegisterRequest(
        prospect_name="Jane Smith",
        prospect_email="jane@example.com",
        prospect_role="sre_platform_engineer",
        infrastructure_location="AWS us-east-1",
        tech_stack_description="Python, Kubernetes",
        current_tools="Datadog, PagerDuty",
    )
    assert req.infrastructure_location == "AWS us-east-1"
    assert req.tech_stack_description == "Python, Kubernetes"
    assert req.current_tools == "Datadog, PagerDuty"


def test_register_request_optional_context_defaults_to_none():
    """RegisterRequest works without context fields — all default to None."""
    from app.schemas.public import RegisterRequest

    req = RegisterRequest(
        prospect_name="Jane Smith",
        prospect_email="jane@example.com",
        prospect_role="sre_platform_engineer",
    )
    assert req.infrastructure_location is None
    assert req.tech_stack_description is None
    assert req.current_tools is None


# ── ResearchSummaryOut schema ─────────────────────────────────────────────────


def test_research_summary_out_not_ready_defaults():
    """ResearchSummaryOut with is_ready=False has sensible empty defaults."""
    from app.schemas.public import ResearchSummaryOut

    out = ResearchSummaryOut(is_ready=False)
    assert out.is_ready is False
    assert out.company_name == ""
    assert out.cloud_providers == []
    assert out.data_confidence == "low"


def test_research_summary_out_has_observability_outcome_field():
    """ResearchSummaryOut exposes observability_outcome defaulting to empty string."""
    from app.schemas.public import ResearchSummaryOut

    out = ResearchSummaryOut(is_ready=False)
    assert hasattr(out, "observability_outcome")
    assert out.observability_outcome == ""


def test_research_summary_out_carries_observability_outcome_value():
    """ResearchSummaryOut preserves a non-empty observability_outcome."""
    from app.schemas.public import ResearchSummaryOut

    out = ResearchSummaryOut(
        is_ready=True,
        observability_outcome="Distributed tracing and security signal correlation would be high-value investments.",
    )
    assert out.observability_outcome == "Distributed tracing and security signal correlation would be high-value investments."


# ── ConfirmResearchRequest schema ─────────────────────────────────────────────


def test_confirm_research_request_requires_assessment_id():
    """ConfirmResearchRequest requires assessment_id."""
    from app.schemas.public import ConfirmResearchRequest
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        ConfirmResearchRequest(additional_notes="some additional notes")


def test_confirm_research_out_has_questions_field():
    """ConfirmResearchOut includes confirmed and questions fields."""
    from app.schemas.public import ConfirmResearchOut

    out = ConfirmResearchOut(confirmed=True, questions=[])
    assert out.confirmed is True
    assert out.questions == []


def test_select_pillar_out_has_only_assessment_id():
    """SelectPillarOut no longer includes questions — only assessment_id."""
    from app.schemas.public import SelectPillarOut
    from uuid import uuid4

    out = SelectPillarOut(assessment_id=uuid4())
    assert hasattr(out, "assessment_id")
    assert not hasattr(out, "questions")


# ── Agent 2: prospect_additional_notes passed through ─────────────────────────


@pytest.mark.asyncio
async def test_select_questions_passes_prospect_context_to_llm():
    """select_questions passes infrastructure_location and prospect_additional_notes to the LLM chain."""
    from app.agents.question_selection_agent import select_questions

    pillar_id = uuid4()

    mock_pillar = MagicMock()
    mock_pillar.id = pillar_id
    mock_pillar.name = "Full-Stack Observability"
    mock_pillar.description = "Observability pillar"
    mock_pillar.question_count = 4

    general_qs = []
    for _ in range(2):
        q = MagicMock()
        q.id = uuid4()
        q.text = "General question"
        q.is_general = True
        q.context_tags = []
        q.answer_options = []
        q.personas = []
        general_qs.append(q)

    persona_qs = []
    for _ in range(4):
        q = MagicMock()
        q.id = uuid4()
        q.text = "Persona question"
        q.is_general = False
        q.context_tags = ["kubernetes"]
        q.answer_options = []
        q.personas = []
        persona_qs.append(q)

    db = AsyncMock()
    pillar_result = MagicMock()
    pillar_result.scalar_one_or_none.return_value = mock_pillar
    general_result = MagicMock()
    general_result.scalars.return_value.all.return_value = general_qs
    persona_result = MagicMock()
    persona_result.scalars.return_value.all.return_value = persona_qs
    db.execute.side_effect = [pillar_result, general_result, persona_result]

    # Mock the LLM chain to return a valid selection
    all_ids = [str(q.id) for q in general_qs + persona_qs]
    selected_ids = all_ids[:4]
    import json

    captured_invoke = {}

    async def mock_ainvoke(inputs: dict) -> str:
        captured_invoke.update(inputs)
        return json.dumps(selected_ids)

    with patch("app.agents.question_selection_agent.get_llm") as mock_llm:
        mock_chain = MagicMock()
        mock_chain.__or__ = MagicMock(return_value=mock_chain)
        mock_chain.ainvoke = mock_ainvoke
        mock_llm.return_value = MagicMock()
        with patch("app.agents.question_selection_agent.ChatPromptTemplate") as mock_pt:
            with patch("app.agents.question_selection_agent.StrOutputParser") as mock_parser:
                mock_prompt = MagicMock()
                mock_prompt.__or__ = MagicMock(return_value=mock_chain)
                mock_pt.from_messages.return_value = mock_prompt
                mock_parser.return_value = MagicMock()
                mock_chain.__or__ = MagicMock(return_value=mock_chain)

                await select_questions(
                    pillar_id,
                    "sre_platform_engineer",
                    None,
                    db,
                    infrastructure_location="AWS us-east-1",
                    tech_stack_description="Kubernetes, Python",
                    current_tools="Datadog",
                    prospect_additional_notes="We also use GCP.",
                )

    assert captured_invoke.get("infrastructure_location") == "AWS us-east-1"
    assert captured_invoke.get("tech_stack_description") == "Kubernetes, Python"
    assert captured_invoke.get("current_tools") == "Datadog"
    assert captured_invoke.get("prospect_additional_notes") == "We also use GCP."
