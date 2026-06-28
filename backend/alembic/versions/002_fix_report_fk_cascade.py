"""fix report fk cascade

Revision ID: 002
Revises: 001
Create Date: 2026-06-28

"""
from alembic import op

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("fk_reports_assessment", "reports", type_="foreignkey")
    op.create_foreign_key(
        "fk_reports_assessment",
        "reports",
        "assessments",
        ["assessment_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    op.drop_constraint("fk_reports_assessment", "reports", type_="foreignkey")
    op.create_foreign_key(
        "fk_reports_assessment",
        "reports",
        "assessments",
        ["assessment_id"],
        ["id"],
    )
