"""Create prospects table and update assessments for Account->Prospect hierarchy

Revision ID: 010
Revises: 009
Create Date: 2026-07-01
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create prospects table
    op.create_table(
        "prospects",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("accounts.id"), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column("job_title", sa.String(255), nullable=True),
        sa.Column("infrastructure_location", sa.Text, nullable=True),
        sa.Column("tech_stack_description", sa.Text, nullable=True),
        sa.Column("current_tools", sa.Text, nullable=True),
        sa.Column("key_challenges_input", sa.Text, nullable=True),
        sa.Column("research_cache", postgresql.JSONB, nullable=True),
        sa.Column("research_cached_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "suggested_pillars",
            postgresql.ARRAY(postgresql.UUID(as_uuid=True)),
            nullable=False,
            server_default=sa.text("'{}'::uuid[]"),
        ),
        sa.Column("short_url_token", sa.String(12), nullable=True, unique=True),
        sa.Column("prospect_corrections", sa.Text, nullable=True),
        sa.Column("research_confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_registered", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("registered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_prospects_account_id", "prospects", ["account_id"])
    op.create_unique_constraint("uq_prospect_account_email", "prospects", ["account_id", "email"])

    # 2. Drop old tables that have incompatible constraints and dependents
    # assessment_answers and reports cascade-delete from assessments; drop all then recreate
    op.execute("DROP TABLE IF EXISTS assessment_answers CASCADE")
    op.execute("DROP TABLE IF EXISTS reports CASCADE")
    op.execute("DROP TABLE IF EXISTS assessments CASCADE")

    # 3. Recreate assessments table with new schema
    op.create_table(
        "assessments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("accounts.id"), nullable=False),
        sa.Column("prospect_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("prospects.id"), nullable=False),
        sa.Column("pillar_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("pillars.id"), nullable=False),
        sa.Column("status", sa.String(50), nullable=False, server_default="pending"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("account_id", "prospect_id", "pillar_id", name="uq_assessment_account_prospect_pillar"),
    )

    # 4. Recreate assessment_answers
    op.create_table(
        "assessment_answers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "assessment_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("assessments.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("question_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("questions.id"), nullable=False),
        sa.Column("answer_option_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("answer_options.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("assessment_id", "question_id", name="uq_answer_assessment_question"),
    )

    # 5. Recreate reports
    op.create_table(
        "reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "assessment_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("assessments.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("pillar_score", sa.Numeric(5, 2), nullable=False),
        sa.Column("maturity_level", sa.Integer, nullable=False),
        sa.Column("maturity_label", sa.String(100), nullable=False),
        sa.Column("executive_summary", sa.Text, nullable=False, server_default=""),
        sa.Column("strengths", postgresql.JSONB, nullable=False, server_default="[]"),
        sa.Column("gap_analysis", postgresql.JSONB, nullable=False, server_default="[]"),
        sa.Column("next_steps", postgresql.JSONB, nullable=False, server_default="[]"),
        sa.Column("pillar_breakdown", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("research_data", postgresql.JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # 6. Drop old context/research columns from accounts
    for col in [
        "suggested_pillars",
        "infrastructure_location",
        "tech_stack_description",
        "current_tools",
        "key_challenges_input",
        "research_cache",
        "research_cached_at",
        "research_started_at",
        "prospect_corrections",
        "research_confirmed_at",
    ]:
        op.execute(f"ALTER TABLE accounts DROP COLUMN IF EXISTS {col}")

    # 7. Add updated_at to accounts if not present
    op.execute(
        "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE "
        "NOT NULL DEFAULT now()"
    )


def downgrade() -> None:
    # Reverting this migration would lose all prospect/assessment data.
    # Simplified downgrade: just drop the new tables.
    op.execute("DROP TABLE IF EXISTS reports CASCADE")
    op.execute("DROP TABLE IF EXISTS assessment_answers CASCADE")
    op.execute("DROP TABLE IF EXISTS assessments CASCADE")
    op.execute("DROP TABLE IF EXISTS prospects CASCADE")
