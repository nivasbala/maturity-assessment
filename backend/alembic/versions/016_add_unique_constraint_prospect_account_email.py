"""Add unique constraint on (account_id, email) in prospects table

Prevents creating two prospects with the same email under the same account.
Returns 409 Conflict when attempted.

Revision ID: 016
Revises: 015
Create Date: 2026-07-02
"""

from alembic import op

revision = "016"
down_revision = "015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Remove any existing duplicates before adding the constraint.
    # Keep the earliest prospect per (account_id, email) pair.
    op.execute("""
        DELETE FROM prospects
        WHERE id NOT IN (
            SELECT DISTINCT ON (account_id, email) id
            FROM prospects
            ORDER BY account_id, email, created_at ASC
        )
    """)
    op.create_unique_constraint(
        "uq_prospect_account_email",
        "prospects",
        ["account_id", "email"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_prospect_account_email", "prospects", type_="unique")
