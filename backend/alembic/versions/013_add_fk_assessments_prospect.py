"""Add FK constraint from assessments.prospect_id to prospects

Revision ID: 013
Revises: 012
Create Date: 2026-07-01

Migration 012 added the prospect_id column but the FK constraint was omitted
due to an Alembic limitation (sa.ForeignKey inside op.add_column is silently
ignored). This migration adds it separately.
"""
from alembic import op

revision = "013"
down_revision = "012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_foreign_key(
        "fk_assessments_prospect",
        "assessments",
        "prospects",
        ["prospect_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_assessments_prospect", "assessments", type_="foreignkey")
