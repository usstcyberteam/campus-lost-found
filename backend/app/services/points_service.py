import uuid

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import PointReason, PointRecord, User

POINT_TITLES: tuple[tuple[int, str], ...] = (
    (0, "见习寻物人"),
    (20, "热心同学"),
    (60, "寻物能手"),
    (150, "校园守护者"),
    (300, "寻物传说"),
)

THANK_POINTS = 20
RETURN_POINTS = 15
TICKET_FEEDBACK_POINTS = 10


def add(db: Session, user_id: uuid.UUID, reason: PointReason, amount: int, ref_id: uuid.UUID) -> bool:
    """写入积分；同一 (user, reason, ref) 重复触发时静默幂等。"""
    savepoint = db.begin_nested()
    db.add(PointRecord(user_id=user_id, reason=reason, amount=amount, ref_id=ref_id))
    try:
        savepoint.commit()
    except IntegrityError:
        savepoint.rollback()
        return False
    return True


def total_for(db: Session, user_id: uuid.UUID) -> int:
    value = db.query(func.coalesce(func.sum(PointRecord.amount), 0)).filter(PointRecord.user_id == user_id).scalar()
    return int(value or 0)


def totals_for(db: Session, user_ids: list[uuid.UUID]) -> dict[uuid.UUID, int]:
    if not user_ids:
        return {}
    rows = (
        db.query(PointRecord.user_id, func.sum(PointRecord.amount))
        .filter(PointRecord.user_id.in_(user_ids))
        .group_by(PointRecord.user_id)
        .all()
    )
    return {row[0]: int(row[1] or 0) for row in rows}


def title_for(total: int) -> str:
    title = POINT_TITLES[0][1]
    for threshold, name in POINT_TITLES:
        if total >= threshold:
            title = name
        else:
            break
    return title


def next_title_for(total: int) -> tuple[str | None, int | None]:
    for threshold, name in POINT_TITLES:
        if total < threshold:
            return name, threshold
    return None, None


def get_my_points(db: Session, user: User, limit: int, offset: int) -> dict:
    total = total_for(db, user.id)
    next_title, next_threshold = next_title_for(total)
    query = db.query(PointRecord).filter(PointRecord.user_id == user.id)
    count = query.count()
    records = query.order_by(PointRecord.created_at.desc(), PointRecord.id.desc()).offset(offset).limit(limit).all()
    return {
        "total": total,
        "title": title_for(total),
        "next_title": next_title,
        "next_threshold": next_threshold,
        "records": records,
        "record_count": count,
    }
