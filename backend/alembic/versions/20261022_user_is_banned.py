"""add user.is_banned

Revision ID: 20261022_user_ban
Revises: 20261020_f14_uniq
Create Date: 2026-10-22 11:00:00.000000

新增用户封禁标记：封禁后登录被拒，且已签发令牌在下次请求时立即失效。
ItemStatus 新增 deleted 值不涉及约束（枚举列无 CHECK），无需数据迁移。
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20261022_user_ban"
down_revision: Union[str, None] = "20261020_f14_uniq"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("user") as batch_op:
        batch_op.add_column(sa.Column("is_banned", sa.Boolean(), nullable=False, server_default="0"))


def downgrade() -> None:
    with op.batch_alter_table("user") as batch_op:
        batch_op.drop_column("is_banned")