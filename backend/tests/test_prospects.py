"""
Tests for Account → Prospect workflow (prospect_service.py).

All tests run without a live database — DB and dependencies are mocked.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from httpx import ASGITransport, AsyncClient

from app.core.database import get_db
from app.core.deps import get_current_user, require_internal_user
from app.core.security import create_access_token
from app.models.account import Account
from app.models.assessment import Assessment
from app.models.prospect import Prospect
from app.models.user import User
from app.routers.accounts import router as accounts_router
from app.schemas.internal import ProspectCreate, ProspectCreatedOut, ProspectListItem

ROUTE_PREFIX = "/api/accounts"


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


def make_account(user: User) -> Account:
    account = Account()
    account.id = uuid4()
    account.company_name = "Acme Corp"
    account.company_website = "https://acme.com"
    account.internal_user_id = user.id
    return account


def make_prospect(account: Account, email: str = "jane@acme.com") -> Prospect:
    from datetime import datetime, timezone

    prospect = Prospect()
    prospect.id = uuid4()
    prospect.account_id = account.id
    prospect.email = email
    prospect.name = None
    prospect.job_title = None
    prospect.short_url_token = "abc123de"
    prospect.is_registered = False
    prospect.registered_at = None
    prospect.suggested_pillars = []
    prospect.assessments = []
    prospect.created_at = datetime.now(timezone.utc)
    return prospect


async def _no_db():
    yield None


def _auth_header(user: User) -> dict:
    token = create_access_token({"sub": str(user.id)})
    return {"Authorization": f"Bearer {token}"}


def build_app(user: User) -> FastAPI:
    application = FastAPI()
    application.include_router(accounts_router)
    application.dependency_overrides[get_db] = _no_db
    application.dependency_overrides[get_current_user] = lambda: user
    application.dependency_overrides[require_internal_user] = lambda: user
    return application


# ---------------------------------------------------------------------------
# Unit tests: prospect_service
# ---------------------------------------------------------------------------


class TestCreateProspect:
    @pytest.mark.asyncio
    async def test_create_prospect_happy_path(self):
        from app.services.prospect_service import create_prospect

        user = make_user()
        account = make_account(user)
        account_id = account.id
        data = ProspectCreate(email="jane@acme.com", suggested_pillars=[])

        db = AsyncMock()
        db.execute = AsyncMock()
        # First execute: account lookup → found
        db.execute.return_value.scalar_one_or_none = MagicMock(return_value=account)

        # Second execute (inside _ensure_unique_prospect_token): no collision
        token_result = MagicMock()
        token_result.scalar_one_or_none = MagicMock(return_value=None)

        db.execute.side_effect = [
            MagicMock(scalar_one_or_none=MagicMock(return_value=account)),
            MagicMock(scalar_one_or_none=MagicMock(return_value=None)),  # token uniqueness check
        ]
        db.commit = AsyncMock()
        db.add = MagicMock()

        prospect = make_prospect(account)

        async def _refresh(obj):
            obj.id = prospect.id

        db.refresh = _refresh

        with patch("app.services.prospect_service.assert_owns_account"):
            with patch("app.services.prospect_service._generate_short_token", return_value="tok123ab"):
                result = await create_prospect(db, account_id, user, data)

        assert result.email == "jane@acme.com"
        assert result.short_url_token == "tok123ab"
        assert result.is_registered is False
        assert "tok123ab" in result.full_url

    @pytest.mark.asyncio
    async def test_create_prospect_account_not_found(self):
        from app.services.prospect_service import create_prospect

        user = make_user()
        data = ProspectCreate(email="jane@acme.com", suggested_pillars=[])
        db = AsyncMock()
        db.execute.return_value.scalar_one_or_none = MagicMock(return_value=None)

        with pytest.raises(HTTPException) as exc_info:
            await create_prospect(db, uuid4(), user, data)

        assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_create_prospect_ownership_check(self):
        from app.services.prospect_service import create_prospect
        from app.services.account_service import assert_owns_account

        user = make_user()
        other_user = make_user()
        account = make_account(other_user)  # owned by other_user, not user
        data = ProspectCreate(email="jane@acme.com", suggested_pillars=[])
        db = AsyncMock()
        db.execute.return_value.scalar_one_or_none = MagicMock(return_value=account)

        with pytest.raises(HTTPException):
            await create_prospect(db, account.id, user, data)


class TestListProspects:
    @pytest.mark.asyncio
    async def test_list_prospects_empty(self):
        from app.services.prospect_service import list_prospects

        user = make_user()
        account = make_account(user)
        db = AsyncMock()
        db.execute.side_effect = [
            MagicMock(scalar_one_or_none=MagicMock(return_value=account)),
            MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[])))),
        ]

        with patch("app.services.prospect_service.assert_owns_account"):
            result = await list_prospects(db, account.id, user)

        assert result == []

    @pytest.mark.asyncio
    async def test_list_prospects_counts_assessments(self):
        from app.services.prospect_service import list_prospects

        user = make_user()
        account = make_account(user)
        prospect = make_prospect(account)
        # 2 assessments, 1 completed
        a1 = MagicMock()
        a1.status = "completed"
        a2 = MagicMock()
        a2.status = "pending"
        prospect.assessments = [a1, a2]

        db = AsyncMock()
        db.execute.side_effect = [
            MagicMock(scalar_one_or_none=MagicMock(return_value=account)),
            MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[prospect])))),
        ]

        with patch("app.services.prospect_service.assert_owns_account"):
            result = await list_prospects(db, account.id, user)

        assert len(result) == 1
        assert result[0].assessments_total == 2
        assert result[0].assessments_completed == 1
        assert result[0].email == "jane@acme.com"

    @pytest.mark.asyncio
    async def test_list_prospects_account_not_found(self):
        from app.services.prospect_service import list_prospects

        user = make_user()
        db = AsyncMock()
        db.execute.return_value.scalar_one_or_none = MagicMock(return_value=None)

        with pytest.raises(HTTPException) as exc_info:
            await list_prospects(db, uuid4(), user)

        assert exc_info.value.status_code == 404


class TestDeleteProspect:
    @pytest.mark.asyncio
    async def test_delete_prospect_happy_path(self):
        from app.services.prospect_service import delete_prospect

        user = make_user()
        account = make_account(user)
        prospect = make_prospect(account)

        db = AsyncMock()
        db.execute.side_effect = [
            MagicMock(scalar_one_or_none=MagicMock(return_value=account)),
            MagicMock(scalar_one_or_none=MagicMock(return_value=prospect)),
        ]
        db.delete = AsyncMock()
        db.commit = AsyncMock()

        with patch("app.services.prospect_service.assert_owns_account"):
            await delete_prospect(db, account.id, prospect.id, user)

        db.delete.assert_called_once_with(prospect)
        db.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_delete_prospect_not_found(self):
        from app.services.prospect_service import delete_prospect

        user = make_user()
        account = make_account(user)

        db = AsyncMock()
        db.execute.side_effect = [
            MagicMock(scalar_one_or_none=MagicMock(return_value=account)),
            MagicMock(scalar_one_or_none=MagicMock(return_value=None)),
        ]

        with patch("app.services.prospect_service.assert_owns_account"):
            with pytest.raises(HTTPException) as exc_info:
                await delete_prospect(db, account.id, uuid4(), user)

        assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_prospect_wrong_account(self):
        """Prospect belongs to a different account — 404."""
        from app.services.prospect_service import delete_prospect

        user = make_user()
        account = make_account(user)
        other_account = make_account(user)
        other_account.id = uuid4()
        prospect = make_prospect(other_account)  # under other account

        db = AsyncMock()
        db.execute.side_effect = [
            MagicMock(scalar_one_or_none=MagicMock(return_value=account)),
            # query filters on account_id so returns None for wrong account
            MagicMock(scalar_one_or_none=MagicMock(return_value=None)),
        ]

        with patch("app.services.prospect_service.assert_owns_account"):
            with pytest.raises(HTTPException) as exc_info:
                await delete_prospect(db, account.id, prospect.id, user)

        assert exc_info.value.status_code == 404


# ---------------------------------------------------------------------------
# API integration tests (mock service layer)
# ---------------------------------------------------------------------------


class TestProspectRoutes:
    @pytest.mark.asyncio
    async def test_create_prospect_route_201(self):
        user = make_user()
        account = make_account(user)
        prospect_out = ProspectCreatedOut(
            prospect_id=uuid4(),
            email="jane@acme.com",
            short_url_token="tok123ab",
            full_url="http://localhost/assess/tok123ab",
            is_registered=False,
        )

        app = build_app(user)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            with patch("app.services.prospect_service.create_prospect", AsyncMock(return_value=prospect_out)):
                resp = await client.post(
                    f"{ROUTE_PREFIX}/{account.id}/prospects",
                    json={"email": "jane@acme.com", "suggested_pillars": []},
                    headers=_auth_header(user),
                )

        assert resp.status_code == 201
        body = resp.json()
        assert body["email"] == "jane@acme.com"
        assert body["short_url_token"] == "tok123ab"

    @pytest.mark.asyncio
    async def test_list_prospects_route_200(self):
        user = make_user()
        account = make_account(user)
        from datetime import datetime, timezone

        item = ProspectListItem(
            id=uuid4(),
            email="jane@acme.com",
            name=None,
            job_title=None,
            short_url_token="tok123ab",
            is_registered=False,
            registered_at=None,
            created_at=datetime.now(timezone.utc),
            assessments_total=0,
            assessments_completed=0,
        )

        app = build_app(user)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            with patch("app.services.prospect_service.list_prospects", AsyncMock(return_value=[item])):
                resp = await client.get(
                    f"{ROUTE_PREFIX}/{account.id}/prospects",
                    headers=_auth_header(user),
                )

        assert resp.status_code == 200
        body = resp.json()
        assert len(body) == 1
        assert body[0]["email"] == "jane@acme.com"

    @pytest.mark.asyncio
    async def test_delete_prospect_route_204(self):
        user = make_user()
        account = make_account(user)
        prospect_id = uuid4()

        app = build_app(user)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            with patch("app.services.prospect_service.delete_prospect", AsyncMock(return_value=None)):
                resp = await client.delete(
                    f"{ROUTE_PREFIX}/{account.id}/prospects/{prospect_id}",
                    headers=_auth_header(user),
                )

        assert resp.status_code == 204

    @pytest.mark.asyncio
    async def test_prospect_routes_require_auth(self):
        account_id = uuid4()
        app = FastAPI()
        app.include_router(accounts_router)
        app.dependency_overrides[get_db] = _no_db
        # No auth override — uses real dependency which will 401

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(f"{ROUTE_PREFIX}/{account_id}/prospects")

        assert resp.status_code == 401
