"""
Tests for GET /api/assessments/{id}, /answers, and /report endpoints.

All tests run without a live database — service calls are mocked.
"""
import pytest
from unittest.mock import AsyncMock, patch
from uuid import uuid4

from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.core.database import get_db
from app.core.deps import require_internal_user
from app.models.user import User
from app.routers.assessments import router as assessments_router


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def make_user(role: str = "internal_user") -> User:
    user = User()
    user.id = uuid4()
    user.name = "Internal User"
    user.email = "internal@example.com"
    user.password_hash = "hashed"
    user.role = role
    user.is_active = True
    return user


async def _no_db():
    yield None


def build_app(user: User) -> FastAPI:
    app = FastAPI()
    app.include_router(assessments_router)
    app.dependency_overrides[get_db] = _no_db
    app.dependency_overrides[require_internal_user] = lambda: user
    return app


def make_assessment_detail(assessment_id, account_id, user_id):
    return {
        "id": str(assessment_id),
        "account_id": str(account_id),
        "pillar_id": str(uuid4()),
        "pillar_name": "Full-Stack Observability",
        "company_name": "Stripe",
        "short_url_token": "AbCdEfGh",
        "prospect_name": "Alice",
        "prospect_email": "alice@stripe.com",
        "prospect_role": "SRE",
        "status": "completed",
        "created_at": "2026-01-01T00:00:00Z",
        "completed_at": "2026-01-02T00:00:00Z",
    }


def make_answers_out(assessment_id, account_id=None):
    return {
        "assessment_id": str(assessment_id),
        "account_id": str(account_id or uuid4()),
        "prospect_id": None,
        "pillar_id": str(uuid4()),
        "pillar_name": "Full-Stack Observability",
        "company_name": "Stripe",
        "status": "completed",
        "prospect_name": "Alice",
        "prospect_email": "alice@stripe.com",
        "prospect_role": "SRE",
        "completed_at": "2026-01-02T00:00:00Z",
        "pillar_score": 2.75,
        "maturity_label": "Developing",
        "answers": [
            {
                "question_text": "How do you collect metrics?",
                "selected_option_text": "We use a centralised observability platform.",
                "maturity_level": 3,
            },
            {
                "question_text": "How do you handle alerting?",
                "selected_option_text": "Ad-hoc, no defined process.",
                "maturity_level": 1,
            },
        ],
    }


def make_report_out(assessment_id):
    return {
        "id": str(uuid4()),
        "assessment_id": str(assessment_id),
        "pillar_score": 2.75,
        "maturity_level": 2,
        "maturity_label": "Developing",
        "executive_summary": "The organisation shows developing maturity.",
        "strengths": [
            {"title": "Centralised metrics", "description": "Strong metric collection."}
        ],
        "gap_analysis": [
            {
                "gap": "Alert coverage",
                "current_state": "Ad-hoc alerting",
                "target_state": "Full SLO-driven alerting",
                "impact": "high",
                "effort": "medium",
            }
        ],
        "next_steps": [
            {
                "title": "Define SLOs",
                "description": "Define SLOs for critical services.",
                "priority": "strategic",
                "timeframe": "3 months",
            }
        ],
        "pillar_breakdown": {},
        "created_at": "2026-01-02T00:00:00Z",
    }


# ---------------------------------------------------------------------------
# Auth enforcement — all three endpoints require authentication
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_assessment_detail_requires_auth():
    app = FastAPI()
    app.include_router(assessments_router)
    app.dependency_overrides[get_db] = _no_db
    # No require_internal_user override → 401
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get(f"/api/assessments/{uuid4()}")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_get_assessment_answers_requires_auth():
    app = FastAPI()
    app.include_router(assessments_router)
    app.dependency_overrides[get_db] = _no_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get(f"/api/assessments/{uuid4()}/answers")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_get_assessment_report_requires_auth():
    app = FastAPI()
    app.include_router(assessments_router)
    app.dependency_overrides[get_db] = _no_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get(f"/api/assessments/{uuid4()}/report")
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# GET /api/assessments/{id} — happy path
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_assessment_detail_returns_200():
    user = make_user()
    app = build_app(user)
    assessment_id = uuid4()
    account_id = uuid4()
    mock_out = make_assessment_detail(assessment_id, account_id, user.id)

    with patch(
        "app.routers.assessments.account_service.get_assessment_detail",
        new_callable=AsyncMock,
    ) as mock_fn:
        mock_fn.return_value = mock_out
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(f"/api/assessments/{assessment_id}")

    assert resp.status_code == 200
    data = resp.json()
    assert data["company_name"] == "Stripe"
    assert data["pillar_name"] == "Full-Stack Observability"
    assert data["prospect_name"] == "Alice"
    assert data["status"] == "completed"


# ---------------------------------------------------------------------------
# GET /api/assessments/{id} — 404 and 403
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_assessment_detail_404_not_found():
    from fastapi import HTTPException

    user = make_user()
    app = build_app(user)

    with patch(
        "app.routers.assessments.account_service.get_assessment_detail",
        new_callable=AsyncMock,
    ) as mock_fn:
        mock_fn.side_effect = HTTPException(status_code=404, detail="Assessment not found")
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(f"/api/assessments/{uuid4()}")

    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_assessment_detail_403_wrong_user():
    from fastapi import HTTPException

    user = make_user()
    app = build_app(user)

    with patch(
        "app.routers.assessments.account_service.get_assessment_detail",
        new_callable=AsyncMock,
    ) as mock_fn:
        mock_fn.side_effect = HTTPException(status_code=403, detail="Access denied")
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(f"/api/assessments/{uuid4()}")

    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# GET /api/assessments/{id}/answers — happy path
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_assessment_answers_returns_200():
    user = make_user()
    app = build_app(user)
    assessment_id = uuid4()
    mock_out = make_answers_out(assessment_id)

    with patch(
        "app.routers.assessments.account_service.get_assessment_answers",
        new_callable=AsyncMock,
    ) as mock_fn:
        mock_fn.return_value = mock_out
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(f"/api/assessments/{assessment_id}/answers")

    assert resp.status_code == 200
    data = resp.json()
    assert data["pillar_score"] == 2.75
    assert data["maturity_label"] == "Developing"
    assert len(data["answers"]) == 2


@pytest.mark.asyncio
async def test_get_assessment_answers_contains_question_and_option_text():
    user = make_user()
    app = build_app(user)
    assessment_id = uuid4()
    mock_out = make_answers_out(assessment_id)

    with patch(
        "app.routers.assessments.account_service.get_assessment_answers",
        new_callable=AsyncMock,
    ) as mock_fn:
        mock_fn.return_value = mock_out
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(f"/api/assessments/{assessment_id}/answers")

    answers = resp.json()["answers"]
    assert answers[0]["question_text"] == "How do you collect metrics?"
    assert answers[0]["selected_option_text"] == "We use a centralised observability platform."
    assert answers[0]["maturity_level"] == 3
    assert answers[1]["maturity_level"] == 1


@pytest.mark.asyncio
async def test_get_assessment_answers_no_report_returns_null_score():
    user = make_user()
    app = build_app(user)
    assessment_id = uuid4()
    mock_out = make_answers_out(assessment_id)
    mock_out["pillar_score"] = None
    mock_out["maturity_label"] = None

    with patch(
        "app.routers.assessments.account_service.get_assessment_answers",
        new_callable=AsyncMock,
    ) as mock_fn:
        mock_fn.return_value = mock_out
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(f"/api/assessments/{assessment_id}/answers")

    data = resp.json()
    assert data["pillar_score"] is None
    assert data["maturity_label"] is None


@pytest.mark.asyncio
async def test_get_assessment_answers_404_not_found():
    from fastapi import HTTPException

    user = make_user()
    app = build_app(user)

    with patch(
        "app.routers.assessments.account_service.get_assessment_answers",
        new_callable=AsyncMock,
    ) as mock_fn:
        mock_fn.side_effect = HTTPException(status_code=404, detail="Assessment not found")
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(f"/api/assessments/{uuid4()}/answers")

    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_assessment_answers_403_wrong_user():
    from fastapi import HTTPException

    user = make_user()
    app = build_app(user)

    with patch(
        "app.routers.assessments.account_service.get_assessment_answers",
        new_callable=AsyncMock,
    ) as mock_fn:
        mock_fn.side_effect = HTTPException(status_code=403, detail="Access denied")
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(f"/api/assessments/{uuid4()}/answers")

    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# GET /api/assessments/{id}/report — happy path
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_assessment_report_returns_200():
    user = make_user()
    app = build_app(user)
    assessment_id = uuid4()
    mock_out = make_report_out(assessment_id)

    with patch(
        "app.routers.assessments.account_service.get_assessment_report",
        new_callable=AsyncMock,
    ) as mock_fn:
        mock_fn.return_value = mock_out
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(f"/api/assessments/{assessment_id}/report")

    assert resp.status_code == 200
    data = resp.json()
    assert data["executive_summary"] == "The organisation shows developing maturity."
    assert data["pillar_score"] == 2.75
    assert data["maturity_label"] == "Developing"


@pytest.mark.asyncio
async def test_get_assessment_report_contains_strengths_gaps_next_steps():
    user = make_user()
    app = build_app(user)
    assessment_id = uuid4()
    mock_out = make_report_out(assessment_id)

    with patch(
        "app.routers.assessments.account_service.get_assessment_report",
        new_callable=AsyncMock,
    ) as mock_fn:
        mock_fn.return_value = mock_out
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(f"/api/assessments/{assessment_id}/report")

    data = resp.json()
    assert len(data["strengths"]) == 1
    assert data["strengths"][0]["title"] == "Centralised metrics"
    assert len(data["gap_analysis"]) == 1
    assert data["gap_analysis"][0]["impact"] == "high"
    assert len(data["next_steps"]) == 1
    assert data["next_steps"][0]["priority"] == "strategic"


@pytest.mark.asyncio
async def test_get_assessment_report_404_not_yet_generated():
    from fastapi import HTTPException

    user = make_user()
    app = build_app(user)

    with patch(
        "app.routers.assessments.account_service.get_assessment_report",
        new_callable=AsyncMock,
    ) as mock_fn:
        mock_fn.side_effect = HTTPException(
            status_code=404, detail="Report not yet available"
        )
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(f"/api/assessments/{uuid4()}/report")

    assert resp.status_code == 404
    assert "not yet available" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_get_assessment_report_403_wrong_user():
    from fastapi import HTTPException

    user = make_user()
    app = build_app(user)

    with patch(
        "app.routers.assessments.account_service.get_assessment_report",
        new_callable=AsyncMock,
    ) as mock_fn:
        mock_fn.side_effect = HTTPException(status_code=403, detail="Access denied")
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(f"/api/assessments/{uuid4()}/report")

    assert resp.status_code == 403
