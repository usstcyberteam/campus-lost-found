"""merge x2a map views and content modules

Revision ID: 20261023_merge
Revises: 20261020_x2a_map, 20261023_content
Create Date: 2026-10-23 12:00:00.000000

合并且 X2a 地图三视图与内容模块两条迁移链，本身不修改表结构。
"""
from collections.abc import Sequence


revision: str = "20261023_merge"
down_revision: tuple[str, str] = ("20261020_x2a_map", "20261023_content")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass