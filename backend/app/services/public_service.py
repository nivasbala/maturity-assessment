"""
Public Assessment Service

Handles the unauthenticated prospect flow:
  1. GET /assess/{token}     — assessment info + available pillars (pre-fills form if already registered)
  2. POST /register          — prospect registration + session token; saves context on Prospect
  3. POST /select-pillar     — creates assessment, fires Agent 2 in background, returns assessment_id
  4. POST /confirm-research  — saves corrections on assessment, waits for Agent 2, returns questions
  5. POST /submit            — save answers, score, create report (LangGraph orchestrator)
  6. GET /report/{id}        — fetch completed report

Agent 1 fires non-blocking at prospect creation (account_service.create_prospect).
Agent 2 fires non-blocking at /select-pillar; /confirm-research awaits the result.
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
    ExistingAssessmentOut,
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

# Module-level dict of pending Agent 2 futures keyed by str(assessment_id).
# Used to pass results from background select_pillar task to confirm_research.
_agent2_futures: dict[str, asyncio.Future] = {}


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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assessment not found")
    return prospect


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


async def _run_agent2_background(
    assessment_id: UUID,
    pillar_id: UUID,
    persona: str,
    research_cache: dict | None,
    question_count: int,
    future: asyncio.Future,
    infrastructure_location: str | None = None,
    tech_stack_description: str | None = None,
    current_tools: str | None = None,
    prospect_corrections: str | None = None,
    key_challenges_input: str | None = None,
) -> None:
    """Run Agent 2 in background and resolve the future with selected questions."""
    async with AsyncSessionLocal() as db:
        try:
            questions = await select_questions(
                pillar_id,
                persona,
                research_cache,
                db,
                infrastructure_location=infrastructure_location,
                tech_stack_description=tech_stack_description,
                current_tools=current_tools,
                prospect_corrections=prospect_corrections,
                key_challenges_input=key_challenges_input,
            )
            logger.info(
                "_run_agent2_background: Agent 2 selected %d questions for assessment_id=%s",
                len(questions),
                assessment_id,
            )
            if not future.done():
                future.set_result(questions)
        except Exception:
            logger.warning(
                "_run_agent2_background: Agent 2 failed for assessment_id=%s",
                assessment_id,
                exc_info=True,
            )
            if not future.done():
                future.set_exception(RuntimeError("Agent 2 failed"))


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
    """Rule-based question selection targeting `target` questions.

    Selection order:
      1. General questions (is_general=TRUE) up to target — highest priority.
      2. Persona-eligible questions (via question_personas) up to fill remaining slots.
      3. If still short, backfill from any other active non-general questions for the pillar.

    Fallback used when Agent 2 is unavailable or times out.
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


def _questions_to_public(questions: list[Question]) -> list[QuestionPublic]:
    return [
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
    ]


# ── Service functions ─────────────────────────────────────────────────────────


async def get_assessment_info(token: str, db: AsyncSession) -> AssessmentInfoOut:
    """GET /assess/{token} — return company info and all available active pillars.

    If already registered, returns is_registered=True with saved prospect fields and
    existing assessments so the frontend can pre-populate the form and show past results.
    """
    prospect = await _get_prospect_by_token(token, db)
    account = prospect.account

    pillars = (
        await db.execute(
            select(Pillar)
            .where(Pillar.is_active.is_(True))
            .order_by(Pillar.display_order)
        )
    ).scalars().all()

    existing: list[ExistingAssessmentOut] = []
    if prospect.is_registered:
        assessments = (
            await db.execute(
                select(Assessment)
                .options(selectinload(Assessment.pillar), selectinload(Assessment.report))
                .where(Assessment.prospect_id == prospect.id)
                .order_by(Assessment.created_at.desc())
            )
        ).scalars().all()
        for a in assessments:
            report = a.report
            existing.append(ExistingAssessmentOut(
                assessment_id=a.id,
                pillar_name=a.pillar.name if a.pillar else "Unknown",
                status=a.status,
                pillar_score=float(report.pillar_score) if report else None,
                maturity_label=report.maturity_label if report else None,
                completed_at=a.completed_at,
            ))

    logger.info("get_assessment_info: token=%s account_id=%s is_registered=%s", token, account.id, prospect.is_registered)
    return AssessmentInfoOut(
        company_name=account.company_name,
        prospect_name=prospect.name,
        prospect_email=prospect.email,
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
        is_registered=prospect.is_registered,
        prospect_role=prospect.prospect_role,
        p3_gate_answered_yes=prospect.p3_gate_answered_yes,
        p4_gate_answered_yes=prospect.p4_gate_answered_yes,
        infrastructure_location=prospect.infrastructure_location,
        tech_stack_description=prospect.tech_stack_description,
        current_tools=prospect.current_tools,
        key_challenges_input=prospect.key_challenges_input,
        existing_assessments=existing,
    )


async def register_prospect(token: str, body: RegisterRequest, db: AsyncSession) -> RegisterOut:
    """POST /assess/{token}/register — register prospect, save context on Prospect, issue session token."""
    if body.prospect_role not in VALID_PERSONAS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid prospect_role. Must be one of: {', '.join(sorted(VALID_PERSONAS))}",
        )

    prospect = await _get_prospect_by_token(token, db)
    account = prospect.account

    # Save context fields on Prospect record (not Account)
    if body.prospect_name:
        prospect.name = body.prospect_name
    prospect.prospect_role = body.prospect_role
    prospect.p3_gate_answered_yes = body.p3_gate_answered_yes
    prospect.p4_gate_answered_yes = body.p4_gate_answered_yes
    prospect.infrastructure_location = body.infrastructure_location or prospect.infrastructure_location
    prospect.tech_stack_description = body.tech_stack_description or prospect.tech_stack_description
    prospect.current_tools = body.current_tools or prospect.current_tools
    prospect.key_challenges_input = body.key_challenges_input or prospect.key_challenges_input
    prospect.is_registered = True
    prospect.registered_at = datetime.now(timezone.utc)
    await db.commit()

    # Re-run Agent 1 in background with enriched prospect context if any context fields provided.
    # The first Agent 1 run at prospect creation only had company_name + company_website.
    # Registration adds infrastructure_location, tech_stack_description, current_tools,
    # key_challenges_input — re-run so these inform the research profile used by Agent 2.
    context_provided = any([
        body.infrastructure_location,
        body.tech_stack_description,
        body.current_tools,
        body.key_challenges_input,
    ])
    if context_provided:
        from app.agents.research_agent import run_research_agent_for_prospect  # noqa: PLC0415
        prospect_id_for_rerun = prospect.id
        company_name_for_rerun = account.company_name
        company_website_for_rerun = account.company_website
        infra = prospect.infrastructure_location
        tech = prospect.tech_stack_description
        tools = prospect.current_tools
        challenges = prospect.key_challenges_input

        async def _rerun_agent1() -> None:
            async with AsyncSessionLocal() as fresh_db:
                p = (await fresh_db.execute(
                    select(Prospect).where(Prospect.id == prospect_id_for_rerun)
                )).scalar_one_or_none()
                if p:
                    p.research_cache = None
                    p.research_cached_at = None
                    await fresh_db.commit()
                try:
                    await run_research_agent_for_prospect(
                        prospect_id_for_rerun,
                        company_name_for_rerun,
                        company_website_for_rerun,
                        fresh_db,
                        infrastructure_location=infra,
                        tech_stack_description=tech,
                        current_tools=tools,
                        key_challenges_input=challenges,
                    )
                    logger.info(
                        "register_prospect: Agent 1 re-run completed for prospect_id=%s",
                        prospect_id_for_rerun,
                    )
                except Exception:
                    logger.error(
                        "register_prospect: Agent 1 re-run failed for prospect_id=%s",
                        prospect_id_for_rerun,
                        exc_info=True,
                    )

        asyncio.create_task(_rerun_agent1())
        logger.info(
            "register_prospect: prospect_id=%s — context provided, Agent 1 re-run fired in background",
            prospect.id,
        )

    # Build session token payload
    session_data: dict = {
        "account_id": str(account.id),
        "prospect_id": str(prospect.id),
        "short_url_token": token,
        "prospect_name": body.prospect_name,
        "prospect_email": body.prospect_email,
        "prospect_role": body.prospect_role,
        "p3_gate": body.p3_gate_answered_yes,
        "p4_gate": body.p4_gate_answered_yes,
    }
    session_token = create_session_token(session_data)

    logger.info(
        "register_prospect: prospect_id=%s persona=%s — context saved, is_registered=True",
        prospect.id,
        body.prospect_role,
    )
    return RegisterOut(session_token=session_token)


async def get_research_summary(token: str, session: dict, db: AsyncSession) -> ResearchSummaryOut:
    """GET /assess/{token}/research-summary — poll until Agent 1 completes."""
    prospect = await _get_prospect_by_token(token, db)
    prospect_id = UUID(session["prospect_id"])
    if prospect.id != prospect_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    if not prospect.research_cache:
        anchor = prospect.research_started_at or prospect.created_at
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
            industry="",
            company_size="",
            products_summary="",
            target_customers="",
            builds_ai_products=False,
            cloud_providers=[],
            key_challenges=[],
            business_outcomes=[],
            operational_scale=[],
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


async def select_pillar(
    token: str,
    session: dict,
    pillar_id: UUID,
    db: AsyncSession,
) -> SelectPillarOut:
    """POST /assess/{token}/select-pillar — validate gate, create assessment, fire Agent 2 in background.

    Non-blocking: returns {assessment_id} immediately. Agent 2 runs in background.
    /confirm-research awaits Agent 2 and returns questions.
    """
    pillar = (
        await db.execute(select(Pillar).where(Pillar.id == pillar_id))
    ).scalar_one_or_none()
    if not pillar:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pillar not found")

    _validate_pillar_gate(pillar, session)

    account_id = UUID(session["account_id"])
    prospect_id = UUID(session["prospect_id"])
    persona = session["prospect_role"]

    # Find or create assessment for this prospect + pillar
    existing = (
        await db.execute(
            select(Assessment).where(
                Assessment.account_id == account_id,
                Assessment.prospect_id == prospect_id,
                Assessment.pillar_id == pillar_id,
            )
        )
    ).scalar_one_or_none()

    if existing:
        assessment = existing
        assessment.status = "in_progress"
    else:
        new_token = await _ensure_unique_token(db)
        assessment = Assessment(
            account_id=account_id,
            prospect_id=prospect_id,
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
        assessment = (
            await db.execute(
                select(Assessment).where(
                    Assessment.account_id == account_id,
                    Assessment.prospect_id == prospect_id,
                    Assessment.pillar_id == pillar_id,
                )
            )
        ).scalar_one_or_none()
        if not assessment:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Assessment conflict — please try again.",
            )
        assessment.status = "in_progress"
        await db.commit()
        await db.refresh(assessment)

    # Load prospect context for Agent 2
    prospect = (
        await db.execute(select(Prospect).where(Prospect.id == prospect_id))
    ).scalar_one_or_none()
    if not prospect:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prospect not found")

    # Fire Agent 2 in background — create a future for confirm_research to await
    loop = asyncio.get_running_loop()
    future: asyncio.Future = loop.create_future()
    _agent2_futures[str(assessment.id)] = future
    # Suppress "Future exception was never retrieved" if confirm_research times out
    # before Agent 2 completes — the exception is handled by the fallback path.
    def _ack_future(f: asyncio.Future) -> None:
        if not f.cancelled():
            try:
                f.exception()
            except Exception:
                pass

    future.add_done_callback(_ack_future)

    asyncio.create_task(
        _run_agent2_background(
            assessment.id,
            pillar_id,
            persona,
            prospect.research_cache,
            pillar.question_count,
            future,
            infrastructure_location=prospect.infrastructure_location,
            tech_stack_description=prospect.tech_stack_description,
            current_tools=prospect.current_tools,
            key_challenges_input=prospect.key_challenges_input,
        )
    )

    logger.info(
        "select_pillar: assessment_id=%s pillar=%s persona=%s — Agent 2 fired in background",
        assessment.id,
        pillar_id,
        persona,
    )

    return SelectPillarOut(assessment_id=assessment.id)


async def confirm_research(
    token: str,
    session: dict,
    body: ConfirmResearchRequest,
    db: AsyncSession,
) -> ConfirmResearchOut:
    """POST /assess/{token}/confirm-research — save corrections on assessment, await Agent 2, return questions."""
    prospect = await _get_prospect_by_token(token, db)
    prospect_id = UUID(session["prospect_id"])
    if prospect.id != prospect_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Load the assessment created by select_pillar
    assessment = (
        await db.execute(
            select(Assessment)
            .options(selectinload(Assessment.pillar))
            .where(
                Assessment.id == body.assessment_id,
                Assessment.prospect_id == prospect_id,
            )
        )
    ).scalar_one_or_none()
    if not assessment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assessment not found")

    # Save corrections and confirmation timestamp on the assessment record
    assessment.research_confirmed_at = datetime.now(timezone.utc)
    if body.corrections and body.corrections.strip():
        assessment.prospect_corrections = body.corrections.strip()
        logger.info("confirm_research: corrections saved for assessment_id=%s", assessment.id)
    await db.commit()

    logger.info("confirm_research: confirmed for assessment_id=%s — awaiting Agent 2", assessment.id)

    # Await Agent 2 future (30s timeout — fallback to rule-based on timeout or error)
    pillar = assessment.pillar
    target = pillar.question_count if pillar else 12
    persona = session["prospect_role"]

    future = _agent2_futures.pop(str(assessment.id), None)
    questions: list = []
    if future is not None:
        try:
            questions = await asyncio.wait_for(asyncio.shield(future), timeout=30.0)
            logger.info(
                "confirm_research: Agent 2 returned %d questions for assessment_id=%s",
                len(questions),
                assessment.id,
            )
        except (asyncio.TimeoutError, Exception):
            logger.warning(
                "confirm_research: Agent 2 timed out or failed for assessment_id=%s — using fallback",
                assessment.id,
                exc_info=True,
            )
            questions = await _select_questions_fallback(db, assessment.pillar_id, persona, target=target)
    else:
        logger.warning(
            "confirm_research: no Agent 2 future found for assessment_id=%s — using fallback",
            assessment.id,
        )
        questions = await _select_questions_fallback(db, assessment.pillar_id, persona, target=target)

    return ConfirmResearchOut(
        confirmed=True,
        questions=_questions_to_public(questions),
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
    await db.flush()

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
    pillar_score, maturity_level, maturity_label, pillar_breakdown = await compute_pillar_score(db, answer_pairs, persona)

    # Create or update report record
    existing_report = (
        await db.execute(select(Report).where(Report.assessment_id == body.assessment_id))
    ).scalar_one_or_none()

    if existing_report:
        existing_report.pillar_score = pillar_score
        existing_report.maturity_level = maturity_level
        existing_report.maturity_label = maturity_label
        existing_report.pillar_breakdown = pillar_breakdown
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
            pillar_breakdown=pillar_breakdown,
        )
        db.add(report)

    # Capture account fields before commit — db.commit() expires all ORM objects
    acct = assessment.account
    acct_id = acct.id
    acct_company_name = acct.company_name
    acct_company_website = acct.company_website
    acct_research_cache = acct.research_cache

    # Load prospect_corrections from assessment record (saved at confirm_research)
    acct_prospect_corrections = assessment.prospect_corrections

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

    # Update report with LLM narrative
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
    prospect = await _get_prospect_by_token(token, db)
    account = prospect.account

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
