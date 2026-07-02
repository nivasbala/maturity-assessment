"""Add prospects table

Revision ID: 010
Revises: 009
Create Date: 2026-07-01
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "prospects",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("account_id", UUID(as_uuid=True), sa.ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column("short_url_token", sa.String(16), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_prospects_account_id", "prospects", ["account_id"])
    op.create_index("ix_prospects_short_url_token", "prospects", ["short_url_token"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_prospects_short_url_token", table_name="prospects")
    op.drop_index("ix_prospects_account_id", table_name="prospects")
    op.drop_table("prospects")
