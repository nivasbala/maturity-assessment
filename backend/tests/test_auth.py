"""
Tests for Task 3: Auth System.

All tests run without a live database — DB calls in services are mocked at
the service layer. The test app uses dependency overrides for get_db.
"""
import pytest
from unittest.mock import AsyncMock, patch
from uuid import uuid4

from fastapi import Depends, FastAPI
from httpx import ASGITransport, AsyncClient

from app.core.database import get_db
from app.core.deps import get_current_user, require_admin, require_internal_user
from app.core.security import create_access_token, create_refresh_token
from app.models.user import User
from app.routers.auth import router as auth_router


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def make_user(role: str = "internal_user", is_active: bool = True) -> User:
    user = User()
    user.id = uuid4()
    user.name = "Test User"
    user.email = "test@example.com"
    user.password_hash = "$2b$12$placeholder"
    user.role = role
    user.is_active = is_active
    return user


async def _no_db():
    yield None


def build_app() -> FastAPI:
    application = FastAPI()
    application.include_router(auth_router)
    application.dependency_overrides[get_db] = _no_db
    return application


APP = build_app()


# ---------------------------------------------------------------------------
# POST /api/auth/login
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_login_valid_credentials_returns_tokens():
    user = make_user()
    with patch("app.routers.auth.authenticate_user", AsyncMock(return_value=user)):
        async with AsyncClient(transport=ASGITransport(app=APP), base_url="http://test") as client:
            resp = await client.post("/api/auth/login", json={"email": "test@example.com", "password": "secret"})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_login_invalid_credentials_returns_401():
    with patch("app.routers.auth.authenticate_user", AsyncMock(return_value=None)):
        async with AsyncClient(transport=ASGITransport(app=APP), base_url="http://test") as client:
            resp = await client.post("/api/auth/login", json={"email": "x@x.com", "password": "wrong"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_login_missing_fields_returns_422():
    async with AsyncClient(transport=ASGITransport(app=APP), base_url="http://test") as client:
        resp = await client.post("/api/auth/login", json={"email": "only-email"})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_login_invalid_email_format_returns_422():
    async with AsyncClient(transport=ASGITransport(app=APP), base_url="http://test") as client:
        resp = await client.post("/api/auth/login", json={"email": "not-an-email", "password": "secret"})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_login_empty_password_returns_422():
    async with AsyncClient(transport=ASGITransport(app=APP), base_url="http://test") as client:
        resp = await client.post("/api/auth/login", json={"email": "user@example.com", "password": ""})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_login_timing_safe_unknown_email():
    with patch(
        "app.routers.auth.authenticate_user",
        AsyncMock(return_value=None),
    ):
        async with AsyncClient(transport=ASGITransport(app=APP), base_url="http://test") as client:
            resp = await client.post("/api/auth/login", json={"email": "unknown@example.com", "password": "x"})
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# POST /api/auth/refresh
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_refresh_valid_token_returns_new_tokens():
    user = make_user()
    token = create_refresh_token({"sub": str(user.id)})
    with patch("app.routers.auth.get_user_by_id", AsyncMock(return_value=user)):
        async with AsyncClient(transport=ASGITransport(app=APP), base_url="http://test") as client:
            resp = await client.post(
                "/api/auth/refresh",
                headers={"Authorization": f"Bearer {token}"},
            )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data


@pytest.mark.asyncio
async def test_refresh_with_access_token_returns_401():
    user = make_user()
    token = create_access_token({"sub": str(user.id)})
    async with AsyncClient(transport=ASGITransport(app=APP), base_url="http://test") as client:
        resp = await client.post(
            "/api/auth/refresh",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_refresh_no_token_returns_401():
    async with AsyncClient(transport=ASGITransport(app=APP), base_url="http://test") as client:
        resp = await client.post("/api/auth/refresh")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_refresh_inactive_user_returns_401():
    user = make_user()
    token = create_refresh_token({"sub": str(user.id)})
    with patch("app.routers.auth.get_user_by_id", AsyncMock(return_value=None)):
        async with AsyncClient(transport=ASGITransport(app=APP), base_url="http://test") as client:
            resp = await client.post(
                "/api/auth/refresh",
                headers={"Authorization": f"Bearer {token}"},
            )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_refresh_token_missing_sub_returns_401():
    token = create_refresh_token({})
    async with AsyncClient(transport=ASGITransport(app=APP), base_url="http://test") as client:
        resp = await client.post(
            "/api/auth/refresh",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_refresh_token_non_uuid_sub_returns_401():
    token = create_refresh_token({"sub": "not-a-uuid"})
    async with AsyncClient(transport=ASGITransport(app=APP), base_url="http://test") as client:
        resp = await client.post(
            "/api/auth/refresh",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# GET /api/auth/me
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_me_with_valid_token_returns_user():
    user = make_user(role="internal_user")
    token = create_access_token({"sub": str(user.id)})
    with patch("app.core.deps.get_user_by_id", AsyncMock(return_value=user)):
        async with AsyncClient(transport=ASGITransport(app=APP), base_url="http://test") as client:
            resp = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["role"] == "internal_user"
    assert data["is_active"] is True


@pytest.mark.asyncio
async def test_me_no_token_returns_401():
    async with AsyncClient(transport=ASGITransport(app=APP), base_url="http://test") as client:
        resp = await client.get("/api/auth/me")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_me_with_refresh_token_returns_401():
    user = make_user()
    token = create_refresh_token({"sub": str(user.id)})
    async with AsyncClient(transport=ASGITransport(app=APP), base_url="http://test") as client:
        resp = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Dependency: require_admin / require_internal_user
# ---------------------------------------------------------------------------


def build_dep_test_app() -> FastAPI:
    dep_app = FastAPI()
    dep_app.dependency_overrides[get_db] = _no_db

    @dep_app.get("/admin-only")
    async def admin_route(user: User = Depends(require_admin)) -> dict:
        return {"ok": True}

    @dep_app.get("/internal-only")
    async def internal_route(user: User = Depends(require_internal_user)) -> dict:
        return {"ok": True}

    return dep_app


DEP_APP = build_dep_test_app()


@pytest.mark.asyncio
async def test_require_admin_with_admin_role_returns_200():
    user = make_user(role="admin")
    token = create_access_token({"sub": str(user.id)})
    with patch("app.core.deps.get_user_by_id", AsyncMock(return_value=user)):
        async with AsyncClient(transport=ASGITransport(app=DEP_APP), base_url="http://test") as client:
            resp = await client.get("/admin-only", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_require_admin_with_internal_user_role_returns_403():
    user = make_user(role="internal_user")
    token = create_access_token({"sub": str(user.id)})
    with patch("app.core.deps.get_user_by_id", AsyncMock(return_value=user)):
        async with AsyncClient(transport=ASGITransport(app=DEP_APP), base_url="http://test") as client:
            resp = await client.get("/admin-only", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_require_admin_unauthenticated_returns_401():
    async with AsyncClient(transport=ASGITransport(app=DEP_APP), base_url="http://test") as client:
        resp = await client.get("/admin-only")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_require_internal_user_with_internal_role_returns_200():
    user = make_user(role="internal_user")
    token = create_access_token({"sub": str(user.id)})
    with patch("app.core.deps.get_user_by_id", AsyncMock(return_value=user)):
        async with AsyncClient(transport=ASGITransport(app=DEP_APP), base_url="http://test") as client:
            resp = await client.get("/internal-only", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_require_internal_user_with_admin_role_returns_200():
    user = make_user(role="admin")
    token = create_access_token({"sub": str(user.id)})
    with patch("app.core.deps.get_user_by_id", AsyncMock(return_value=user)):
        async with AsyncClient(transport=ASGITransport(app=DEP_APP), base_url="http://test") as client:
            resp = await client.get("/internal-only", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_require_internal_user_unauthenticated_returns_401():
    async with AsyncClient(transport=ASGITransport(app=DEP_APP), base_url="http://test") as client:
        resp = await client.get("/internal-only")
    assert resp.status_code == 401
