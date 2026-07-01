"""
Question Selection Agent (Agent 2)

LLM-based agent that selects the most diagnostic questions for a prospect.
Runs synchronously at /select-pillar time (~3–8 seconds).

Architecture (05-architecture-api.md §1.3):
  - Input: prospect persona, pillar context, research_cache from Agent 1,
    candidate question list (general + persona-eligible) with id/text/context_tags
  - LLM selects question_count IDs ordered for maximum diagnostic value
  - Falls back: caller (public_service) catches any exception and uses rule-based fallback

The assessment always proceeds. Agent 2 is an enhancement, not a dependency.
"""
from __future__ import annotations

import json
import logging
from typing import Any
from uuid import UUID

from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.llm_factory import get_llm
from app.models.pillar import Pillar
from app.models.question import Question, QuestionPersona

logger = logging.getLogger(__name__)

_PERSONA_LABELS: dict[str, str] = {
    "cto_executive": "CTO / C-Suite Executive",
    "vp_engineering": "VP Engineering / Director of Engineering",
    "ciso_vp_security": "CISO / VP Security",
    "sre_platform_engineer": "SRE / Platform Engineer",
    "devops_engineer": "DevOps Engineer",
    "ml_ai_engineer": "ML Engineer / AI Engineer / Data Scientist",
    "security_engineer": "Security Engineer / AppSec",
    "software_developer": "Software Developer / Software Engineer",
}

_SYSTEM_PROMPT = """\
You are a technical assessment expert helping to personalize a maturity assessment \
for a specific company and role.

You will receive:
1. Prospect role: {persona_label}
2. Assessment pillar: {pillar_name}
   Description: {pillar_description}
3. Company research context:
{research_summary}

4. Candidate questions (JSON):
{candidate_questions_json}

Each question has: "id", "text", "is_general", "context_tags"

Your task: Select exactly {question_count} questions that best assess this prospect's \
maturity in {pillar_name}.

MANDATORY RULES:
- Include ALL questions where "is_general" is true — no exceptions
- Select remaining questions ONLY from the provided list — never invent questions
- Return exactly {question_count} question IDs total

When research is available, prefer questions whose context_tags match the company's \
technology stack, cloud providers, and industry. Prioritize questions that address \
the specific challenges and business outcomes in the research.

When research is empty, select the most broadly diagnostic questions for a \
{persona_label} in this pillar.

Return ONLY a valid JSON array of exactly {question_count} question IDs in \
presentation order. No explanation, no markdown, no preamble — just the array:
["uuid-1", "uuid-2", ...]"""


def _build_research_summary(research_cache: dict[str, Any] | None) -> str:
    if not research_cache:
        return "No research data available."
    parts: list[str] = []
    if research_cache.get("industry"):
        parts.append(f"Industry: {research_cache['industry']}")
    if research_cache.get("products_summary"):
        parts.append(f"Products: {research_cache['products_summary']}")
    signals = research_cache.get("technology_signals") or []
    if signals:
        parts.append(f"Technology signals: {', '.join(signals)}")
    clouds = research_cache.get("cloud_providers") or []
    if clouds:
        parts.append(f"Cloud providers: {', '.join(clouds)}")
    challenges = research_cache.get("key_challenges") or []
    if challenges:
        parts.append(f"Key challenges: {', '.join(challenges)}")
    outcomes = research_cache.get("business_outcomes") or []
    if outcomes:
        parts.append(f"Business outcomes: {', '.join(outcomes)}")
    return "\n".join(parts) if parts else "No research data available."


async def select_questions(
    pillar_id: UUID,
    persona: str,
    research_cache: dict[str, Any] | None,
    db: AsyncSession,
) -> list[Question]:
    """Return question_count questions for the given pillar and persona.

    Raises an exception if the LLM call fails or returns invalid output — the
    calling service (public_service.select_pillar) is responsible for falling back
    to rule-based selection.

    Args:
        pillar_id: UUID of the selected pillar.
        persona: Prospect's role string (must match persona enum).
        research_cache: Parsed accounts.research_cache JSONB, or None if not ready.
        db: Async SQLAlchemy session.

    Returns:
        Ordered list of Question ORM objects (eager-loaded with answer_options + personas).
    """
    pillar = (
        await db.execute(select(Pillar).where(Pillar.id == pillar_id))
    ).scalar_one_or_none()
    if not pillar:
        raise ValueError(f"Pillar {pillar_id} not found")

    question_count: int = pillar.question_count

    # Fetch general questions
    general_qs: list[Question] = (
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

    # Fetch persona-eligible questions
    persona_qs: list[Question] = (
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

    all_candidates = list(general_qs) + [
        q for q in persona_qs if q.id not in {g.id for g in general_qs}
    ]

    if not all_candidates:
        raise ValueError(f"No candidate questions found for pillar={pillar_id} persona={persona}")

    # Build candidate list for the prompt
    candidate_list = [
        {
            "id": str(q.id),
            "text": q.text,
            "is_general": q.is_general,
            "context_tags": q.context_tags or [],
        }
        for q in all_candidates
    ]

    persona_label = _PERSONA_LABELS.get(persona, persona)
    research_summary = _build_research_summary(research_cache)

    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", _SYSTEM_PROMPT),
            ("human", "Select the {question_count} most diagnostic questions now."),
        ]
    )
    chain = prompt | get_llm() | StrOutputParser()
    raw = await chain.ainvoke(
        {
            "persona_label": persona_label,
            "pillar_name": pillar.name,
            "pillar_description": pillar.description,
            "research_summary": research_summary,
            "candidate_questions_json": json.dumps(candidate_list, indent=2),
            "question_count": question_count,
        }
    )

    # Parse and validate
    raw = raw.strip()
    if raw.startswith("```"):
        lines = raw.split("\n")
        raw = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:]).strip()

    selected_ids: list[str] = json.loads(raw)
    if not isinstance(selected_ids, list):
        raise ValueError("Agent 2 response is not a list")

    valid_ids = {str(q.id) for q in all_candidates}
    filtered_ids = [qid for qid in selected_ids if qid in valid_ids]

    if len(filtered_ids) != question_count:
        raise ValueError(
            f"Agent 2 returned {len(filtered_ids)} valid IDs, expected {question_count}"
        )

    # Return questions in the LLM-selected order
    id_to_question = {str(q.id): q for q in all_candidates}
    ordered = [id_to_question[qid] for qid in filtered_ids]

    logger.info(
        "select_questions: pillar=%s persona=%s selected=%d via LLM",
        pillar_id,
        persona,
        len(ordered),
    )
    return ordered
