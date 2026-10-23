"""layer kind and building 2.5d geometry

Revision ID: 20261020_x2a_map
Revises: 20261020_f14_uniq
Create Date: 2026-10-20 12:00:00.000000

为图层增加三分类与房间数据，为建筑增加 2.5D 命中区、2.5D 标签、绘制层级与入口节点。
回填只依据既有列：有楼层的图层记为 floor，无楼层且无建筑的记为 flat；
iso 不做名称猜测，由素材导入流程按 kind 幂等写入。

不可逆点：
- 降级删除 kind 后，三类图层无法再区分，楼层图与室外图会退化为同一类型；
- 降级删除 iso_hit_area 与 iso_label_position 后，2.5D 建筑几何丢失，需重新导入素材；
- 降级删除 draw_order 与 entrance_node 后，绘制层级与入口节点丢失，同样只能重新导入。
本迁移不改动任何帖子、路线、点位的坐标，也不删除旧底图文件。
"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op


revision: str = "20261020_x2a_map"
down_revision: str | None = "20261020_f14_uniq"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 先加带 server_default 的非空列，既有行不会因缺值失败
    with op.batch_alter_table("layer") as batch_op:
        batch_op.add_column(sa.Column("kind", sa.String(length=16), nullable=False, server_default="flat"))
    # 楼层图优先：有楼层号的图层一律归为 floor，其余室外图层归为 flat
    op.execute("UPDATE layer SET kind='floor' WHERE floor IS NOT NULL")
    op.execute("UPDATE layer SET kind='flat' WHERE floor IS NULL AND building_id IS NULL")
    with op.batch_alter_table("layer") as batch_op:
        batch_op.add_column(sa.Column("rooms", sa.JSON(), nullable=True))
        # 换算矩阵随素材导入写入，请求时不再读取素材文件
        batch_op.add_column(sa.Column("transform", sa.JSON(), nullable=True))
    op.create_index("ix_layer_kind", "layer", ["kind"])
    # 图层收敛需要按创建时间取最早一条，补齐时间戳
    with op.batch_alter_table("layer") as batch_op:
        batch_op.add_column(
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("CURRENT_TIMESTAMP"),
                nullable=False,
            )
        )
    op.create_index("ix_layer_created_at", "layer", ["created_at"])
    with op.batch_alter_table("building") as batch_op:
        batch_op.add_column(sa.Column("iso_hit_area", sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column("iso_label_position", sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column("draw_order", sa.Integer(), nullable=False, server_default="0"))
        batch_op.add_column(sa.Column("entrance_node", sa.Integer(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("building") as batch_op:
        batch_op.drop_column("entrance_node")
        batch_op.drop_column("draw_order")
        batch_op.drop_column("iso_label_position")
        batch_op.drop_column("iso_hit_area")
    op.drop_index("ix_layer_created_at", table_name="layer")
    op.drop_index("ix_layer_kind", table_name="layer")
    with op.batch_alter_table("layer") as batch_op:
        batch_op.drop_column("created_at")
        batch_op.drop_column("rooms")
        batch_op.drop_column("transform")
        batch_op.drop_column("kind")