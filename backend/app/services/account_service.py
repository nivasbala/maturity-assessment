import logging
import secrets
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import delete as sql_delete
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models.account import Account
from app.models.assessment import Assessment, AssessmentAnswer
from app.models.pillar import Pillar
from app.models.prospect import Prospect
from app.models.report import Report
from app.models.user import User
from app.schemas.admin import Paginated
from app.schemas.internal import (
    AccountCreate,
    AccountDetailOut,
    AccountListOut,
    AggregateOut,
    AggregateScoreItem,
    AnswerRow,
    AssessmentAnswersOut,
    AssessmentCreatedOut,
    AssessmentDetailOut,
    AssessmentListItemOut,
    PillarStatusRow,
    ProspectCreate,
    ProspectOut,
    ReportOut,
)

logger = logging.getLogger(__name__)


def assert_owns_account(current_user: User, account: Account) -> None:
    if current_user.role == "admin":
        return
    if account.internal_user_id != current_user.id:
        logger.warning(
            "Access denied: user_id=%s attempted to access account owned by user_id=%s",
            current_user.id,
            account.internal_user_id,
        )
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")


def _generate_short_token() -> str:
    return secrets.token_urlsafe(6)  # produces 8-char URL-safe string


async def list_accounts(
    db: AsyncSession,
    current_user: User,
    page: int = 1,
    size: int = 25,
) -> Paginated[AccountListOut]:
    offset = (page - 1) * size
    q = select(Account)
    if current_user.role != "admin":
        q = q.where(Account.internal_user_id == current_user.id)
    total_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(total_q)).scalar_one()
    rows = (
        await db.execute(q.order_by(Account.created_at.desc()).offset(offset).limit(size))
    ).scalars().all()
    logger.info("list_accounts: user_id=%s count=%d", current_user.id, total)

    # Compute pillar counts per account in two bulk queries
    account_ids = [a.id for a in rows]
    sent_map: dict = {}
    completed_map: dict = {}
    if account_ids:
        sent_rows = (
            await db.execute(
                select(Assessment.account_id, func.count().label("cnt"))
                .where(Assessment.account_id.in_(account_ids))
                .group_by(Assessment.account_id)
            )
        ).all()
        done_rows = (
            await db.execute(
                select(Assessment.account_id, func.count().label("cnt"))
                .where(
                    Assessment.account_id.in_(account_ids),
                    Assessment.status == "completed",
                )
                .group_by(Assessment.account_id)
            )
        ).all()
        sent_map = {r.account_id: r.cnt for r in sent_rows}
        completed_map = {r.account_id: r.cnt for r in done_rows}

    items = []
    for a in rows:
        item = AccountListOut.model_validate(a)
        item.pillars_sent = sent_map.get(a.id, 0)
        item.pillars_completed = completed_map.get(a.id, 0)
        items.append(item)

    return Paginated(
        items=items,
        total=total,
        page=page,
        size=size,
    )


async def create_account(
    db: AsyncSession,
    current_user: User,
    data: AccountCreate,
) -> AccountListOut:
    account = Account(
        company_name=data.company_name,
        company_website=data.company_website,
        internal_user_id=current_user.id,
        suggested_pillars=data.suggested_pillars,
    )
    db.add(account)
    await db.commit()
    await db.refresh(account)
    logger.info("create_account: account_id=%s user_id=%s", account.id, current_user.id)
    return AccountListOut.model_validate(account)


async def get_account_detail(
    db: AsyncSession,
    account_id: UUID,
    current_user: User,
) -> AccountDetailOut:
    account = (
        await db.execute(
            select(Account)
            .options(selectinload(Account.internal_user))
            .where(Account.id == account_id)
        )
    ).scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    assert_owns_account(current_user, account)

    assessments = (
        await db.execute(
            select(Assessment)
            .options(selectinload(Assessment.report))
            .where(Assessment.account_id == account_id)
        )
    ).scalars().all()
    assessment_map = {a.pillar_id: a for a in assessments}

    # Show all pillars (active and inactive) so internal users can see P4's
    # "Inactive" status and track completed work on deactivated pillars.
    pillars = (
        await db.execute(select(Pillar).order_by(Pillar.display_order))
    ).scalars().all()

    pillar_statuses: list[PillarStatusRow] = []
    for pillar in pillars:
        assessment = assessment_map.get(pillar.id)
        report = assessment.report if assessment else None
        pillar_statuses.append(
            PillarStatusRow(
                pillar_id=pillar.id,
                pillar_name=pillar.name,
                display_order=pillar.display_order,
                is_gated=pillar.is_gated,
                is_active=pillar.is_active,
                assessment_id=assessment.id if assessment else None,
                status=assessment.status if assessment else None,
                prospect_name=assessment.prospect_name if assessment else None,
                prospect_email=assessment.prospect_email if assessment else None,
                prospect_role=assessment.prospect_role if assessment else None,
                pillar_score=float(report.pillar_score) if report else None,
                maturity_label=report.maturity_label if report else None,
                short_url_token=assessment.short_url_token if assessment else None,
            )
        )

    return AccountDetailOut(
        id=account.id,
        company_name=account.company_name,
        company_website=account.company_website,
        internal_user_id=account.internal_user_id,
        internal_user_name=account.internal_user.name,
        suggested_pillars=account.suggested_pillars or [],
        created_at=account.created_at,
        pillar_statuses=pillar_statuses,
    )


async def create_assessment(
    db: AsyncSession,
    account_id: UUID,
    current_user: User,
    pillar_id: UUID,
) -> AssessmentCreatedOut:
    account = (
        await db.execute(select(Account).where(Account.id == account_id))
    ).scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    assert_owns_account(current_user, account)

    pillar = (
        await db.execute(select(Pillar).where(Pillar.id == pillar_id, Pillar.is_active == True))  # noqa: E712
    ).scalar_one_or_none()
    if not pillar:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pillar not found or inactive")

    existing = (
        await db.execute(
            select(Assessment).where(
                Assessment.account_id == account_id,
                Assessment.pillar_id == pillar_id,
            )
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Assessment already exists for this account and pillar",
        )

    token = _generate_short_token()
    # Ensure uniqueness (collision is extremely unlikely but handle it)
    while (
        await db.execute(select(Assessment).where(Assessment.short_url_token == token))
    ).scalar_one_or_none():
        logger.warning("Short URL token collision — regenerating")
        token = _generate_short_token()

    assessment = Assessment(
        account_id=account_id,
        pillar_id=pillar_id,
        short_url_token=token,
        status="pending",
    )
    db.add(assessment)
    try:
        await db.commit()
        await db.refresh(assessment)
    except IntegrityError:
        await db.rollback()
        logger.warning(
            "create_assessment: duplicate constraint hit for account_id=%s pillar_id=%s",
            account_id,
            pillar_id,
        )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Assessment already exists for this account and pillar",
        )
    logger.info(
        "create_assessment: assessment_id=%s account_id=%s pillar_id=%s",
        assessment.id,
        account_id,
        pillar_id,
    )
    full_url = f"{settings.base_url}/assess/{token}"
    return AssessmentCreatedOut(
        assessment_id=assessment.id,
        short_url_token=token,
        full_url=full_url,
    )


async def list_account_assessments(
    db: AsyncSession,
    account_id: UUID,
    current_user: User,
) -> list[AssessmentListItemOut]:
    account = (
        await db.execute(select(Account).where(Account.id == account_id))
    ).scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    assert_owns_account(current_user, account)

    rows = (
        await db.execute(
            select(Assessment)
            .options(selectinload(Assessment.pillar), selectinload(Assessment.report))
            .where(Assessment.account_id == account_id)
            .order_by(Assessment.created_at.desc())
        )
    ).scalars().all()

    result = []
    for a in rows:
        report = a.report
        result.append(
            AssessmentListItemOut(
                id=a.id,
                account_id=a.account_id,
                pillar_id=a.pillar_id,
                pillar_name=a.pillar.name,
                short_url_token=a.short_url_token,
                prospect_name=a.prospect_name,
                prospect_email=a.prospect_email,
                prospect_role=a.prospect_role,
                status=a.status,
                pillar_score=float(report.pillar_score) if report else None,
                maturity_label=report.maturity_label if report else None,
                created_at=a.created_at,
                completed_at=a.completed_at,
            )
        )
    logger.info("list_account_assessments: account_id=%s count=%d", account_id, len(result))
    return result


async def get_assessment_detail(
    db: AsyncSession,
    assessment_id: UUID,
    current_user: User,
) -> AssessmentDetailOut:
    assessment = (
        await db.execute(
            select(Assessment)
            .options(selectinload(Assessment.pillar), selectinload(Assessment.account))
            .where(Assessment.id == assessment_id)
        )
    ).scalar_one_or_none()
    if not assessment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assessment not found")
    assert_owns_account(current_user, assessment.account)

    return AssessmentDetailOut(
        id=assessment.id,
        account_id=assessment.account_id,
        pillar_id=assessment.pillar_id,
        pillar_name=assessment.pillar.name,
        company_name=assessment.account.company_name,
        short_url_token=assessment.short_url_token,
        prospect_name=assessment.prospect_name,
        prospect_email=assessment.prospect_email,
        prospect_role=assessment.prospect_role,
        status=assessment.status,
        created_at=assessment.created_at,
        completed_at=assessment.completed_at,
    )


async def get_assessment_answers(
    db: AsyncSession,
    assessment_id: UUID,
    current_user: User,
) -> AssessmentAnswersOut:
    assessment = (
        await db.execute(
            select(Assessment)
            .options(
                selectinload(Assessment.account),
                selectinload(Assessment.pillar),
                selectinload(Assessment.report),
                selectinload(Assessment.answers).selectinload(AssessmentAnswer.question),
                selectinload(Assessment.answers).selectinload(AssessmentAnswer.answer_option),
            )
            .where(Assessment.id == assessment_id)
        )
    ).scalar_one_or_none()
    if not assessment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assessment not found")
    assert_owns_account(current_user, assessment.account)

    report = assessment.report
    answers = [
        AnswerRow(
            question_text=ans.question.text,
            selected_option_text=ans.answer_option.text,
            maturity_level=ans.answer_option.maturity_level,
        )
        for ans in sorted(assessment.answers, key=lambda a: a.question.display_order)
    ]

    return AssessmentAnswersOut(
        assessment_id=assessment.id,
        account_id=assessment.account_id,
        pillar_id=assessment.pillar_id,
        pillar_name=assessment.pillar.name,
        company_name=assessment.account.company_name,
        status=assessment.status,
        prospect_name=assessment.prospect_name,
        prospect_email=assessment.prospect_email,
        prospect_role=assessment.prospect_role,
        completed_at=assessment.completed_at,
        pillar_score=float(report.pillar_score) if report else None,
        maturity_label=report.maturity_label if report else None,
        answers=answers,
    )


async def get_assessment_report(
    db: AsyncSession,
    assessment_id: UUID,
    current_user: User,
) -> ReportOut:
    assessment = (
        await db.execute(
            select(Assessment)
            .options(selectinload(Assessment.account), selectinload(Assessment.report))
            .where(Assessment.id == assessment_id)
        )
    ).scalar_one_or_none()
    if not assessment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assessment not found")
    assert_owns_account(current_user, assessment.account)

    report = assessment.report
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not yet available")

    return ReportOut(
        id=report.id,
        assessment_id=report.assessment_id,
        pillar_score=float(report.pillar_score),
        maturity_level=report.maturity_level,
        maturity_label=report.maturity_label,
        executive_summary=report.executive_summary,
        strengths=report.strengths or [],
        gap_analysis=report.gap_analysis or [],
        next_steps=report.next_steps or [],
        pillar_breakdown=report.pillar_breakdown or {},
        research_data=report.research_data,
        created_at=report.created_at,
    )


async def delete_assessment(
    db: AsyncSession,
    account_id: UUID,
    assessment_id: UUID,
    current_user: User,
) -> None:
    account = (
        await db.execute(select(Account).where(Account.id == account_id))
    ).scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    assert_owns_account(current_user, account)

    assessment = (
        await db.execute(
            select(Assessment).where(
                Assessment.id == assessment_id,
                Assessment.account_id == account_id,
            )
        )
    ).scalar_one_or_none()
    if not assessment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assessment not found")

    await db.delete(assessment)
    await db.commit()
    logger.info(
        "delete_assessment: assessment_id=%s account_id=%s user_id=%s",
        assessment_id, account_id, current_user.id,
    )


async def delete_account(
    db: AsyncSession,
    account_id: UUID,
    current_user: User,
) -> None:
    account = (
        await db.execute(select(Account).where(Account.id == account_id))
    ).scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    assert_owns_account(current_user, account)
    await db.execute(sql_delete(Assessment).where(Assessment.account_id == account_id))
    await db.delete(account)
    await db.commit()
    logger.info("delete_account: account_id=%s user_id=%s", account_id, current_user.id)


async def get_account_aggregate(
    db: AsyncSession,
    account_id: UUID,
    current_user: User,
) -> AggregateOut:
    account = (
        await db.execute(select(Account).where(Account.id == account_id))
    ).scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    assert_owns_account(current_user, account)

    completed = (
        await db.execute(
            select(Assessment)
            .options(selectinload(Assessment.pillar), selectinload(Assessment.report))
            .where(
                Assessment.account_id == account_id,
                Assessment.status == "completed",
            )
        )
    ).scalars().all()

    scores = [
        AggregateScoreItem(
            pillar_id=a.pillar_id,
            pillar_name=a.pillar.name,
            pillar_score=float(a.report.pillar_score),
            maturity_label=a.report.maturity_label,
            prospect_name=a.prospect_name,
            prospect_role=a.prospect_role,
        )
        for a in completed
        if a.report
    ]

    if len(scores) < 2:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aggregate view requires at least 2 completed assessments",
        )

    logger.info("get_account_aggregate: account_id=%s completed=%d", account_id, len(scores))
    return AggregateOut(
        account_id=account_id,
        company_name=account.company_name,
        completed_count=len(scores),
        scores=scores,
    )


# ── Prospects ─────────────────────────────────────────────────────────────────

async def create_prospect(
    db: AsyncSession,
    account_id: UUID,
    current_user: User,
    body: ProspectCreate,
) -> ProspectOut:
    account = (
        await db.execute(select(Account).where(Account.id == account_id))
    ).scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    assert_owns_account(current_user, account)

    # Generate a unique short URL token
    for _ in range(5):
        token = _generate_short_token()
        existing = (
            await db.execute(select(Prospect).where(Prospect.short_url_token == token))
        ).scalar_one_or_none()
        if not existing:
            break
        logger.warning("Prospect short URL token collision — regenerating")
    else:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not generate unique token")

    prospect = Prospect(
        account_id=account_id,
        email=body.email,
        name=body.name,
        short_url_token=token,
    )
    db.add(prospect)
    await db.commit()
    await db.refresh(prospect)

    full_url = f"{settings.base_url}/assess/{token}"
    logger.info("create_prospect: prospect_id=%s account_id=%s token=%s", prospect.id, account_id, token)
    return ProspectOut(
        id=prospect.id,
        account_id=prospect.account_id,
        email=prospect.email,
        name=prospect.name,
        short_url_token=prospect.short_url_token,
        full_url=full_url,
        created_at=prospect.created_at,
    )


async def list_prospects(
    db: AsyncSession,
    account_id: UUID,
    current_user: User,
) -> list[ProspectOut]:
    account = (
        await db.execute(select(Account).where(Account.id == account_id))
    ).scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    assert_owns_account(current_user, account)

    prospects = (
        await db.execute(
            select(Prospect)
            .where(Prospect.account_id == account_id)
            .order_by(Prospect.created_at.desc())
        )
    ).scalars().all()

    logger.info("list_prospects: account_id=%s count=%d", account_id, len(prospects))
    return [
        ProspectOut(
            id=p.id,
            account_id=p.account_id,
            email=p.email,
            name=p.name,
            short_url_token=p.short_url_token,
            full_url=f"{settings.base_url}/assess/{p.short_url_token}",
            created_at=p.created_at,
        )
        for p in prospects
    ]
