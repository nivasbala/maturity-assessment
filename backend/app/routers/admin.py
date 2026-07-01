import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_admin
from app.models.user import User
from app.schemas.admin import (
    AccountOut,
    AssessmentOut,
    Paginated,
    PillarCreate,
    PillarOut,
    PillarUpdate,
    QuestionCreate,
    QuestionOut,
    QuestionUpdate,
    SettingOut,
    SettingUpdate,
    UserCreate,
    UserOut,
    UserUpdate,
)
from app.services import admin_service, settings_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ── Users ────────────────────────────────────────────────────────────────────


@router.get("/users", response_model=Paginated[UserOut])
async def list_users(
    page: int = Query(1, ge=1),
    size: int = Query(25, ge=1, le=100),
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> Paginated[UserOut]:
    return await admin_service.list_users(db, page=page, size=size)


@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(
    body: UserCreate,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> UserOut:
    return await admin_service.create_user(db, body)


@router.get("/users/{user_id}", response_model=UserOut)
async def get_user(
    user_id: UUID,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> UserOut:
    user = await admin_service.get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.put("/users/{user_id}", response_model=UserOut)
async def update_user(
    user_id: UUID,
    body: UserUpdate,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> UserOut:
    user = await admin_service.update_user(db, user_id, body)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.delete("/users/{user_id}", response_model=UserOut)
async def deactivate_user(
    user_id: UUID,
    current_admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> UserOut:
    if user_id == current_admin.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot deactivate your own account")
    user = await admin_service.deactivate_user(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


# ── Pillars ──────────────────────────────────────────────────────────────────


@router.get("/pillars", response_model=Paginated[PillarOut])
async def list_pillars(
    page: int = Query(1, ge=1),
    size: int = Query(25, ge=1, le=100),
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> Paginated[PillarOut]:
    return await admin_service.list_pillars(db, page=page, size=size)


@router.post("/pillars", response_model=PillarOut, status_code=status.HTTP_201_CREATED)
async def create_pillar(
    body: PillarCreate,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> PillarOut:
    return await admin_service.create_pillar(db, body)


@router.get("/pillars/{pillar_id}", response_model=PillarOut)
async def get_pillar(
    pillar_id: UUID,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> PillarOut:
    pillar = await admin_service.get_pillar(db, pillar_id)
    if not pillar:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pillar not found")
    return pillar


@router.put("/pillars/{pillar_id}", response_model=PillarOut)
async def update_pillar(
    pillar_id: UUID,
    body: PillarUpdate,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> PillarOut:
    pillar = await admin_service.update_pillar(db, pillar_id, body)
    if not pillar:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pillar not found")
    return pillar


@router.delete("/pillars/{pillar_id}", response_model=PillarOut)
async def deactivate_pillar(
    pillar_id: UUID,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> PillarOut:
    pillar = await admin_service.deactivate_pillar(db, pillar_id)
    if not pillar:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pillar not found")
    return pillar


# ── Questions ─────────────────────────────────────────────────────────────────


@router.get("/pillars/{pillar_id}/questions", response_model=Paginated[QuestionOut])
async def list_questions(
    pillar_id: UUID,
    page: int = Query(1, ge=1),
    size: int = Query(25, ge=1, le=100),
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> Paginated[QuestionOut]:
    pillar = await admin_service.get_pillar(db, pillar_id)
    if not pillar:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pillar not found")
    return await admin_service.list_questions(db, pillar_id=pillar_id, page=page, size=size)


@router.post("/pillars/{pillar_id}/questions", response_model=QuestionOut, status_code=status.HTTP_201_CREATED)
async def create_question(
    pillar_id: UUID,
    body: QuestionCreate,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> QuestionOut:
    pillar = await admin_service.get_pillar(db, pillar_id)
    if not pillar:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pillar not found")
    return await admin_service.create_question(db, pillar_id=pillar_id, data=body)


@router.get("/questions/{question_id}", response_model=QuestionOut)
async def get_question(
    question_id: UUID,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> QuestionOut:
    question = await admin_service.get_question(db, question_id)
    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")
    return question


@router.put("/questions/{question_id}", response_model=QuestionOut)
async def update_question(
    question_id: UUID,
    body: QuestionUpdate,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> QuestionOut:
    question = await admin_service.update_question(db, question_id, body)
    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")
    return question


@router.delete("/questions/{question_id}", response_model=QuestionOut)
async def deactivate_question(
    question_id: UUID,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> QuestionOut:
    question = await admin_service.deactivate_question(db, question_id)
    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")
    return question


# ── Admin read-only views ─────────────────────────────────────────────────────


@router.get("/accounts", response_model=Paginated[AccountOut])
async def list_accounts(
    page: int = Query(1, ge=1),
    size: int = Query(25, ge=1, le=100),
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> Paginated[AccountOut]:
    return await admin_service.list_accounts(db, page=page, size=size)


@router.get("/assessments", response_model=Paginated[AssessmentOut])
async def list_assessments(
    page: int = Query(1, ge=1),
    size: int = Query(25, ge=1, le=100),
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> Paginated[AssessmentOut]:
    return await admin_service.list_assessments(db, page=page, size=size)


# ── System Settings ──────────────────────────────────────────────────────────


@router.get("/settings", response_model=list[SettingOut])
async def list_settings(
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> list[SettingOut]:
    rows = await settings_service.get_all_settings(db)
    return [SettingOut.model_validate(r) for r in rows]


@router.get("/settings/{key}", response_model=SettingOut)
async def get_setting(
    key: str,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> SettingOut:
    row = await settings_service.get_setting(db, key)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Setting '{key}' not found")
    return SettingOut.model_validate(row)


@router.put("/settings/{key}", response_model=SettingOut)
async def update_setting(
    key: str,
    body: SettingUpdate,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> SettingOut:
    row = await settings_service.update_setting(db, key, body.value)
    return SettingOut.model_validate(row)
