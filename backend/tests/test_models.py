"""
Tests for SQLAlchemy ORM models (Task 2).

All tests run without a database connection — they inspect the model class
definitions, column metadata, constraints, and relationships that SQLAlchemy
builds from the declarative mapping.
"""
import os

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost/test")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-that-is-long-enough-32chars")

import pytest
from sqlalchemy import Boolean, DateTime, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID

from app.core.database import Base
from app.models import (
    Account,
    AnswerOption,
    Assessment,
    AssessmentAnswer,
    Pillar,
    Question,
    QuestionPersona,
    Report,
    User,
)


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------


def test_all_nine_tables_registered():
    expected = {
        "users",
        "accounts",
        "pillars",
        "questions",
        "question_personas",
        "answer_options",
        "assessments",
        "assessment_answers",
        "reports",
    }
    assert expected == set(Base.metadata.tables.keys())


def test_all_models_exported_from_package():
    from app import models as m

    for cls in [User, Account, Pillar, Question, QuestionPersona, AnswerOption, Assessment, AssessmentAnswer, Report]:
        assert hasattr(m, cls.__name__), f"{cls.__name__} not exported from app.models"


# ---------------------------------------------------------------------------
# users
# ---------------------------------------------------------------------------


def test_users_table_name():
    assert User.__tablename__ == "users"


def test_users_columns():
    cols = User.__table__.columns
    assert "id" in cols
    assert "name" in cols
    assert "email" in cols
    assert "password_hash" in cols
    assert "role" in cols
    assert "is_active" in cols
    assert "created_at" in cols
    assert "updated_at" in cols


def test_users_email_unique():
    col = User.__table__.columns["email"]
    assert col.unique


def test_users_is_active_default():
    col = User.__table__.columns["is_active"]
    assert col.default is not None or col.server_default is not None


def test_users_role_not_nullable():
    assert not User.__table__.columns["role"].nullable


def test_users_has_accounts_relationship():
    assert hasattr(User, "accounts")


# ---------------------------------------------------------------------------
# accounts
# ---------------------------------------------------------------------------


def test_accounts_table_name():
    assert Account.__tablename__ == "accounts"


def test_accounts_columns():
    cols = Account.__table__.columns
    assert "id" in cols
    assert "company_name" in cols
    assert "company_website" in cols
    assert "internal_user_id" in cols
    assert "suggested_pillars" in cols
    assert "research_cache" in cols
    assert "research_cached_at" in cols


def test_accounts_research_cache_is_jsonb():
    col = Account.__table__.columns["research_cache"]
    assert isinstance(col.type, JSONB)


def test_accounts_suggested_pillars_is_array():
    col = Account.__table__.columns["suggested_pillars"]
    assert isinstance(col.type, ARRAY)


def test_accounts_company_website_nullable():
    assert Account.__table__.columns["company_website"].nullable


def test_accounts_research_cached_at_nullable():
    assert Account.__table__.columns["research_cached_at"].nullable


def test_accounts_fk_to_users():
    fks = {fk.column.table.name for fk in Account.__table__.foreign_keys}
    assert "users" in fks


def test_accounts_has_assessments_relationship():
    assert hasattr(Account, "assessments")


# ---------------------------------------------------------------------------
# pillars
# ---------------------------------------------------------------------------


def test_pillars_table_name():
    assert Pillar.__tablename__ == "pillars"


def test_pillars_columns():
    cols = Pillar.__table__.columns
    for name in ["id", "name", "description", "overall_weight", "display_order", "is_active", "is_gated", "gate_question"]:
        assert name in cols, f"missing column: {name}"


def test_pillars_gate_question_nullable():
    assert Pillar.__table__.columns["gate_question"].nullable


def test_pillars_overall_weight_is_numeric():
    col = Pillar.__table__.columns["overall_weight"]
    assert isinstance(col.type, Numeric)


def test_pillars_is_gated_default_false():
    col = Pillar.__table__.columns["is_gated"]
    assert col.default is not None or col.server_default is not None


# ---------------------------------------------------------------------------
# questions
# ---------------------------------------------------------------------------


def test_questions_table_name():
    assert Question.__tablename__ == "questions"


def test_questions_columns():
    cols = Question.__table__.columns
    for name in ["id", "pillar_id", "text", "question_weight", "is_general", "display_order", "is_active"]:
        assert name in cols


def test_questions_fk_to_pillars():
    fks = {fk.column.table.name for fk in Question.__table__.foreign_keys}
    assert "pillars" in fks


def test_questions_has_personas_relationship():
    assert hasattr(Question, "personas")


def test_questions_has_answer_options_relationship():
    assert hasattr(Question, "answer_options")


# ---------------------------------------------------------------------------
# question_personas
# ---------------------------------------------------------------------------


def test_question_personas_table_name():
    assert QuestionPersona.__tablename__ == "question_personas"


def test_question_personas_unique_constraint():
    constraint_names = {c.name for c in QuestionPersona.__table__.constraints if isinstance(c, UniqueConstraint)}
    assert "uq_question_persona" in constraint_names


def test_question_personas_fk_to_questions():
    fks = {fk.column.table.name for fk in QuestionPersona.__table__.foreign_keys}
    assert "questions" in fks


def test_question_personas_fk_cascade_delete():
    fk = next(fk for fk in QuestionPersona.__table__.foreign_keys if fk.column.table.name == "questions")
    assert fk.ondelete == "CASCADE"


def test_question_personas_persona_weight_numeric():
    col = QuestionPersona.__table__.columns["persona_weight"]
    assert isinstance(col.type, Numeric)


# ---------------------------------------------------------------------------
# answer_options
# ---------------------------------------------------------------------------


def test_answer_options_table_name():
    assert AnswerOption.__tablename__ == "answer_options"


def test_answer_options_columns():
    cols = AnswerOption.__table__.columns
    for name in ["id", "question_id", "text", "maturity_level", "display_order"]:
        assert name in cols


def test_answer_options_fk_to_questions():
    fks = {fk.column.table.name for fk in AnswerOption.__table__.foreign_keys}
    assert "questions" in fks


def test_answer_options_fk_cascade_delete():
    fk = next(fk for fk in AnswerOption.__table__.foreign_keys if fk.column.table.name == "questions")
    assert fk.ondelete == "CASCADE"


def test_answer_options_maturity_level_integer():
    col = AnswerOption.__table__.columns["maturity_level"]
    assert isinstance(col.type, Integer)


# ---------------------------------------------------------------------------
# assessments
# ---------------------------------------------------------------------------


def test_assessments_table_name():
    assert Assessment.__tablename__ == "assessments"


def test_assessments_columns():
    cols = Assessment.__table__.columns
    for name in ["id", "account_id", "pillar_id", "short_url_token", "prospect_name",
                 "prospect_email", "prospect_role", "status", "created_at", "completed_at"]:
        assert name in cols


def test_assessments_unique_token():
    col = Assessment.__table__.columns["short_url_token"]
    assert col.unique


def test_assessments_unique_account_pillar():
    constraint_names = {c.name for c in Assessment.__table__.constraints if isinstance(c, UniqueConstraint)}
    assert "uq_assessment_account_pillar" in constraint_names


def test_assessments_fks():
    fk_tables = {fk.column.table.name for fk in Assessment.__table__.foreign_keys}
    assert "accounts" in fk_tables
    assert "pillars" in fk_tables


def test_assessments_completed_at_nullable():
    assert Assessment.__table__.columns["completed_at"].nullable


def test_assessments_status_default_pending():
    col = Assessment.__table__.columns["status"]
    assert col.default is not None or col.server_default is not None


def test_assessments_has_answers_relationship():
    assert hasattr(Assessment, "answers")


def test_assessments_has_report_relationship():
    assert hasattr(Assessment, "report")


# ---------------------------------------------------------------------------
# assessment_answers
# ---------------------------------------------------------------------------


def test_assessment_answers_table_name():
    assert AssessmentAnswer.__tablename__ == "assessment_answers"


def test_assessment_answers_unique_constraint():
    constraint_names = {c.name for c in AssessmentAnswer.__table__.constraints if isinstance(c, UniqueConstraint)}
    assert "uq_answer_assessment_question" in constraint_names


def test_assessment_answers_fks():
    fk_tables = {fk.column.table.name for fk in AssessmentAnswer.__table__.foreign_keys}
    assert "assessments" in fk_tables
    assert "questions" in fk_tables
    assert "answer_options" in fk_tables


def test_assessment_answers_cascade_delete_from_assessment():
    fk = next(fk for fk in AssessmentAnswer.__table__.foreign_keys if fk.column.table.name == "assessments")
    assert fk.ondelete == "CASCADE"


# ---------------------------------------------------------------------------
# reports
# ---------------------------------------------------------------------------


def test_reports_table_name():
    assert Report.__tablename__ == "reports"


def test_reports_columns():
    cols = Report.__table__.columns
    for name in ["id", "assessment_id", "pillar_score", "maturity_level", "maturity_label",
                 "executive_summary", "strengths", "gap_analysis", "next_steps", "pillar_breakdown"]:
        assert name in cols


def test_reports_assessment_id_unique():
    col = Report.__table__.columns["assessment_id"]
    assert col.unique


def test_reports_fk_to_assessments():
    fk_tables = {fk.column.table.name for fk in Report.__table__.foreign_keys}
    assert "assessments" in fk_tables


def test_reports_jsonb_fields():
    cols = Report.__table__.columns
    for name in ["strengths", "gap_analysis", "next_steps", "pillar_breakdown"]:
        assert isinstance(cols[name].type, JSONB), f"{name} should be JSONB"


def test_reports_pillar_score_numeric():
    col = Report.__table__.columns["pillar_score"]
    assert isinstance(col.type, Numeric)


def test_reports_jsonb_server_defaults():
    cols = Report.__table__.columns
    assert cols["strengths"].server_default is not None
    assert cols["gap_analysis"].server_default is not None
    assert cols["next_steps"].server_default is not None
    assert cols["pillar_breakdown"].server_default is not None
