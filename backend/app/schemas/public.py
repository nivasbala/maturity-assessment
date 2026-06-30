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


class AssessmentInfoOut(BaseModel):
    company_name: str
    suggested_pillars: list[UUID]
    available_pillars: list[AvailablePillar]


class RegisterRequest(BaseModel):
    prospect_name: str = Field(min_length=1, max_length=255)
    prospect_email: str = Field(min_length=1, max_length=255)
    prospect_role: str = Field(min_length=1, max_length=100)
    p3_gate_answered_yes: bool | None = None
    p4_gate_answered_yes: bool | None = None


class RegisterOut(BaseModel):
    session_token: str


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


class SelectPillarOut(BaseModel):
    assessment_id: UUID
    questions: list[QuestionPublic]


class AnswerSubmit(BaseModel):
    question_id: UUID
    answer_option_id: UUID


class SubmitRequest(BaseModel):
    assessment_id: UUID
    answers: list[AnswerSubmit] = Field(min_length=12, max_length=12)


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
