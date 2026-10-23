"""离线回填相似帖聚合 group_id（管理命令，手动触发）。

对历史存量的进行中帖（发布时早于聚合功能上线、无 group_id）按发布时同款规则
（item_group_service.assign_group）重新聚类：按 created_at 升序逐帖判定，
命中的帖子归入同一 group_id，与线上发布时行为完全一致。

用法：
    cd backend
    .venv/Scripts/python scripts/backfill_groups.py            # 执行回填
    .venv/Scripts/python scripts/backfill_groups.py --dry-run  # 只统计不写库
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select  # noqa: E402

from app.database import SessionLocal  # noqa: E402
from app.models import Item, ItemStatus  # noqa: E402
from app.services.item_group_service import assign_group  # noqa: E402


def backfill(dry_run: bool = False) -> None:
    db = SessionLocal()
    try:
        # 仅回填进行中（非删除/非终态）且未聚类的帖；按时间升序保证后发帖归入先发帖的组
        items = db.scalars(
            select(Item)
            .where(Item.group_id.is_(None), Item.status != ItemStatus.deleted)
            .order_by(Item.created_at.asc())
        ).all()
        print(f"待回填帖子：{len(items)} 条")
        grouped = 0
        for item in items:
            before = item.group_id
            assign_group(db, item)
            if item.group_id is not None and before is None:
                grouped += 1

        print(f"命中聚合规则：{grouped} 条帖将被标记 group_id")
        if dry_run:
            db.rollback()
            print("dry-run：已回滚，未写库")
        else:
            db.commit()
            print(f"已提交：本次共 {grouped} 条帖获得聚合分组")
    finally:
        db.close()


if __name__ == "__main__":
    backfill(dry_run="--dry-run" in sys.argv)
