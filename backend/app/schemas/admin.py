from __future__ import annotations

from datetime import datetime
from typing import Generic, TypeVar
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator

T = TypeVar("T")


class Paginated(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    size: int


# ── Users ────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    # Only internal_user can be created through the UI — admin is not selectable


class UserUpdate(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
    is_active: bool | None = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    email: str
    role: str
    is_active: bool
    created_at: datetime


# ── Pillars ──────────────────────────────────────────────────────────────────

class PillarCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str = Field(min_length=1)
    overall_weight: float = Field(default=1.0, gt=0)
    display_order: int = Field(ge=1)
    is_gated: bool = False
    gate_question: str | None = None


class PillarUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    overall_weight: float | None = Field(default=None, gt=0)
    display_order: int | None = Field(default=None, ge=1)
    is_active: bool | None = None
    is_gated: bool | None = None
    gate_question: str | None = None


class PillarOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: str
    overall_weight: float
    display_order: int
    is_active: bool
    is_gated: bool
    gate_question: str | None
    question_count: int = 0
    created_at: datetime


# ── Questions ─────────────────────────────────────────────────────────────────

class AnswerOptionCreate(BaseModel):
    text: str = Field(min_length=1)
    maturity_level: int = Field(ge=1, le=4)


class QuestionPersonaCreate(BaseModel):
    persona: str
    persona_weight: float = Field(default=1.0, gt=0)


class QuestionCreate(BaseModel):
    text: str = Field(min_length=1)
    question_weight: float = Field(default=1.0, gt=0)
    is_general: bool = False
    is_active: bool = True
    answer_options: list[AnswerOptionCreate] = Field(min_length=4, max_length=4)
    personas: list[QuestionPersonaCreate] = []

    @model_validator(mode="after")
    def validate_maturity_levels(self) -> "QuestionCreate":
        levels = sorted(opt.maturity_level for opt in self.answer_options)
        if levels != [1, 2, 3, 4]:
            raise ValueError("answer_options must have exactly one option for each maturity level 1–4")
        return self


class QuestionUpdate(BaseModel):
    text: str | None = None
    question_weight: float | None = Field(default=None, gt=0)
    is_general: bool | None = None
    is_active: bool | None = None
    answer_options: list[AnswerOptionCreate] | None = Field(default=None, min_length=4, max_length=4)
    personas: list[QuestionPersonaCreate] | None = None


class AnswerOptionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    text: str
    maturity_level: int
    display_order: int


class QuestionPersonaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    persona: str
    persona_weight: float


class QuestionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    pillar_id: UUID
    text: str
    question_weight: float
    is_general: bool
    display_order: int
    is_active: bool
    answer_options: list[AnswerOptionOut]
    personas: list[QuestionPersonaOut]


# ── Admin read-only views ─────────────────────────────────────────────────────

class AccountOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    company_name: str
    company_website: str | None
    internal_user_id: UUID
    created_at: datetime


class AssessmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    account_id: UUID
    pillar_id: UUID
    short_url_token: str
    prospect_name: str | None
    prospect_email: str | None
    prospect_role: str | None
    status: str
    created_at: datetime
    completed_at: datetime | None
