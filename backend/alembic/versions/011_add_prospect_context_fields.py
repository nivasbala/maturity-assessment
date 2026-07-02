"""Add context, registration, and research fields to prospects

Revision ID: 011
Revises: 010
Create Date: 2026-07-01
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY, JSONB

revision = "011"
down_revision = "010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Registration state
    op.add_column("prospects", sa.Column("is_registered", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("prospects", sa.Column("registered_at", sa.DateTime(timezone=True), nullable=True))

    # Prospect-provided context (collected at registration)
    op.add_column("prospects", sa.Column("job_title", sa.String(255), nullable=True))
    op.add_column("prospects", sa.Column("infrastructure_location", sa.Text(), nullable=True))
    op.add_column("prospects", sa.Column("tech_stack_description", sa.Text(), nullable=True))
    op.add_column("prospects", sa.Column("current_tools", sa.Text(), nullable=True))
    op.add_column("prospects", sa.Column("key_challenges_input", sa.Text(), nullable=True))

    # Research cache (populated by Agent 1 at prospect creation)
    op.add_column("prospects", sa.Column("research_cache", JSONB(), nullable=True))
    op.add_column("prospects", sa.Column("research_cached_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("prospects", sa.Column("research_started_at", sa.DateTime(timezone=True), nullable=True))

    # Suggested pillars from research (array of pillar name strings)
    op.add_column("prospects", sa.Column("suggested_pillars", ARRAY(sa.String()), nullable=True))


def downgrade() -> None:
    op.drop_column("prospects", "suggested_pillars")
    op.drop_column("prospects", "research_started_at")
    op.drop_column("prospects", "research_cached_at")
    op.drop_column("prospects", "research_cache")
    op.drop_column("prospects", "key_challenges_input")
    op.drop_column("prospects", "current_tools")
    op.drop_column("prospects", "tech_stack_description")
    op.drop_column("prospects", "infrastructure_location")
    op.drop_column("prospects", "job_title")
    op.drop_column("prospects", "registered_at")
    op.drop_column("prospects", "is_registered")
