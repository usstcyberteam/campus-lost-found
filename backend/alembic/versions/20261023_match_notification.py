"""ai match notification table

Revision ID: 20261023_match_n
Revises: 20261023_content
Create Date: 2026-10-23 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20261023_match_n"
down_revision: Union[str, None] = "20261023_content"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "notification",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("kind", sa.String(length=16), nullable=False),
        sa.Column("title", sa.String(length=128), nullable=False),
        sa.Column("content", sa.String(length=500), nullable=False),
        sa.Column("link", sa.String(length=256), nullable=False, server_default=""),
        sa.Column("related_item_id", sa.Uuid(), nullable=True),
        sa.Column("source", sa.String(length=8), nullable=False, server_default="rule"),
        sa.Column("read", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)")),
        sa.Column("dedup_key", sa.String(length=160), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("dedup_key", name="uq_notification_dedup_key"),
    )
    op.create_index(op.f("ix_notification_user_id"), "notification", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_notification_user_id"), table_name="notification")
    op.drop_table("notification")