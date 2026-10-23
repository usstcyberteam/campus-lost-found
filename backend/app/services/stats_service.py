from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Building, Claim, ClaimStatus, Item, ItemStatus
from app.models.enums import Direction

# 进行中状态：与大厅过滤、认领可用状态保持一致
_ACTIVE_STATUSES = (ItemStatus.searching, ItemStatus.pending, ItemStatus.reviewing)
_STATUS_ORDER = (
    ItemStatus.searching,
    ItemStatus.pending,
    ItemStatus.reviewing,
    ItemStatus.found,
    ItemStatus.returned,
    ItemStatus.withdrawn,
)


def overview(db: Session) -> dict:
    """全校失物招领概览。已删除记录不计入任何口径，避免下架内容影响统计。"""
    visible = db.query(Item).filter(Item.status != ItemStatus.deleted)
    total_items = visible.count()
    lost_count = visible.filter(Item.direction == Direction.lost).count()
    found_count = visible.filter(Item.direction == Direction.found).count()
    active_count = visible.filter(Item.status.in_(_ACTIVE_STATUSES)).count()
    returned_count = visible.filter(Item.status == ItemStatus.returned).count()

    status_rows = (
        db.query(Item.status, func.count(Item.id)).filter(Item.status != ItemStatus.deleted).group_by(Item.status).all()
    )
    status_counts = {status: count for status, count in status_rows}

    claim_rows = db.query(Claim.status, func.count(Claim.id)).group_by(Claim.status).all()
    claim_counts = {status: count for status, count in claim_rows}

    building_rows = (
        db.query(Building.id, Building.name, func.count(Item.id))
        .join(Item, Item.building_id == Building.id)
        .filter(Item.status != ItemStatus.deleted)
        .group_by(Building.id, Building.name)
        .order_by(func.count(Item.id).desc())
        .all()
    )
    category_rows = (
        db.query(Item.category, func.count(Item.id))
        .filter(Item.status != ItemStatus.deleted)
        .group_by(Item.category)
        .order_by(func.count(Item.id).desc())
        .all()
    )

    durations = [
        (updated - created).total_seconds() / 3600
        for created, updated in db.query(Item.created_at, Item.updated_at)
        .filter(Item.status == ItemStatus.returned)
        .all()
        if created is not None and updated is not None
    ]

    return {
        "total_items": total_items,
        "lost_count": lost_count,
        "found_count": found_count,
        "active_count": active_count,
        "returned_count": returned_count,
        "claim_total": sum(claim_counts.values()),
        "claim_pending": claim_counts.get(ClaimStatus.pending, 0),
        "claim_approved": claim_counts.get(ClaimStatus.approved, 0),
        "claim_completed": claim_counts.get(ClaimStatus.completed, 0),
        # 找回率：已确认归还的记录数 / 寻物记录总数
        "recovery_rate": round(returned_count / lost_count, 4) if lost_count else 0.0,
        # 平均处理时长：已归还记录从发布到更新的平均小时数（近似值）
        "avg_handling_hours": round(sum(durations) / len(durations), 2) if durations else None,
        "by_building": [{"key": str(bid), "name": name, "count": count} for bid, name, count in building_rows],
        "by_category": [{"key": category, "name": category, "count": count} for category, count in category_rows[:10]],
        "by_status": [
            {"key": status.value, "name": status.value, "count": status_counts.get(status, 0)}
            for status in _STATUS_ORDER
        ],
    }
