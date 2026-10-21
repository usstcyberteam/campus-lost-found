import uuid

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.errors import ApiError
from app.models import Direction, HelperStatus, Item, ItemHelper, ItemStatus, PointReason, User
from app.schemas.helper import ThankRequest
from app.services import points_service


def _ensure_item(db: Session, item_id: uuid.UUID) -> Item:
    item = db.get(Item, item_id)
    if item is None:
        raise ApiError(404, "NOT_FOUND", "记录不存在")
    return item


def _active_helper(db: Session, item_id: uuid.UUID, user_id: uuid.UUID) -> ItemHelper | None:
    return (
        db.query(ItemHelper)
        .filter(ItemHelper.item_id == item_id, ItemHelper.user_id == user_id, ItemHelper.status == HelperStatus.active)
        .first()
    )


def stats_for_items(db: Session, item_ids: list[uuid.UUID], user_id: uuid.UUID) -> dict[uuid.UUID, dict]:
    if not item_ids:
        return {}
    counts = dict(
        db.query(ItemHelper.item_id, func.count(ItemHelper.id))
        .filter(ItemHelper.item_id.in_(item_ids), ItemHelper.status == HelperStatus.active)
        .group_by(ItemHelper.item_id)
        .all()
    )
    mine = {
        row[0]
        for row in db.query(ItemHelper.item_id)
        .filter(
            ItemHelper.item_id.in_(item_ids),
            ItemHelper.user_id == user_id,
            ItemHelper.status == HelperStatus.active,
        )
        .all()
    }
    return {
        item_id: {"helper_count": int(counts.get(item_id, 0)), "is_helper": item_id in mine} for item_id in item_ids
    }


def list_helpers(db: Session, item_id: uuid.UUID) -> list[dict]:
    rows = (
        db.query(ItemHelper, User)
        .join(User, User.id == ItemHelper.user_id)
        .filter(ItemHelper.item_id == item_id, ItemHelper.status == HelperStatus.active)
        .order_by(ItemHelper.created_at.asc(), ItemHelper.id.asc())
        .all()
    )
    totals = points_service.totals_for(db, [user.id for _, user in rows])
    return [
        {
            "id": helper.id,
            "display_name": user.display_name,
            "title": points_service.title_for(totals.get(user.id, 0)),
            "thanked": helper.thanked,
        }
        for helper, user in rows
    ]


def list_my_helping(db: Session, user: User, limit: int, offset: int) -> tuple[list[tuple[ItemHelper, Item]], int]:
    total = db.query(ItemHelper).filter(ItemHelper.user_id == user.id).count()
    rows = (
        db.query(ItemHelper, Item)
        .join(Item, Item.id == ItemHelper.item_id)
        .filter(ItemHelper.user_id == user.id)
        .order_by(ItemHelper.created_at.desc(), ItemHelper.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [(helper, item) for helper, item in rows], total


def take_helper(db: Session, user: User, item_id: uuid.UUID) -> dict:
    item = _ensure_item(db, item_id)
    if item.owner_user_id == user.id:
        raise ApiError(403, "FORBIDDEN", "不能接取自己发布的委托")
    if item.direction != Direction.lost or item.status not in (ItemStatus.searching, ItemStatus.reviewing):
        raise ApiError(409, "STATE_CONFLICT", "该记录当前不可接取")
    if _active_helper(db, item_id, user.id) is not None:
        raise ApiError(409, "STATE_CONFLICT", "已接取该委托")
    db.add(ItemHelper(item_id=item_id, user_id=user.id, status=HelperStatus.active))
    db.commit()
    count = db.query(ItemHelper).filter(ItemHelper.item_id == item_id, ItemHelper.status == HelperStatus.active).count()
    return {"helper_count": count, "is_helper": True}


def abandon_helper(db: Session, user: User, item_id: uuid.UUID) -> dict:
    item = _ensure_item(db, item_id)
    if item.owner_user_id == user.id:
        raise ApiError(403, "FORBIDDEN", "发布者无需放弃委托")
    helper = _active_helper(db, item_id, user.id)
    if helper is None:
        raise ApiError(409, "STATE_CONFLICT", "尚未接取该委托")
    helper.status = HelperStatus.abandoned
    db.commit()
    count = db.query(ItemHelper).filter(ItemHelper.item_id == item_id, ItemHelper.status == HelperStatus.active).count()
    return {"helper_count": count, "is_helper": False}


def thank_helpers(db: Session, user: User, item_id: uuid.UUID, body: ThankRequest) -> dict:
    item = _ensure_item(db, item_id)
    if item.owner_user_id != user.id:
        raise ApiError(403, "FORBIDDEN", "只有发布者可以致谢")
    if item.direction != Direction.lost or item.status != ItemStatus.found:
        raise ApiError(409, "STATE_CONFLICT", "只有已找回的寻物记录可以致谢")
    helper_ids = list(dict.fromkeys(body.helper_ids))
    helpers = (
        db.query(ItemHelper)
        .filter(
            ItemHelper.id.in_(helper_ids),
            ItemHelper.item_id == item_id,
            ItemHelper.status == HelperStatus.active,
        )
        .all()
    )
    if len(helpers) != len(helper_ids):
        raise ApiError(409, "STATE_CONFLICT", "协助者不存在或已放弃")
    for helper in helpers:
        if helper.thanked:
            continue
        helper.thanked = True
        points_service.add(db, helper.user_id, PointReason.thank, points_service.THANK_POINTS, helper.id)
    db.commit()
    return {"thanked_count": len(helpers)}
