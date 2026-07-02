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


# ── Research Summary Service ──────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_research_summary_not_ready_when_cache_null():
    """Returns is_ready=False when research_cache is NULL (Agent 1 still running)."""
    from app.services.public_service import get_research_summary

    account_id = uuid4()
    token = "test_token"
    session = {"account_id": str(account_id)}

    from datetime import datetime, timezone

    mock_account = MagicMock()
    mock_account.id = account_id
    mock_account.research_cache = None
    mock_account.created_at = datetime.now(timezone.utc)  # recent — within 60s window

    mock_assessment = MagicMock()
    mock_assessment.account_id = account_id
    mock_assessment.account = mock_account

    db = AsyncMock()
    assessment_result = MagicMock()
    assessment_result.scalar_one_or_none.return_value = mock_assessment
    db.execute.return_value = assessment_result

    result = await get_research_summary(token, session, db)

    assert result.is_ready is False


@pytest.mark.asyncio
async def test_get_research_summary_ready_with_full_profile():
    """Returns is_ready=True with all profile fields when cache is populated."""
    from app.services.public_service import get_research_summary

    account_id = uuid4()
    token = "test_token"
    session = {"account_id": str(account_id)}

    mock_assessment = MagicMock()
    mock_assessment.account_id = account_id

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

    mock_account = MagicMock()
    mock_account.id = account_id
    mock_account.company_name = "Acme Corp"
    mock_account.research_cache = cache

    mock_assessment.account = mock_account

    db = AsyncMock()
    assessment_result = MagicMock()
    assessment_result.scalar_one_or_none.return_value = mock_assessment
    db.execute.return_value = assessment_result

    result = await get_research_summary(token, session, db)

    assert result.is_ready is True
    assert result.industry == "saas"
    assert result.cloud_providers == ["aws", "gcp"]
    assert result.data_confidence == "high"
    assert result.key_challenges == ["latency", "scale"]


@pytest.mark.asyncio
async def test_get_research_summary_access_denied_for_wrong_account():
    """Returns 403 when session account_id does not match the assessment's account."""
    from app.services.public_service import get_research_summary
    from fastapi import HTTPException

    account_id = uuid4()
    other_account_id = uuid4()
    token = "test_token"
    session = {"account_id": str(other_account_id)}

    mock_assessment = MagicMock()
    mock_assessment.account_id = account_id  # different from session

    db = AsyncMock()
    result = MagicMock()
    result.scalar_one_or_none.return_value = mock_assessment
    db.execute.return_value = result

    with pytest.raises(HTTPException) as exc_info:
        await get_research_summary(token, session, db)
    assert exc_info.value.status_code == 403


# ── Confirm Research Service ──────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_confirm_research_sets_timestamp():
    """confirm_research sets research_confirmed_at on the account."""
    from app.services.public_service import confirm_research
    from app.schemas.public import ConfirmResearchRequest

    account_id = uuid4()
    token = "test_token"
    session = {"account_id": str(account_id)}
    body = ConfirmResearchRequest(corrections=None)

    mock_account = MagicMock()
    mock_account.id = account_id
    mock_account.prospect_corrections = None

    mock_assessment = MagicMock()
    mock_assessment.account_id = account_id
    mock_assessment.account = mock_account

    db = AsyncMock()
    assessment_result = MagicMock()
    assessment_result.scalar_one_or_none.return_value = mock_assessment
    db.execute.return_value = assessment_result

    result = await confirm_research(token, session, body, db)

    assert result.confirmed is True
    assert mock_account.research_confirmed_at is not None
    db.commit.assert_called_once()


@pytest.mark.asyncio
async def test_confirm_research_saves_corrections_when_provided():
    """confirm_research saves non-empty corrections to account.prospect_corrections."""
    from app.services.public_service import confirm_research
    from app.schemas.public import ConfirmResearchRequest

    account_id = uuid4()
    token = "test_token"
    session = {"account_id": str(account_id)}
    body = ConfirmResearchRequest(corrections="We are on Azure, not AWS.")

    mock_account = MagicMock()
    mock_account.id = account_id
    mock_account.prospect_corrections = None

    mock_assessment = MagicMock()
    mock_assessment.account_id = account_id
    mock_assessment.account = mock_account

    db = AsyncMock()
    assessment_result = MagicMock()
    assessment_result.scalar_one_or_none.return_value = mock_assessment
    db.execute.return_value = assessment_result

    await confirm_research(token, session, body, db)

    assert mock_account.prospect_corrections == "We are on Azure, not AWS."


@pytest.mark.asyncio
async def test_confirm_research_does_not_overwrite_when_corrections_empty():
    """Empty/None corrections do not overwrite existing prospect_corrections."""
    from app.services.public_service import confirm_research
    from app.schemas.public import ConfirmResearchRequest

    account_id = uuid4()
    token = "test_token"
    session = {"account_id": str(account_id)}
    body = ConfirmResearchRequest(corrections="   ")  # whitespace only → treated as empty

    mock_account = MagicMock()
    mock_account.id = account_id
    mock_account.prospect_corrections = "previous corrections"

    mock_assessment = MagicMock()
    mock_assessment.account_id = account_id
    mock_assessment.account = mock_account

    db = AsyncMock()
    assessment_result = MagicMock()
    assessment_result.scalar_one_or_none.return_value = mock_assessment
    db.execute.return_value = assessment_result

    await confirm_research(token, session, body, db)

    # Should not have overwritten existing value
    assert mock_account.prospect_corrections == "previous corrections"


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


# ── Agent 2: prospect_corrections passed through ──────────────────────────────


@pytest.mark.asyncio
async def test_select_questions_passes_prospect_context_to_llm():
    """select_questions passes infrastructure_location and prospect_corrections to the LLM chain."""
    from app.agents.question_selection_agent import select_questions

    pillar_id = uuid4()
    account_id = uuid4()

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
        # Chain pipeline: prompt | llm | parser
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
                    prospect_corrections="We also use GCP.",
                )

    # The invoke was called with the prospect context values
    assert captured_invoke.get("infrastructure_location") == "AWS us-east-1"
    assert captured_invoke.get("tech_stack_description") == "Kubernetes, Python"
    assert captured_invoke.get("current_tools") == "Datadog"
    assert captured_invoke.get("prospect_corrections") == "We also use GCP."
