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
