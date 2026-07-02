"""Drop dead context/research fields from accounts table

These fields were duplicates of fields on the prospects table and were never
written by any code path. All context and research data lives on Prospect.

Revision ID: 017
Revises: 016
Create Date: 2026-07-02
"""

from alembic import op

revision = "017"
down_revision = "016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("accounts", "infrastructure_location")
    op.drop_column("accounts", "tech_stack_description")
    op.drop_column("accounts", "current_tools")
    op.drop_column("accounts", "key_challenges_input")
    op.drop_column("accounts", "research_cache")
    op.drop_column("accounts", "research_cached_at")
    op.drop_column("accounts", "research_started_at")
    op.drop_column("accounts", "prospect_corrections")
    op.drop_column("accounts", "research_confirmed_at")


def downgrade() -> None:
    import sqlalchemy as sa
    from sqlalchemy.dialects import postgresql

    op.add_column("accounts", sa.Column("research_confirmed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("accounts", sa.Column("prospect_corrections", sa.Text(), nullable=True))
    op.add_column("accounts", sa.Column("research_started_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("accounts", sa.Column("research_cached_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("accounts", sa.Column("research_cache", postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column("accounts", sa.Column("key_challenges_input", sa.Text(), nullable=True))
    op.add_column("accounts", sa.Column("current_tools", sa.Text(), nullable=True))
    op.add_column("accounts", sa.Column("tech_stack_description", sa.Text(), nullable=True))
    op.add_column("accounts", sa.Column("infrastructure_location", sa.Text(), nullable=True))
