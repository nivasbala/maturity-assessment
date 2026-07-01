"""
LangGraph Orchestrator — runs at /submit time only.

Pipeline: research_node → compute_score_node → generate_report_node → END

research_node:
  Reads accounts.research_cache. Agent 1 already fired at /register; only
  re-runs Agent 1 if cache is NULL (edge case: prospect submitted before
  background task completed).

compute_score_node:
  Score is pre-computed synchronously in public_service.submit_assessment
  before the orchestrator is called. This node passes through the pre-computed
  values into state so generate_report_node can consume them.

generate_report_node:
  Fetches answer context (question text + selected answer text) from DB,
  then calls Agent 3 (report_agent.run_report_agent).

Error handling: each node catches exceptions, logs, and returns partial state.
  - research_node failure → company_profile = {}; pipeline continues
  - generate_report_node failure → narrative fields remain empty; score survives
"""
from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from langgraph.graph import END, StateGraph
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from typing_extensions import TypedDict

from app.agents.report_agent import run_report_agent
from app.agents.research_agent import run_research_agent
from app.core.database import AsyncSessionLocal
from app.models.account import Account
from app.models.assessment import AssessmentAnswer
from app.models.question import AnswerOption, Question

logger = logging.getLogger(__name__)


class AssessmentReportState(TypedDict):
    # ── Inputs (provided before graph runs) ──────────────────────────────────
    account_id: str
    company_name: str
    company_website: str | None
    persona: str
    pillar_name: str
    pre_computed_score: float
    pre_computed_maturity_level: int
    pre_computed_maturity_label: str
    assessment_id: str
    prospect_corrections: str | None

    # ── Set by research_node ─────────────────────────────────────────────────
    company_profile: dict[str, Any] | None

    # ── Set by compute_score_node ────────────────────────────────────────────
    pillar_score: float
    maturity_level: int
    maturity_label: str

    # ── Set by generate_report_node ──────────────────────────────────────────
    executive_summary: str
    strengths: list[dict[str, Any]]
    gap_analysis: list[dict[str, Any]]
    next_steps: list[dict[str, Any]]

    # ── Error tracking ───────────────────────────────────────────────────────
    error: str | None


def _build_graph(db: AsyncSession) -> Any:
    """Build and compile the LangGraph StateGraph with DB session captured."""

    async def research_node(state: AssessmentReportState) -> dict[str, Any]:
        # company_profile is pre-populated from submit_assessment.
        # None = research_cache was NULL (Agent 1 still running) → re-run.
        # {} = Agent 1 ran but returned empty profile → skip re-run.
        if state.get("company_profile") is not None:
            logger.info("orchestrator research_node: using pre-fetched profile")
            return {}

        # Edge case: prospect submitted before Agent 1 background task completed.
        # Re-run Agent 1 using a fresh session — must NOT commit on the orchestrator's
        # shared db session since generate_report_node still needs to read from it.
        account_id = UUID(state["account_id"])
        logger.warning(
            "orchestrator research_node: no cached profile for account_id=%s — re-running Agent 1",
            account_id,
        )
        try:
            async with AsyncSessionLocal() as fresh_db:
                acct = (
                    await fresh_db.execute(select(Account).where(Account.id == account_id))
                ).scalar_one_or_none()
                profile = await run_research_agent(
                    account_id,
                    state["company_name"],
                    state.get("company_website"),
                    fresh_db,
                    infrastructure_location=acct.infrastructure_location if acct else None,
                    tech_stack_description=acct.tech_stack_description if acct else None,
                    current_tools=acct.current_tools if acct else None,
                    key_challenges_input=acct.key_challenges_input if acct else None,
                )
            return {"company_profile": profile}
        except Exception:
            logger.error(
                "orchestrator research_node: Agent 1 re-run failed for account_id=%s — continuing with empty profile",
                account_id,
                exc_info=True,
            )
            return {"company_profile": {}}

    async def compute_score_node(state: AssessmentReportState) -> dict[str, Any]:
        # Score was pre-computed synchronously in submit_assessment before the orchestrator ran.
        # Pass through into state fields consumed by generate_report_node.
        return {
            "pillar_score": state["pre_computed_score"],
            "maturity_level": state["pre_computed_maturity_level"],
            "maturity_label": state["pre_computed_maturity_label"],
        }

    async def generate_report_node(state: AssessmentReportState) -> dict[str, Any]:
        assessment_id = UUID(state["assessment_id"])
        try:
            # Fetch answer context (question text + selected answer text)
            raw_answers = (
                await db.execute(
                    select(AssessmentAnswer)
                    .options(
                        selectinload(AssessmentAnswer.question),
                        selectinload(AssessmentAnswer.answer_option),
                    )
                    .where(AssessmentAnswer.assessment_id == assessment_id)
                )
            ).scalars().all()

            answers_with_context = [
                {
                    "question_text": aa.question.text,
                    "answer_text": aa.answer_option.text,
                    "maturity_level": aa.answer_option.maturity_level,
                }
                for aa in raw_answers
                if aa.question and aa.answer_option
            ]

            narrative = await run_report_agent(
                company_profile=state.get("company_profile") or {},
                answers_with_context=answers_with_context,
                pillar_name=state["pillar_name"],
                score=state["pillar_score"],
                maturity_label=state["maturity_label"],
                persona=state["persona"],
                company_name=state["company_name"],
                prospect_corrections=state.get("prospect_corrections"),
            )
            return {
                "executive_summary": narrative.get("executive_summary", ""),
                "strengths": narrative.get("strengths", []),
                "gap_analysis": narrative.get("gap_analysis", []),
                "next_steps": narrative.get("next_steps", []),
            }

        except Exception:
            logger.error(
                "orchestrator generate_report_node: failed for assessment_id=%s",
                assessment_id,
                exc_info=True,
            )
            return {
                "executive_summary": "",
                "strengths": [],
                "gap_analysis": [],
                "next_steps": [],
                "error": "Report generation failed",
            }

    graph = StateGraph(AssessmentReportState)
    graph.add_node("research_node", research_node)
    graph.add_node("compute_score_node", compute_score_node)
    graph.add_node("generate_report_node", generate_report_node)

    graph.set_entry_point("research_node")
    graph.add_edge("research_node", "compute_score_node")
    graph.add_edge("compute_score_node", "generate_report_node")
    graph.add_edge("generate_report_node", END)

    return graph.compile()


async def run_assessment_orchestrator(
    db: AsyncSession,
    account_id: UUID,
    company_name: str,
    company_website: str | None,
    persona: str,
    pillar_name: str,
    assessment_id: UUID,
    pre_computed_score: float,
    pre_computed_maturity_level: int,
    pre_computed_maturity_label: str,
    company_profile: dict[str, Any] | None = None,
    prospect_corrections: str | None = None,
) -> dict[str, Any]:
    """Run the report generation pipeline and return the narrative fields.

    Returns a dict with: executive_summary, strengths, gap_analysis, next_steps.
    On total failure, returns empty values so the score record is always preserved.
    """
    initial_state: AssessmentReportState = {
        "account_id": str(account_id),
        "company_name": company_name,
        "company_website": company_website,
        "persona": persona,
        "pillar_name": pillar_name,
        "assessment_id": str(assessment_id),
        "pre_computed_score": pre_computed_score,
        "pre_computed_maturity_level": pre_computed_maturity_level,
        "pre_computed_maturity_label": pre_computed_maturity_label,
        # Filled by nodes (or pre-populated from submit_assessment):
        # None = research_cache was NULL; {} = cache exists but empty. research_node checks is not None.
        "company_profile": company_profile,
        "pillar_score": pre_computed_score,
        "maturity_level": pre_computed_maturity_level,
        "maturity_label": pre_computed_maturity_label,
        "executive_summary": "",
        "strengths": [],
        "gap_analysis": [],
        "next_steps": [],
        "prospect_corrections": prospect_corrections,
        "error": None,
    }

    try:
        compiled = _build_graph(db)
        final_state = await compiled.ainvoke(initial_state)
        logger.info(
            "run_assessment_orchestrator: completed for assessment_id=%s", assessment_id
        )
        return {
            "executive_summary": final_state.get("executive_summary", ""),
            "strengths": final_state.get("strengths", []),
            "gap_analysis": final_state.get("gap_analysis", []),
            "next_steps": final_state.get("next_steps", []),
        }
    except Exception:
        logger.error(
            "run_assessment_orchestrator: pipeline failed for assessment_id=%s",
            assessment_id,
            exc_info=True,
        )
        return {
            "executive_summary": "",
            "strengths": [],
            "gap_analysis": [],
            "next_steps": [],
        }
