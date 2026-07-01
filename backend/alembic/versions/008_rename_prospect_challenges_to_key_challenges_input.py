"""Rename prospect_challenges to key_challenges_input on accounts

Revision ID: 008
Revises: 007
Create Date: 2026-07-01
"""
from alembic import op

revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("accounts", "prospect_challenges", new_column_name="key_challenges_input")


def downgrade() -> None:
    op.alter_column("accounts", "key_challenges_input", new_column_name="prospect_challenges")
