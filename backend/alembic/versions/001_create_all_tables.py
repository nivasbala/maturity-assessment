"""create all tables

Revision ID: 001
Revises:
Create Date: 2026-06-28

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", sa.String(50), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("TRUE")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.UniqueConstraint("email", name="uq_users_email"),
        sa.CheckConstraint("role IN ('admin', 'internal_user')", name="ck_users_role"),
    )

    op.create_table(
        "accounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_name", sa.String(255), nullable=False),
        sa.Column("company_website", sa.String(500), nullable=True),
        sa.Column("internal_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("suggested_pillars", postgresql.ARRAY(postgresql.UUID(as_uuid=True)), nullable=False, server_default=sa.text("'{}'::uuid[]")),
        sa.Column("research_cache", postgresql.JSONB(), nullable=True),
        sa.Column("research_cached_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.ForeignKeyConstraint(["internal_user_id"], ["users.id"], name="fk_accounts_user"),
    )

    op.create_table(
        "pillars",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("overall_weight", sa.Numeric(3, 2), nullable=False, server_default=sa.text("1.0")),
        sa.Column("display_order", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("TRUE")),
        sa.Column("is_gated", sa.Boolean(), nullable=False, server_default=sa.text("FALSE")),
        sa.Column("gate_question", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )

    op.create_table(
        "questions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("pillar_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("question_weight", sa.Numeric(3, 2), nullable=False, server_default=sa.text("1.0")),
        sa.Column("is_general", sa.Boolean(), nullable=False, server_default=sa.text("FALSE")),
        sa.Column("display_order", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("TRUE")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.ForeignKeyConstraint(["pillar_id"], ["pillars.id"], name="fk_questions_pillar"),
    )

    op.create_table(
        "question_personas",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("question_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("persona", sa.String(100), nullable=False),
        sa.Column("persona_weight", sa.Numeric(3, 2), nullable=False, server_default=sa.text("1.0")),
        sa.ForeignKeyConstraint(["question_id"], ["questions.id"], name="fk_qpersona_question", ondelete="CASCADE"),
        sa.UniqueConstraint("question_id", "persona", name="uq_question_persona"),
        sa.CheckConstraint(
            "persona IN ("
            "'cto_executive','vp_engineering','ciso_vp_security','sre_platform_engineer',"
            "'devops_engineer','ml_ai_engineer','security_engineer','software_developer'"
            ")",
            name="ck_question_personas_persona",
        ),
    )

    op.create_table(
        "answer_options",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("question_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("maturity_level", sa.Integer(), nullable=False),
        sa.Column("display_order", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["question_id"], ["questions.id"], name="fk_answer_options_question", ondelete="CASCADE"),
        sa.CheckConstraint("maturity_level BETWEEN 1 AND 4", name="ck_answer_options_maturity_level"),
    )

    op.create_table(
        "assessments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("account_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("pillar_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("short_url_token", sa.String(12), nullable=False),
        sa.Column("prospect_name", sa.String(255), nullable=True),
        sa.Column("prospect_email", sa.String(255), nullable=True),
        sa.Column("prospect_role", sa.String(100), nullable=True),
        sa.Column("status", sa.String(50), nullable=False, server_default=sa.text("'pending'")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], name="fk_assessments_account"),
        sa.ForeignKeyConstraint(["pillar_id"], ["pillars.id"], name="fk_assessments_pillar"),
        sa.UniqueConstraint("short_url_token", name="uq_assessments_token"),
        sa.UniqueConstraint("account_id", "pillar_id", name="uq_assessment_account_pillar"),
        sa.CheckConstraint("status IN ('pending', 'in_progress', 'completed')", name="ck_assessments_status"),
    )

    op.create_table(
        "assessment_answers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("assessment_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("question_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("answer_option_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.ForeignKeyConstraint(["assessment_id"], ["assessments.id"], name="fk_answers_assessment", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["question_id"], ["questions.id"], name="fk_answers_question"),
        sa.ForeignKeyConstraint(["answer_option_id"], ["answer_options.id"], name="fk_answers_option"),
        sa.UniqueConstraint("assessment_id", "question_id", name="uq_answer_assessment_question"),
    )

    op.create_table(
        "reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("assessment_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("pillar_score", sa.Numeric(4, 2), nullable=False),
        sa.Column("maturity_level", sa.Integer(), nullable=False),
        sa.Column("maturity_label", sa.String(50), nullable=False),
        sa.Column("executive_summary", sa.Text(), nullable=False),
        sa.Column("strengths", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("gap_analysis", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("next_steps", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("pillar_breakdown", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.ForeignKeyConstraint(["assessment_id"], ["assessments.id"], name="fk_reports_assessment"),
        sa.UniqueConstraint("assessment_id", name="uq_reports_assessment"),
        sa.CheckConstraint("maturity_level BETWEEN 1 AND 4", name="ck_reports_maturity_level"),
    )


def downgrade() -> None:
    op.drop_table("reports")
    op.drop_table("assessment_answers")
    op.drop_table("assessments")
    op.drop_table("answer_options")
    op.drop_table("question_personas")
    op.drop_table("questions")
    op.drop_table("pillars")
    op.drop_table("accounts")
    op.drop_table("users")
