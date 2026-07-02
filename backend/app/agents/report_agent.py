"""
Agent 3: Report Agent

Generates the narrative maturity report from pre-computed score + research context.
Called by the LangGraph orchestrator at /submit time.

Output conforms to the JSONB schemas in spec/04-data-model.md Section 4:
  - executive_summary: string (3-4 paragraphs)
  - strengths: [{title, description}]           — 2-4 items
  - gap_analysis: [{gap, current_state, target_state, impact, effort}]  — 3-6 items
  - next_steps: [{title, description, priority, timeframe}]             — 4-6 items
"""
from __future__ import annotations

import json
import logging
from typing import Any

from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate

from app.core.llm_factory import get_llm

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """\
You are a technology maturity expert helping organizations understand their \
current capabilities and identify improvement opportunities.

You will receive:
1. A company profile (from research)
2. Assessment answers from a {persona} at {company_name}
3. The pillar being assessed: {pillar_name}
4. Pre-computed maturity score: {score}/4.0 ({maturity_label})

Generate a professional maturity report. Be specific, constructive, and \
grounded in the actual answers provided. Do NOT mention Datadog or any \
specific vendor by name. Frame recommendations as capabilities and outcomes.

Return ONLY valid JSON with this exact structure, no preamble, no markdown:
{{
  "executive_summary": string,
  "strengths": [
    {{"title": string, "description": string}}
  ],
  "gap_analysis": [
    {{
      "gap": string,
      "current_state": string,
      "target_state": string,
      "impact": "high" | "medium" | "low",
      "effort": "high" | "medium" | "low"
    }}
  ],
  "next_steps": [
    {{
      "title": string,
      "description": string,
      "priority": "quick_win" | "strategic" | "foundational",
      "timeframe": "0-30 days" | "1-3 months" | "3-6 months" | "6+ months"
    }}
  ]
}}

Constraints:
- executive_summary: 3-4 paragraphs, acknowledge company context from research
- strengths: 2-4 items based on high-scoring answers
- gap_analysis: 3-6 items, ordered by impact (high first)
- next_steps: 4-6 items, mix of quick wins and strategic investments
- Never mention specific vendor product names
- Keep language accessible to the persona level ({persona})"""


def _format_company_context(
    company_profile: dict[str, Any],
    prospect_additional_notes: str | None = None,
) -> str:
    if not company_profile:
        return "No company research available."
    parts: list[str] = []
    if company_profile.get("industry"):
        parts.append(f"Industry: {company_profile['industry']}")
    if company_profile.get("company_size"):
        parts.append(f"Size: {company_profile['company_size']}")
    if company_profile.get("products_summary"):
        parts.append(f"Products: {company_profile['products_summary']}")
    if company_profile.get("target_customers"):
        parts.append(f"Target customers: {company_profile['target_customers']}")
    outcomes = company_profile.get("business_outcomes") or []
    if outcomes:
        parts.append(f"Business outcomes: {', '.join(outcomes)}")
    scale = company_profile.get("operational_scale") or []
    if scale:
        parts.append(f"Operational scale: {', '.join(scale)}")
    if prospect_additional_notes:
        parts.append(f"Additional notes from prospect: {prospect_additional_notes}")
    return "\n".join(parts) if parts else "No company research available."


def _format_answers(answers_with_context: list[dict[str, Any]]) -> str:
    if not answers_with_context:
        return "No answers provided."
    lines: list[str] = []
    for i, a in enumerate(answers_with_context, 1):
        lines.append(
            f"{i}. Q: {a.get('question_text', '')}\n"
            f"   A: {a.get('answer_text', '')} (Level {a.get('maturity_level', '?')})"
        )
    return "\n".join(lines)


from app.core.json_utils import extract_json_object as _extract_json_object


async def run_report_agent(
    company_profile: dict[str, Any],
    answers_with_context: list[dict[str, Any]],
    pillar_name: str,
    score: float,
    maturity_label: str,
    persona: str,
    company_name: str,
    prospect_additional_notes: str | None = None,
) -> dict[str, Any]:
    """Generate a maturity report narrative via LLM.

    Args:
        company_profile: Agent 1 research output (may be empty dict on failure).
        answers_with_context: List of {question_text, answer_text, maturity_level}.
        pillar_name: Name of the assessed pillar.
        score: Pre-computed pillar score (1.00–4.00).
        maturity_label: 'Reactive' | 'Developing' | 'Defined' | 'Optimized'.
        persona: Prospect's role string.
        company_name: Company name for personalisation.

    Returns:
        Dict with executive_summary, strengths, gap_analysis, next_steps.

    Raises:
        Exception on LLM failure — caller (orchestrator) catches and logs.
    """
    company_context = _format_company_context(company_profile, prospect_additional_notes)
    formatted_answers = _format_answers(answers_with_context)

    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", _SYSTEM_PROMPT),
            (
                "human",
                "Company profile:\n{company_context}\n\n"
                "Assessment answers:\n{formatted_answers}\n\n"
                "Generate the report JSON now.",
            ),
        ]
    )
    chain = prompt | get_llm(json_mode=True) | StrOutputParser()
    raw = await chain.ainvoke(
        {
            "persona": persona,
            "company_name": company_name,
            "pillar_name": pillar_name,
            "score": f"{score:.2f}",
            "maturity_label": maturity_label,
            "company_context": company_context,
            "formatted_answers": formatted_answers,
        }
    )

    result = json.loads(_extract_json_object(raw))

    # Enforce cardinality constraints from spec
    strengths = result.get("strengths") or []
    gap_analysis = result.get("gap_analysis") or []
    next_steps = result.get("next_steps") or []

    if not (2 <= len(strengths) <= 4):
        logger.warning(
            "run_report_agent: strengths count=%d outside 2-4 range", len(strengths)
        )
    if not (3 <= len(gap_analysis) <= 6):
        logger.warning(
            "run_report_agent: gap_analysis count=%d outside 3-6 range", len(gap_analysis)
        )
    if not (4 <= len(next_steps) <= 6):
        logger.warning(
            "run_report_agent: next_steps count=%d outside 4-6 range", len(next_steps)
        )

    logger.info(
        "run_report_agent: completed pillar=%s score=%.2f strengths=%d gaps=%d steps=%d",
        pillar_name,
        score,
        len(strengths),
        len(gap_analysis),
        len(next_steps),
    )

    return {
        "executive_summary": result.get("executive_summary", ""),
        "strengths": strengths,
        "gap_analysis": gap_analysis,
        "next_steps": next_steps,
    }
