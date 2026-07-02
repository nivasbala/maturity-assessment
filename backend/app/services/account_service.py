import logging
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import delete as sql_delete
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.account import Account
from app.models.assessment import Assessment
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
    AssessmentDetailOut,
    AssessmentListItemOut,
    ProspectListItem,
    ReportOut,
)
from app.models.assessment import AssessmentAnswer

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

    account_ids = [a.id for a in rows]
    total_map: dict = {}
    registered_map: dict = {}
    if account_ids:
        total_rows = (
            await db.execute(
                select(Prospect.account_id, func.count().label("cnt"))
                .where(Prospect.account_id.in_(account_ids))
                .group_by(Prospect.account_id)
            )
        ).all()
        reg_rows = (
            await db.execute(
                select(Prospect.account_id, func.count().label("cnt"))
                .where(
                    Prospect.account_id.in_(account_ids),
                    Prospect.is_registered.is_(True),
                )
                .group_by(Prospect.account_id)
            )
        ).all()
        total_map = {r.account_id: r.cnt for r in total_rows}
        registered_map = {r.account_id: r.cnt for r in reg_rows}

    items = []
    for a in rows:
        item = AccountListOut.model_validate(a)
        item.prospects_total = total_map.get(a.id, 0)
        item.prospects_registered = registered_map.get(a.id, 0)
        items.append(item)

    return Paginated(items=items, total=total, page=page, size=size)


async def create_account(
    db: AsyncSession,
    current_user: User,
    data: AccountCreate,
) -> AccountListOut:
    account = Account(
        company_name=data.company_name,
        company_website=data.company_website,
        internal_user_id=current_user.id,
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

    prospects_rows = (
        await db.execute(
            select(Prospect)
            .options(selectinload(Prospect.assessments).selectinload(Assessment.report))
            .where(Prospect.account_id == account_id)
            .order_by(Prospect.created_at.desc())
        )
    ).scalars().all()

    prospect_list = []
    for p in prospects_rows:
        total = len(p.assessments)
        completed = sum(1 for a in p.assessments if a.status == "completed")
        prospect_list.append(
            ProspectListItem(
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
        )

    return AccountDetailOut(
        id=account.id,
        company_name=account.company_name,
        company_website=account.company_website,
        internal_user_id=account.internal_user_id,
        internal_user_name=account.internal_user.name,
        created_at=account.created_at,
        prospects=prospect_list,
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
                prospect_id=a.prospect_id,
                pillar_id=a.pillar_id,
                pillar_name=a.pillar.name,
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
            .options(
                selectinload(Assessment.pillar),
                selectinload(Assessment.account),
                selectinload(Assessment.prospect),
            )
            .where(Assessment.id == assessment_id)
        )
    ).scalar_one_or_none()
    if not assessment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assessment not found")
    assert_owns_account(current_user, assessment.account)

    prospect = assessment.prospect
    return AssessmentDetailOut(
        id=assessment.id,
        account_id=assessment.account_id,
        prospect_id=assessment.prospect_id,
        pillar_id=assessment.pillar_id,
        pillar_name=assessment.pillar.name,
        company_name=assessment.account.company_name,
        prospect_name=prospect.name if prospect else None,
        prospect_email=prospect.email if prospect else None,
        prospect_role=prospect.job_title if prospect else None,
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
                selectinload(Assessment.prospect),
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
    prospect = assessment.prospect
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
        prospect_name=prospect.name if prospect else None,
        prospect_email=prospect.email if prospect else None,
        prospect_role=prospect.job_title if prospect else None,
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
        assessment_id,
        account_id,
        current_user.id,
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
    # Cascades: prospects → assessments → answers/reports all cascade via FK
    await db.execute(sql_delete(Prospect).where(Prospect.account_id == account_id))
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
            .options(
                selectinload(Assessment.pillar),
                selectinload(Assessment.prospect),
                selectinload(Assessment.report),
            )
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
            prospect_name=a.prospect.name if a.prospect else None,
            prospect_role=a.prospect.job_title if a.prospect else None,
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
