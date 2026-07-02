"""
Public Assessment Service

Handles the unauthenticated prospect flow:
  1. GET /assess/{token}     — assessment info + available pillars
  2. POST /register          — prospect registration + session token (fires Agent 1)
  3. GET /research-summary   — poll until Agent 1 completes
  4. POST /confirm-research  — save optional corrections
  5. POST /select-pillar     — question selection (Agent 2 LLM, falls back to rule-based)
  6. POST /submit            — save answers, score, create report (LangGraph orchestrator)
  7. GET /report/{id}        — fetch completed report

Agent 1 fires non-blocking at /register time (using prospect context).
Agent 2 runs synchronously at /select-pillar time (~3-8s); falls back to rule-based on failure.
LangGraph orchestrator (Agent 3) runs synchronously at /submit time.
"""
from __future__ import annotations

import asyncio
import logging
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
from app.models.prospect import Prospect
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


async def _get_prospect_by_token(token: str, db: AsyncSession) -> Prospect:
    prospect = (
        await db.execute(
            select(Prospect)
            .options(selectinload(Prospect.account))
            .where(Prospect.short_url_token == token)
        )
    ).scalar_one_or_none()
    if not prospect:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assessment link not found")
    return prospect


async def _run_agent1_background(
    prospect_id: UUID,
    company_name: str,
    company_website: str | None,
    infrastructure_location: str | None = None,
    tech_stack_description: str | None = None,
    current_tools: str | None = None,
    key_challenges_input: str | None = None,
) -> None:
    """Fire Agent 1 in a background coroutine with its own DB session."""
    async with AsyncSessionLocal() as db:
        try:
            await run_research_agent(
                prospect_id,
                company_name,
                company_website,
                db,
                infrastructure_location=infrastructure_location,
                tech_stack_description=tech_stack_description,
                current_tools=current_tools,
                key_challenges_input=key_challenges_input,
            )
            logger.info("Agent 1 completed for prospect_id=%s", prospect_id)
        except NotImplementedError:
            logger.info("Agent 1 not yet implemented — skipping for prospect_id=%s", prospect_id)
        except Exception:
            logger.error("Agent 1 background task failed for prospect_id=%s", prospect_id, exc_info=True)


def _validate_pillar_gate(pillar: Pillar, session: dict) -> None:
    """Raise 403 if the prospect's gate answers block this pillar."""
    if not pillar.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Pillar is inactive")
    if not pillar.is_gated:
        return
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
    """Rule-based question selection targeting `target` questions."""
    general_qs = (
        await db.execute(
            select(Question)
            .options(selectinload(Question.answer_options), selectinload(Question.personas))
            .where(Question.pillar_id == pillar_id, Question.is_general.is_(True), Question.is_active.is_(True))
            .order_by(Question.display_order)
        )
    ).scalars().all()

    persona_qs = (
        await db.execute(
            select(Question)
            .options(selectinload(Question.answer_options), selectinload(Question.personas))
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

    if slots_remaining > 0:
        all_other_qs = (
            await db.execute(
                select(Question)
                .options(selectinload(Question.answer_options), selectinload(Question.personas))
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
        pillar_id, persona, len(selected), target,
    )
    return selected


# ── Service functions ─────────────────────────────────────────────────────────


async def get_assessment_info(token: str, db: AsyncSession) -> AssessmentInfoOut:
    """GET /assess/{token} — return company info, prospect email, and all available active pillars."""
    prospect = await _get_prospect_by_token(token, db)
    account = prospect.account

    pillars = (
        await db.execute(
            select(Pillar).where(Pillar.is_active.is_(True)).order_by(Pillar.display_order)
        )
    ).scalars().all()

    logger.info("get_assessment_info: token=%s prospect_id=%s", token, prospect.id)
    return AssessmentInfoOut(
        company_name=account.company_name,
        prospect_email=prospect.email,
        suggested_pillars=prospect.suggested_pillars or [],
        available_pillars=[
            AvailablePillar(id=p.id, name=p.name, description=p.description, is_gated=p.is_gated, gate_question=p.gate_question)
            for p in pillars
        ],
    )


async def register_prospect(token: str, body: RegisterRequest, db: AsyncSession) -> RegisterOut:
    """POST /assess/{token}/register — update prospect record, issue session token, fire Agent 1."""
    if body.prospect_role not in VALID_PERSONAS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid prospect_role. Must be one of: {', '.join(sorted(VALID_PERSONAS))}",
        )

    prospect = await _get_prospect_by_token(token, db)
    account = prospect.account

    # Update Prospect record with registration data
    prospect.name = body.prospect_name
    prospect.job_title = body.prospect_role
    prospect.infrastructure_location = body.infrastructure_location or prospect.infrastructure_location
    prospect.tech_stack_description = body.tech_stack_description or prospect.tech_stack_description
    prospect.current_tools = body.current_tools or prospect.current_tools
    prospect.key_challenges_input = body.key_challenges_input or prospect.key_challenges_input
    prospect.is_registered = True
    prospect.registered_at = datetime.now(timezone.utc)
    await db.commit()

    session_data: dict = {
        "prospect_id": str(prospect.id),
        "short_url_token": token,
        "prospect_name": body.prospect_name,
        "prospect_role": body.prospect_role,
        "p3_gate": body.p3_gate_answered_yes,
        "p4_gate": body.p4_gate_answered_yes,
    }
    session_token = create_session_token(session_data)

    # Fire Agent 1 background with both web + prospect context
    asyncio.create_task(
        _run_agent1_background(
            prospect.id,
            account.company_name,
            account.company_website,
            infrastructure_location=body.infrastructure_location,
            tech_stack_description=body.tech_stack_description,
            current_tools=body.current_tools,
            key_challenges_input=body.key_challenges_input,
        )
    )
    logger.info("register_prospect: prospect_id=%s persona=%s — Agent 1 fired", prospect.id, body.prospect_role)
    return RegisterOut(session_token=session_token)


async def get_research_summary(token: str, session: dict, db: AsyncSession) -> ResearchSummaryOut:
    """GET /assess/{token}/research-summary — poll until Agent 1 completes."""
    prospect = await _get_prospect_by_token(token, db)
    prospect_id = UUID(session["prospect_id"])
    if prospect.id != prospect_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    if not prospect.research_cache:
        anchor = prospect.registered_at or prospect.created_at
        if anchor.tzinfo is None:
            anchor = anchor.replace(tzinfo=timezone.utc)
        elapsed_seconds = (datetime.now(timezone.utc) - anchor).total_seconds()
        if elapsed_seconds < 60:
            logger.info("get_research_summary: Agent 1 still running for prospect_id=%s", prospect_id)
            return ResearchSummaryOut(is_ready=False)
        logger.warning(
            "get_research_summary: 60s timeout reached for prospect_id=%s — returning empty profile",
            prospect_id,
        )
        return ResearchSummaryOut(
            is_ready=True,
            company_name=prospect.account.company_name,
            data_confidence="low",
            research_notes="Research summary is not available. You can still proceed with your assessment.",
        )

    cache = prospect.research_cache
    logger.info("get_research_summary: returning ready profile for prospect_id=%s", prospect_id)
    return ResearchSummaryOut(
        is_ready=True,
        company_name=cache.get("company_name", prospect.account.company_name),
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
    """POST /assess/{token}/confirm-research — save corrections and timestamp on prospect."""
    prospect = await _get_prospect_by_token(token, db)
    prospect_id = UUID(session["prospect_id"])
    if prospect.id != prospect_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    prospect.research_confirmed_at = datetime.now(timezone.utc)
    if body.corrections and body.corrections.strip():
        prospect.prospect_corrections = body.corrections.strip()
        logger.info("confirm_research: corrections saved for prospect_id=%s", prospect_id)
    await db.commit()

    logger.info("confirm_research: confirmed for prospect_id=%s", prospect_id)
    return ConfirmResearchOut(confirmed=True)


async def select_pillar(
    token: str,
    session: dict,
    pillar_id: UUID,
    db: AsyncSession,
) -> SelectPillarOut:
    """POST /assess/{token}/select-pillar — validate gate, select questions, return to prospect."""
    pillar = (
        await db.execute(select(Pillar).where(Pillar.id == pillar_id))
    ).scalar_one_or_none()
    if not pillar:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pillar not found")

    _validate_pillar_gate(pillar, session)

    prospect_id = UUID(session["prospect_id"])
    persona = session["prospect_role"]

    prospect = (
        await db.execute(select(Prospect).where(Prospect.id == prospect_id))
    ).scalar_one_or_none()
    if not prospect:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prospect not found")

    if not prospect.research_confirmed_at:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Research summary must be confirmed before selecting a pillar",
        )

    # Find or create assessment for this prospect + pillar
    existing = (
        await db.execute(
            select(Assessment).where(
                Assessment.prospect_id == prospect_id,
                Assessment.pillar_id == pillar_id,
            )
        )
    ).scalar_one_or_none()

    if existing:
        assessment = existing
        if assessment.status == "pending":
            assessment.status = "in_progress"
    else:
        assessment = Assessment(
            account_id=prospect.account_id,
            prospect_id=prospect_id,
            pillar_id=pillar_id,
            status="in_progress",
        )
        db.add(assessment)

    try:
        await db.commit()
        await db.refresh(assessment)
    except IntegrityError:
        await db.rollback()
        assessment = (
            await db.execute(
                select(Assessment).where(
                    Assessment.prospect_id == prospect_id,
                    Assessment.pillar_id == pillar_id,
                )
            )
        ).scalar_one()
        assessment.status = "in_progress"
        await db.commit()
        await db.refresh(assessment)

    # Agent 2: LLM question selection — falls back to rule-based on any failure
    try:
        questions = await select_questions(
            pillar_id,
            persona,
            prospect.research_cache,
            db,
            infrastructure_location=prospect.infrastructure_location,
            tech_stack_description=prospect.tech_stack_description,
            current_tools=prospect.current_tools,
            prospect_corrections=prospect.prospect_corrections,
            key_challenges_input=prospect.key_challenges_input,
        )
        logger.info(
            "select_pillar: Agent 2 selected %d questions for assessment_id=%s",
            len(questions), assessment.id,
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
        assessment.id, pillar_id, persona, len(questions),
    )

    return SelectPillarOut(
        assessment_id=assessment.id,
        questions=[
            QuestionPublic(
                id=q.id,
                text=q.text,
                answer_options=[
                    AnswerOptionPublic(id=ao.id, text=ao.text, display_order=ao.display_order)
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
    prospect_id = UUID(session["prospect_id"])
    persona = session["prospect_role"]

    assessment = (
        await db.execute(
            select(Assessment)
            .options(
                selectinload(Assessment.account),
                selectinload(Assessment.prospect),
            )
            .where(Assessment.id == body.assessment_id)
        )
    ).scalar_one_or_none()
    if not assessment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assessment not found")
    if assessment.prospect_id != prospect_id:
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
    await db.flush()

    for answer in body.answers:
        db.add(
            AssessmentAnswer(
                assessment_id=body.assessment_id,
                question_id=answer.question_id,
                answer_option_id=answer.answer_option_id,
            )
        )
    await db.flush()

    answer_pairs = [(a.question_id, a.answer_option_id) for a in body.answers]
    pillar_score, maturity_level, maturity_label = await compute_pillar_score(db, answer_pairs, persona)

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

    # Capture fields before commit — ORM objects expire after commit in async SA
    acct = assessment.account
    prospect = assessment.prospect
    acct_id = acct.id
    acct_company_name = acct.company_name
    acct_company_website = acct.company_website
    prospect_research_cache = prospect.research_cache if prospect else None
    prospect_corrections = prospect.prospect_corrections if prospect else None

    assessment.status = "completed"
    assessment.completed_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(report)

    logger.info(
        "submit_assessment: assessment_id=%s score=%.2f level=%d — report_id=%s — running Agent 3",
        body.assessment_id, pillar_score, maturity_level, report.id,
    )

    narrative = await run_assessment_orchestrator(
        db=db,
        account_id=acct_id,
        prospect_id=prospect_id,
        company_name=acct_company_name,
        company_website=acct_company_website,
        persona=persona,
        pillar_name=pillar.name if pillar else "Assessment",
        assessment_id=body.assessment_id,
        pre_computed_score=pillar_score,
        pre_computed_maturity_level=maturity_level,
        pre_computed_maturity_label=maturity_label,
        company_profile=prospect_research_cache,
        prospect_corrections=prospect_corrections,
    )

    report.executive_summary = narrative.get("executive_summary", "")
    report.strengths = narrative.get("strengths", [])
    report.gap_analysis = narrative.get("gap_analysis", [])
    report.next_steps = narrative.get("next_steps", [])
    report.research_data = prospect_research_cache or {}
    await db.commit()
    await db.refresh(report)

    logger.info("submit_assessment: report narrative saved for report_id=%s", report.id)
    return SubmitOut(report_id=report.id)


async def get_report(token: str, assessment_id: UUID, db: AsyncSession) -> ReportPublicOut:
    """GET /assess/{token}/report/{assessment_id} — return completed report."""
    prospect = await _get_prospect_by_token(token, db)
    account = prospect.account

    target_assessment = (
        await db.execute(
            select(Assessment)
            .options(
                selectinload(Assessment.pillar),
                selectinload(Assessment.report),
                selectinload(Assessment.prospect),
            )
            .where(
                Assessment.id == assessment_id,
                Assessment.prospect_id == prospect.id,
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
        prospect_name=prospect.name,
        prospect_role=prospect.job_title,
    )
