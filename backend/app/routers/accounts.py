import logging
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_internal_user
from app.models.user import User
from app.schemas.admin import Paginated
from app.schemas.internal import (
    AccountAggregateOut,
    AccountCreate,
    AccountDetailOut,
    AccountListOut,
    AssessmentCreateRequest,
    AssessmentCreatedOut,
    AssessmentListItemOut,
    ProspectAggregateOut,
    ProspectCreate,
    ProspectDetailOut,
    ProspectOut,
    ProspectWithAccountOut,
)
from app.services import account_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/accounts", tags=["accounts"])


@router.get("", response_model=Paginated[AccountListOut])
async def list_accounts(
    page: int = Query(1, ge=1),
    size: int = Query(25, ge=1, le=100),
    current_user: User = Depends(require_internal_user),
    db: AsyncSession = Depends(get_db),
) -> Paginated[AccountListOut]:
    return await account_service.list_accounts(db, current_user, page=page, size=size)


@router.post("", response_model=AccountListOut, status_code=201)
async def create_account(
    body: AccountCreate,
    current_user: User = Depends(require_internal_user),
    db: AsyncSession = Depends(get_db),
) -> AccountListOut:
    return await account_service.create_account(db, current_user, body)


@router.get("/all-prospects", response_model=list[ProspectWithAccountOut])
async def list_all_prospects(
    current_user: User = Depends(require_internal_user),
    db: AsyncSession = Depends(get_db),
) -> list[ProspectWithAccountOut]:
    return await account_service.list_all_prospects(db, current_user)


@router.get("/{account_id}/aggregate", response_model=AccountAggregateOut)
async def get_account_aggregate(
    account_id: UUID,
    current_user: User = Depends(require_internal_user),
    db: AsyncSession = Depends(get_db),
) -> AccountAggregateOut:
    return await account_service.get_account_aggregate(db, account_id, current_user)


@router.get("/{account_id}", response_model=AccountDetailOut)
async def get_account_detail(
    account_id: UUID,
    current_user: User = Depends(require_internal_user),
    db: AsyncSession = Depends(get_db),
) -> AccountDetailOut:
    return await account_service.get_account_detail(db, account_id, current_user)


@router.post("/{account_id}/assessments", response_model=AssessmentCreatedOut, status_code=201)
async def create_assessment(
    account_id: UUID,
    body: AssessmentCreateRequest,
    current_user: User = Depends(require_internal_user),
    db: AsyncSession = Depends(get_db),
) -> AssessmentCreatedOut:
    return await account_service.create_assessment(db, account_id, current_user, body.pillar_id)


@router.get("/{account_id}/assessments", response_model=list[AssessmentListItemOut])
async def list_account_assessments(
    account_id: UUID,
    current_user: User = Depends(require_internal_user),
    db: AsyncSession = Depends(get_db),
) -> list[AssessmentListItemOut]:
    return await account_service.list_account_assessments(db, account_id, current_user)


@router.delete("/{account_id}", status_code=204)
async def delete_account(
    account_id: UUID,
    current_user: User = Depends(require_internal_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await account_service.delete_account(db, account_id, current_user)


@router.delete("/{account_id}/assessments/{assessment_id}", status_code=204)
async def delete_assessment(
    account_id: UUID,
    assessment_id: UUID,
    current_user: User = Depends(require_internal_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await account_service.delete_assessment(db, account_id, assessment_id, current_user)


@router.post("/{account_id}/prospects", response_model=ProspectOut, status_code=201)
async def create_prospect(
    account_id: UUID,
    body: ProspectCreate,
    current_user: User = Depends(require_internal_user),
    db: AsyncSession = Depends(get_db),
) -> ProspectOut:
    return await account_service.create_prospect(db, account_id, current_user, body)


@router.get("/{account_id}/prospects", response_model=list[ProspectOut])
async def list_prospects(
    account_id: UUID,
    current_user: User = Depends(require_internal_user),
    db: AsyncSession = Depends(get_db),
) -> list[ProspectOut]:
    return await account_service.list_prospects(db, account_id, current_user)


@router.get("/{account_id}/prospects/{prospect_id}", response_model=ProspectDetailOut)
async def get_prospect_detail(
    account_id: UUID,
    prospect_id: UUID,
    current_user: User = Depends(require_internal_user),
    db: AsyncSession = Depends(get_db),
) -> ProspectDetailOut:
    return await account_service.get_prospect_detail(db, account_id, prospect_id, current_user)


@router.get("/{account_id}/prospects/{prospect_id}/aggregate", response_model=ProspectAggregateOut)
async def get_prospect_aggregate(
    account_id: UUID,
    prospect_id: UUID,
    current_user: User = Depends(require_internal_user),
    db: AsyncSession = Depends(get_db),
) -> ProspectAggregateOut:
    return await account_service.get_prospect_aggregate(db, account_id, prospect_id, current_user)


@router.delete("/{account_id}/prospects/{prospect_id}", status_code=204)
async def delete_prospect(
    account_id: UUID,
    prospect_id: UUID,
    current_user: User = Depends(require_internal_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await account_service.delete_prospect(db, account_id, prospect_id, current_user)
