from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# ── Account ───────────────────────────────────────────────────────────────────

class AccountCreate(BaseModel):
    company_name: str = Field(min_length=1, max_length=255)
    company_website: str | None = Field(default=None, max_length=500)
    suggested_pillars: list[UUID] = []


class AccountListOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    company_name: str
    company_website: str | None
    internal_user_id: UUID
    internal_user_name: str = ""
    suggested_pillars: list[UUID]
    created_at: datetime
    pillars_sent: int = 0
    pillars_completed: int = 0


class PillarStatusRow(BaseModel):
    pillar_id: UUID
    pillar_name: str
    display_order: int
    is_gated: bool
    is_active: bool
    assessment_id: UUID | None
    status: str | None  # pending | in_progress | completed | None (not sent)
    prospect_name: str | None
    prospect_email: str | None
    prospect_role: str | None
    pillar_score: float | None
    maturity_label: str | None
    short_url_token: str | None


class AccountDetailOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    company_name: str
    company_website: str | None
    internal_user_id: UUID
    internal_user_name: str
    suggested_pillars: list[UUID]
    created_at: datetime
    pillar_statuses: list[PillarStatusRow]


# ── Prospect ──────────────────────────────────────────────────────────────────

class ProspectCreate(BaseModel):
    email: str = Field(min_length=1, max_length=255)
    name: str | None = Field(default=None, max_length=255)


class ProspectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    account_id: UUID
    email: str
    name: str | None
    short_url_token: str
    full_url: str
    created_at: datetime
    is_registered: bool = False
    registered_at: datetime | None = None
    job_title: str | None = None
    infrastructure_location: str | None = None
    tech_stack_description: str | None = None
    current_tools: str | None = None
    key_challenges_input: str | None = None
    research_cache: dict | None = None
    research_cached_at: datetime | None = None
    suggested_pillars: list[str] | None = None


class ProspectWithAccountOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    account_id: UUID
    company_name: str
    internal_user_name: str = ""
    email: str
    name: str | None
    short_url_token: str
    full_url: str
    created_at: datetime
    is_registered: bool = False
    registered_at: datetime | None = None


class ProspectAssessmentRow(BaseModel):
    pillar_id: UUID
    pillar_name: str
    display_order: int
    assessment_id: UUID | None
    status: str | None  # pending | in_progress | completed | None (not started)
    pillar_score: float | None
    maturity_label: str | None
    completed_at: datetime | None


class ProspectDetailOut(BaseModel):
    id: UUID
    account_id: UUID
    email: str
    name: str | None
    short_url_token: str
    full_url: str
    created_at: datetime
    is_registered: bool = False
    registered_at: datetime | None = None
    job_title: str | None = None
    infrastructure_location: str | None = None
    tech_stack_description: str | None = None
    current_tools: str | None = None
    key_challenges_input: str | None = None
    assessments: list[ProspectAssessmentRow]


# ── Account aggregate ─────────────────────────────────────────────────────────

class AggregateAssessmentRow(BaseModel):
    pillar_name: str
    display_order: int
    pillar_score: float
    maturity_label: str
    prospect_name: str | None
    prospect_email: str | None


class AccountAggregateOut(BaseModel):
    account_id: UUID
    company_name: str
    completed_count: int
    assessments: list[AggregateAssessmentRow]


class ProspectAggregateOut(BaseModel):
    prospect_id: UUID
    prospect_name: str | None
    prospect_email: str
    completed_count: int
    assessments: list[AggregateAssessmentRow]


# ── Assessment creation ────────────────────────────────────────────────────────

class AssessmentCreateRequest(BaseModel):
    pillar_id: UUID


class AssessmentCreatedOut(BaseModel):
    assessment_id: UUID
    prospect_id: UUID | None = None
    short_url_token: str
    full_url: str


class AssessmentListItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    account_id: UUID
    pillar_id: UUID
    pillar_name: str
    short_url_token: str
    prospect_name: str | None
    prospect_email: str | None
    prospect_role: str | None
    status: str
    pillar_score: float | None
    maturity_label: str | None
    created_at: datetime
    completed_at: datetime | None


# ── Assessment detail ─────────────────────────────────────────────────────────

class AssessmentDetailOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    account_id: UUID
    pillar_id: UUID
    pillar_name: str
    company_name: str
    short_url_token: str
    prospect_name: str | None
    prospect_email: str | None
    prospect_role: str | None
    status: str
    created_at: datetime
    completed_at: datetime | None


# ── Assessment answers ─────────────────────────────────────────────────────────

class AnswerRow(BaseModel):
    question_text: str
    selected_option_text: str
    maturity_level: int


class AssessmentAnswersOut(BaseModel):
    assessment_id: UUID
    account_id: UUID
    prospect_id: UUID | None
    pillar_id: UUID
    pillar_name: str
    company_name: str
    status: str
    prospect_name: str | None
    prospect_email: str | None
    prospect_role: str | None
    completed_at: datetime | None
    pillar_score: float | None
    maturity_label: str | None
    answers: list[AnswerRow]
    additional_notes: str | None = None
    infrastructure_location: str | None = None
    tech_stack_description: str | None = None
    current_tools: str | None = None
    key_challenges_input: str | None = None


# ── Report ────────────────────────────────────────────────────────────────────
#
# strengths / gap_analysis / next_steps are LLM-generated JSONB content (see
# app/agents/report_agent.py). The agent only validates item *counts*, not the
# shape of each item, so a single malformed item (missing key, wrong type,
# unexpected null) must not fail response validation. Kept as list[dict] here
# to match the same permissive typing used by ReportPublicOut below — the two
# endpoints serve the same underlying report row and must agree on strictness.
class ReportOut(BaseModel):
    id: UUID
    assessment_id: UUID
    pillar_score: float
    maturity_level: int
    maturity_label: str
    executive_summary: str
    strengths: list[dict]
    gap_analysis: list[dict]
    next_steps: list[dict]
    pillar_breakdown: dict
    research_data: dict | None = None
    created_at: datetime

