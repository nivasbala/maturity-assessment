"""Backfill and default prospects.suggested_pillars to NOT NULL '{}'

Revision ID: 021
Revises: 020
Create Date: 2026-07-29

spec/04-data-model.md specifies suggested_pillars as VARCHAR(100)[] DEFAULT
'{}'. The column was added nullable with no default (011), so rows could end
up NULL instead of an empty array. Brings it in line with
accounts.suggested_pillars, which already has NOT NULL + server_default.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY

revision = "021"
down_revision = "020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("UPDATE prospects SET suggested_pillars = '{}' WHERE suggested_pillars IS NULL")
    op.alter_column(
        "prospects",
        "suggested_pillars",
        existing_type=ARRAY(sa.String()),
        nullable=False,
        server_default=sa.text("'{}'::character varying[]"),
    )


def downgrade() -> None:
    op.alter_column(
        "prospects",
        "suggested_pillars",
        existing_type=ARRAY(sa.String()),
        nullable=True,
        server_default=None,
    )
