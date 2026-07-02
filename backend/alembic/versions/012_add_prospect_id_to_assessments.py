"""Add prospect_id, corrections, research_confirmed_at, started_at to assessments

Revision ID: 012
Revises: 011
Create Date: 2026-07-01
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "012"
down_revision = "011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add new columns (FK added separately in migration 013)
    op.add_column("assessments", sa.Column("prospect_id", UUID(as_uuid=True), nullable=True))
    op.add_column("assessments", sa.Column("started_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("assessments", sa.Column("prospect_corrections", sa.Text(), nullable=True))
    op.add_column("assessments", sa.Column("research_confirmed_at", sa.DateTime(timezone=True), nullable=True))

    op.create_index("ix_assessments_prospect_id", "assessments", ["prospect_id"])

    # Partial unique index for rows that have a prospect_id (multi-prospect constraint).
    # The old uq_assessment_account_pillar is kept for rows where prospect_id IS NULL.
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_assessment_account_prospect_pillar "
        "ON assessments(account_id, prospect_id, pillar_id) "
        "WHERE prospect_id IS NOT NULL"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_assessment_account_prospect_pillar")
    op.drop_index("ix_assessments_prospect_id", table_name="assessments")
    # Use raw SQL so downgrade is safe even if FK was never created
    op.execute("ALTER TABLE assessments DROP CONSTRAINT IF EXISTS fk_assessments_prospect")
    op.drop_column("assessments", "research_confirmed_at")
    op.drop_column("assessments", "prospect_corrections")
    op.drop_column("assessments", "started_at")
    op.drop_column("assessments", "prospect_id")
