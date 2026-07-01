"""Add prospect context and research confirmation fields to accounts

Revision ID: 006
Revises: 005
Create Date: 2026-07-01
"""
from alembic import op
import sqlalchemy as sa

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("accounts", sa.Column("infrastructure_location", sa.Text(), nullable=True))
    op.add_column("accounts", sa.Column("tech_stack_description", sa.Text(), nullable=True))
    op.add_column("accounts", sa.Column("current_tools", sa.Text(), nullable=True))
    op.add_column("accounts", sa.Column("prospect_corrections", sa.Text(), nullable=True))
    op.add_column(
        "accounts",
        sa.Column("research_confirmed_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("accounts", "research_confirmed_at")
    op.drop_column("accounts", "prospect_corrections")
    op.drop_column("accounts", "current_tools")
    op.drop_column("accounts", "tech_stack_description")
    op.drop_column("accounts", "infrastructure_location")
