import uuid

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.errors import ApiError
from app.models import Comment, Item, ItemFavorite, ItemLike, User


def _ensure_item(db: Session, item_id: uuid.UUID) -> Item:
    item = db.get(Item, item_id)
    if item is None:
        raise ApiError(404, "NOT_FOUND", "记录不存在")
    return item


def counts_for_items(db: Session, item_ids: list[uuid.UUID], user_id: uuid.UUID) -> dict[uuid.UUID, dict]:
    if not item_ids:
        return {}
    like_counts = dict(
        db.query(ItemLike.item_id, func.count(ItemLike.id))
        .filter(ItemLike.item_id.in_(item_ids))
        .group_by(ItemLike.item_id)
        .all()
    )
    favorite_counts = dict(
        db.query(ItemFavorite.item_id, func.count(ItemFavorite.id))
        .filter(ItemFavorite.item_id.in_(item_ids))
        .group_by(ItemFavorite.item_id)
        .all()
    )
    comment_counts = dict(
        db.query(Comment.item_id, func.count(Comment.id))
        .filter(Comment.item_id.in_(item_ids), Comment.is_deleted.is_(False))
        .group_by(Comment.item_id)
        .all()
    )
    liked = {
        row[0]
        for row in db.query(ItemLike.item_id).filter(ItemLike.item_id.in_(item_ids), ItemLike.user_id == user_id).all()
    }
    favorited = {
        row[0]
        for row in db.query(ItemFavorite.item_id)
        .filter(ItemFavorite.item_id.in_(item_ids), ItemFavorite.user_id == user_id)
        .all()
    }
    return {
        item_id: {
            "like_count": int(like_counts.get(item_id, 0)),
            "favorite_count": int(favorite_counts.get(item_id, 0)),
            "comment_count": int(comment_counts.get(item_id, 0)),
            "is_liked": item_id in liked,
            "is_favorited": item_id in favorited,
        }
        for item_id in item_ids
    }


def _state(db: Session, user: User, item_id: uuid.UUID) -> dict:
    counts = counts_for_items(db, [item_id], user.id)[item_id]
    return {
        "liked": counts["is_liked"],
        "favorited": counts["is_favorited"],
        "like_count": counts["like_count"],
        "favorite_count": counts["favorite_count"],
    }


def set_like(db: Session, user: User, item_id: uuid.UUID, active: bool) -> dict:
    _ensure_item(db, item_id)
    existing = db.query(ItemLike).filter(ItemLike.item_id == item_id, ItemLike.user_id == user.id).first()
    if active and existing is None:
        db.add(ItemLike(item_id=item_id, user_id=user.id))
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
    elif not active and existing is not None:
        db.delete(existing)
        db.commit()
    return _state(db, user, item_id)


def set_favorite(db: Session, user: User, item_id: uuid.UUID, active: bool) -> dict:
    _ensure_item(db, item_id)
    existing = db.query(ItemFavorite).filter(ItemFavorite.item_id == item_id, ItemFavorite.user_id == user.id).first()
    if active and existing is None:
        db.add(ItemFavorite(item_id=item_id, user_id=user.id))
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
    elif not active and existing is not None:
        db.delete(existing)
        db.commit()
    return _state(db, user, item_id)


def list_liked_items(db: Session, user: User, limit: int, offset: int) -> tuple[list[Item], int]:
    query = db.query(Item).join(ItemLike, ItemLike.item_id == Item.id).filter(ItemLike.user_id == user.id)
    total = query.count()
    items = query.order_by(ItemLike.created_at.desc()).offset(offset).limit(limit).all()
    return items, total


def list_favorited_items(db: Session, user: User, limit: int, offset: int) -> tuple[list[Item], int]:
    query = db.query(Item).join(ItemFavorite, ItemFavorite.item_id == Item.id).filter(ItemFavorite.user_id == user.id)
    total = query.count()
    items = query.order_by(ItemFavorite.created_at.desc()).offset(offset).limit(limit).all()
    return items, total
