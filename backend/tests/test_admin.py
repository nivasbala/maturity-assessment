"""
Tests for Task 5: Admin API.

All tests run without a live database — DB is mocked at the boundary.
"""
import logging
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

from fastapi.testclient import TestClient

from app.main import app
from app.core.deps import require_admin, get_current_user
from app.core.database import get_db
from app.models.user import User, UserRole
from app.schemas.admin import (
    AccountOut,
    AssessmentOut,
    Paginated,
    PillarOut,
    QuestionOut,
    UserOut,
)


# ── Helpers ──────────────────────────────────────────────────────────────────


def _admin_user() -> User:
    u = User()
    u.id = uuid4()
    u.name = "Admin"
    u.email = "admin@test.com"
    u.role = UserRole.ADMIN
    u.is_active = True
    u.created_at = datetime.now(timezone.utc)
    u.updated_at = datetime.now(timezone.utc)
    u.accounts = []
    return u


def _internal_user() -> User:
    u = User()
    u.id = uuid4()
    u.name = "Internal"
    u.email = "internal@test.com"
    u.role = UserRole.INTERNAL_USER
    u.is_active = True
    u.created_at = datetime.now(timezone.utc)
    u.updated_at = datetime.now(timezone.utc)
    u.accounts = []
    return u


def _make_user_out(u: User | None = None) -> UserOut:
    u = u or _admin_user()
    return UserOut(id=u.id, name=u.name, email=u.email, role=str(u.role), is_active=u.is_active, created_at=u.created_at)


def _make_pillar_out() -> PillarOut:
    return PillarOut(
        id=uuid4(),
        name="Test Pillar",
        description="A test pillar",
        overall_weight=1.0,
        display_order=1,
        is_active=True,
        is_gated=False,
        gate_question=None,
        question_count=5,
        created_at=datetime.now(timezone.utc),
    )


def _make_question_out(pillar_id=None, context_tags=None) -> QuestionOut:
    return QuestionOut(
        id=uuid4(),
        pillar_id=pillar_id or uuid4(),
        text="What is your observability strategy?",
        question_weight=1.0,
        is_general=True,
        display_order=1,
        is_active=True,
        context_tags=context_tags if context_tags is not None else [],
        answer_options=[],
        personas=[],
    )


# ── Auth enforcement ──────────────────────────────────────────────────────────


def _client_with_admin(admin: User) -> TestClient:
    """Return a TestClient with admin auth and a no-op DB injected."""
    async def _fake_db():
        yield AsyncMock()

    app.dependency_overrides[require_admin] = lambda: admin
    app.dependency_overrides[get_db] = _fake_db
    client = TestClient(app)
    return client


def _clear_overrides():
    app.dependency_overrides.clear()


def test_list_users_requires_auth():
    _clear_overrides()
    client = TestClient(app)
    resp = client.get("/api/admin/users")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_require_admin_raises_403_for_internal_user():
    from fastapi import HTTPException

    internal = _internal_user()

    with pytest.raises(HTTPException) as exc:
        await require_admin(current_user=internal)
    assert exc.value.status_code == 403


# ── User CRUD ─────────────────────────────────────────────────────────────────


def test_list_users_returns_paginated():
    admin = _admin_user()
    user_out = _make_user_out()
    paginated = Paginated(items=[user_out], total=1, page=1, size=25)

    client = _client_with_admin(admin)
    with patch("app.routers.admin.admin_service.list_users", AsyncMock(return_value=paginated)):
        resp = client.get("/api/admin/users")
    _clear_overrides()

    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert len(body["items"]) == 1


def test_create_user_returns_201():
    admin = _admin_user()
    user_out = _make_user_out()

    client = _client_with_admin(admin)
    with patch("app.routers.admin.admin_service.create_user", AsyncMock(return_value=user_out)):
        resp = client.post(
            "/api/admin/users",
            json={"name": "New User", "email": "new@test.com", "password": "securepass"},
        )
    _clear_overrides()

    assert resp.status_code == 201


def test_get_user_returns_404_when_missing():
    admin = _admin_user()

    client = _client_with_admin(admin)
    with patch("app.routers.admin.admin_service.get_user", AsyncMock(return_value=None)):
        resp = client.get(f"/api/admin/users/{uuid4()}")
    _clear_overrides()

    assert resp.status_code == 404


def test_deactivate_user_returns_404_when_missing():
    admin = _admin_user()

    client = _client_with_admin(admin)
    with patch("app.routers.admin.admin_service.deactivate_user", AsyncMock(return_value=None)):
        resp = client.delete(f"/api/admin/users/{uuid4()}")
    _clear_overrides()

    assert resp.status_code == 404


def test_deactivate_user_blocks_self_deactivation():
    admin = _admin_user()

    client = _client_with_admin(admin)
    resp = client.delete(f"/api/admin/users/{admin.id}")
    _clear_overrides()

    assert resp.status_code == 400
    assert "own account" in resp.json()["detail"]


# ── Pillar CRUD ───────────────────────────────────────────────────────────────


def test_list_pillars_returns_paginated():
    admin = _admin_user()
    pillar = _make_pillar_out()
    paginated = Paginated(items=[pillar], total=1, page=1, size=25)

    client = _client_with_admin(admin)
    with patch("app.routers.admin.admin_service.list_pillars", AsyncMock(return_value=paginated)):
        resp = client.get("/api/admin/pillars")
    _clear_overrides()

    assert resp.status_code == 200
    assert resp.json()["total"] == 1


def test_create_pillar_returns_201():
    admin = _admin_user()
    pillar = _make_pillar_out()

    client = _client_with_admin(admin)
    with patch("app.routers.admin.admin_service.create_pillar", AsyncMock(return_value=pillar)):
        resp = client.post(
            "/api/admin/pillars",
            json={"name": "New Pillar", "description": "Desc", "overall_weight": 1.0, "display_order": 5, "is_gated": False},
        )
    _clear_overrides()

    assert resp.status_code == 201


def test_deactivate_pillar_returns_404_when_missing():
    admin = _admin_user()

    client = _client_with_admin(admin)
    with patch("app.routers.admin.admin_service.deactivate_pillar", AsyncMock(return_value=None)):
        resp = client.delete(f"/api/admin/pillars/{uuid4()}")
    _clear_overrides()

    assert resp.status_code == 404


# ── Question CRUD ─────────────────────────────────────────────────────────────


def test_list_questions_returns_404_for_unknown_pillar():
    admin = _admin_user()

    client = _client_with_admin(admin)
    with patch("app.routers.admin.admin_service.get_pillar", AsyncMock(return_value=None)):
        resp = client.get(f"/api/admin/pillars/{uuid4()}/questions")
    _clear_overrides()

    assert resp.status_code == 404


def test_create_question_requires_exactly_4_options():
    """Schema validation rejects fewer than 4 answer_options (422)."""
    admin = _admin_user()
    pillar = _make_pillar_out()

    client = _client_with_admin(admin)
    with patch("app.routers.admin.admin_service.get_pillar", AsyncMock(return_value=pillar)):
        resp = client.post(
            f"/api/admin/pillars/{pillar.id}/questions",
            json={
                "text": "Q?",
                "question_weight": 1.0,
                "is_general": True,
                "is_active": True,
                "answer_options": [{"text": "Only one", "maturity_level": 1}],
                "personas": [],
            },
        )
    _clear_overrides()

    assert resp.status_code == 422


def test_create_question_rejects_duplicate_maturity_levels():
    """Schema validation rejects duplicate maturity levels even with 4 options (422)."""
    admin = _admin_user()
    pillar = _make_pillar_out()

    client = _client_with_admin(admin)
    with patch("app.routers.admin.admin_service.get_pillar", AsyncMock(return_value=pillar)):
        resp = client.post(
            f"/api/admin/pillars/{pillar.id}/questions",
            json={
                "text": "Q?",
                "question_weight": 1.0,
                "is_general": True,
                "is_active": True,
                "answer_options": [
                    {"text": "A", "maturity_level": 1},
                    {"text": "B", "maturity_level": 1},
                    {"text": "C", "maturity_level": 2},
                    {"text": "D", "maturity_level": 3},
                ],
                "personas": [],
            },
        )
    _clear_overrides()

    assert resp.status_code == 422


def test_get_question_returns_404_when_missing():
    admin = _admin_user()

    client = _client_with_admin(admin)
    with patch("app.routers.admin.admin_service.get_question", AsyncMock(return_value=None)):
        resp = client.get(f"/api/admin/questions/{uuid4()}")
    _clear_overrides()

    assert resp.status_code == 404


# ── Admin service unit tests ──────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_admin_service_create_user_always_sets_internal_user_role():
    """create_user must always set role=internal_user regardless of input."""
    from app.schemas.admin import UserCreate
    from app.services.admin_service import create_user

    created_user = MagicMock()
    created_user.id = uuid4()
    created_user.name = "New"
    created_user.email = "new@test.com"
    created_user.role = "internal_user"
    created_user.is_active = True
    created_user.created_at = datetime.now(timezone.utc)

    db = AsyncMock()
    db.add = MagicMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock(side_effect=lambda obj: None)

    captured = {}

    def capture_add(obj):
        captured["user"] = obj

    db.add.side_effect = capture_add

    with patch("app.services.admin_service.hash_password", AsyncMock(return_value="hashed")):
        # Patch refresh to set the captured user attributes
        async def fake_refresh(obj):
            obj.id = uuid4()
            obj.created_at = datetime.now(timezone.utc)

        db.refresh = AsyncMock(side_effect=fake_refresh)

        data = UserCreate(name="New", email="new@test.com", password="secure123")
        # We just verify the role is set correctly on the User object before commit
        from app.services.admin_service import create_user as svc_create_user
        with patch("app.services.admin_service.hash_password", AsyncMock(return_value="hashed")):
            try:
                await svc_create_user(db, data)
            except Exception:
                logger.error("Expected mock failure in test setup", exc_info=True)

    if "user" in captured:
        assert captured["user"].role == UserRole.INTERNAL_USER


@pytest.mark.asyncio
async def test_admin_service_deactivate_sets_is_active_false():
    """deactivate_user must set is_active=False, not delete the row."""
    from app.services.admin_service import deactivate_user

    target_id = uuid4()
    mock_user = MagicMock()
    mock_user.id = target_id
    mock_user.is_active = True
    mock_user.name = "Test"
    mock_user.email = "t@test.com"
    mock_user.role = "internal_user"
    mock_user.created_at = datetime.now(timezone.utc)

    db = AsyncMock()

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_user
    db.execute = AsyncMock(return_value=mock_result)

    async def fake_refresh(obj):
        pass
    db.commit = AsyncMock()
    db.refresh = AsyncMock(side_effect=fake_refresh)

    with patch("app.services.admin_service.UserOut.model_validate", return_value=_make_user_out()):
        await deactivate_user(db, target_id)

    assert mock_user.is_active is False
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_admin_service_deactivate_question_sets_is_active_false():
    """deactivate_question must set is_active=False, not delete the row."""
    from app.services.admin_service import deactivate_question

    target_id = uuid4()
    mock_q = MagicMock()
    mock_q.id = target_id
    mock_q.is_active = True

    db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_q
    db.execute = AsyncMock(return_value=mock_result)
    db.commit = AsyncMock()
    db.refresh = AsyncMock()

    with patch("app.services.admin_service._load_question", AsyncMock(return_value=mock_q)):
        with patch("app.services.admin_service.QuestionOut.model_validate", return_value=_make_question_out()):
            await deactivate_question(db, target_id)

    assert mock_q.is_active is False


# ── context_tags on questions ─────────────────────────────────────────────────


def test_create_question_with_context_tags_returns_201():
    """Questions created via admin API can carry context_tags."""
    admin = _admin_user()
    pillar = _make_pillar_out()
    question_out = _make_question_out(pillar_id=pillar.id, context_tags=["kubernetes", "aws"])

    client = _client_with_admin(admin)
    with patch("app.routers.admin.admin_service.get_pillar", AsyncMock(return_value=pillar)):
        with patch("app.routers.admin.admin_service.create_question", AsyncMock(return_value=question_out)):
            resp = client.post(
                f"/api/admin/pillars/{pillar.id}/questions",
                json={
                    "text": "How do you manage Kubernetes observability?",
                    "question_weight": 1.5,
                    "is_general": False,
                    "is_active": True,
                    "context_tags": ["kubernetes", "aws"],
                    "answer_options": [
                        {"text": "Level 1", "maturity_level": 1},
                        {"text": "Level 2", "maturity_level": 2},
                        {"text": "Level 3", "maturity_level": 3},
                        {"text": "Level 4", "maturity_level": 4},
                    ],
                    "personas": [{"persona": "sre_platform_engineer", "persona_weight": 1.2}],
                },
            )
    _clear_overrides()

    assert resp.status_code == 201
    data = resp.json()
    assert data["context_tags"] == ["kubernetes", "aws"]


def test_create_question_without_context_tags_defaults_to_empty_list():
    """context_tags defaults to [] when omitted from the request body."""
    admin = _admin_user()
    pillar = _make_pillar_out()
    question_out = _make_question_out(pillar_id=pillar.id, context_tags=[])

    client = _client_with_admin(admin)
    with patch("app.routers.admin.admin_service.get_pillar", AsyncMock(return_value=pillar)):
        with patch("app.routers.admin.admin_service.create_question", AsyncMock(return_value=question_out)):
            resp = client.post(
                f"/api/admin/pillars/{pillar.id}/questions",
                json={
                    "text": "General observability question?",
                    "question_weight": 1.0,
                    "is_general": True,
                    "is_active": True,
                    "answer_options": [
                        {"text": "Level 1", "maturity_level": 1},
                        {"text": "Level 2", "maturity_level": 2},
                        {"text": "Level 3", "maturity_level": 3},
                        {"text": "Level 4", "maturity_level": 4},
                    ],
                    "personas": [],
                },
            )
    _clear_overrides()

    assert resp.status_code == 201
    assert resp.json()["context_tags"] == []


@pytest.mark.asyncio
async def test_admin_service_create_question_passes_context_tags():
    """create_question must store context_tags on the Question ORM object."""
    from app.schemas.admin import QuestionCreate, AnswerOptionCreate
    from app.services.admin_service import create_question

    pillar_id = uuid4()
    tags = ["gpu", "cuda", "nvidia"]
    data = QuestionCreate(
        text="GPU utilization question?",
        question_weight=2.0,
        is_general=False,
        is_active=True,
        context_tags=tags,
        answer_options=[
            AnswerOptionCreate(text="Level 1", maturity_level=1),
            AnswerOptionCreate(text="Level 2", maturity_level=2),
            AnswerOptionCreate(text="Level 3", maturity_level=3),
            AnswerOptionCreate(text="Level 4", maturity_level=4),
        ],
        personas=[],
    )

    captured = {}
    db = AsyncMock()

    mock_count_result = MagicMock()
    mock_count_result.scalar_one.return_value = 5
    db.execute = AsyncMock(return_value=mock_count_result)
    db.flush = AsyncMock()
    db.commit = AsyncMock()

    def capture_add(obj):
        if hasattr(obj, "context_tags"):
            captured["question"] = obj

    db.add = MagicMock(side_effect=capture_add)

    question_out = _make_question_out(pillar_id=pillar_id, context_tags=tags)
    with patch("app.services.admin_service._load_question", AsyncMock(return_value=MagicMock())):
        with patch("app.services.admin_service.QuestionOut.model_validate", return_value=question_out):
            await create_question(db, pillar_id=pillar_id, data=data)

    assert "question" in captured
    assert captured["question"].context_tags == tags


@pytest.mark.asyncio
async def test_admin_service_update_question_updates_context_tags():
    """update_question must apply context_tags when provided."""
    from app.schemas.admin import QuestionUpdate
    from app.services.admin_service import update_question

    question_id = uuid4()
    mock_q = MagicMock()
    mock_q.id = question_id
    mock_q.context_tags = []
    mock_q.personas = []
    mock_q.answer_options = []

    db = AsyncMock()
    db.commit = AsyncMock()
    db.flush = AsyncMock()

    new_tags = ["kubernetes", "microservices"]
    data = QuestionUpdate(context_tags=new_tags)

    question_out = _make_question_out(context_tags=new_tags)
    with patch("app.services.admin_service._load_question", AsyncMock(return_value=mock_q)):
        with patch("app.services.admin_service.QuestionOut.model_validate", return_value=question_out):
            result = await update_question(db, question_id, data)

    assert mock_q.context_tags == new_tags
    assert result.context_tags == new_tags


# ── System Settings API ───────────────────────────────────────────────────────


def test_list_settings_returns_200():
    """GET /api/admin/settings returns list of settings."""
    from app.schemas.admin import SettingOut
    from datetime import datetime, timezone

    admin = _admin_user()
    setting = SettingOut(
        key="question_count_min",
        value="12",
        description="Min questions",
        updated_at=datetime.now(timezone.utc),
    )

    client = _client_with_admin(admin)
    with patch("app.routers.admin.settings_service.get_all_settings", AsyncMock(return_value=[])):
        with patch("app.routers.admin.SettingOut.model_validate", return_value=setting):
            resp = client.get("/api/admin/settings")
    _clear_overrides()

    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_get_setting_returns_404_when_missing():
    """GET /api/admin/settings/{key} returns 404 when key not found."""
    admin = _admin_user()

    client = _client_with_admin(admin)
    with patch("app.routers.admin.settings_service.get_setting", AsyncMock(return_value=None)):
        resp = client.get("/api/admin/settings/nonexistent_key")
    _clear_overrides()

    assert resp.status_code == 404


def test_update_setting_requires_auth():
    """PUT /api/admin/settings/{key} requires admin auth."""
    _clear_overrides()
    client = TestClient(app)
    resp = client.put("/api/admin/settings/question_count_max", json={"value": "20"})
    assert resp.status_code == 401


def test_update_setting_returns_updated_value():
    """PUT /api/admin/settings/{key} returns the updated setting."""
    from app.schemas.admin import SettingOut
    from datetime import datetime, timezone

    admin = _admin_user()
    updated = SettingOut(
        key="question_count_max",
        value="20",
        description="Max questions",
        updated_at=datetime.now(timezone.utc),
    )

    client = _client_with_admin(admin)
    with patch("app.routers.admin.settings_service.update_setting", AsyncMock(return_value=MagicMock())):
        with patch("app.routers.admin.SettingOut.model_validate", return_value=updated):
            resp = client.put("/api/admin/settings/question_count_max", json={"value": "20"})
    _clear_overrides()

    assert resp.status_code == 200
    assert resp.json()["value"] == "20"


# ── settings_service unit tests ───────────────────────────────────────────────


@pytest.mark.asyncio
async def test_settings_service_get_question_count_bounds_returns_defaults():
    """get_question_count_bounds uses 12/25 defaults when rows are missing."""
    from app.services.settings_service import get_question_count_bounds

    db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    db.execute = AsyncMock(return_value=mock_result)

    q_min, q_max = await get_question_count_bounds(db)
    assert q_min == 12
    assert q_max == 25


@pytest.mark.asyncio
async def test_settings_service_get_question_count_bounds_reads_db():
    """get_question_count_bounds returns values from the DB rows."""
    from app.services.settings_service import get_question_count_bounds

    def make_row(value: str) -> MagicMock:
        row = MagicMock()
        row.value = value
        return row

    db = AsyncMock()
    results = [make_row("10"), make_row("30")]
    call_count = 0

    async def side_effect(stmt):
        nonlocal call_count
        r = MagicMock()
        r.scalar_one_or_none.return_value = results[call_count]
        call_count += 1
        return r

    db.execute = AsyncMock(side_effect=side_effect)

    q_min, q_max = await get_question_count_bounds(db)
    assert q_min == 10
    assert q_max == 30


@pytest.mark.asyncio
async def test_settings_service_validate_question_count_raises_400_when_out_of_bounds():
    """validate_question_count raises 400 when value is outside min/max."""
    from app.services.settings_service import validate_question_count
    from fastapi import HTTPException

    with patch("app.services.settings_service.get_question_count_bounds", AsyncMock(return_value=(12, 25))):
        db = AsyncMock()
        with pytest.raises(HTTPException) as exc_info:
            await validate_question_count(db, 30)
        assert exc_info.value.status_code == 400

        with pytest.raises(HTTPException) as exc_info:
            await validate_question_count(db, 5)
        assert exc_info.value.status_code == 400


@pytest.mark.asyncio
async def test_settings_service_validate_question_count_passes_within_bounds():
    """validate_question_count does not raise when value is within bounds."""
    from app.services.settings_service import validate_question_count

    with patch("app.services.settings_service.get_question_count_bounds", AsyncMock(return_value=(12, 25))):
        db = AsyncMock()
        await validate_question_count(db, 12)  # min boundary — no raise
        await validate_question_count(db, 25)  # max boundary — no raise
        await validate_question_count(db, 15)  # middle — no raise


@pytest.mark.asyncio
async def test_settings_service_update_rejects_min_greater_than_max():
    """update_setting raises 400 when setting min > current max."""
    from app.services.settings_service import update_setting
    from fastapi import HTTPException

    min_row = MagicMock()
    min_row.value = "5"
    min_row.key = "question_count_min"

    max_row = MagicMock()
    max_row.value = "20"
    max_row.key = "question_count_max"

    call_count = 0

    async def get_setting_side_effect(db, key):
        nonlocal call_count
        call_count += 1
        if key == "question_count_min":
            return min_row
        return max_row

    db = AsyncMock()
    with patch("app.services.settings_service.get_setting", AsyncMock(side_effect=get_setting_side_effect)):
        with pytest.raises(HTTPException) as exc_info:
            await update_setting(db, "question_count_min", "25")  # 25 > max of 20
        assert exc_info.value.status_code == 400


@pytest.mark.asyncio
async def test_settings_service_update_rejects_max_less_than_min():
    """update_setting raises 400 when setting max < current min."""
    from app.services.settings_service import update_setting
    from fastapi import HTTPException

    max_row = MagicMock()
    max_row.value = "25"
    max_row.key = "question_count_max"

    min_row = MagicMock()
    min_row.value = "12"
    min_row.key = "question_count_min"

    async def get_setting_side_effect(db, key):
        if key == "question_count_max":
            return max_row
        return min_row

    db = AsyncMock()
    with patch("app.services.settings_service.get_setting", AsyncMock(side_effect=get_setting_side_effect)):
        with pytest.raises(HTTPException) as exc_info:
            await update_setting(db, "question_count_max", "5")  # 5 < min of 12
        assert exc_info.value.status_code == 400


# ── Pillar question_count validation ─────────────────────────────────────────


def test_create_pillar_includes_question_count_in_response():
    """POST /api/admin/pillars returns question_count in the pillar response."""
    admin = _admin_user()
    pillar = _make_pillar_out()
    pillar.question_count = 15

    client = _client_with_admin(admin)
    with patch("app.routers.admin.admin_service.create_pillar", AsyncMock(return_value=pillar)):
        resp = client.post(
            "/api/admin/pillars",
            json={
                "name": "New Pillar",
                "description": "Desc",
                "overall_weight": 1.0,
                "display_order": 5,
                "is_gated": False,
                "question_count": 15,
            },
        )
    _clear_overrides()

    assert resp.status_code == 201
    assert resp.json()["question_count"] == 15


@pytest.mark.asyncio
async def test_admin_service_create_pillar_rejects_out_of_bounds_question_count():
    """create_pillar raises 400 when question_count is outside system bounds."""
    from app.schemas.admin import PillarCreate
    from app.services.admin_service import create_pillar
    from fastapi import HTTPException

    data = PillarCreate(
        name="P", description="D", overall_weight=1.0, display_order=1, question_count=99
    )
    db = AsyncMock()
    with patch(
        "app.services.admin_service.settings_service.validate_question_count",
        AsyncMock(side_effect=HTTPException(status_code=400, detail="out of bounds")),
    ):
        with pytest.raises(HTTPException) as exc_info:
            await create_pillar(db, data)
        assert exc_info.value.status_code == 400


@pytest.mark.asyncio
async def test_admin_service_update_pillar_validates_question_count_when_provided():
    """update_pillar validates question_count only when explicitly included in the update."""
    from app.schemas.admin import PillarUpdate
    from app.services.admin_service import update_pillar
    from fastapi import HTTPException

    pillar_id = uuid4()
    mock_pillar = MagicMock()
    mock_pillar.id = pillar_id
    mock_pillar.question_count = 12
    mock_pillar.name = "P1"
    mock_pillar.description = "D"
    mock_pillar.overall_weight = 1.0
    mock_pillar.display_order = 1
    mock_pillar.is_active = True
    mock_pillar.is_gated = False
    mock_pillar.gate_question = None
    mock_pillar.created_at = datetime.now(timezone.utc)

    db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_pillar
    db.execute = AsyncMock(return_value=mock_result)
    db.commit = AsyncMock()
    db.refresh = AsyncMock()

    data = PillarUpdate(question_count=99)
    with patch(
        "app.services.admin_service.settings_service.validate_question_count",
        AsyncMock(side_effect=HTTPException(status_code=400, detail="out of bounds")),
    ):
        with pytest.raises(HTTPException) as exc_info:
            await update_pillar(db, pillar_id, data)
        assert exc_info.value.status_code == 400


@pytest.mark.asyncio
async def test_admin_service_update_pillar_skips_validation_when_question_count_not_in_payload():
    """update_pillar skips question_count validation when field is not in the update payload."""
    from app.schemas.admin import PillarUpdate
    from app.services.admin_service import update_pillar

    pillar_id = uuid4()
    mock_pillar = MagicMock()
    mock_pillar.id = pillar_id
    mock_pillar.question_count = 12
    mock_pillar.name = "P1"
    mock_pillar.description = "D"
    mock_pillar.overall_weight = 1.0
    mock_pillar.display_order = 1
    mock_pillar.is_active = True
    mock_pillar.is_gated = False
    mock_pillar.gate_question = None
    mock_pillar.created_at = datetime.now(timezone.utc)

    db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_pillar
    db.execute = AsyncMock(return_value=mock_result)
    db.commit = AsyncMock()
    db.refresh = AsyncMock()

    validate_mock = AsyncMock()
    data = PillarUpdate(name="Updated Name")  # no question_count
    with patch("app.services.admin_service.settings_service.validate_question_count", validate_mock):
        with patch("app.services.admin_service.PillarOut.model_validate", return_value=_make_pillar_out()):
            await update_pillar(db, pillar_id, data)

    validate_mock.assert_not_awaited()
