"""Recreate fk_assessments_prospect with ON DELETE SET NULL

Revision ID: 020
Revises: 019
Create Date: 2026-07-02

The original FK had no ON DELETE action, causing a constraint violation when
deleting a prospect that has assessments. Since prospect_id is nullable, SET NULL
is the correct behaviour: deleting a prospect orphans the assessment (keeps the
score/report data) rather than blocking or cascading the delete.
"""
from alembic import op

revision = "020"
down_revision = "019"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("fk_assessments_prospect", "assessments", type_="foreignkey")
    op.create_foreign_key(
        "fk_assessments_prospect",
        "assessments",
        "prospects",
        ["prospect_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_assessments_prospect", "assessments", type_="foreignkey")
    op.create_foreign_key(
        "fk_assessments_prospect",
        "assessments",
        "prospects",
        ["prospect_id"],
        ["id"],
    )
