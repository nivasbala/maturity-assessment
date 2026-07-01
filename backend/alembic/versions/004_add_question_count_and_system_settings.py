"""add question_count to pillars and system_settings table

Revision ID: 004
Revises: 003
Create Date: 2026-06-30

"""
from alembic import op
import sqlalchemy as sa

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add question_count to pillars (how many questions shown per session)
    op.add_column(
        "pillars",
        sa.Column("question_count", sa.Integer(), nullable=False, server_default="12"),
    )

    # System-wide settings table (key-value store)
    op.create_table(
        "system_settings",
        sa.Column("key", sa.String(100), primary_key=True),
        sa.Column("value", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
            onupdate=sa.text("now()"),
        ),
    )

    # Seed default bounds
    op.execute(
        """
        INSERT INTO system_settings (key, value, description) VALUES
        ('question_count_min', '12', 'Minimum number of questions per assessment session (hard floor)'),
        ('question_count_max', '25', 'Maximum number of questions per assessment session')
        ON CONFLICT (key) DO NOTHING
        """
    )


def downgrade() -> None:
    op.drop_table("system_settings")
    op.drop_column("pillars", "question_count")
