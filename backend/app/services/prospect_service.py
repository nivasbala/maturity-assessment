import logging
import secrets
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models.account import Account
from app.models.assessment import Assessment
from app.models.pillar import Pillar
from app.models.prospect import Prospect
from app.models.report import Report
from app.schemas.internal import (
    PillarStatusRow,
    ProspectCreate,
    ProspectCreatedOut,
    ProspectDetailOut,
    ProspectListItem,
)
from app.services.account_service import assert_owns_account

logger = logging.getLogger(__name__)


def _generate_short_token() -> str:
    return secrets.token_urlsafe(6)


async def _ensure_unique_prospect_token(db: AsyncSession) -> str:
    token = _generate_short_token()
    while (
        await db.execute(select(Prospect).where(Prospect.short_url_token == token))
    ).scalar_one_or_none():
        logger.warning("prospect short_url_token collision — regenerating")
        token = _generate_short_token()
    return token


async def create_prospect(
    db: AsyncSession,
    account_id: UUID,
    current_user,
    data: ProspectCreate,
) -> ProspectCreatedOut:
    account = (
        await db.execute(select(Account).where(Account.id == account_id))
    ).scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    assert_owns_account(current_user, account)

    token = await _ensure_unique_prospect_token(db)

    prospect = Prospect(
        account_id=account_id,
        email=data.email,
        suggested_pillars=data.suggested_pillars,
        short_url_token=token,
        is_registered=False,
    )
    db.add(prospect)
    try:
        await db.commit()
        await db.refresh(prospect)
    except IntegrityError:
        await db.rollback()
        logger.warning(
            "create_prospect: duplicate email for account_id=%s email=%s",
            account_id,
            data.email,
        )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A prospect with this email already exists for this account",
        )

    logger.info("create_prospect: prospect_id=%s account_id=%s", prospect.id, account_id)
    full_url = f"{settings.base_url}/assess/{token}"
    return ProspectCreatedOut(
        prospect_id=prospect.id,
        email=prospect.email,
        short_url_token=token,
        full_url=full_url,
        is_registered=False,
    )


async def list_prospects(
    db: AsyncSession,
    account_id: UUID,
    current_user,
) -> list[ProspectListItem]:
    account = (
        await db.execute(select(Account).where(Account.id == account_id))
    ).scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    assert_owns_account(current_user, account)

    prospects = (
        await db.execute(
            select(Prospect)
            .options(selectinload(Prospect.assessments).selectinload(Assessment.report))
            .where(Prospect.account_id == account_id)
            .order_by(Prospect.created_at.desc())
        )
    ).scalars().all()

    result = []
    for p in prospects:
        total = len(p.assessments)
        completed = sum(1 for a in p.assessments if a.status == "completed")
        item = ProspectListItem(
            id=p.id,
            email=p.email,
            name=p.name,
            job_title=p.job_title,
            short_url_token=p.short_url_token,
            is_registered=p.is_registered,
            registered_at=p.registered_at,
            created_at=p.created_at,
            assessments_total=total,
            assessments_completed=completed,
        )
        result.append(item)

    logger.info("list_prospects: account_id=%s count=%d", account_id, len(result))
    return result


async def get_prospect_detail(
    db: AsyncSession,
    account_id: UUID,
    prospect_id: UUID,
    current_user,
) -> ProspectDetailOut:
    account = (
        await db.execute(select(Account).where(Account.id == account_id))
    ).scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    assert_owns_account(current_user, account)

    prospect = (
        await db.execute(
            select(Prospect)
            .where(Prospect.id == prospect_id, Prospect.account_id == account_id)
        )
    ).scalar_one_or_none()
    if not prospect:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prospect not found")

    assessments = (
        await db.execute(
            select(Assessment)
            .options(selectinload(Assessment.report))
            .where(Assessment.prospect_id == prospect_id)
        )
    ).scalars().all()
    assessment_map = {a.pillar_id: a for a in assessments}

    pillars = (
        await db.execute(select(Pillar).order_by(Pillar.display_order))
    ).scalars().all()

    pillar_statuses: list[PillarStatusRow] = []
    for pillar in pillars:
        a = assessment_map.get(pillar.id)
        report = a.report if a else None
        pillar_statuses.append(
            PillarStatusRow(
                pillar_id=pillar.id,
                pillar_name=pillar.name,
                display_order=pillar.display_order,
                is_gated=pillar.is_gated,
                is_active=pillar.is_active,
                assessment_id=a.id if a else None,
                status=a.status if a else None,
                pillar_score=float(report.pillar_score) if report else None,
                maturity_label=report.maturity_label if report else None,
            )
        )

    logger.info("get_prospect_detail: prospect_id=%s account_id=%s", prospect_id, account_id)
    return ProspectDetailOut(
        id=prospect.id,
        account_id=prospect.account_id,
        email=prospect.email,
        name=prospect.name,
        job_title=prospect.job_title,
        suggested_pillars=prospect.suggested_pillars or [],
        short_url_token=prospect.short_url_token,
        is_registered=prospect.is_registered,
        registered_at=prospect.registered_at,
        created_at=prospect.created_at,
        pillar_statuses=pillar_statuses,
    )


async def delete_prospect(
    db: AsyncSession,
    account_id: UUID,
    prospect_id: UUID,
    current_user,
) -> None:
    account = (
        await db.execute(select(Account).where(Account.id == account_id))
    ).scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    assert_owns_account(current_user, account)

    prospect = (
        await db.execute(
            select(Prospect).where(Prospect.id == prospect_id, Prospect.account_id == account_id)
        )
    ).scalar_one_or_none()
    if not prospect:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prospect not found")

    await db.delete(prospect)
    await db.commit()
    logger.info(
        "delete_prospect: prospect_id=%s account_id=%s user_id=%s",
        prospect_id,
        account_id,
        current_user.id,
    )
