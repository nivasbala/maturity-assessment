"""Add prospect_corrections to prospects table

Stores the prospect's freetext corrections/additions to the Agent 1 research
summary, entered on the research results page before starting their assessment.

Revision ID: 018
Revises: 017
Create Date: 2026-07-02
"""

import sqlalchemy as sa
from alembic import op

revision = "018"
down_revision = "017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("prospects", sa.Column("prospect_corrections", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("prospects", "prospect_corrections")
