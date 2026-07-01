"""
Public Assessment Service

Handles the unauthenticated prospect flow:
  1. GET /assess/{token}     — assessment info + available pillars
  2. POST /register          — prospect registration + session token (fires Agent 1)
  3. POST /select-pillar     — question selection (Agent 2 LLM, falls back to rule-based)
  4. POST /submit            — save answers, score, create report (LangGraph orchestrator)
  5. GET /report/{id}        — fetch completed report

Agent 1 fires non-blocking at /register time.
Agent 2 runs synchronously at /select-pillar time (~3-8s); falls back to rule-based on failure.
LangGraph orchestrator (Agent 3) runs synchronously at /submit time.
"""
from __future__ import annotations

import asyncio
import logging
import secrets
from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.agents.orchestrator import run_assessment_orchestrator
from app.agents.question_selection_agent import select_questions
from app.agents.research_agent import run_research_agent
from app.core.database import AsyncSessionLocal
from app.core.security import create_session_token
from app.models.account import Account
from app.models.assessment import Assessment, AssessmentAnswer
from app.models.pillar import Pillar
from app.models.question import AnswerOption, Question, QuestionPersona
from app.models.report import Report
from app.schemas.public import (
    AnswerOptionPublic,
    AssessmentInfoOut,
    AvailablePillar,
    ConfirmResearchOut,
    ConfirmResearchRequest,
    QuestionPublic,
    RegisterOut,
    RegisterRequest,
    ReportPublicOut,
    ResearchSummaryOut,
    SelectPillarOut,
    SubmitOut,
    SubmitRequest,
)
from app.services.scoring_service import compute_pillar_score

logger = logging.getLogger(__name__)

VALID_PERSONAS = {
    "cto_executive",
    "vp_engineering",
    "ciso_vp_security",
    "sre_platform_engineer",
    "devops_engineer",
    "ml_ai_engineer",
    "security_engineer",
    "software_developer",
}


# ── Helpers ───────────────────────────────────────────────────────────────────


async def _get_assessment_by_token(token: str, db: AsyncSession) -> Assessment:
    assessment = (
        await db.execute(
            select(Assessment)
            .options(selectinload(Assessment.account))
            .where(Assessment.short_url_token == token)
        )
    ).scalar_one_or_none()
    if not assessment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assessment not found")
    return assessment


def _generate_short_token() -> str:
    return secrets.token_urlsafe(6)


async def _ensure_unique_token(db: AsyncSession) -> str:
    token = _generate_short_token()
    while (
        await db.execute(select(Assessment).where(Assessment.short_url_token == token))
    ).scalar_one_or_none():
        logger.warning("Short URL token collision — regenerating")
        token = _generate_short_token()
    return token


async def _run_agent1_background(
    account_id: UUID,
    company_name: str,
    company_website: str | None,
    infrastructure_location: str | None = None,
    tech_stack_description: str | None = None,
    current_tools: str | None = None,
) -> None:
    """Fire Agent 1 in a background coroutine with its own DB session."""
    async with AsyncSessionLocal() as db:
        try:
            await run_research_agent(
                account_id,
                company_name,
                company_website,
                db,
                infrastructure_location=infrastructure_location,
                tech_stack_description=tech_stack_description,
                current_tools=current_tools,
            )
            logger.info("Agent 1 completed for account_id=%s", account_id)
        except NotImplementedError:
            logger.info("Agent 1 not yet implemented — skipping for account_id=%s", account_id)
        except Exception:
            logger.error("Agent 1 background task failed for account_id=%s", account_id, exc_info=True)


def _validate_pillar_gate(pillar: Pillar, session: dict) -> None:
    """Raise 403 if the prospect's gate answers block this pillar."""
    if not pillar.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Pillar is inactive")
    if not pillar.is_gated:
        return

    # Determine which gated pillar this is by display_order (P3=3, P4=4)
    if pillar.display_order == 3:
        gate_answer = session.get("p3_gate")
        if gate_answer is False:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Pillar not available (gate answered No)")
    elif pillar.display_order == 4:
        gate_answer = session.get("p4_gate")
        if gate_answer is False:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Pillar not available (gate answered No)")


async def _select_questions_fallback(
    db: AsyncSession,
    pillar_id: UUID,
    persona: str,
    target: int = 12,
) -> list[Question]:
    """Rule-based question selection targeting `target` questions.

    Selection order:
      1. General questions (is_general=TRUE) up to target — highest priority.
      2. Persona-eligible questions (via question_personas) up to fill remaining slots.
      3. If still short, backfill from any other active non-general questions for the pillar.

    This is the fallback used when Agent 2 is unavailable (Task 9 wires in the LLM agent).
    """
    general_qs = (
        await db.execute(
            select(Question)
            .options(
                selectinload(Question.answer_options),
                selectinload(Question.personas),
            )
            .where(
                Question.pillar_id == pillar_id,
                Question.is_general.is_(True),
                Question.is_active.is_(True),
            )
            .order_by(Question.display_order)
        )
    ).scalars().all()

    persona_qs = (
        await db.execute(
            select(Question)
            .options(
                selectinload(Question.answer_options),
                selectinload(Question.personas),
            )
            .join(QuestionPersona, Question.id == QuestionPersona.question_id)
            .where(
                Question.pillar_id == pillar_id,
                Question.is_general.is_(False),
                Question.is_active.is_(True),
                QuestionPersona.persona == persona,
            )
            .order_by(Question.display_order)
        )
    ).scalars().all()

    general_ids = {q.id for q in general_qs}
    pure_persona = [q for q in persona_qs if q.id not in general_ids]

    # Start with general questions up to target; fill remaining slots from persona questions
    selected: list[Question] = list(general_qs[:target])
    selected_ids = {q.id for q in selected}
    slots_remaining = target - len(selected)

    for q in pure_persona:
        if slots_remaining <= 0:
            break
        if q.id not in selected_ids:
            selected.append(q)
            selected_ids.add(q.id)
            slots_remaining -= 1

    # If still short of target, backfill from any other active non-general questions
    if slots_remaining > 0:
        all_other_qs = (
            await db.execute(
                select(Question)
                .options(
                    selectinload(Question.answer_options),
                    selectinload(Question.personas),
                )
                .where(
                    Question.pillar_id == pillar_id,
                    Question.is_general.is_(False),
                    Question.is_active.is_(True),
                    Question.id.not_in(list(selected_ids)),
                )
                .order_by(Question.display_order)
            )
        ).scalars().all()

        for q in all_other_qs:
            if slots_remaining <= 0:
                break
            selected.append(q)
            selected_ids.add(q.id)
            slots_remaining -= 1

    logger.info(
        "_select_questions_fallback: pillar_id=%s persona=%s total=%d (target=%d)",
        pillar_id,
        persona,
        len(selected),
        target,
    )
    return selected


# ── Service functions ─────────────────────────────────────────────────────────


async def get_assessment_info(token: str, db: AsyncSession) -> AssessmentInfoOut:
    """GET /assess/{token} — return company info and all available active pillars."""
    assessment = await _get_assessment_by_token(token, db)
    account = assessment.account

    pillars = (
        await db.execute(
            select(Pillar)
            .where(Pillar.is_active.is_(True))
            .order_by(Pillar.display_order)
        )
    ).scalars().all()

    logger.info("get_assessment_info: token=%s account_id=%s", token, account.id)
    return AssessmentInfoOut(
        company_name=account.company_name,
        suggested_pillars=account.suggested_pillars or [],
        available_pillars=[
            AvailablePillar(
                id=p.id,
                name=p.name,
                description=p.description,
                is_gated=p.is_gated,
                gate_question=p.gate_question,
            )
            for p in pillars
        ],
    )


async def register_prospect(token: str, body: RegisterRequest, db: AsyncSession) -> RegisterOut:
    """POST /assess/{token}/register — register prospect, issue session token, fire Agent 1."""
    if body.prospect_role not in VALID_PERSONAS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid prospect_role. Must be one of: {', '.join(sorted(VALID_PERSONAS))}",
        )

    assessment = await _get_assessment_by_token(token, db)
    account = assessment.account

    # Update assessment and account in one commit
    assessment.prospect_name = body.prospect_name
    assessment.prospect_email = body.prospect_email
    assessment.prospect_role = body.prospect_role
    account.infrastructure_location = body.infrastructure_location or account.infrastructure_location
    account.tech_stack_description = body.tech_stack_description or account.tech_stack_description
    account.current_tools = body.current_tools or account.current_tools
    await db.commit()

    # Build session token payload
    session_data: dict = {
        "account_id": str(account.id),
        "short_url_token": token,
        "prospect_name": body.prospect_name,
        "prospect_email": body.prospect_email,
        "prospect_role": body.prospect_role,
        "p3_gate": body.p3_gate_answered_yes,
        "p4_gate": body.p4_gate_answered_yes,
    }
    session_token = create_session_token(session_data)

    # Fire Agent 1 in background (non-blocking) with both web + prospect context
    asyncio.create_task(
        _run_agent1_background(
            account.id,
            account.company_name,
            account.company_website,
            infrastructure_location=body.infrastructure_location,
            tech_stack_description=body.tech_stack_description,
            current_tools=body.current_tools,
        )
    )
    logger.info("register_prospect: account_id=%s persona=%s — Agent 1 fired", account.id, body.prospect_role)

    return RegisterOut(session_token=session_token)


async def get_research_summary(token: str, session: dict, db: AsyncSession) -> ResearchSummaryOut:
    """GET /assess/{token}/research-summary — poll until Agent 1 completes."""
    assessment = await _get_assessment_by_token(token, db)
    account_id = UUID(session["account_id"])
    if assessment.account_id != account_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    account = assessment.account
    if not account.research_cache:
        logger.info("get_research_summary: Agent 1 still running for account_id=%s", account_id)
        return ResearchSummaryOut(is_ready=False)

    cache = account.research_cache
    logger.info("get_research_summary: returning ready profile for account_id=%s", account_id)
    return ResearchSummaryOut(
        is_ready=True,
        company_name=cache.get("company_name", account.company_name),
        industry=cache.get("industry", ""),
        company_size=cache.get("company_size", ""),
        products_summary=cache.get("products_summary", ""),
        target_customers=cache.get("target_customers", ""),
        builds_ai_products=cache.get("builds_ai_products", False),
        cloud_providers=cache.get("cloud_providers") or [],
        key_challenges=cache.get("key_challenges") or [],
        business_outcomes=cache.get("business_outcomes") or [],
        operational_scale=cache.get("operational_scale") or [],
        data_confidence=cache.get("data_confidence", "low"),
        research_notes=cache.get("research_notes", ""),
    )


async def confirm_research(
    token: str,
    session: dict,
    body: ConfirmResearchRequest,
    db: AsyncSession,
) -> ConfirmResearchOut:
    """POST /assess/{token}/confirm-research — save corrections and timestamp."""
    assessment = await _get_assessment_by_token(token, db)
    account_id = UUID(session["account_id"])
    if assessment.account_id != account_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    account = assessment.account
    account.research_confirmed_at = datetime.now(timezone.utc)
    if body.corrections and body.corrections.strip():
        account.prospect_corrections = body.corrections.strip()
        logger.info("confirm_research: corrections saved for account_id=%s", account_id)
    await db.commit()

    logger.info("confirm_research: confirmed for account_id=%s", account_id)
    return ConfirmResearchOut(confirmed=True)


async def select_pillar(
    token: str,
    session: dict,
    pillar_id: UUID,
    db: AsyncSession,
) -> SelectPillarOut:
    """POST /assess/{token}/select-pillar — validate gate, select 12 questions, return to prospect."""
    pillar = (
        await db.execute(select(Pillar).where(Pillar.id == pillar_id))
    ).scalar_one_or_none()
    if not pillar:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pillar not found")

    _validate_pillar_gate(pillar, session)

    account_id = UUID(session["account_id"])
    persona = session["prospect_role"]

    # Find or create assessment for this account + pillar
    existing = (
        await db.execute(
            select(Assessment).where(
                Assessment.account_id == account_id,
                Assessment.pillar_id == pillar_id,
            )
        )
    ).scalar_one_or_none()

    if existing:
        assessment = existing
        if assessment.status == "pending":
            assessment.status = "in_progress"
    else:
        new_token = await _ensure_unique_token(db)
        assessment = Assessment(
            account_id=account_id,
            pillar_id=pillar_id,
            short_url_token=new_token,
            prospect_name=session.get("prospect_name"),
            prospect_email=session.get("prospect_email"),
            prospect_role=persona,
            status="in_progress",
        )
        db.add(assessment)

    try:
        await db.commit()
        await db.refresh(assessment)
    except IntegrityError:
        await db.rollback()
        # Race condition: another request created this assessment simultaneously
        assessment = (
            await db.execute(
                select(Assessment).where(
                    Assessment.account_id == account_id,
                    Assessment.pillar_id == pillar_id,
                )
            )
        ).scalar_one()
        assessment.status = "in_progress"
        await db.commit()
        await db.refresh(assessment)

    # Agent 2: LLM question selection — falls back to rule-based on any failure
    account = (
        await db.execute(select(Account).where(Account.id == account_id))
    ).scalar_one_or_none()

    if not account or not account.research_confirmed_at:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Research summary must be confirmed before selecting a pillar",
        )

    research_cache = account.research_cache

    try:
        questions = await select_questions(
            pillar_id,
            persona,
            research_cache,
            db,
            infrastructure_location=account.infrastructure_location if account else None,
            tech_stack_description=account.tech_stack_description if account else None,
            current_tools=account.current_tools if account else None,
            prospect_corrections=account.prospect_corrections if account else None,
        )
        logger.info(
            "select_pillar: Agent 2 selected %d questions for assessment_id=%s",
            len(questions),
            assessment.id,
        )
    except Exception:
        logger.warning(
            "select_pillar: Agent 2 failed — using rule-based fallback for pillar_id=%s",
            pillar_id,
            exc_info=True,
        )
        questions = await _select_questions_fallback(db, pillar_id, persona, target=pillar.question_count)

    logger.info(
        "select_pillar: assessment_id=%s pillar=%s persona=%s questions=%d",
        assessment.id,
        pillar_id,
        persona,
        len(questions),
    )

    return SelectPillarOut(
        assessment_id=assessment.id,
        questions=[
            QuestionPublic(
                id=q.id,
                text=q.text,
                answer_options=[
                    AnswerOptionPublic(
                        id=ao.id,
                        text=ao.text,
                        display_order=ao.display_order,
                    )
                    for ao in sorted(q.answer_options, key=lambda a: a.display_order)
                ],
            )
            for q in questions
        ],
    )


async def submit_assessment(
    token: str,
    session: dict,
    body: SubmitRequest,
    db: AsyncSession,
) -> SubmitOut:
    """POST /assess/{token}/submit — validate, save answers, score, create report."""
    account_id = UUID(session["account_id"])
    persona = session["prospect_role"]

    # Verify assessment belongs to this session's account
    assessment = (
        await db.execute(
            select(Assessment)
            .options(selectinload(Assessment.account))
            .where(Assessment.id == body.assessment_id)
        )
    ).scalar_one_or_none()
    if not assessment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assessment not found")
    if assessment.account_id != account_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    pillar = (
        await db.execute(select(Pillar).where(Pillar.id == assessment.pillar_id))
    ).scalar_one_or_none()
    expected_count = pillar.question_count if pillar else 12
    if len(body.answers) != expected_count:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Exactly {expected_count} answers required",
        )

    # Validate answer_option_ids belong to the correct questions
    question_ids = {a.question_id for a in body.answers}
    valid_options = {
        ao.id
        for ao in (
            await db.execute(
                select(AnswerOption).where(AnswerOption.question_id.in_(question_ids))
            )
        ).scalars().all()
    }
    for a in body.answers:
        if a.answer_option_id not in valid_options:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"answer_option_id {a.answer_option_id} does not belong to question {a.question_id}",
            )

    # Idempotency: delete existing answers if re-submitting
    existing_answers = (
        await db.execute(
            select(AssessmentAnswer).where(AssessmentAnswer.assessment_id == body.assessment_id)
        )
    ).scalars().all()
    for ea in existing_answers:
        await db.delete(ea)
    await db.flush()  # ensure deletes execute before inserts

    # Save answers
    for answer in body.answers:
        db.add(
            AssessmentAnswer(
                assessment_id=body.assessment_id,
                question_id=answer.question_id,
                answer_option_id=answer.answer_option_id,
            )
        )

    await db.flush()

    # Compute score synchronously
    answer_pairs = [(a.question_id, a.answer_option_id) for a in body.answers]
    pillar_score, maturity_level, maturity_label = await compute_pillar_score(db, answer_pairs, persona)

    # Create or update report record (score stored immediately per spec)
    existing_report = (
        await db.execute(select(Report).where(Report.assessment_id == body.assessment_id))
    ).scalar_one_or_none()

    if existing_report:
        existing_report.pillar_score = pillar_score
        existing_report.maturity_level = maturity_level
        existing_report.maturity_label = maturity_label
        report = existing_report
    else:
        report = Report(
            assessment_id=body.assessment_id,
            pillar_score=pillar_score,
            maturity_level=maturity_level,
            maturity_label=maturity_label,
            executive_summary="",
            strengths=[],
            gap_analysis=[],
            next_steps=[],
            pillar_breakdown={},
        )
        db.add(report)

    # Capture account fields before commit — db.commit() expires all ORM objects, so
    # accessing assessment.account.* after the commit raises MissingGreenlet in async SA.
    acct = assessment.account
    acct_id = acct.id
    acct_company_name = acct.company_name
    acct_company_website = acct.company_website
    acct_research_cache = acct.research_cache
    acct_prospect_corrections = acct.prospect_corrections

    # Mark assessment complete
    assessment.status = "completed"
    assessment.completed_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(report)

    logger.info(
        "submit_assessment: assessment_id=%s score=%.2f level=%d — report_id=%s — running Agent 3",
        body.assessment_id,
        pillar_score,
        maturity_level,
        report.id,
    )

    # LangGraph orchestrator: Agent 3 (Report Agent) — user waits ~15-45s
    narrative = await run_assessment_orchestrator(
        db=db,
        account_id=acct_id,
        company_name=acct_company_name,
        company_website=acct_company_website,
        persona=persona,
        pillar_name=pillar.name if pillar else "Assessment",
        assessment_id=body.assessment_id,
        pre_computed_score=pillar_score,
        pre_computed_maturity_level=maturity_level,
        pre_computed_maturity_label=maturity_label,
        company_profile=acct_research_cache,
        prospect_corrections=acct_prospect_corrections,
    )

    # Update report with LLM narrative and research snapshot (score already committed above)
    report.executive_summary = narrative.get("executive_summary", "")
    report.strengths = narrative.get("strengths", [])
    report.gap_analysis = narrative.get("gap_analysis", [])
    report.next_steps = narrative.get("next_steps", [])
    report.research_data = acct_research_cache or {}
    await db.commit()
    await db.refresh(report)

    logger.info(
        "submit_assessment: report narrative saved for report_id=%s", report.id
    )

    return SubmitOut(report_id=report.id)


async def get_report(token: str, assessment_id: UUID, db: AsyncSession) -> ReportPublicOut:
    """GET /assess/{token}/report/{assessment_id} — return completed report."""
    assessment = await _get_assessment_by_token(token, db)
    account = assessment.account

    # The report can be for any assessment under this account (multi-pillar flow)
    target_assessment = (
        await db.execute(
            select(Assessment)
            .options(
                selectinload(Assessment.pillar),
                selectinload(Assessment.report),
            )
            .where(
                Assessment.id == assessment_id,
                Assessment.account_id == account.id,
            )
        )
    ).scalar_one_or_none()
    if not target_assessment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assessment not found")

    report = target_assessment.report
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not yet available")

    logger.info("get_report: token=%s assessment_id=%s report_id=%s", token, assessment_id, report.id)
    return ReportPublicOut(
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
        created_at=report.created_at,
        company_name=account.company_name,
        pillar_name=target_assessment.pillar.name,
        prospect_name=target_assessment.prospect_name,
        prospect_role=target_assessment.prospect_role,
    )
