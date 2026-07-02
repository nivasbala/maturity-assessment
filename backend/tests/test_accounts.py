"""
Tests for Task 6: Short URL Flow.

All tests run without a live database — service calls are mocked.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.core.database import get_db
from app.core.deps import get_current_user, require_internal_user
from app.core.security import create_access_token
from app.models.user import User
from app.routers.accounts import router as accounts_router
from app.routers.assessments import router as assessments_router
from app.services.account_service import assert_owns_account


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


def make_other_user() -> User:
    user = User()
    user.id = uuid4()
    user.name = "Other User"
    user.email = "other@example.com"
    user.password_hash = "hashed"
    user.role = "internal_user"
    user.is_active = True
    return user


async def _no_db():
    yield None


def _auth_header(user: User) -> dict:
    token = create_access_token({"sub": str(user.id)})
    return {"Authorization": f"Bearer {token}"}


def build_app(user: User) -> FastAPI:
    application = FastAPI()
    application.include_router(accounts_router)
    application.include_router(assessments_router)
    application.dependency_overrides[get_db] = _no_db
    application.dependency_overrides[get_current_user] = lambda: user
    application.dependency_overrides[require_internal_user] = lambda: user
    return application


# ---------------------------------------------------------------------------
# assert_owns_account
# ---------------------------------------------------------------------------


def test_assert_owns_account_admin_passes():
    admin = make_user(role="admin")
    account = MagicMock()
    account.internal_user_id = uuid4()
    assert_owns_account(admin, account) is None


def test_assert_owns_account_owner_passes():
    user = make_user()
    account = MagicMock()
    account.internal_user_id = user.id
    assert_owns_account(user, account) is None


def test_assert_owns_account_other_user_raises():
    from fastapi import HTTPException

    user = make_user()
    account = MagicMock()
    account.internal_user_id = uuid4()  # different user
    with pytest.raises(HTTPException) as exc_info:
        assert_owns_account(user, account)
    assert exc_info.value.status_code == 403


# ---------------------------------------------------------------------------
# Short URL token generation
# ---------------------------------------------------------------------------


def test_generate_short_token_length():
    import secrets

    # token_urlsafe(6) produces exactly 8 URL-safe base64 chars
    for _ in range(10):
        token = secrets.token_urlsafe(6)
        assert len(token) == 8
        assert all(c in "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_" for c in token)


# ---------------------------------------------------------------------------
# GET /api/accounts — returns 401 without auth
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_accounts_requires_auth():
    application = FastAPI()
    application.include_router(accounts_router)
    application.dependency_overrides[get_db] = _no_db
    # No auth override — bearer header will be missing
    async with AsyncClient(transport=ASGITransport(app=application), base_url="http://test") as client:
        resp = await client.get("/api/accounts")
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# GET /api/accounts — list returns accounts
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_accounts_returns_paginated():
    user = make_user()
    app = build_app(user)

    account_id = uuid4()
    mock_result = {
        "items": [
            {
                "id": str(account_id),
                "company_name": "Acme Corp",
                "company_website": "https://acme.com",
                "internal_user_id": str(user.id),
                "suggested_pillars": [],
                "created_at": "2026-01-01T00:00:00Z",
            }
        ],
        "total": 1,
        "page": 1,
        "size": 25,
    }

    with patch("app.routers.accounts.account_service.list_accounts", new_callable=AsyncMock) as mock_list:
        mock_list.return_value = mock_result
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/api/accounts")

    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["company_name"] == "Acme Corp"


# ---------------------------------------------------------------------------
# POST /api/accounts — create account
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_account_returns_201():
    user = make_user()
    app = build_app(user)

    new_id = uuid4()
    mock_out = {
        "id": str(new_id),
        "company_name": "NewCo",
        "company_website": None,
        "internal_user_id": str(user.id),
        "suggested_pillars": [],
        "created_at": "2026-01-01T00:00:00Z",
    }

    with patch("app.routers.accounts.account_service.create_account", new_callable=AsyncMock) as mock_create:
        mock_create.return_value = mock_out
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post("/api/accounts", json={"company_name": "NewCo"})

    assert resp.status_code == 201
    assert resp.json()["company_name"] == "NewCo"


@pytest.mark.asyncio
async def test_create_account_missing_name_returns_422():
    user = make_user()
    app = build_app(user)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/api/accounts", json={})

    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# POST /api/accounts/{id}/assessments — short URL generation
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_assessment_returns_short_url():
    user = make_user()
    app = build_app(user)

    account_id = uuid4()
    pillar_id = uuid4()
    assessment_id = uuid4()

    mock_out = {
        "assessment_id": str(assessment_id),
        "short_url_token": "AbCdEfGh",
        "full_url": f"http://localhost/assess/AbCdEfGh",
    }

    with patch(
        "app.routers.accounts.account_service.create_assessment", new_callable=AsyncMock
    ) as mock_create:
        mock_create.return_value = mock_out
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                f"/api/accounts/{account_id}/assessments",
                json={"pillar_id": str(pillar_id)},
            )

    assert resp.status_code == 201
    data = resp.json()
    assert "short_url_token" in data
    assert "full_url" in data
    assert len(data["short_url_token"]) == 8


# ---------------------------------------------------------------------------
# POST /api/accounts/{id}/assessments — 409 on duplicate
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_assessment_409_on_duplicate():
    from fastapi import HTTPException

    user = make_user()
    app = build_app(user)

    account_id = uuid4()
    pillar_id = uuid4()

    with patch(
        "app.routers.accounts.account_service.create_assessment", new_callable=AsyncMock
    ) as mock_create:
        mock_create.side_effect = HTTPException(status_code=409, detail="Already exists")
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                f"/api/accounts/{account_id}/assessments",
                json={"pillar_id": str(pillar_id)},
            )

    assert resp.status_code == 409


# ---------------------------------------------------------------------------
# GET /api/accounts/{id} — 403 for wrong user
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_account_detail_403_wrong_user():
    from fastapi import HTTPException

    user = make_user()
    app = build_app(user)

    account_id = uuid4()

    with patch(
        "app.routers.accounts.account_service.get_account_detail", new_callable=AsyncMock
    ) as mock_get:
        mock_get.side_effect = HTTPException(status_code=403, detail="Access denied")
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(f"/api/accounts/{account_id}")

    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# GET /api/accounts/{id}/aggregate — 404 when fewer than 2 completed
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_aggregate_404_insufficient_assessments():
    from fastapi import HTTPException

    user = make_user()
    app = build_app(user)

    account_id = uuid4()

    with patch(
        "app.routers.accounts.account_service.get_account_aggregate", new_callable=AsyncMock
    ) as mock_agg:
        mock_agg.side_effect = HTTPException(
            status_code=404, detail="Aggregate view requires at least 2 completed assessments"
        )
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(f"/api/accounts/{account_id}/aggregate")

    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# DELETE /api/accounts/{id}/assessments/{assessment_id}
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_delete_assessment_returns_204():
    user = make_user()
    app = build_app(user)

    account_id = uuid4()
    assessment_id = uuid4()

    with patch(
        "app.routers.accounts.account_service.delete_assessment", new_callable=AsyncMock
    ) as mock_del:
        mock_del.return_value = None
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.delete(
                f"/api/accounts/{account_id}/assessments/{assessment_id}"
            )

    assert resp.status_code == 204
    mock_del.assert_awaited_once()


@pytest.mark.asyncio
async def test_delete_assessment_404_not_found():
    from fastapi import HTTPException

    user = make_user()
    app = build_app(user)

    account_id = uuid4()
    assessment_id = uuid4()

    with patch(
        "app.routers.accounts.account_service.delete_assessment", new_callable=AsyncMock
    ) as mock_del:
        mock_del.side_effect = HTTPException(status_code=404, detail="Assessment not found")
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.delete(
                f"/api/accounts/{account_id}/assessments/{assessment_id}"
            )

    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_assessment_403_wrong_user():
    from fastapi import HTTPException

    user = make_user()
    app = build_app(user)

    account_id = uuid4()
    assessment_id = uuid4()

    with patch(
        "app.routers.accounts.account_service.delete_assessment", new_callable=AsyncMock
    ) as mock_del:
        mock_del.side_effect = HTTPException(status_code=403, detail="Access denied")
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.delete(
                f"/api/accounts/{account_id}/assessments/{assessment_id}"
            )

    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_delete_assessment_401_unauthenticated():
    application = FastAPI()
    application.include_router(accounts_router)
    application.dependency_overrides[get_db] = _no_db
    # No auth override — bearer header will be missing

    account_id = uuid4()
    assessment_id = uuid4()

    async with AsyncClient(
        transport=ASGITransport(app=application), base_url="http://test"
    ) as client:
        resp = await client.delete(
            f"/api/accounts/{account_id}/assessments/{assessment_id}"
        )

    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# GET /api/accounts — admin sees all, internal_user_name populated
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_accounts_admin_receives_all_accounts():
    """Admin user: service called without user filter and returns accounts from multiple owners."""
    admin = make_user(role="admin")
    other_user = make_other_user()
    app = build_app(admin)

    account_id_1 = uuid4()
    account_id_2 = uuid4()
    mock_result = {
        "items": [
            {
                "id": str(account_id_1),
                "company_name": "Alpha Corp",
                "company_website": None,
                "internal_user_id": str(admin.id),
                "internal_user_name": admin.name,
                "suggested_pillars": [],
                "created_at": "2026-01-01T00:00:00Z",
                "pillars_sent": 0,
                "pillars_completed": 0,
            },
            {
                "id": str(account_id_2),
                "company_name": "Beta Inc",
                "company_website": None,
                "internal_user_id": str(other_user.id),
                "internal_user_name": other_user.name,
                "suggested_pillars": [],
                "created_at": "2026-01-02T00:00:00Z",
                "pillars_sent": 0,
                "pillars_completed": 0,
            },
        ],
        "total": 2,
        "page": 1,
        "size": 25,
    }

    with patch("app.routers.accounts.account_service.list_accounts", new_callable=AsyncMock) as mock_list:
        mock_list.return_value = mock_result
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/api/accounts")

    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2
    # verify accounts from different owners both returned
    owner_ids = {item["internal_user_id"] for item in data["items"]}
    assert str(admin.id) in owner_ids
    assert str(other_user.id) in owner_ids


@pytest.mark.asyncio
async def test_list_accounts_response_includes_internal_user_name():
    """Each account in the list carries the creator's name."""
    user = make_user()
    app = build_app(user)

    mock_result = {
        "items": [
            {
                "id": str(uuid4()),
                "company_name": "Acme Corp",
                "company_website": None,
                "internal_user_id": str(user.id),
                "internal_user_name": "Internal User",
                "suggested_pillars": [],
                "created_at": "2026-01-01T00:00:00Z",
                "pillars_sent": 2,
                "pillars_completed": 1,
            }
        ],
        "total": 1,
        "page": 1,
        "size": 25,
    }

    with patch("app.routers.accounts.account_service.list_accounts", new_callable=AsyncMock) as mock_list:
        mock_list.return_value = mock_result
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/api/accounts")

    assert resp.status_code == 200
    item = resp.json()["items"][0]
    assert item["internal_user_name"] == "Internal User"
    assert item["pillars_sent"] == 2
    assert item["pillars_completed"] == 1


@pytest.mark.asyncio
async def test_list_accounts_pagination_params_forwarded():
    """page and size query params are passed through to the service."""
    user = make_user()
    app = build_app(user)

    mock_result = {"items": [], "total": 0, "page": 2, "size": 10}

    with patch("app.routers.accounts.account_service.list_accounts", new_callable=AsyncMock) as mock_list:
        mock_list.return_value = mock_result
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/api/accounts?page=2&size=10")

    assert resp.status_code == 200
    mock_list.assert_awaited_once()
    call_kwargs = mock_list.await_args.kwargs
    assert call_kwargs.get("page") == 2
    assert call_kwargs.get("size") == 10


# ---------------------------------------------------------------------------
# POST /api/accounts — suggested_pillars and internal_user_name in response
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_account_with_suggested_pillars():
    """suggested_pillars array is accepted and mirrored in the response."""
    user = make_user()
    app = build_app(user)

    pillar_id = uuid4()
    mock_out = {
        "id": str(uuid4()),
        "company_name": "PillarCo",
        "company_website": "https://pillarco.com",
        "internal_user_id": str(user.id),
        "internal_user_name": user.name,
        "suggested_pillars": [str(pillar_id)],
        "created_at": "2026-01-01T00:00:00Z",
        "pillars_sent": 0,
        "pillars_completed": 0,
    }

    with patch("app.routers.accounts.account_service.create_account", new_callable=AsyncMock) as mock_create:
        mock_create.return_value = mock_out
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/api/accounts",
                json={
                    "company_name": "PillarCo",
                    "company_website": "https://pillarco.com",
                    "suggested_pillars": [str(pillar_id)],
                },
            )

    assert resp.status_code == 201
    data = resp.json()
    assert data["suggested_pillars"] == [str(pillar_id)]
    assert data["internal_user_name"] == user.name


@pytest.mark.asyncio
async def test_create_account_empty_name_returns_422():
    """Empty string company_name (min_length=1) is rejected with 422."""
    user = make_user()
    app = build_app(user)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/api/accounts", json={"company_name": ""})

    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# GET /api/accounts/{id} — happy path and 404
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_account_detail_returns_200_with_pillar_statuses():
    """Successful lookup returns account info plus pillar_statuses list."""
    user = make_user()
    app = build_app(user)

    account_id = uuid4()
    pillar_id = uuid4()
    mock_detail = {
        "id": str(account_id),
        "company_name": "Detail Corp",
        "company_website": None,
        "internal_user_id": str(user.id),
        "internal_user_name": user.name,
        "suggested_pillars": [],
        "created_at": "2026-01-01T00:00:00Z",
        "pillar_statuses": [
            {
                "pillar_id": str(pillar_id),
                "pillar_name": "Full-Stack Observability",
                "display_order": 1,
                "is_gated": False,
                "is_active": True,
                "assessment_id": None,
                "status": None,
                "prospect_name": None,
                "prospect_email": None,
                "prospect_role": None,
                "pillar_score": None,
                "maturity_label": None,
                "short_url_token": None,
            }
        ],
    }

    with patch("app.routers.accounts.account_service.get_account_detail", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_detail
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(f"/api/accounts/{account_id}")

    assert resp.status_code == 200
    data = resp.json()
    assert data["company_name"] == "Detail Corp"
    assert len(data["pillar_statuses"]) == 1
    assert data["pillar_statuses"][0]["pillar_name"] == "Full-Stack Observability"


@pytest.mark.asyncio
async def test_get_account_detail_404_not_found():
    from fastapi import HTTPException

    user = make_user()
    app = build_app(user)

    with patch("app.routers.accounts.account_service.get_account_detail", new_callable=AsyncMock) as mock_get:
        mock_get.side_effect = HTTPException(status_code=404, detail="Account not found")
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(f"/api/accounts/{uuid4()}")

    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# GET /api/accounts/{id}/aggregate — happy path (2+ completed assessments)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_aggregate_returns_scores_when_two_or_more_completed():
    user = make_user()
    app = build_app(user)

    account_id = uuid4()
    mock_agg = {
        "account_id": str(account_id),
        "company_name": "Scored Corp",
        "completed_count": 2,
        "scores": [
            {
                "pillar_id": str(uuid4()),
                "pillar_name": "Full-Stack Observability",
                "pillar_score": 3.2,
                "maturity_label": "Optimizing",
                "prospect_name": "Alice",
                "prospect_role": "SRE",
            },
            {
                "pillar_id": str(uuid4()),
                "pillar_name": "AIOps & Intelligent Observability",
                "pillar_score": 2.5,
                "maturity_label": "Defined",
                "prospect_name": "Bob",
                "prospect_role": "ML Engineer",
            },
        ],
    }

    with patch("app.routers.accounts.account_service.get_account_aggregate", new_callable=AsyncMock) as mock_agg_fn:
        mock_agg_fn.return_value = mock_agg
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(f"/api/accounts/{account_id}/aggregate")

    assert resp.status_code == 200
    data = resp.json()
    assert data["completed_count"] == 2
    assert len(data["scores"]) == 2
    pillar_names = [s["pillar_name"] for s in data["scores"]]
    assert "Full-Stack Observability" in pillar_names


# ---------------------------------------------------------------------------
# DELETE /api/accounts/{id} — delete whole account
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_delete_account_returns_204():
    user = make_user()
    app = build_app(user)

    account_id = uuid4()

    with patch("app.routers.accounts.account_service.delete_account", new_callable=AsyncMock) as mock_del:
        mock_del.return_value = None
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.delete(f"/api/accounts/{account_id}")

    assert resp.status_code == 204
    mock_del.assert_awaited_once()


@pytest.mark.asyncio
async def test_delete_account_403_wrong_owner():
    from fastapi import HTTPException

    user = make_user()
    app = build_app(user)

    with patch("app.routers.accounts.account_service.delete_account", new_callable=AsyncMock) as mock_del:
        mock_del.side_effect = HTTPException(status_code=403, detail="Access denied")
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.delete(f"/api/accounts/{uuid4()}")

    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_delete_account_404_not_found():
    from fastapi import HTTPException

    user = make_user()
    app = build_app(user)

    with patch("app.routers.accounts.account_service.delete_account", new_callable=AsyncMock) as mock_del:
        mock_del.side_effect = HTTPException(status_code=404, detail="Account not found")
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.delete(f"/api/accounts/{uuid4()}")

    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_account_401_unauthenticated():
    application = FastAPI()
    application.include_router(accounts_router)
    application.dependency_overrides[get_db] = _no_db

    async with AsyncClient(transport=ASGITransport(app=application), base_url="http://test") as client:
        resp = await client.delete(f"/api/accounts/{uuid4()}")

    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Service layer — list_accounts ownership filtering
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_accounts_service_filters_by_user_for_non_admin():
    """Service builds a WHERE clause on internal_user_id for non-admin users."""
    from unittest.mock import AsyncMock as AM, MagicMock as MM, patch as p

    from sqlalchemy.ext.asyncio import AsyncSession

    from app.services.account_service import list_accounts

    db = MM(spec=AsyncSession)

    # scalar_one() for count query
    count_result = MM()
    count_result.scalar_one.return_value = 0

    # scalars().all() for rows query
    rows_result = MM()
    rows_result.scalars.return_value.all.return_value = []

    # count query and rows query return in sequence
    db.execute = AM(side_effect=[count_result, rows_result, rows_result, rows_result])

    user = make_user(role="internal_user")

    with p("app.services.account_service.select", wraps=__import__("sqlalchemy", fromlist=["select"]).select):
        result = await list_accounts(db, user, page=1, size=25)

    assert result.total == 0
    assert result.items == []


@pytest.mark.asyncio
async def test_list_accounts_service_no_filter_for_admin():
    """Admin user gets all accounts — the service does not apply a user ID filter."""
    from unittest.mock import AsyncMock as AM, MagicMock as MM

    from app.services.account_service import list_accounts

    db = MM()

    count_result = MM()
    count_result.scalar_one.return_value = 0

    rows_result = MM()
    rows_result.scalars.return_value.all.return_value = []

    db.execute = AM(side_effect=[count_result, rows_result, rows_result, rows_result])

    admin = make_user(role="admin")
    result = await list_accounts(db, admin, page=1, size=25)

    assert result.total == 0
    assert result.items == []
