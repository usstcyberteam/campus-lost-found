"""content modules: announcement, praise, comment moderation

Revision ID: 20261023_content
Revises: 20261022_user_ban
Create Date: 2026-10-23 10:00:00.000000

新增公告（含收藏）、表扬墙两张表，并为评论增加工作人员审核隐藏标记。
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20261023_content"
down_revision: Union[str, None] = "20261022_user_ban"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "announcement",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=128), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("is_pinned", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_by_user_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_announcement_created_by_user_id"), "announcement", ["created_by_user_id"])
    op.create_index(op.f("ix_announcement_created_at"), "announcement", ["created_at"])

    op.create_table(
        "announcement_favorite",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("announcement_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"]),
        sa.ForeignKeyConstraint(["announcement_id"], ["announcement.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "announcement_id", name="uq_announcement_favorite"),
    )
    op.create_index(op.f("ix_announcement_favorite_user_id"), "announcement_favorite", ["user_id"])
    op.create_index(op.f("ix_announcement_favorite_announcement_id"), "announcement_favorite", ["announcement_id"])

    op.create_table(
        "praise",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("item_id", sa.Uuid(), nullable=True),
        sa.Column("from_user_id", sa.Uuid(), nullable=False),
        sa.Column("to_user_id", sa.Uuid(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["item_id"], ["item.id"]),
        sa.ForeignKeyConstraint(["from_user_id"], ["user.id"]),
        sa.ForeignKeyConstraint(["to_user_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_praise_item_id"), "praise", ["item_id"])
    op.create_index(op.f("ix_praise_from_user_id"), "praise", ["from_user_id"])
    op.create_index(op.f("ix_praise_to_user_id"), "praise", ["to_user_id"])
    op.create_index(op.f("ix_praise_created_at"), "praise", ["created_at"])

    with op.batch_alter_table("comment") as batch_op:
        batch_op.add_column(sa.Column("is_hidden", sa.Boolean(), nullable=False, server_default="0"))


def downgrade() -> None:
    with op.batch_alter_table("comment") as batch_op:
        batch_op.drop_column("is_hidden")
    op.drop_index(op.f("ix_praise_created_at"), table_name="praise")
    op.drop_index(op.f("ix_praise_to_user_id"), table_name="praise")
    op.drop_index(op.f("ix_praise_from_user_id"), table_name="praise")
    op.drop_index(op.f("ix_praise_item_id"), table_name="praise")
    op.drop_table("praise")
    op.drop_index(op.f("ix_announcement_favorite_announcement_id"), table_name="announcement_favorite")
    op.drop_index(op.f("ix_announcement_favorite_user_id"), table_name="announcement_favorite")
    op.drop_table("announcement_favorite")
    op.drop_index(op.f("ix_announcement_created_at"), table_name="announcement")
    op.drop_index(op.f("ix_announcement_created_by_user_id"), table_name="announcement")
    op.drop_table("announcement")