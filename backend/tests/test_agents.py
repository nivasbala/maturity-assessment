"""
Unit tests for LLM agents (Task 9).

All tests mock the LLM and DB to run without a live database or network.
Tests cover: prompt construction, output parsing, fallback logic, cache
behavior, and the orchestrator pipeline.
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_uuid() -> str:
    return str(uuid.uuid4())


def _mock_question(
    q_id: str | None = None,
    is_general: bool = False,
    context_tags: list[str] | None = None,
    display_order: int = 1,
) -> MagicMock:
    q = MagicMock()
    q.id = uuid.UUID(q_id) if q_id else uuid.uuid4()
    q.text = f"Question {display_order}"
    q.is_general = is_general
    q.is_active = True
    q.context_tags = context_tags or []
    q.display_order = display_order
    q.question_weight = 1.0
    q.answer_options = []
    q.personas = []
    return q


# ── research_agent ────────────────────────────────────────────────────────────

class TestResearchAgent:
    """Tests for run_research_agent_for_prospect (Agent 1)."""

    @pytest.mark.asyncio
    async def test_cache_hit_skips_llm(self):
        """Fresh cache should be returned immediately without calling LLM."""
        from app.agents.research_agent import run_research_agent_for_prospect

        prospect_id = uuid.uuid4()
        cached_profile = {"company_name": "Acme", "industry": "SaaS"}

        mock_prospect = MagicMock()
        mock_prospect.research_cache = cached_profile
        mock_prospect.research_cached_at = datetime.now(timezone.utc) - timedelta(days=1)

        mock_execute_result = MagicMock()
        mock_execute_result.scalar_one_or_none.return_value = mock_prospect

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=mock_execute_result)

        with patch("app.agents.research_agent.get_research_agent_llm") as mock_llm:
            result = await run_research_agent_for_prospect(prospect_id, "Acme", "acme.com", mock_db)

        assert result == cached_profile
        mock_llm.assert_not_called()

    def test_stale_cache_should_refresh(self):
        """_should_refresh returns True for cache older than 7 days."""
        from app.agents.research_agent import _should_refresh

        mock_account = MagicMock()
        mock_account.research_cache = {"company_name": "Acme"}
        mock_account.research_cached_at = datetime.now(timezone.utc) - timedelta(days=8)

        assert _should_refresh(mock_account) is True

    def test_7_day_boundary_refreshes(self):
        """Cache over 7 days triggers refresh; under 7 days does not."""
        from app.agents.research_agent import _should_refresh

        mock_account = MagicMock()
        mock_account.research_cache = {"company_name": "Acme"}

        # Well under 7 days (6 days): should NOT refresh
        mock_account.research_cached_at = datetime.now(timezone.utc) - timedelta(days=6)
        assert _should_refresh(mock_account) is False

        # Over 7 days (8 days): should refresh
        mock_account.research_cached_at = datetime.now(timezone.utc) - timedelta(days=8)
        assert _should_refresh(mock_account) is True

    @pytest.mark.asyncio
    async def test_null_cache_triggers_research(self):
        """NULL cache should always trigger Agent 1 research."""
        from app.agents.research_agent import _should_refresh

        mock_account = MagicMock()
        mock_account.research_cache = None
        mock_account.research_cached_at = None

        assert _should_refresh(mock_account) is True

    @pytest.mark.asyncio
    async def test_fresh_cache_not_refreshed(self):
        """Cache within 7 days should not refresh."""
        from app.agents.research_agent import _should_refresh

        mock_account = MagicMock()
        mock_account.research_cache = {"company_name": "Acme"}
        mock_account.research_cached_at = datetime.now(timezone.utc) - timedelta(days=3)

        assert _should_refresh(mock_account) is False

    @pytest.mark.asyncio
    async def test_prospect_not_found_returns_minimal_profile(self):
        """Missing prospect should return minimal profile without crashing."""
        from app.agents.research_agent import run_research_agent_for_prospect

        mock_execute_result = MagicMock()
        mock_execute_result.scalar_one_or_none.return_value = None

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=mock_execute_result)

        result = await run_research_agent_for_prospect(uuid.uuid4(), "Unknown Co", None, mock_db)

        assert result["company_name"] == "Unknown Co"
        assert result["industry"] == "technology"
        assert result["data_confidence"] == "low"
        assert "technology_signals" not in result

    def test_minimal_profile_structure(self):
        """Minimal profile has all required keys including observability_outcome."""
        from app.agents.research_agent import _build_minimal_profile

        profile = _build_minimal_profile("TestCorp")
        required_keys = {
            "company_name", "industry", "company_size", "products_summary",
            "target_customers", "builds_ai_products", "cloud_providers",
            "key_challenges", "business_outcomes", "operational_scale",
            "data_confidence", "research_notes", "news_insights",
            "observability_outcome", "sources",
        }
        assert required_keys == set(profile.keys())
        assert profile["company_name"] == "TestCorp"
        assert "technology_signals" not in profile

    def test_minimal_profile_observability_outcome_defaults_empty(self):
        """Fallback profile sets observability_outcome to empty string."""
        from app.agents.research_agent import _build_minimal_profile

        profile = _build_minimal_profile("FallbackCo")
        assert profile["observability_outcome"] == ""

    def test_system_prompt_includes_observability_outcome(self):
        """LLM system prompt defines observability_outcome and includes it in the JSON template."""
        from app.agents.research_agent import _SYSTEM_PROMPT

        assert "observability_outcome" in _SYSTEM_PROMPT
        assert "key_challenges_input" in _SYSTEM_PROMPT

    def test_extract_json_object(self):
        """JSON object extraction handles preamble, fences, and nested structures."""
        from app.agents.research_agent import _extract_json_object

        # Plain JSON
        assert _extract_json_object('{"key": "value"}') == '{"key": "value"}'
        # With markdown fence
        assert _extract_json_object('```json\n{"key": "value"}\n```') == '{"key": "value"}'
        # With prose preamble
        assert _extract_json_object('Here is your result:\n{"key": "value"}') == '{"key": "value"}'


# ── _synthesize_observability_outcome ────────────────────────────────────────

class TestSynthesizeObservabilityOutcome:
    """Unit tests for the observability_outcome synthesis fallback."""

    def _synth(self, profile: dict, key_challenges_input: str | None = None, company_name: str = "Acme") -> str:
        from app.agents.research_agent import _synthesize_observability_outcome
        return _synthesize_observability_outcome(profile, key_challenges_input, company_name)

    def test_visibility_keyword_match(self):
        result = self._synth({"key_challenges": ["end-to-end visibility across services"]})
        assert "distributed tracing" in result
        assert "Acme" in result

    def test_alert_keyword_match(self):
        result = self._synth({"key_challenges": ["alert fatigue from too many pages"]})
        assert "intelligent alerting" in result

    def test_mttr_keyword_match(self):
        result = self._synth({"key_challenges": ["high MTTR for production incidents"]})
        assert "root-cause" in result

    def test_cost_keyword_match(self):
        result = self._synth({"key_challenges": ["GPU cost and efficiency"]})
        assert "cost-aware" in result

    def test_response_keyword_does_not_match_mttr_branch(self):
        # "response" was removed from the MTTR branch — should fall through to generic
        result = self._synth({"key_challenges": ["slow API response time"]})
        assert "full-stack observability" in result

    def test_ai_products_appended_for_ai_company(self):
        result = self._synth({"builds_ai_products": True})
        assert "LLM cost and latency" in result

    def test_ai_string_false_is_not_truthy(self):
        result = self._synth({"builds_ai_products": "false"})
        assert "LLM cost and latency" not in result

    def test_ai_string_true_is_truthy(self):
        result = self._synth({"builds_ai_products": "true"})
        assert "LLM cost and latency" in result

    def test_multi_cloud_appended_when_two_or_more_providers(self):
        result = self._synth({"cloud_providers": ["aws", "gcp"]})
        assert "multi-cloud" in result
        assert "aws" in result
        assert "gcp" in result

    def test_single_cloud_does_not_append_multi_cloud_sentence(self):
        result = self._synth({"cloud_providers": ["aws"]})
        assert "multi-cloud" not in result

    def test_generic_fallback_when_no_signals(self):
        result = self._synth({})
        assert "full-stack observability" in result
        assert "Acme" in result

    def test_none_items_in_challenges_are_filtered(self):
        # Should not raise AttributeError
        result = self._synth({"key_challenges": [None, "alert fatigue"]})
        assert "intelligent alerting" in result

    def test_null_first_challenge_with_no_key_challenges_input(self):
        result = self._synth({"key_challenges": [None]})
        assert result  # generic fallback — no crash

    def test_none_items_in_cloud_providers_are_filtered(self):
        # Should not raise TypeError in ', '.join
        result = self._synth({"cloud_providers": ["aws", None, "gcp"]})
        assert "multi-cloud" in result
        assert "None" not in result

    def test_company_name_parameter_used_when_profile_omits_it(self):
        result = self._synth({}, company_name="Datadog")
        assert "Datadog" in result
        assert "this company" not in result

    def test_key_challenges_input_prepended_and_case_insensitive_dedup(self):
        profile = {"key_challenges": ["Alert Fatigue"]}
        result = self._synth(profile, key_challenges_input="alert fatigue")
        # dedup should remove the near-duplicate LLM version
        assert result.count("alert") == result.lower().count("alert") >= 1

    def test_whitespace_only_key_challenges_input_is_ignored(self):
        profile = {"key_challenges": ["alert fatigue"]}
        result = self._synth(profile, key_challenges_input="   ")
        # whitespace-only input should not push out the real challenge
        assert "intelligent alerting" in result

    def test_always_returns_non_empty_string(self):
        assert self._synth({})
        assert self._synth({"key_challenges": []})
        assert self._synth({"key_challenges": [None]})

    def test_size_tag_in_generic_fallback(self):
        result = self._synth({"company_size": "startup"})
        assert "(startup)" in result

    def test_company_name_from_profile_takes_precedence(self):
        result = self._synth({"company_name": "ProfileCorp"}, company_name="FallbackCorp")
        assert "ProfileCorp" in result
        assert "FallbackCorp" not in result


# ── question_selection_agent ──────────────────────────────────────────────────

class TestQuestionSelectionAgent:
    """Tests for select_questions (Agent 2)."""

    def test_build_research_summary_with_data(self):
        """Research summary includes all populated fields."""
        from app.agents.question_selection_agent import _build_research_summary

        cache = {
            "industry": "SaaS",
            "products_summary": "Cloud monitoring platform",
            "cloud_providers": ["AWS"],
            "key_challenges": ["alert fatigue"],
            "business_outcomes": ["uptime SLA"],
            "data_confidence": "medium",
        }
        summary = _build_research_summary(cache)
        assert "SaaS" in summary
        assert "AWS" in summary
        assert "alert fatigue" in summary
        assert "medium" in summary
        # technology_signals no longer in output (spec v1.6)
        assert "technology_signals" not in summary

    def test_build_research_summary_empty(self):
        """Empty/None cache returns placeholder string."""
        from app.agents.question_selection_agent import _build_research_summary

        assert _build_research_summary(None) == "No research data available."
        assert _build_research_summary({}) == "No research data available."

    @pytest.mark.asyncio
    async def test_select_questions_valid_llm_response(self):
        """Valid LLM response with 12 UUIDs returns ordered Question list."""
        from app.agents.question_selection_agent import select_questions

        q_ids = [str(uuid.uuid4()) for _ in range(15)]
        questions = [_mock_question(q_id=q_ids[i], is_general=(i < 4), display_order=i + 1) for i in range(15)]

        # LLM returns exactly 12 IDs from the pool (first 12)
        selected_ids = q_ids[:12]

        mock_pillar = MagicMock()
        mock_pillar.id = uuid.uuid4()
        mock_pillar.name = "P1: Observability"
        mock_pillar.description = "Full stack observability"
        mock_pillar.question_count = 12

        mock_db = AsyncMock()

        # first execute: pillar; second: general Qs; third: persona Qs
        mock_db.execute.return_value.scalar_one_or_none.return_value = mock_pillar
        mock_db.execute.return_value.scalars.return_value.all.side_effect = [
            questions[:4],   # general questions
            questions[4:15], # persona questions
        ]

        with (
            patch("app.agents.question_selection_agent.get_question_selection_agent_llm") as mock_get_llm,
            patch("app.agents.question_selection_agent.ChatPromptTemplate") as mock_cpt,
            patch("app.agents.question_selection_agent.StrOutputParser"),
        ):
            mock_chain = AsyncMock()
            mock_chain.ainvoke = AsyncMock(return_value=json.dumps(selected_ids))
            mock_cpt.from_messages.return_value.__or__ = MagicMock(
                return_value=MagicMock(__or__=MagicMock(return_value=mock_chain))
            )

            # Patch the full DB execute sequence
            execute_results = [
                MagicMock(scalar_one_or_none=MagicMock(return_value=mock_pillar)),
                MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=questions[:4])))),
                MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=questions[4:])))),
            ]
            mock_db.execute.side_effect = execute_results

            result = await select_questions(
                mock_pillar.id, "sre_platform_engineer", None, mock_db
            )

        assert len(result) == 12

    @pytest.mark.asyncio
    async def test_select_questions_wrong_count_raises(self):
        """LLM returning fewer than question_count valid IDs should raise ValueError."""
        from app.agents.question_selection_agent import select_questions

        q_ids = [str(uuid.uuid4()) for _ in range(15)]
        questions = [_mock_question(q_id=q_ids[i], display_order=i + 1) for i in range(15)]

        # LLM returns only 10 valid IDs
        bad_response = q_ids[:10]

        mock_pillar = MagicMock()
        mock_pillar.question_count = 12
        mock_pillar.name = "P1"
        mock_pillar.description = "desc"

        mock_db = AsyncMock()

        with (
            patch("app.agents.question_selection_agent.ChatPromptTemplate") as mock_cpt,
            patch("app.agents.question_selection_agent.StrOutputParser"),
            patch("app.agents.question_selection_agent.get_question_selection_agent_llm"),
        ):
            mock_chain = AsyncMock()
            mock_chain.ainvoke = AsyncMock(return_value=json.dumps(bad_response))
            mock_cpt.from_messages.return_value.__or__ = MagicMock(
                return_value=MagicMock(__or__=MagicMock(return_value=mock_chain))
            )

            execute_results = [
                MagicMock(scalar_one_or_none=MagicMock(return_value=mock_pillar)),
                MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=questions[:4])))),
                MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=questions[4:])))),
            ]
            mock_db.execute.side_effect = execute_results

            with pytest.raises(ValueError, match="valid IDs"):
                await select_questions(mock_pillar.id, "sre_platform_engineer", None, mock_db)

    @pytest.mark.asyncio
    async def test_select_questions_hallucinated_ids_filtered(self):
        """IDs not in the candidate pool should be filtered out, triggering ValueError."""
        from app.agents.question_selection_agent import select_questions

        q_ids = [str(uuid.uuid4()) for _ in range(15)]
        questions = [_mock_question(q_id=q_ids[i], display_order=i + 1) for i in range(15)]

        # LLM returns 12 but 4 are hallucinated (not in pool)
        hallucinated = [str(uuid.uuid4()) for _ in range(4)]
        bad_response = q_ids[:8] + hallucinated

        mock_pillar = MagicMock()
        mock_pillar.question_count = 12
        mock_pillar.name = "P1"
        mock_pillar.description = "desc"

        mock_db = AsyncMock()

        with (
            patch("app.agents.question_selection_agent.ChatPromptTemplate") as mock_cpt,
            patch("app.agents.question_selection_agent.StrOutputParser"),
            patch("app.agents.question_selection_agent.get_question_selection_agent_llm"),
        ):
            mock_chain = AsyncMock()
            mock_chain.ainvoke = AsyncMock(return_value=json.dumps(bad_response))
            mock_cpt.from_messages.return_value.__or__ = MagicMock(
                return_value=MagicMock(__or__=MagicMock(return_value=mock_chain))
            )

            execute_results = [
                MagicMock(scalar_one_or_none=MagicMock(return_value=mock_pillar)),
                MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=questions[:4])))),
                MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=questions[4:])))),
            ]
            mock_db.execute.side_effect = execute_results

            with pytest.raises(ValueError):
                await select_questions(mock_pillar.id, "sre_platform_engineer", None, mock_db)

    @pytest.mark.asyncio
    async def test_select_questions_pillar_not_found_raises(self):
        """Missing pillar should raise ValueError immediately."""
        from app.agents.question_selection_agent import select_questions

        mock_execute_result = MagicMock()
        mock_execute_result.scalar_one_or_none.return_value = None

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=mock_execute_result)

        with pytest.raises(ValueError, match="not found"):
            await select_questions(uuid.uuid4(), "sre_platform_engineer", None, mock_db)

    def test_persona_labels_cover_all_personas(self):
        """All persona enum values have a label mapping."""
        from app.agents.question_selection_agent import _PERSONA_LABELS

        expected_personas = {
            "cto_executive", "vp_engineering", "ciso_vp_security",
            "sre_platform_engineer", "devops_engineer", "ml_ai_engineer",
            "security_engineer", "software_developer",
        }
        assert expected_personas == set(_PERSONA_LABELS.keys())


# ── report_agent ──────────────────────────────────────────────────────────────

class TestReportAgent:
    """Tests for run_report_agent (Agent 3)."""

    def test_format_company_context_full(self):
        """All company profile fields rendered in summary."""
        from app.agents.report_agent import _format_company_context

        profile = {
            "industry": "FinTech",
            "company_size": "mid-market",
            "products_summary": "Payment APIs",
            "target_customers": "banks and fintechs",
            "business_outcomes": ["transaction reliability"],
            "operational_scale": ["10M transactions/day"],
        }
        ctx = _format_company_context(profile)
        assert "FinTech" in ctx
        assert "transaction reliability" in ctx
        assert "10M transactions/day" in ctx
        # technology_signals no longer rendered (spec v1.6)
        assert "technology_signals" not in ctx

    def test_format_company_context_empty(self):
        """Empty profile returns placeholder."""
        from app.agents.report_agent import _format_company_context

        assert "No company context available" in _format_company_context({})

    def test_format_answers(self):
        """Answer context is formatted as numbered list."""
        from app.agents.report_agent import _format_answers

        answers = [
            {"question_text": "Do you have SLOs?", "answer_text": "Yes, for all services", "maturity_level": 3},
            {"question_text": "Do you use APM?", "answer_text": "Partially", "maturity_level": 2},
        ]
        result = _format_answers(answers)
        assert "Do you have SLOs?" in result
        assert "Level 3" in result
        assert "Partially" in result

    def test_extract_json_object(self):
        """JSON object extraction handles preamble and fences."""
        from app.agents.report_agent import _extract_json_object

        assert _extract_json_object("{}") == "{}"
        assert _extract_json_object('```json\n{}\n```') == "{}"
        assert _extract_json_object('Sure! Here you go:\n{"a": 1}') == '{"a": 1}'

    @pytest.mark.asyncio
    async def test_run_report_agent_valid_response(self):
        """Valid LLM response is parsed and returned correctly."""
        from app.agents.report_agent import run_report_agent

        expected = {
            "executive_summary": "This is a summary.",
            "strengths": [
                {"title": "S1", "description": "desc1"},
                {"title": "S2", "description": "desc2"},
            ],
            "gap_analysis": [
                {"gap": "G1", "current_state": "cs", "target_state": "ts", "impact": "high", "effort": "medium"},
                {"gap": "G2", "current_state": "cs", "target_state": "ts", "impact": "medium", "effort": "low"},
                {"gap": "G3", "current_state": "cs", "target_state": "ts", "impact": "low", "effort": "high"},
            ],
            "next_steps": [
                {"title": "N1", "description": "d", "priority": "quick_win", "timeframe": "0-30 days"},
                {"title": "N2", "description": "d", "priority": "strategic", "timeframe": "1-3 months"},
                {"title": "N3", "description": "d", "priority": "foundational", "timeframe": "3-6 months"},
                {"title": "N4", "description": "d", "priority": "strategic", "timeframe": "6+ months"},
            ],
        }

        with (
            patch("app.agents.report_agent.ChatPromptTemplate") as mock_cpt,
            patch("app.agents.report_agent.StrOutputParser"),
            patch("app.agents.report_agent.get_report_agent_llm"),
        ):
            mock_chain = AsyncMock()
            mock_chain.ainvoke = AsyncMock(return_value=json.dumps(expected))
            mock_cpt.from_messages.return_value.__or__ = MagicMock(
                return_value=MagicMock(__or__=MagicMock(return_value=mock_chain))
            )

            result = await run_report_agent(
                company_profile={"industry": "SaaS"},
                answers_with_context=[],
                pillar_name="P1: Observability",
                score=2.5,
                maturity_label="Defined",
                persona="sre_platform_engineer",
                company_name="Acme Corp",
            )

        assert result["executive_summary"] == "This is a summary."
        assert len(result["strengths"]) == 2
        assert len(result["gap_analysis"]) == 3
        assert len(result["next_steps"]) == 4

    @pytest.mark.asyncio
    async def test_run_report_agent_llm_failure_raises(self):
        """LLM failure propagates so orchestrator can handle it."""
        from app.agents.report_agent import run_report_agent

        with (
            patch("app.agents.report_agent.ChatPromptTemplate") as mock_cpt,
            patch("app.agents.report_agent.StrOutputParser"),
            patch("app.agents.report_agent.get_report_agent_llm"),
        ):
            mock_chain = AsyncMock()
            mock_chain.ainvoke = AsyncMock(side_effect=RuntimeError("LLM timeout"))
            mock_cpt.from_messages.return_value.__or__ = MagicMock(
                return_value=MagicMock(__or__=MagicMock(return_value=mock_chain))
            )

            with pytest.raises(Exception):
                await run_report_agent(
                    company_profile={},
                    answers_with_context=[],
                    pillar_name="P1",
                    score=2.0,
                    maturity_label="Developing",
                    persona="sre_platform_engineer",
                    company_name="Acme",
                )


# ── orchestrator ──────────────────────────────────────────────────────────────

class TestOrchestrator:
    """Tests for run_assessment_orchestrator."""

    @pytest.mark.asyncio
    async def test_orchestrator_returns_empty_on_pipeline_failure(self):
        """Total pipeline failure returns empty narrative, not an exception."""
        from app.agents.orchestrator import run_assessment_orchestrator

        mock_db = AsyncMock()

        with patch("app.agents.orchestrator._build_graph") as mock_build:
            mock_compiled = AsyncMock()
            mock_compiled.ainvoke = AsyncMock(side_effect=RuntimeError("graph error"))
            mock_build.return_value = mock_compiled

            result = await run_assessment_orchestrator(
                db=mock_db,
                account_id=uuid.uuid4(),
                company_name="Acme",
                company_website=None,
                persona="sre_platform_engineer",
                pillar_name="P1: Observability",
                assessment_id=uuid.uuid4(),
                pre_computed_score=2.5,
                pre_computed_maturity_level=3,
                pre_computed_maturity_label="Defined",
            )

        assert result["executive_summary"] == ""
        assert result["strengths"] == []
        assert result["gap_analysis"] == []
        assert result["next_steps"] == []

    @pytest.mark.asyncio
    async def test_orchestrator_returns_narrative_on_success(self):
        """Successful pipeline returns narrative fields from final state."""
        from app.agents.orchestrator import run_assessment_orchestrator

        mock_db = AsyncMock()
        final_state = {
            "executive_summary": "Great progress.",
            "strengths": [{"title": "S1", "description": "d"}],
            "gap_analysis": [{"gap": "G1", "current_state": "c", "target_state": "t", "impact": "high", "effort": "medium"}],
            "next_steps": [{"title": "N1", "description": "d", "priority": "quick_win", "timeframe": "0-30 days"}],
        }

        with patch("app.agents.orchestrator._build_graph") as mock_build:
            mock_compiled = AsyncMock()
            mock_compiled.ainvoke = AsyncMock(return_value=final_state)
            mock_build.return_value = mock_compiled

            result = await run_assessment_orchestrator(
                db=mock_db,
                account_id=uuid.uuid4(),
                company_name="Acme",
                company_website="acme.com",
                persona="vp_engineering",
                pillar_name="P2: AIOps",
                assessment_id=uuid.uuid4(),
                pre_computed_score=3.1,
                pre_computed_maturity_level=3,
                pre_computed_maturity_label="Defined",
            )

        assert result["executive_summary"] == "Great progress."
        assert len(result["strengths"]) == 1

    @pytest.mark.asyncio
    async def test_compute_score_node_passes_through_precomputed(self):
        """compute_score_node should not recompute — it passes through pre-computed values."""
        from app.agents.orchestrator import AssessmentReportState, _build_graph

        mock_db = AsyncMock()
        graph = _build_graph(mock_db)

        # Directly test the compute_score_node by passing known pre-computed state
        state: AssessmentReportState = {
            "account_id": str(uuid.uuid4()),
            "company_name": "Acme",
            "company_website": None,
            "persona": "sre_platform_engineer",
            "pillar_name": "P1",
            "assessment_id": str(uuid.uuid4()),
            "pre_computed_score": 3.25,
            "pre_computed_maturity_level": 4,
            "pre_computed_maturity_label": "Optimized",
            "company_profile": {},
            "pillar_score": 0.0,
            "maturity_level": 0,
            "maturity_label": "",
            "executive_summary": "",
            "strengths": [],
            "gap_analysis": [],
            "next_steps": [],
            "error": None,
        }

        # Access the compute_score_node directly from the graph's node map
        nodes = graph.nodes
        compute_node_fn = nodes.get("compute_score_node")
        if compute_node_fn is None:
            # Different LangGraph version — skip node-level access
            pytest.skip("Cannot access individual nodes in this LangGraph version")

        result = await compute_node_fn.ainvoke(state)
        assert result["pillar_score"] == 3.25
        assert result["maturity_level"] == 4
        assert result["maturity_label"] == "Optimized"


# ── run_research_agent_for_prospect ──────────────────────────────────────────

class TestResearchAgentForProspect:
    """Tests for run_research_agent_for_prospect (prospect-scoped Agent 1)."""

    @pytest.mark.asyncio
    async def test_cache_hit_skips_llm(self):
        """Fresh prospect cache is returned without calling LLM."""
        from datetime import timedelta

        from app.agents.research_agent import run_research_agent_for_prospect

        prospect_id = uuid.uuid4()
        cached_profile = {"company_name": "Acme", "industry": "SaaS"}

        mock_prospect = MagicMock()
        mock_prospect.research_cache = cached_profile
        mock_prospect.research_cached_at = datetime.now(timezone.utc) - timedelta(days=1)

        mock_execute_result = MagicMock()
        mock_execute_result.scalar_one_or_none.return_value = mock_prospect

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=mock_execute_result)

        with patch("app.agents.research_agent.get_research_agent_llm") as mock_llm:
            result = await run_research_agent_for_prospect(
                prospect_id, "Acme", "acme.com", mock_db
            )

        assert result == cached_profile
        mock_llm.assert_not_called()

    @pytest.mark.asyncio
    async def test_prospect_not_found_returns_minimal_profile(self):
        """Missing prospect returns minimal profile without crashing."""
        from app.agents.research_agent import run_research_agent_for_prospect

        mock_execute_result = MagicMock()
        mock_execute_result.scalar_one_or_none.return_value = None

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=mock_execute_result)

        result = await run_research_agent_for_prospect(
            uuid.uuid4(), "Unknown Co", None, mock_db
        )

        assert result["company_name"] == "Unknown Co"
        assert result["data_confidence"] == "low"

    @pytest.mark.asyncio
    async def test_stale_cache_triggers_refresh(self):
        """Cache older than 7 days triggers refresh (_should_refresh returns True)."""
        from datetime import timedelta

        from app.agents.research_agent import _should_refresh

        mock_prospect = MagicMock()
        mock_prospect.research_cache = {"company_name": "Acme"}
        mock_prospect.research_cached_at = datetime.now(timezone.utc) - timedelta(days=8)

        assert _should_refresh(mock_prospect) is True

    @pytest.mark.asyncio
    async def test_null_cache_triggers_refresh(self):
        """NULL cache always triggers refresh."""
        from app.agents.research_agent import _should_refresh

        mock_prospect = MagicMock()
        mock_prospect.research_cache = None
        mock_prospect.research_cached_at = None

        assert _should_refresh(mock_prospect) is True


# ── _compute_research_input_hash ─────────────────────────────────────────────

class TestComputeResearchInputHash:
    """Tests for the registration-time input hash used to skip Agent 1 re-runs."""

    def test_same_inputs_produce_same_hash(self):
        """Calling twice with identical inputs returns the same digest."""
        from app.services.public_service import _compute_research_input_hash

        h1 = _compute_research_input_hash("Acme", "acme.com", "AWS", "Python", "Datadog", "latency")
        h2 = _compute_research_input_hash("Acme", "acme.com", "AWS", "Python", "Datadog", "latency")
        assert h1 == h2

    def test_different_inputs_produce_different_hash(self):
        """Changing any input field changes the digest."""
        from app.services.public_service import _compute_research_input_hash

        base = _compute_research_input_hash("Acme", "acme.com", "AWS", "Python", "Datadog", "latency")
        changed = _compute_research_input_hash("Acme", "acme.com", "GCP", "Python", "Datadog", "latency")
        assert base != changed

    def test_none_fields_treated_as_empty(self):
        """None optional fields hash identically to empty strings."""
        from app.services.public_service import _compute_research_input_hash

        h_none = _compute_research_input_hash("Acme", None, None, None, None, None)
        h_empty = _compute_research_input_hash("Acme", "", "", "", "", "")
        assert h_none == h_empty

    def test_hash_is_case_insensitive(self):
        """Input normalisation lowercases before hashing."""
        from app.services.public_service import _compute_research_input_hash

        h_lower = _compute_research_input_hash("acme", "acme.com", "aws", None, None, None)
        h_upper = _compute_research_input_hash("ACME", "ACME.COM", "AWS", None, None, None)
        assert h_lower == h_upper

    def test_hash_is_whitespace_trimmed(self):
        """Leading/trailing whitespace is stripped before hashing."""
        from app.services.public_service import _compute_research_input_hash

        h_trimmed = _compute_research_input_hash("Acme", "acme.com", None, None, None, None)
        h_padded = _compute_research_input_hash("  Acme  ", "  acme.com  ", None, None, None, None)
        assert h_trimmed == h_padded

    def test_returns_hex_string(self):
        """Hash is a non-empty lowercase hex string (SHA-256 = 64 chars)."""
        from app.services.public_service import _compute_research_input_hash

        result = _compute_research_input_hash("Acme", None, None, None, None, None)
        assert isinstance(result, str)
        assert len(result) == 64
        assert all(c in "0123456789abcdef" for c in result)


# ── _research_cache_expired ───────────────────────────────────────────────────

class TestResearchCacheExpired:
    """Tests for the 3-day TTL check added at registration."""

    def test_absent_cache_is_expired(self):
        """No cache at all → always expired."""
        from app.services.public_service import _research_cache_expired

        mock_prospect = MagicMock()
        mock_prospect.research_cache = None
        mock_prospect.research_cached_at = None
        assert _research_cache_expired(mock_prospect) is True

    def test_cache_older_than_ttl_is_expired(self):
        """Cache older than 3 days is expired."""
        from datetime import timedelta
        from app.services.public_service import _research_cache_expired

        mock_prospect = MagicMock()
        mock_prospect.research_cache = {"company_name": "Acme"}
        mock_prospect.research_cached_at = datetime.now(timezone.utc) - timedelta(days=4)
        assert _research_cache_expired(mock_prospect) is True

    def test_cache_within_ttl_is_not_expired(self):
        """Cache less than 3 days old is not expired."""
        from datetime import timedelta
        from app.services.public_service import _research_cache_expired

        mock_prospect = MagicMock()
        mock_prospect.research_cache = {"company_name": "Acme"}
        mock_prospect.research_cached_at = datetime.now(timezone.utc) - timedelta(days=2)
        assert _research_cache_expired(mock_prospect) is False

    def test_cache_exactly_at_boundary_is_expired(self):
        """Cache exactly at 3 days + 1 second is expired."""
        from datetime import timedelta
        from app.services.public_service import _research_cache_expired

        mock_prospect = MagicMock()
        mock_prospect.research_cache = {"company_name": "Acme"}
        mock_prospect.research_cached_at = datetime.now(timezone.utc) - timedelta(days=3, seconds=1)
        assert _research_cache_expired(mock_prospect) is True

    def test_naive_cached_at_treated_as_utc(self):
        """Naive datetime (no tzinfo) in research_cached_at is treated as UTC."""
        from datetime import timedelta
        from app.services.public_service import _research_cache_expired

        mock_prospect = MagicMock()
        mock_prospect.research_cache = {"company_name": "Acme"}
        mock_prospect.research_cached_at = datetime.utcnow() - timedelta(days=1)
        assert _research_cache_expired(mock_prospect) is False

    def test_custom_ttl_days_respected(self):
        """ttl_days parameter overrides the default 3-day window."""
        from datetime import timedelta
        from app.services.public_service import _research_cache_expired

        mock_prospect = MagicMock()
        mock_prospect.research_cache = {"company_name": "Acme"}
        # 5 days old — expired at ttl=3, but not at ttl=7
        mock_prospect.research_cached_at = datetime.now(timezone.utc) - timedelta(days=5)
        assert _research_cache_expired(mock_prospect, ttl_days=3) is True
        assert _research_cache_expired(mock_prospect, ttl_days=7) is False


# ── _format_company_context with prospect_context ────────────────────────────

class TestFormatCompanyContextProspectContext:
    """Tests for prospect_context arg added to _format_company_context (Agent 3)."""

    def test_prospect_context_fields_appear_in_output(self):
        """All four prospect_context fields are rendered when provided."""
        from app.agents.report_agent import _format_company_context

        ctx = _format_company_context(
            {},
            prospect_context={
                "infrastructure_location": "AWS us-east-1",
                "tech_stack_description": "Python, Kubernetes",
                "current_tools": "Datadog, PagerDuty",
                "key_challenges_input": "alert fatigue at scale",
            },
        )
        assert "AWS us-east-1" in ctx
        assert "Python, Kubernetes" in ctx
        assert "Datadog, PagerDuty" in ctx
        assert "alert fatigue at scale" in ctx

    def test_none_prospect_context_does_not_crash(self):
        """None prospect_context is handled gracefully."""
        from app.agents.report_agent import _format_company_context

        ctx = _format_company_context({"industry": "SaaS"}, prospect_context=None)
        assert "SaaS" in ctx

    def test_empty_dict_prospect_context_renders_nothing_extra(self):
        """Empty dict prospect_context adds no lines."""
        from app.agents.report_agent import _format_company_context

        ctx_with = _format_company_context({"industry": "SaaS"}, prospect_context={})
        ctx_without = _format_company_context({"industry": "SaaS"}, prospect_context=None)
        assert ctx_with == ctx_without

    def test_prospect_context_combined_with_profile_and_notes(self):
        """All three inputs (profile, additional_notes, prospect_context) appear together."""
        from app.agents.report_agent import _format_company_context

        ctx = _format_company_context(
            {"industry": "FinTech", "products_summary": "Payment APIs"},
            prospect_additional_notes="We also use GCP.",
            prospect_context={"infrastructure_location": "AWS us-west-2"},
        )
        assert "FinTech" in ctx
        assert "Payment APIs" in ctx
        assert "AWS us-west-2" in ctx
        assert "We also use GCP." in ctx

    def test_empty_profile_and_context_returns_placeholder(self):
        """Both empty → placeholder string, not a crash."""
        from app.agents.report_agent import _format_company_context

        ctx = _format_company_context({}, prospect_context={})
        assert "No company context available" in ctx

    def test_news_insights_rendered_from_profile(self):
        """news_insights from company_profile appears in the context output."""
        from app.agents.report_agent import _format_company_context

        ctx = _format_company_context(
            {"news_insights": "Acme recently raised a Series C and is investing in observability."}
        )
        assert "Series C" in ctx
        assert "observability" in ctx
