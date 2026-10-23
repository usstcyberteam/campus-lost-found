"""merge match/group chain with x2a mergepoint

Revision ID: 20261023_merge2
Revises: 20261023_group, 20261023_merge
Create Date: 2026-10-23 18:00:00.000000

合并相似帖聚合/匹配通知链与 X2A 地图合并点，本身不修改表结构。
"""
from collections.abc import Sequence


revision: str = "20261023_merge2"
down_revision: tuple[str, str] = ("20261023_group", "20261023_merge")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass