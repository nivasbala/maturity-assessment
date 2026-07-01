"""add research_data column to reports

Revision ID: 005
Revises: 004
Create Date: 2026-07-01

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("reports", sa.Column("research_data", JSONB, nullable=True))


def downgrade() -> None:
    op.drop_column("reports", "research_data")
