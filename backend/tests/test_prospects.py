"""
Tests for the Prospect feature.

Covers:
  - Route layer (HTTP status codes, request/response shape) — service mocked
  - Service layer (create_prospect, list_prospects) — DB mocked via AsyncMock
  - Schema validation (ProspectCreate)
  - Token uniqueness retry logic
"""
import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch, call
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError

from app.core.database import get_db
from app.core.deps import get_current_user, require_internal_user
from app.models.user import User
from app.routers.accounts import router as accounts_router
from app.schemas.internal import ProspectCreate, ProspectOut


# ── Helpers ───────────────────────────────────────────────────────────────────

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
    app.include_router(accounts_router)
    app.dependency_overrides[get_db] = _no_db
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[require_internal_user] = lambda: user
    return app


def make_prospect_out(account_id=None, email="jane@acme.com", name=None) -> dict:
    account_id = account_id or uuid4()
    token = "AbCdEfGh"
    return {
        "id": str(uuid4()),
        "account_id": str(account_id),
        "email": email,
        "name": name,
        "short_url_token": token,
        "full_url": f"http://localhost/assess/{token}",
        "created_at": "2026-07-01T12:00:00Z",
    }


# ── Schema validation ─────────────────────────────────────────────────────────

def test_prospect_create_valid():
    body = ProspectCreate(email="jane@acme.com")
    assert body.email == "jane@acme.com"
    assert body.name is None


def test_prospect_create_with_name():
    body = ProspectCreate(email="jane@acme.com", name="Jane Smith")
    assert body.name == "Jane Smith"


def test_prospect_create_empty_email_fails():
    with pytest.raises(ValidationError):
        ProspectCreate(email="")


def test_prospect_create_missing_email_fails():
    with pytest.raises(ValidationError):
        ProspectCreate()


def test_prospect_create_email_too_long_fails():
    with pytest.raises(ValidationError):
        ProspectCreate(email="a" * 256 + "@acme.com")


def test_prospect_create_name_too_long_fails():
    with pytest.raises(ValidationError):
        ProspectCreate(email="jane@acme.com", name="x" * 256)


# ── Route: POST /api/accounts/{id}/prospects ─────────────────────────────────

@pytest.mark.asyncio
async def test_create_prospect_returns_201():
    user = make_user()
    account_id = uuid4()
    app = build_app(user)
    mock_out = make_prospect_out(account_id=account_id)

    with patch("app.routers.accounts.account_service.create_prospect", new_callable=AsyncMock) as mock_create:
        mock_create.return_value = mock_out
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                f"/api/accounts/{account_id}/prospects",
                json={"email": "jane@acme.com"},
            )

    assert resp.status_code == 201
    data = resp.json()
    assert data["email"] == "jane@acme.com"
    assert "full_url" in data
    assert "short_url_token" in data
    assert data["full_url"].endswith(data["short_url_token"])


@pytest.mark.asyncio
async def test_create_prospect_with_name_passes_name_to_service():
    user = make_user()
    account_id = uuid4()
    app = build_app(user)
    mock_out = make_prospect_out(account_id=account_id, email="jane@acme.com", name="Jane Smith")

    with patch("app.routers.accounts.account_service.create_prospect", new_callable=AsyncMock) as mock_create:
        mock_create.return_value = mock_out
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                f"/api/accounts/{account_id}/prospects",
                json={"email": "jane@acme.com", "name": "Jane Smith"},
            )

    assert resp.status_code == 201
    assert resp.json()["name"] == "Jane Smith"
    # confirm the service received the name
    call_args = mock_create.call_args
    body_arg = call_args[0][3]  # positional: db, account_id, user, body
    assert body_arg.name == "Jane Smith"


@pytest.mark.asyncio
async def test_create_prospect_missing_email_returns_422():
    user = make_user()
    account_id = uuid4()
    app = build_app(user)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            f"/api/accounts/{account_id}/prospects",
            json={},
        )

    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_prospect_empty_email_returns_422():
    user = make_user()
    account_id = uuid4()
    app = build_app(user)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            f"/api/accounts/{account_id}/prospects",
            json={"email": ""},
        )

    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_prospect_unauthenticated_returns_401():
    app = FastAPI()
    app.include_router(accounts_router)
    app.dependency_overrides[get_db] = _no_db
    # no auth override

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            f"/api/accounts/{uuid4()}/prospects",
            json={"email": "jane@acme.com"},
        )

    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_create_prospect_account_not_found_returns_404():
    user = make_user()
    account_id = uuid4()
    app = build_app(user)

    with patch("app.routers.accounts.account_service.create_prospect", new_callable=AsyncMock) as mock_create:
        mock_create.side_effect = HTTPException(status_code=404, detail="Account not found")
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                f"/api/accounts/{account_id}/prospects",
                json={"email": "jane@acme.com"},
            )

    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_create_prospect_wrong_user_returns_403():
    user = make_user()
    account_id = uuid4()
    app = build_app(user)

    with patch("app.routers.accounts.account_service.create_prospect", new_callable=AsyncMock) as mock_create:
        mock_create.side_effect = HTTPException(status_code=403, detail="Access denied")
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                f"/api/accounts/{account_id}/prospects",
                json={"email": "jane@acme.com"},
            )

    assert resp.status_code == 403


# ── Route: GET /api/accounts/{id}/prospects ──────────────────────────────────

@pytest.mark.asyncio
async def test_list_prospects_returns_200_with_list():
    user = make_user()
    account_id = uuid4()
    app = build_app(user)
    mock_out = [make_prospect_out(account_id=account_id, email=f"p{i}@acme.com") for i in range(3)]

    with patch("app.routers.accounts.account_service.list_prospects", new_callable=AsyncMock) as mock_list:
        mock_list.return_value = mock_out
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(f"/api/accounts/{account_id}/prospects")

    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) == 3
    assert all("full_url" in p for p in data)


@pytest.mark.asyncio
async def test_list_prospects_returns_empty_list():
    user = make_user()
    account_id = uuid4()
    app = build_app(user)

    with patch("app.routers.accounts.account_service.list_prospects", new_callable=AsyncMock) as mock_list:
        mock_list.return_value = []
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(f"/api/accounts/{account_id}/prospects")

    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_list_prospects_unauthenticated_returns_401():
    app = FastAPI()
    app.include_router(accounts_router)
    app.dependency_overrides[get_db] = _no_db

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get(f"/api/accounts/{uuid4()}/prospects")

    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_list_prospects_account_not_found_returns_404():
    user = make_user()
    account_id = uuid4()
    app = build_app(user)

    with patch("app.routers.accounts.account_service.list_prospects", new_callable=AsyncMock) as mock_list:
        mock_list.side_effect = HTTPException(status_code=404, detail="Account not found")
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(f"/api/accounts/{account_id}/prospects")

    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_list_prospects_wrong_user_returns_403():
    user = make_user()
    account_id = uuid4()
    app = build_app(user)

    with patch("app.routers.accounts.account_service.list_prospects", new_callable=AsyncMock) as mock_list:
        mock_list.side_effect = HTTPException(status_code=403, detail="Access denied")
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(f"/api/accounts/{account_id}/prospects")

    assert resp.status_code == 403


# ── Service: create_prospect ──────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_service_create_prospect_happy_path():
    from app.services.account_service import create_prospect

    user = make_user()
    account_id = uuid4()
    account = MagicMock()
    account.id = account_id
    account.internal_user_id = user.id

    prospect_id = uuid4()

    db = AsyncMock()
    db.add = MagicMock()
    # account lookup returns account; token collision check returns None (no collision)
    db.execute.side_effect = [
        MagicMock(scalar_one_or_none=MagicMock(return_value=account)),   # account select
        MagicMock(scalar_one_or_none=MagicMock(return_value=None)),      # token collision check
    ]

    async def mock_refresh(obj):
        obj.id = prospect_id
        obj.created_at = datetime(2026, 7, 1, 12, 0, 0, tzinfo=timezone.utc)

    db.refresh = AsyncMock(side_effect=mock_refresh)

    result = await create_prospect(
        db, account_id, user, ProspectCreate(email="jane@acme.com")
    )

    assert result.email == "jane@acme.com"
    assert "/assess/" in result.full_url
    db.add.assert_called_once()
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_service_create_prospect_account_not_found():
    from app.services.account_service import create_prospect

    user = make_user()
    db = AsyncMock()
    db.execute.return_value = MagicMock(scalar_one_or_none=MagicMock(return_value=None))

    with pytest.raises(HTTPException) as exc_info:
        await create_prospect(db, uuid4(), user, ProspectCreate(email="jane@acme.com"))

    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_service_create_prospect_wrong_user_raises_403():
    from app.services.account_service import create_prospect

    user = make_user()
    account = MagicMock()
    account.internal_user_id = uuid4()  # different owner

    db = AsyncMock()
    db.execute.return_value = MagicMock(scalar_one_or_none=MagicMock(return_value=account))

    with pytest.raises(HTTPException) as exc_info:
        await create_prospect(db, uuid4(), user, ProspectCreate(email="jane@acme.com"))

    assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_service_create_prospect_admin_bypasses_ownership():
    from app.services.account_service import create_prospect

    admin = make_user(role="admin")
    account_id = uuid4()
    account = MagicMock()
    account.id = account_id
    account.internal_user_id = uuid4()  # owned by someone else — admin should still pass

    prospect_id = uuid4()

    db = AsyncMock()
    db.add = MagicMock()
    db.execute.side_effect = [
        MagicMock(scalar_one_or_none=MagicMock(return_value=account)),
        MagicMock(scalar_one_or_none=MagicMock(return_value=None)),
    ]

    async def mock_refresh(obj):
        obj.id = prospect_id
        obj.created_at = datetime(2026, 7, 1, 12, 0, 0, tzinfo=timezone.utc)

    db.refresh = AsyncMock(side_effect=mock_refresh)

    result = await create_prospect(
        db, account_id, admin, ProspectCreate(email="jane@acme.com")
    )

    assert result.email == "jane@acme.com"


@pytest.mark.asyncio
async def test_service_create_prospect_token_collision_retries():
    """Service retries token generation on collision and succeeds on second attempt."""
    from app.services.account_service import create_prospect

    user = make_user()
    account_id = uuid4()
    account = MagicMock()
    account.id = account_id
    account.internal_user_id = user.id

    colliding_prospect = MagicMock()  # simulates existing record with same token
    prospect_id = uuid4()

    db = AsyncMock()
    db.add = MagicMock()
    db.execute.side_effect = [
        MagicMock(scalar_one_or_none=MagicMock(return_value=account)),        # account lookup
        MagicMock(scalar_one_or_none=MagicMock(return_value=colliding_prospect)),  # first token: collision
        MagicMock(scalar_one_or_none=MagicMock(return_value=None)),           # second token: no collision
    ]

    async def mock_refresh(obj):
        obj.id = prospect_id
        obj.created_at = datetime(2026, 7, 1, 12, 0, 0, tzinfo=timezone.utc)

    db.refresh = AsyncMock(side_effect=mock_refresh)

    result = await create_prospect(
        db, account_id, user, ProspectCreate(email="jane@acme.com")
    )

    assert result.email == "jane@acme.com"
    # account lookup + 2 collision checks = 3 execute calls
    assert db.execute.call_count == 3


@pytest.mark.asyncio
async def test_service_create_prospect_all_tokens_collide_raises_500():
    """Service raises 500 after exhausting 5 collision retries."""
    from app.services.account_service import create_prospect

    user = make_user()
    account = MagicMock()
    account.internal_user_id = user.id
    colliding = MagicMock()

    db = AsyncMock()
    # account lookup + 5 collisions
    db.execute.side_effect = [
        MagicMock(scalar_one_or_none=MagicMock(return_value=account)),
    ] + [
        MagicMock(scalar_one_or_none=MagicMock(return_value=colliding))
        for _ in range(5)
    ]

    with pytest.raises(HTTPException) as exc_info:
        await create_prospect(db, uuid4(), user, ProspectCreate(email="jane@acme.com"))

    assert exc_info.value.status_code == 500


# ── Service: list_prospects ───────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_service_list_prospects_returns_all():
    from app.services.account_service import list_prospects

    user = make_user()
    account_id = uuid4()
    account = MagicMock()
    account.internal_user_id = user.id

    p1 = MagicMock()
    p1.id, p1.account_id, p1.email, p1.name = uuid4(), account_id, "a@co.com", "Alice"
    p1.short_url_token = "tok111aa"
    p1.created_at = datetime(2026, 7, 1, 12, 0, 0, tzinfo=timezone.utc)

    p2 = MagicMock()
    p2.id, p2.account_id, p2.email, p2.name = uuid4(), account_id, "b@co.com", None
    p2.short_url_token = "tok222bb"
    p2.created_at = datetime(2026, 7, 1, 11, 0, 0, tzinfo=timezone.utc)

    db = AsyncMock()
    db.execute.side_effect = [
        MagicMock(scalar_one_or_none=MagicMock(return_value=account)),
        MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[p1, p2])))),
    ]

    result = await list_prospects(db, account_id, user)

    assert len(result) == 2
    emails = {r.email for r in result}
    assert emails == {"a@co.com", "b@co.com"}
    assert all("/assess/" in r.full_url for r in result)


@pytest.mark.asyncio
async def test_service_list_prospects_returns_empty_list():
    from app.services.account_service import list_prospects

    user = make_user()
    account = MagicMock()
    account.internal_user_id = user.id

    db = AsyncMock()
    db.execute.side_effect = [
        MagicMock(scalar_one_or_none=MagicMock(return_value=account)),
        MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[])))),
    ]

    result = await list_prospects(db, uuid4(), user)

    assert result == []


@pytest.mark.asyncio
async def test_service_list_prospects_account_not_found():
    from app.services.account_service import list_prospects

    user = make_user()
    db = AsyncMock()
    db.execute.return_value = MagicMock(scalar_one_or_none=MagicMock(return_value=None))

    with pytest.raises(HTTPException) as exc_info:
        await list_prospects(db, uuid4(), user)

    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_service_list_prospects_wrong_user_raises_403():
    from app.services.account_service import list_prospects

    user = make_user()
    account = MagicMock()
    account.internal_user_id = uuid4()  # different owner

    db = AsyncMock()
    db.execute.return_value = MagicMock(scalar_one_or_none=MagicMock(return_value=account))

    with pytest.raises(HTTPException) as exc_info:
        await list_prospects(db, uuid4(), user)

    assert exc_info.value.status_code == 403


# ── ProspectOut full_url construction ─────────────────────────────────────────

def test_prospect_out_full_url_contains_token():
    token = "AbCdEfGh"
    out = ProspectOut(
        id=uuid4(),
        account_id=uuid4(),
        email="jane@acme.com",
        name=None,
        short_url_token=token,
        full_url=f"http://localhost/assess/{token}",
        created_at=datetime(2026, 7, 1, tzinfo=timezone.utc),
    )
    assert out.full_url.endswith(f"/assess/{token}")
    assert out.short_url_token == token
