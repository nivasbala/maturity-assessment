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
1. Prospect role: {persona_label} — {persona_description}
2. Assessment pillar: {pillar_name}
   Description: {pillar_description}
3. Company research profile (from Agent 1):
{research_summary}

4. Prospect-provided context (direct input — treat as primary signal):
   Infrastructure & deployment: {infrastructure_location}
   Tech stack description:      {tech_stack_description}
   Current tools:               {current_tools}
   Key challenges they stated:  {key_challenges_input}
   Research corrections:        {prospect_corrections}
   (Empty fields above were not provided by the prospect)

5. Candidate questions (JSON):
{candidate_questions_json}

Each question has: "id", "text", "is_general", "context_tags"

Your task: Select exactly {question_count} questions that best assess this \
prospect's maturity in {pillar_name}.

MANDATORY RULES:
- Include ALL {general_count} questions where "is_general" is true — no exceptions
- Select exactly {persona_count} remaining questions from persona-eligible candidates only
- Total must be exactly {question_count} ({general_count} general + {persona_count} persona-specific)
- ONLY select from the provided question IDs — never invent questions

SELECTION GUIDANCE:
Use the prospect's directly stated tech stack and tools (Input 4) as the \
primary signal — these are more accurate than any inferred data.
Match questions whose context_tags align with technologies explicitly mentioned \
in tech_stack_description or current_tools.
Use the research profile (Input 3) for business context: prioritize questions \
that address key_challenges, operational_scale, and business_outcomes.
If data_confidence is "low", weight the pillar and persona more than company context.
If prospect_corrections are present, use them to override any conflicting research.

Return ONLY a valid JSON array of exactly {question_count} question IDs in \
presentation order. No explanation, no markdown, no preamble:
["uuid-1", "uuid-2", ...]"""


_PERSONA_DESCRIPTIONS: dict[str, str] = {
    "cto_executive": "Sets technology strategy and investment priorities",
    "vp_engineering": "Leads engineering teams and delivery processes",
    "ciso_vp_security": "Owns security posture and compliance",
    "sre_platform_engineer": "Builds and operates production reliability infrastructure",
    "devops_engineer": "Manages CI/CD pipelines and deployment automation",
    "ml_ai_engineer": "Builds and deploys ML models and AI systems",
    "security_engineer": "Implements application security controls",
    "software_developer": "Writes and ships application code",
}


def _build_research_summary(research_cache: dict[str, Any] | None) -> str:
    if not research_cache:
        return "No research data available."
    parts: list[str] = []
    if research_cache.get("industry"):
        parts.append(f"Industry: {research_cache['industry']}")
    if research_cache.get("company_size"):
        parts.append(f"Company size: {research_cache['company_size']}")
    if research_cache.get("products_summary"):
        parts.append(f"Products: {research_cache['products_summary']}")
    if research_cache.get("target_customers"):
        parts.append(f"Target customers: {research_cache['target_customers']}")
    clouds = research_cache.get("cloud_providers") or []
    if clouds:
        parts.append(f"Cloud providers: {', '.join(clouds)}")
    challenges = research_cache.get("key_challenges") or []
    if challenges:
        parts.append(f"Key challenges: {'; '.join(challenges)}")
    outcomes = research_cache.get("business_outcomes") or []
    if outcomes:
        parts.append(f"Business outcomes: {'; '.join(outcomes)}")
    scale = research_cache.get("operational_scale") or []
    if scale:
        parts.append(f"Operational scale: {'; '.join(scale)}")
    confidence = research_cache.get("data_confidence", "low")
    parts.append(f"Data confidence: {confidence}")
    return "\n".join(parts) if parts else "No research data available."


async def select_questions(
    pillar_id: UUID,
    persona: str,
    research_cache: dict[str, Any] | None,
    db: AsyncSession,
    infrastructure_location: str | None = None,
    tech_stack_description: str | None = None,
    current_tools: str | None = None,
    prospect_corrections: str | None = None,
    key_challenges_input: str | None = None,
) -> list[Question]:
    """Return question_count questions for the given pillar and persona.

    Raises an exception if the LLM call fails or returns invalid output — the
    calling service (public_service.select_pillar) is responsible for falling back
    to rule-based selection.

    Args:
        pillar_id: UUID of the selected pillar.
        persona: Prospect's role string (must match persona enum).
        research_cache: Parsed accounts.research_cache JSONB (Input 1), or None.
        db: Async SQLAlchemy session.
        infrastructure_location: Prospect-provided infra context (Input 2).
        tech_stack_description: Prospect-provided tech stack description (Input 2).
        current_tools: Prospect-provided current toolset (Input 2).
        prospect_corrections: Corrections entered at research summary step (Input 2).

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

    general_count = len(general_qs)
    persona_count = max(0, question_count - general_count)

    persona_label = _PERSONA_LABELS.get(persona, persona)
    persona_description = _PERSONA_DESCRIPTIONS.get(persona, "")
    research_summary = _build_research_summary(research_cache)

    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", _SYSTEM_PROMPT),
            ("human", "Select the {question_count} most diagnostic questions now."),
        ]
    )
    chain = prompt | get_llm(json_mode=True) | StrOutputParser()
    raw = await chain.ainvoke(
        {
            "persona_label": persona_label,
            "persona_description": persona_description,
            "pillar_name": pillar.name,
            "pillar_description": pillar.description,
            "research_summary": research_summary,
            "infrastructure_location": infrastructure_location or "(not provided)",
            "tech_stack_description": tech_stack_description or "(not provided)",
            "current_tools": current_tools or "(not provided)",
            "key_challenges_input": key_challenges_input or "(not provided)",
            "prospect_corrections": prospect_corrections or "(none)",
            "candidate_questions_json": json.dumps(candidate_list, indent=2),
            "question_count": question_count,
            "general_count": general_count,
            "persona_count": persona_count,
        }
    )

    # Parse and validate — extract the first balanced JSON array from the response,
    # handling prose preamble and trailing content that local models sometimes emit.
    from app.core.json_utils import extract_json_array  # noqa: PLC0415

    raw = extract_json_array(raw.strip())
    selected_ids: list[str] = json.loads(raw)
    if not isinstance(selected_ids, list):
        raise ValueError("Agent 2 response is not a list")

    valid_ids = {str(q.id) for q in all_candidates}
    seen_ids: set[str] = set()
    filtered_ids: list[str] = []
    for qid in selected_ids:
        if qid in valid_ids and qid not in seen_ids:
            seen_ids.add(qid)
            filtered_ids.append(qid)

    if len(filtered_ids) != question_count:
        raise ValueError(
            f"Agent 2 returned {len(filtered_ids)} valid IDs, expected {question_count}"
        )

    # Return questions in the LLM-selected order
    id_to_question = {str(q.id): q for q in all_candidates}
    ordered = [id_to_question[qid] for qid in filtered_ids]

    logger.info(
        "select_questions: pillar=%s selected=%d via LLM",
        pillar_id,
        len(ordered),
    )
    return ordered
