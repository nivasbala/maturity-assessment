"""Rename prospect_corrections to prospect_additional_notes on prospects and assessments

Revision ID: 019
Revises: 018
Create Date: 2026-07-02
"""

from alembic import op

revision = "019"
down_revision = "018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("prospects", "prospect_corrections", new_column_name="prospect_additional_notes")
    op.alter_column("assessments", "prospect_corrections", new_column_name="prospect_additional_notes")


def downgrade() -> None:
    op.alter_column("assessments", "prospect_additional_notes", new_column_name="prospect_corrections")
    op.alter_column("prospects", "prospect_additional_notes", new_column_name="prospect_corrections")
