from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class AvailablePillar(BaseModel):
    id: UUID
    name: str
    description: str
    is_gated: bool
    gate_question: str | None


class ExistingAssessmentOut(BaseModel):
    assessment_id: UUID
    pillar_name: str
    status: str
    pillar_score: float | None
    maturity_label: str | None
    completed_at: datetime | None


class AssessmentInfoOut(BaseModel):
    company_name: str
    prospect_name: str | None
    prospect_email: str
    suggested_pillars: list[UUID]
    available_pillars: list[AvailablePillar]
    is_registered: bool = False
    prospect_role: str | None = None
    p3_gate_answered_yes: bool | None = None
    p4_gate_answered_yes: bool | None = None
    infrastructure_location: str | None = None
    tech_stack_description: str | None = None
    current_tools: str | None = None
    key_challenges_input: str | None = None
    existing_assessments: list[ExistingAssessmentOut] = []


class RegisterRequest(BaseModel):
    prospect_name: str = Field(min_length=1, max_length=255)
    prospect_email: str = Field(min_length=1, max_length=255)
    prospect_role: str = Field(min_length=1, max_length=100)
    p3_gate_answered_yes: bool | None = None
    p4_gate_answered_yes: bool | None = None
    # Optional prospect context — stored on prospect, passed to Agent 1
    infrastructure_location: str | None = None
    tech_stack_description: str | None = None
    current_tools: str | None = None
    key_challenges_input: str | None = None


class RegisterOut(BaseModel):
    session_token: str


class ResearchSummaryOut(BaseModel):
    is_ready: bool
    company_name: str = ""
    industry: str = ""
    company_size: str = ""
    products_summary: str = ""
    target_customers: str = ""
    builds_ai_products: bool = False
    cloud_providers: list[str] = []
    key_challenges: list[str] = []
    business_outcomes: list[str] = []
    operational_scale: list[str] = []
    data_confidence: str = "low"
    research_notes: str = ""
    news_insights: str = ""
    observability_outcome: str = ""
    sources: list[dict] = []


class SaveAdditionalNotesRequest(BaseModel):
    additional_notes: str | None = None


class SaveAdditionalNotesOut(BaseModel):
    saved: bool


class SelectPillarRequest(BaseModel):
    pillar_id: UUID


class AnswerOptionPublic(BaseModel):
    id: UUID
    text: str
    display_order: int


class QuestionPublic(BaseModel):
    id: UUID
    text: str
    answer_options: list[AnswerOptionPublic]


class ConfirmResearchRequest(BaseModel):
    assessment_id: UUID
    additional_notes: str | None = None


class ConfirmResearchOut(BaseModel):
    confirmed: bool
    questions: list[QuestionPublic] = []


class SelectPillarOut(BaseModel):
    assessment_id: UUID


class AnswerSubmit(BaseModel):
    question_id: UUID
    answer_option_id: UUID


class SubmitRequest(BaseModel):
    assessment_id: UUID
    answers: list[AnswerSubmit] = Field(min_length=1, max_length=50)


class SubmitOut(BaseModel):
    report_id: UUID


class ReportPublicOut(BaseModel):
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
    created_at: datetime
    company_name: str
    pillar_name: str
    prospect_name: str | None
    prospect_role: str | None
    research_data: dict | None = None
    answers: list[dict] = []
    additional_notes: str | None = None
    infrastructure_location: str | None = None
    tech_stack_description: str | None = None
    current_tools: str | None = None
    key_challenges_input: str | None = None
