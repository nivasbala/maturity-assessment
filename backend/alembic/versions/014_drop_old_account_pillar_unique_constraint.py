"""Drop uq_assessment_account_pillar to allow multiple prospects per account+pillar

The old constraint (account_id, pillar_id) blocked a second prospect in the same
account from taking an assessment on the same pillar.  The partial unique index
added in migration 012 (account_id, prospect_id, pillar_id WHERE prospect_id IS
NOT NULL) correctly handles per-prospect uniqueness, so the old constraint is
now redundant and harmful.

Revision ID: 014
Revises: 013
Create Date: 2026-07-02
"""
from alembic import op

revision = "014"
down_revision = "013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE assessments DROP CONSTRAINT IF EXISTS uq_assessment_account_pillar")


def downgrade() -> None:
    op.execute(
        "ALTER TABLE assessments ADD CONSTRAINT uq_assessment_account_pillar "
        "UNIQUE (account_id, pillar_id)"
    )
