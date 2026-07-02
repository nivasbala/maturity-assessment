"""
Tests for the Prospects sidebar nav feature.

Covers the accounts API behavior that backs ProspectsListPage and
ProspectDetailPage:
  - GET /api/accounts — admin sees all accounts (not just own); internal_user
    sees only theirs; pillars_sent/pillars_completed in response
  - GET /api/accounts/:id — returns pillar_statuses with short_url_token,
    prospect name/email, status, score; admin can access any account
  - GET /api/accounts/:id/assessments — returns list; auth-enforced

All tests run without a live database — service calls are mocked.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from httpx import ASGITransport, AsyncClient

from app.core.database import get_db
from app.core.deps import require_internal_user
from app.models.user import User
from app.routers.accounts import router as accounts_router


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def make_user(role: str = "internal_user") -> User:
    user = User()
    user.id = uuid4()
    user.name = "Test User"
    user.email = "user@example.com"
    user.password_hash = "hashed"
    user.role = role
    user.is_active = True
    return user


async def _no_db():
    yield None


def build_app(user: User) -> FastAPI:
    application = FastAPI()
    application.include_router(accounts_router)
    application.dependency_overrides[get_db] = _no_db
    application.dependency_overrides[require_internal_user] = lambda: user
    return application


def make_account_list_item(owner_id, company_name: str = "Acme Corp") -> dict:
    return {
        "id": str(uuid4()),
        "company_name": company_name,
        "company_website": "https://acme.com",
        "internal_user_id": str(owner_id),
        "suggested_pillars": [],
        "created_at": "2026-01-01T00:00:00Z",
        "pillars_sent": 2,
        "pillars_completed": 1,
    }


def make_pillar_status(
    *,
    status=None,
    short_url_token=None,
    assessment_id=None,
    pillar_score=None,
    maturity_label=None,
    prospect_name=None,
    prospect_email=None,
) -> dict:
    return {
        "pillar_id": str(uuid4()),
        "pillar_name": "Full-Stack Observability",
        "display_order": 1,
        "is_gated": False,
        "is_active": True,
        "assessment_id": str(assessment_id) if assessment_id else None,
        "status": status,
        "prospect_name": prospect_name,
        "prospect_email": prospect_email,
        "prospect_role": None,
        "pillar_score": pillar_score,
        "maturity_label": maturity_label,
        "short_url_token": short_url_token,
    }


def make_account_detail(owner_id, pillar_statuses=None) -> dict:
    return {
        "id": str(uuid4()),
        "company_name": "Acme Corp",
        "company_website": None,
        "internal_user_id": str(owner_id),
        "internal_user_name": "Alice",
        "suggested_pillars": [],
        "created_at": "2026-01-01T00:00:00Z",
        "pillar_statuses": pillar_statuses or [],
    }


def make_assessment_item(account_id) -> dict:
    return {
        "id": str(uuid4()),
        "account_id": str(account_id),
        "pillar_id": str(uuid4()),
        "pillar_name": "Full-Stack Observability",
        "short_url_token": "AbCdEfGh",
        "prospect_name": None,
        "prospect_email": None,
        "prospect_role": None,
        "status": "pending",
        "pillar_score": None,
        "maturity_label": None,
        "created_at": "2026-01-01T00:00:00Z",
        "completed_at": None,
    }


# ---------------------------------------------------------------------------
# Service-layer: list_accounts admin vs internal_user path
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_accounts_service_admin_returns_without_error():
    """Admin path through list_accounts service does not raise."""
    from app.services import account_service

    admin = make_user(role="admin")
    db = AsyncMock()
    count_mock = MagicMock()
    count_mock.scalar_one.return_value = 0
    rows_mock = MagicMock()
    rows_mock.scalars.return_value.all.return_value = []
    db.execute = AsyncMock(side_effect=[count_mock, rows_mock])

    result = await account_service.list_accounts(db, admin, page=1, size=25)
    assert result.total == 0
    assert result.items == []


@pytest.mark.asyncio
async def test_list_accounts_service_internal_user_returns_without_error():
    """Internal user path through list_accounts service does not raise."""
    from app.services import account_service

    user = make_user(role="internal_user")
    db = AsyncMock()
    count_mock = MagicMock()
    count_mock.scalar_one.return_value = 0
    rows_mock = MagicMock()
    rows_mock.scalars.return_value.all.return_value = []
    db.execute = AsyncMock(side_effect=[count_mock, rows_mock])

    result = await account_service.list_accounts(db, user, page=1, size=25)
    assert result.total == 0
    assert result.items == []


# ---------------------------------------------------------------------------
# GET /api/accounts — ProspectsListPage data source
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_accounts_admin_sees_multiple_owners():
    """Admin user receives accounts from different internal users."""
    admin = make_user(role="admin")
    app = build_app(admin)

    user_a = uuid4()
    user_b = uuid4()
    mock_result = {
        "items": [
            make_account_list_item(user_a, "Alpha Co"),
            make_account_list_item(user_b, "Beta Inc"),
        ],
        "total": 2,
        "page": 1,
        "size": 25,
    }

    with patch(
        "app.routers.accounts.account_service.list_accounts", new_callable=AsyncMock
    ) as mock_list:
        mock_list.return_value = mock_result
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/api/accounts")

    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2
    names = {item["company_name"] for item in data["items"]}
    assert names == {"Alpha Co", "Beta Inc"}


@pytest.mark.asyncio
async def test_list_accounts_internal_user_returns_200():
    """Internal user gets 200 with their own accounts."""
    user = make_user(role="internal_user")
    app = build_app(user)

    mock_result = {
        "items": [make_account_list_item(user.id, "My Company")],
        "total": 1,
        "page": 1,
        "size": 25,
    }

    with patch(
        "app.routers.accounts.account_service.list_accounts", new_callable=AsyncMock
    ) as mock_list:
        mock_list.return_value = mock_result
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/api/accounts")

    assert resp.status_code == 200
    assert resp.json()["items"][0]["company_name"] == "My Company"


@pytest.mark.asyncio
async def test_list_accounts_pagination_params_forwarded():
    """page and size query params reach the service layer."""
    user = make_user()
    app = build_app(user)
    mock_result = {"items": [], "total": 0, "page": 2, "size": 10}

    with patch(
        "app.routers.accounts.account_service.list_accounts", new_callable=AsyncMock
    ) as mock_list:
        mock_list.return_value = mock_result
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            await client.get("/api/accounts?page=2&size=10")

    mock_list.assert_awaited_once()
    _, kwargs = mock_list.call_args[0], mock_list.call_args[1]
    # service signature: list_accounts(db, user, page, size) — positional args
    args = mock_list.call_args[0]
    assert args[2] == 2   # page
    assert args[3] == 10  # size


@pytest.mark.asyncio
async def test_list_accounts_response_includes_pillars_sent_completed():
    """Response shape for ProspectsListPage includes sent/completed counts."""
    user = make_user()
    app = build_app(user)

    item = make_account_list_item(user.id)
    item["pillars_sent"] = 3
    item["pillars_completed"] = 2
    mock_result = {"items": [item], "total": 1, "page": 1, "size": 25}

    with patch(
        "app.routers.accounts.account_service.list_accounts", new_callable=AsyncMock
    ) as mock_list:
        mock_list.return_value = mock_result
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/api/accounts")

    result_item = resp.json()["items"][0]
    assert result_item["pillars_sent"] == 3
    assert result_item["pillars_completed"] == 2


@pytest.mark.asyncio
async def test_list_accounts_response_includes_company_name_and_website():
    """Company name and website are present for display in ProspectsListPage."""
    user = make_user()
    app = build_app(user)

    item = make_account_list_item(user.id, "Datadog")
    item["company_website"] = "https://datadoghq.com"
    mock_result = {"items": [item], "total": 1, "page": 1, "size": 25}

    with patch(
        "app.routers.accounts.account_service.list_accounts", new_callable=AsyncMock
    ) as mock_list:
        mock_list.return_value = mock_result
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/api/accounts")

    result_item = resp.json()["items"][0]
    assert result_item["company_name"] == "Datadog"
    assert result_item["company_website"] == "https://datadoghq.com"


# ---------------------------------------------------------------------------
# GET /api/accounts/:id — ProspectDetailPage data source
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_account_detail_returns_pillar_statuses_with_url_token():
    """Pending assessment exposes short_url_token for the Copy URL button."""
    user = make_user()
    app = build_app(user)
    account_id = uuid4()

    ps = make_pillar_status(
        status="pending",
        short_url_token="AbCdEfGh",
        assessment_id=uuid4(),
    )
    mock_detail = make_account_detail(user.id, [ps])

    with patch(
        "app.routers.accounts.account_service.get_account_detail", new_callable=AsyncMock
    ) as mock_get:
        mock_get.return_value = mock_detail
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(f"/api/accounts/{account_id}")

    assert resp.status_code == 200
    row = resp.json()["pillar_statuses"][0]
    assert row["short_url_token"] == "AbCdEfGh"
    assert row["status"] == "pending"


@pytest.mark.asyncio
async def test_get_account_detail_completed_pillar_has_score_and_label():
    """Completed assessment includes pillar_score and maturity_label for View Report."""
    user = make_user()
    app = build_app(user)

    ps = make_pillar_status(
        status="completed",
        pillar_score=3.5,
        maturity_label="Defined",
        assessment_id=uuid4(),
        short_url_token="XyZxYzXy",
    )
    mock_detail = make_account_detail(user.id, [ps])

    with patch(
        "app.routers.accounts.account_service.get_account_detail", new_callable=AsyncMock
    ) as mock_get:
        mock_get.return_value = mock_detail
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(f"/api/accounts/{uuid4()}")

    row = resp.json()["pillar_statuses"][0]
    assert row["pillar_score"] == 3.5
    assert row["maturity_label"] == "Defined"
    assert row["status"] == "completed"


@pytest.mark.asyncio
async def test_get_account_detail_unsent_pillar_has_null_fields():
    """Unsent pillar appears in list with null status and token (filtered out by UI)."""
    user = make_user()
    app = build_app(user)

    ps = make_pillar_status(status=None, short_url_token=None, assessment_id=None)
    mock_detail = make_account_detail(user.id, [ps])

    with patch(
        "app.routers.accounts.account_service.get_account_detail", new_callable=AsyncMock
    ) as mock_get:
        mock_get.return_value = mock_detail
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(f"/api/accounts/{uuid4()}")

    row = resp.json()["pillar_statuses"][0]
    assert row["status"] is None
    assert row["short_url_token"] is None
    assert row["assessment_id"] is None


@pytest.mark.asyncio
async def test_get_account_detail_includes_prospect_name_and_email():
    """Prospect contact info is available for display in the assessments table."""
    user = make_user()
    app = build_app(user)

    ps = make_pillar_status(
        status="completed",
        prospect_name="Jane Smith",
        prospect_email="jane@company.com",
        assessment_id=uuid4(),
        short_url_token="TkN1AbCd",
        pillar_score=2.8,
        maturity_label="Developing",
    )
    mock_detail = make_account_detail(user.id, [ps])

    with patch(
        "app.routers.accounts.account_service.get_account_detail", new_callable=AsyncMock
    ) as mock_get:
        mock_get.return_value = mock_detail
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(f"/api/accounts/{uuid4()}")

    row = resp.json()["pillar_statuses"][0]
    assert row["prospect_name"] == "Jane Smith"
    assert row["prospect_email"] == "jane@company.com"


@pytest.mark.asyncio
async def test_get_account_detail_admin_can_access_any_account():
    """Admin receives 200 even for accounts owned by a different user."""
    admin = make_user(role="admin")
    app = build_app(admin)

    other_owner = uuid4()
    mock_detail = make_account_detail(other_owner)

    with patch(
        "app.routers.accounts.account_service.get_account_detail", new_callable=AsyncMock
    ) as mock_get:
        mock_get.return_value = mock_detail
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(f"/api/accounts/{uuid4()}")

    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_get_account_detail_not_found_returns_404():
    """Non-existent account returns 404."""
    user = make_user()
    app = build_app(user)

    with patch(
        "app.routers.accounts.account_service.get_account_detail", new_callable=AsyncMock
    ) as mock_get:
        mock_get.side_effect = HTTPException(status_code=404, detail="Account not found")
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(f"/api/accounts/{uuid4()}")

    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_account_detail_wrong_user_returns_403():
    """Internal user cannot access another user's account detail."""
    user = make_user()
    app = build_app(user)

    with patch(
        "app.routers.accounts.account_service.get_account_detail", new_callable=AsyncMock
    ) as mock_get:
        mock_get.side_effect = HTTPException(status_code=403, detail="Access denied")
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(f"/api/accounts/{uuid4()}")

    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_get_account_detail_requires_auth():
    """Unauthenticated request to account detail returns 401."""
    application = FastAPI()
    application.include_router(accounts_router)
    application.dependency_overrides[get_db] = _no_db

    async with AsyncClient(transport=ASGITransport(app=application), base_url="http://test") as client:
        resp = await client.get(f"/api/accounts/{uuid4()}")

    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# GET /api/accounts/:id/assessments — assessment list endpoint
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_account_assessments_returns_items_with_token():
    """Returns 200 and each item includes short_url_token."""
    user = make_user()
    app = build_app(user)
    account_id = uuid4()

    with patch(
        "app.routers.accounts.account_service.list_account_assessments", new_callable=AsyncMock
    ) as mock_list:
        mock_list.return_value = [make_assessment_item(account_id)]
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(f"/api/accounts/{account_id}/assessments")

    assert resp.status_code == 200
    assert resp.json()[0]["short_url_token"] == "AbCdEfGh"


@pytest.mark.asyncio
async def test_list_account_assessments_empty_returns_200():
    """Empty list is a valid response (no assessments yet)."""
    user = make_user()
    app = build_app(user)

    with patch(
        "app.routers.accounts.account_service.list_account_assessments", new_callable=AsyncMock
    ) as mock_list:
        mock_list.return_value = []
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(f"/api/accounts/{uuid4()}/assessments")

    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_list_account_assessments_requires_auth():
    """Returns 401 without authentication."""
    application = FastAPI()
    application.include_router(accounts_router)
    application.dependency_overrides[get_db] = _no_db

    async with AsyncClient(transport=ASGITransport(app=application), base_url="http://test") as client:
        resp = await client.get(f"/api/accounts/{uuid4()}/assessments")

    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_list_account_assessments_wrong_user_returns_403():
    """Internal user cannot list assessments for another user's account."""
    user = make_user()
    app = build_app(user)

    with patch(
        "app.routers.accounts.account_service.list_account_assessments", new_callable=AsyncMock
    ) as mock_list:
        mock_list.side_effect = HTTPException(status_code=403, detail="Access denied")
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(f"/api/accounts/{uuid4()}/assessments")

    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_list_account_assessments_completed_includes_score_and_label():
    """Completed assessments include score and maturity label."""
    user = make_user()
    app = build_app(user)
    account_id = uuid4()

    item = make_assessment_item(account_id)
    item["status"] = "completed"
    item["pillar_score"] = 3.2
    item["maturity_label"] = "Defined"
    item["completed_at"] = "2026-06-01T12:00:00Z"

    with patch(
        "app.routers.accounts.account_service.list_account_assessments", new_callable=AsyncMock
    ) as mock_list:
        mock_list.return_value = [item]
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(f"/api/accounts/{account_id}/assessments")

    result = resp.json()[0]
    assert result["pillar_score"] == 3.2
    assert result["maturity_label"] == "Defined"
    assert result["status"] == "completed"
