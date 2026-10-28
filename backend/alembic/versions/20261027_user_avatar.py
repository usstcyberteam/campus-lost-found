"""user avatar path

Revision ID: 20261027_avatar
Revises: 20261023_merge2
Create Date: 2026-10-27 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20261027_avatar"
down_revision: Union[str, None] = "20261023_merge2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # batch 模式：SQLite 本地库与 PostgreSQL 部署库都能升级
    with op.batch_alter_table("user") as batch_op:
        batch_op.add_column(sa.Column("avatar_path", sa.String(length=128), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("user") as batch_op:
        batch_op.drop_column("avatar_path")
