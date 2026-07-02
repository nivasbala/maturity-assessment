"""Add prospect_role, p3_gate_answered_yes, p4_gate_answered_yes to prospects table

These fields were previously only stored in the session token JWT and sessionStorage,
which meant returning visitors lost their role selection and gate answers on a fresh
browser session. Persisting them to the DB allows GET /assess/{token} to pre-fill
all form fields for returning visitors.

Revision ID: 015
Revises: 014
Create Date: 2026-07-02
"""
from alembic import op
import sqlalchemy as sa

revision = "015"
down_revision = "014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("prospects", sa.Column("prospect_role", sa.String(100), nullable=True))
    op.add_column("prospects", sa.Column("p3_gate_answered_yes", sa.Boolean(), nullable=True))
    op.add_column("prospects", sa.Column("p4_gate_answered_yes", sa.Boolean(), nullable=True))


def downgrade() -> None:
    op.drop_column("prospects", "p3_gate_answered_yes")
    op.drop_column("prospects", "p4_gate_answered_yes")
    op.drop_column("prospects", "prospect_role")
