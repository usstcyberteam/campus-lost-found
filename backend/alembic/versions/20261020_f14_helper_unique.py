"""item_helper unique constraint

Revision ID: 20261020_f14_uniq
Revises: 20261018_v2_inc
Create Date: 2026-10-20 10:00:00.000000

同一用户对同一帖子只允许一条委托记录。升级会先清理同组重复行：
优先保留状态为 active（进行中）的记录；同组没有 active 时保留
created_at 最早的一条；created_at 并列时保留 id 字典序最小的一条。
同组同时存在 active 与 abandoned 时，abandoned 行会被删除。

不可逆点：
- 升级删除的重复记录不可恢复，降级只移除约束，不会还原数据。
- 降级后数据库可再次出现同组多行。
"""
from typing import Sequence, Union

from alembic import op


revision: str = "20261020_f14_uniq"
down_revision: Union[str, None] = "20261018_v2_inc"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 先清理历史重复，否则加约束会直接失败；两步在同一迁移事务内，失败整体回滚
    op.execute(
        """
        DELETE FROM item_helper
        WHERE id IN (
            SELECT id
            FROM (
                SELECT
                    id,
                    ROW_NUMBER() OVER (
                        PARTITION BY item_id, user_id
                        ORDER BY
                            CASE WHEN status = 'active' THEN 0 ELSE 1 END,
                            created_at ASC,
                            id ASC
                    ) AS rn
                FROM item_helper
            ) ranked
            WHERE rn > 1
        )
        """
    )
    # batch 模式让 SQLite 走重建表，PostgreSQL 走原生 ALTER TABLE
    with op.batch_alter_table("item_helper") as batch_op:
        batch_op.create_unique_constraint("uq_item_helper_item_user", ["item_id", "user_id"])


def downgrade() -> None:
    with op.batch_alter_table("item_helper") as batch_op:
        batch_op.drop_constraint("uq_item_helper_item_user", type_="unique")
