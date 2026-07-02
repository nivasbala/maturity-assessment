from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# ── Account ───────────────────────────────────────────────────────────────────

class AccountCreate(BaseModel):
    company_name: str = Field(min_length=1, max_length=255)
    company_website: str | None = Field(default=None, max_length=500)


class AccountListOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    company_name: str
    company_website: str | None
    internal_user_id: UUID
    created_at: datetime
    prospects_total: int = 0
    prospects_registered: int = 0


# ── Prospect ──────────────────────────────────────────────────────────────────

class ProspectCreate(BaseModel):
    email: str = Field(min_length=1, max_length=255)
    suggested_pillars: list[UUID] = []


class ProspectCreatedOut(BaseModel):
    prospect_id: UUID
    email: str
    short_url_token: str
    full_url: str
    is_registered: bool


class ProspectListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    name: str | None
    job_title: str | None
    short_url_token: str | None
    is_registered: bool
    registered_at: datetime | None
    created_at: datetime
    assessments_total: int = 0
    assessments_completed: int = 0


class ProspectDetailOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    account_id: UUID
    email: str
    name: str | None
    job_title: str | None
    suggested_pillars: list[UUID]
    short_url_token: str | None
    is_registered: bool
    registered_at: datetime | None
    created_at: datetime
    pillar_statuses: list[PillarStatusRow]


# ── Account detail ─────────────────────────────────────────────────────────────

class AccountDetailOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    company_name: str
    company_website: str | None
    internal_user_id: UUID
    internal_user_name: str
    created_at: datetime
    prospects: list[ProspectListItem]


# ── Pillar status (for ProspectDetailOut) ─────────────────────────────────────

class PillarStatusRow(BaseModel):
    pillar_id: UUID
    pillar_name: str
    display_order: int
    is_gated: bool
    is_active: bool
    assessment_id: UUID | None
    status: str | None  # pending | in_progress | completed | None (not started)
    pillar_score: float | None
    maturity_label: str | None


# ── Assessment schemas ─────────────────────────────────────────────────────────

class AssessmentListItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    account_id: UUID
    prospect_id: UUID
    pillar_id: UUID
    pillar_name: str
    status: str
    pillar_score: float | None
    maturity_label: str | None
    created_at: datetime
    completed_at: datetime | None


class AssessmentDetailOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    account_id: UUID
    prospect_id: UUID
    pillar_id: UUID
    pillar_name: str
    company_name: str
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


# ── Report ────────────────────────────────────────────────────────────────────

class StrengthItem(BaseModel):
    title: str
    description: str


class GapItem(BaseModel):
    gap: str
    current_state: str
    target_state: str
    impact: str
    effort: str


class NextStepItem(BaseModel):
    title: str
    description: str
    priority: str
    timeframe: str


class ReportOut(BaseModel):
    id: UUID
    assessment_id: UUID
    pillar_score: float
    maturity_level: int
    maturity_label: str
    executive_summary: str
    strengths: list[StrengthItem]
    gap_analysis: list[GapItem]
    next_steps: list[NextStepItem]
    pillar_breakdown: dict
    research_data: dict | None = None
    created_at: datetime


# ── Aggregate view ────────────────────────────────────────────────────────────

class AggregateScoreItem(BaseModel):
    pillar_id: UUID
    pillar_name: str
    pillar_score: float
    maturity_label: str
    prospect_name: str | None
    prospect_role: str | None


class AggregateOut(BaseModel):
    account_id: UUID
    company_name: str
    completed_count: int
    scores: list[AggregateScoreItem]
