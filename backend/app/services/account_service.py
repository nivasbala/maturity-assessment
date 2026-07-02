import asyncio
import logging
import secrets
from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import delete as sql_delete
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.account import Account
from app.models.assessment import Assessment, AssessmentAnswer
from app.models.pillar import Pillar
from app.models.prospect import Prospect
from app.models.report import Report
from app.models.user import User
from app.schemas.admin import Paginated
from app.schemas.internal import (
    AccountAggregateOut,
    AccountCreate,
    AccountDetailOut,
    AccountListOut,
    AggregateAssessmentRow,
    AnswerRow,
    AssessmentAnswersOut,
    AssessmentCreatedOut,
    AssessmentDetailOut,
    AssessmentListItemOut,
    PillarStatusRow,
    ProspectAssessmentRow,
    ProspectCreate,
    ProspectDetailOut,
    ProspectOut,
    ProspectWithAccountOut,
    ReportOut,
)

logger = logging.getLogger(__name__)


async def _run_agent1_background_for_prospect(
    prospect_id: UUID,
    company_name: str,
    company_website: str | None,
) -> None:
    """Fire Agent 1 in a background coroutine with its own DB session."""
    from app.agents.research_agent import run_research_agent_for_prospect  # noqa: PLC0415

    async with AsyncSessionLocal() as db:
        try:
            await run_research_agent_for_prospect(
                prospect_id,
                company_name,
                company_website,
                db,
            )
            logger.info("Agent 1 completed for prospect_id=%s", prospect_id)
        except NotImplementedError:
            logger.info("Agent 1 not yet implemented — skipping for prospect_id=%s", prospect_id)
        except Exception:
            logger.error("Agent 1 background task failed for prospect_id=%s", prospect_id, exc_info=True)


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
        await db.execute(
            q.options(selectinload(Account.internal_user))
            .order_by(Account.created_at.desc())
            .offset(offset)
            .limit(size)
        )
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
        item.internal_user_name = a.internal_user.name if a.internal_user else ""
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
    out = AccountListOut.model_validate(account)
    out.internal_user_name = current_user.name
    return out


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

    prospect_id = None
    if assessment.prospect_email:
        prospect = (
            await db.execute(
                select(Prospect).where(
                    Prospect.account_id == assessment.account_id,
                    Prospect.email == assessment.prospect_email,
                )
            )
        ).scalar_one_or_none()
        if prospect:
            prospect_id = prospect.id

    return AssessmentAnswersOut(
        assessment_id=assessment.id,
        account_id=assessment.account_id,
        prospect_id=prospect_id,
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


async def reset_assessment(
    db: AsyncSession,
    assessment_id: UUID,
    current_user: User,
) -> None:
    """Reset an assessment to pending — clears all answers, report, and status fields."""
    assessment = (
        await db.execute(
            select(Assessment)
            .options(selectinload(Assessment.account))
            .where(Assessment.id == assessment_id)
        )
    ).scalar_one_or_none()
    if not assessment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assessment not found")
    assert_owns_account(current_user, assessment.account)

    # Delete answers
    await db.execute(sql_delete(AssessmentAnswer).where(AssessmentAnswer.assessment_id == assessment_id))

    # Delete report if it exists
    report = (
        await db.execute(select(Report).where(Report.assessment_id == assessment_id))
    ).scalar_one_or_none()
    if report:
        await db.delete(report)

    # Reset assessment status fields
    assessment.status = "pending"
    assessment.started_at = None
    assessment.completed_at = None
    assessment.prospect_corrections = None
    assessment.research_confirmed_at = None

    await db.commit()
    logger.info(
        "reset_assessment: assessment_id=%s user_id=%s",
        assessment_id, current_user.id,
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

    # Reject duplicate email within the same account
    existing_prospect = (
        await db.execute(
            select(Prospect).where(
                Prospect.account_id == account_id,
                Prospect.email == body.email,
            )
        )
    ).scalar_one_or_none()
    if existing_prospect:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A prospect with this email already exists under this account",
        )

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
        research_started_at=datetime.now(timezone.utc),
    )
    db.add(prospect)
    await db.commit()
    await db.refresh(prospect)

    # Fire Agent 1 in background (non-blocking) at prospect creation time
    asyncio.create_task(
        _run_agent1_background_for_prospect(
            prospect.id,
            account.company_name,
            account.company_website,
        )
    )
    logger.info(
        "create_prospect: prospect_id=%s account_id=%s token=%s — Agent 1 fired",
        prospect.id,
        account_id,
        token,
    )

    full_url = f"{settings.base_url}/assess/{token}"
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
            is_registered=p.is_registered,
            registered_at=p.registered_at,
        )
        for p in prospects
    ]


async def list_all_prospects(
    db: AsyncSession,
    current_user: User,
) -> list[ProspectWithAccountOut]:
    q = (
        select(Prospect, Account.company_name, User.name.label("user_name"))
        .join(Account, Prospect.account_id == Account.id)
        .join(User, Account.internal_user_id == User.id)
        .order_by(Prospect.created_at.desc())
    )
    if current_user.role != "admin":
        q = q.where(Account.internal_user_id == current_user.id)
    rows = (await db.execute(q)).all()
    logger.info("list_all_prospects: user_id=%s count=%d", current_user.id, len(rows))
    return [
        ProspectWithAccountOut(
            id=p.id,
            account_id=p.account_id,
            company_name=company_name,
            internal_user_name=user_name or "",
            email=p.email,
            name=p.name,
            short_url_token=p.short_url_token,
            full_url=f"{settings.base_url}/assess/{p.short_url_token}",
            created_at=p.created_at,
        )
        for p, company_name, user_name in rows
    ]


async def delete_prospect(
    db: AsyncSession,
    account_id: UUID,
    prospect_id: UUID,
    current_user: User,
) -> None:
    account = (await db.execute(select(Account).where(Account.id == account_id))).scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    assert_owns_account(current_user, account)
    prospect = (
        await db.execute(select(Prospect).where(Prospect.id == prospect_id, Prospect.account_id == account_id))
    ).scalar_one_or_none()
    if not prospect:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prospect not found")
    await db.delete(prospect)
    await db.commit()
    logger.info("delete_prospect: prospect_id=%s account_id=%s", prospect_id, account_id)


async def get_prospect_detail(
    db: AsyncSession,
    account_id: UUID,
    prospect_id: UUID,
    current_user: User,
) -> ProspectDetailOut:
    account = (await db.execute(select(Account).where(Account.id == account_id))).scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    assert_owns_account(current_user, account)
    prospect = (
        await db.execute(select(Prospect).where(Prospect.id == prospect_id, Prospect.account_id == account_id))
    ).scalar_one_or_none()
    if not prospect:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prospect not found")

    pillars = (
        await db.execute(select(Pillar).where(Pillar.is_active.is_(True)).order_by(Pillar.display_order))
    ).scalars().all()

    assessments = (
        await db.execute(
            select(Assessment)
            .options(selectinload(Assessment.report))
            .where(
                Assessment.account_id == account_id,
                Assessment.prospect_email == prospect.email,
            )
        )
    ).scalars().all()

    assessment_by_pillar = {a.pillar_id: a for a in assessments}

    rows = []
    for p in pillars:
        a = assessment_by_pillar.get(p.id)
        score = None
        maturity_label = None
        if a and a.report:
            score = a.report.pillar_score
            maturity_label = a.report.maturity_label
        rows.append(ProspectAssessmentRow(
            pillar_id=p.id,
            pillar_name=p.name,
            display_order=p.display_order,
            assessment_id=a.id if a else None,
            status=a.status if a else None,
            pillar_score=score,
            maturity_label=maturity_label,
            completed_at=a.completed_at if a else None,
        ))

    full_url = f"{settings.base_url}/assess/{prospect.short_url_token}"
    logger.info("get_prospect_detail: prospect_id=%s account_id=%s", prospect_id, account_id)
    return ProspectDetailOut(
        id=prospect.id,
        account_id=prospect.account_id,
        email=prospect.email,
        name=prospect.name,
        short_url_token=prospect.short_url_token,
        full_url=full_url,
        created_at=prospect.created_at,
        assessments=rows,
    )


async def get_account_aggregate(
    db: AsyncSession,
    account_id: UUID,
    current_user: User,
) -> AccountAggregateOut:
    account = (await db.execute(select(Account).where(Account.id == account_id))).scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    assert_owns_account(current_user, account)

    completed = (
        await db.execute(
            select(Assessment)
            .options(selectinload(Assessment.report))
            .where(
                Assessment.account_id == account_id,
                Assessment.status == "completed",
            )
            .order_by(Assessment.completed_at.desc())
        )
    ).scalars().all()

    completed_with_report = [a for a in completed if a.report and a.report.pillar_score is not None]

    if len(completed_with_report) < 2:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aggregate view requires at least 2 completed assessments",
        )

    pillar_ids = [a.pillar_id for a in completed_with_report]
    pillars = (
        await db.execute(select(Pillar).where(Pillar.id.in_(pillar_ids)))
    ).scalars().all()
    pillar_map = {p.id: p for p in pillars}

    agg_rows = []
    for a in completed_with_report:
        pillar = pillar_map.get(a.pillar_id)
        agg_rows.append(
            AggregateAssessmentRow(
                pillar_name=pillar.name if pillar else str(a.pillar_id),
                display_order=pillar.display_order if pillar else 0,
                pillar_score=a.report.pillar_score,
                maturity_label=a.report.maturity_label or "",
                prospect_name=a.prospect_name,
                prospect_email=a.prospect_email,
            )
        )
    agg_rows.sort(key=lambda r: r.display_order)

    logger.info("get_account_aggregate: account_id=%s completed=%d", account_id, len(agg_rows))
    return AccountAggregateOut(
        account_id=account_id,
        company_name=account.company_name,
        completed_count=len(agg_rows),
        assessments=agg_rows,
    )
