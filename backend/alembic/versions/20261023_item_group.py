"""item group_id for similar post aggregation

Revision ID: 20261023_group
Revises: 20261023_match_n
Create Date: 2026-10-23 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20261023_group"
down_revision: Union[str, None] = "20261023_match_n"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # SQLite 兼容：走 batch 模式加列与索引，PostgreSQL 下等价于普通 ALTER
    with op.batch_alter_table("item") as batch_op:
        batch_op.add_column(sa.Column("group_id", sa.Uuid(), nullable=True))
        batch_op.create_index(op.f("ix_item_group_id"), ["group_id"], unique=False)


def downgrade() -> None:
    with op.batch_alter_table("item") as batch_op:
        batch_op.drop_index(op.f("ix_item_group_id"), table_name="item")
        batch_op.drop_column("group_id")