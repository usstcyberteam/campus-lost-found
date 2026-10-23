import uuid

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.errors import ApiError
from app.models import Announcement, AnnouncementFavorite, User
from app.schemas.announcement import AnnouncementCreate, AnnouncementUpdate


def _favorite_stats(
    db: Session, announcement_ids: list[uuid.UUID], user_id: uuid.UUID
) -> tuple[dict[uuid.UUID, int], set[uuid.UUID]]:
    if not announcement_ids:
        return {}, set()
    rows = (
        db.query(AnnouncementFavorite.announcement_id, func.count(AnnouncementFavorite.id))
        .filter(AnnouncementFavorite.announcement_id.in_(announcement_ids))
        .group_by(AnnouncementFavorite.announcement_id)
        .all()
    )
    counts = {announcement_id: count for announcement_id, count in rows}
    mine = {
        row.announcement_id
        for row in db.query(AnnouncementFavorite)
        .filter(
            AnnouncementFavorite.announcement_id.in_(announcement_ids),
            AnnouncementFavorite.user_id == user_id,
        )
        .all()
    }
    return counts, mine


def _serialize(announcement: Announcement, author_name: str | None, favorite_count: int, is_favorited: bool) -> dict:
    return {
        "id": announcement.id,
        "title": announcement.title,
        "content": announcement.content,
        "is_pinned": announcement.is_pinned,
        "author_name": author_name,
        "created_at": announcement.created_at,
        "updated_at": announcement.updated_at,
        "favorite_count": favorite_count,
        "is_favorited": is_favorited,
    }


def _author_name(db: Session, announcement: Announcement) -> str | None:
    author = db.get(User, announcement.created_by_user_id)
    return author.display_name if author else None


def list_announcements(db: Session, user: User, limit: int, offset: int) -> tuple[list[dict], int]:
    total = db.query(Announcement).count()
    rows = (
        db.query(Announcement)
        .order_by(Announcement.is_pinned.desc(), Announcement.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    ids = [row.id for row in rows]
    counts, mine = _favorite_stats(db, ids, user.id)
    authors = {
        row.id: row.display_name
        for row in db.query(User).filter(User.id.in_({row.created_by_user_id for row in rows})).all()
    }
    items = [
        _serialize(row, authors.get(row.created_by_user_id), counts.get(row.id, 0), row.id in mine) for row in rows
    ]
    return items, total


def get_announcement(db: Session, user: User, announcement_id: uuid.UUID) -> dict:
    announcement = db.get(Announcement, announcement_id)
    if announcement is None:
        raise ApiError(404, "NOT_FOUND", "公告不存在")
    counts, mine = _favorite_stats(db, [announcement.id], user.id)
    return _serialize(
        announcement, _author_name(db, announcement), counts.get(announcement.id, 0), announcement.id in mine
    )


def create_announcement(db: Session, user: User, body: AnnouncementCreate) -> dict:
    announcement = Announcement(
        title=body.title,
        content=body.content,
        is_pinned=body.is_pinned,
        created_by_user_id=user.id,
    )
    db.add(announcement)
    db.commit()
    db.refresh(announcement)
    return _serialize(announcement, user.display_name, 0, False)


def update_announcement(db: Session, user: User, announcement_id: uuid.UUID, body: AnnouncementUpdate) -> dict:
    announcement = db.get(Announcement, announcement_id)
    if announcement is None:
        raise ApiError(404, "NOT_FOUND", "公告不存在")
    data = body.model_dump(exclude_unset=True)
    for field, value in data.items():
        if value is not None:
            setattr(announcement, field, value)
    db.commit()
    db.refresh(announcement)
    counts, mine = _favorite_stats(db, [announcement.id], user.id)
    return _serialize(
        announcement, _author_name(db, announcement), counts.get(announcement.id, 0), announcement.id in mine
    )


def delete_announcement(db: Session, announcement_id: uuid.UUID) -> None:
    announcement = db.get(Announcement, announcement_id)
    if announcement is None:
        raise ApiError(404, "NOT_FOUND", "公告不存在")
    db.query(AnnouncementFavorite).filter(AnnouncementFavorite.announcement_id == announcement_id).delete()
    db.delete(announcement)
    db.commit()


def set_favorite(db: Session, user: User, announcement_id: uuid.UUID, favored: bool) -> dict:
    if db.get(Announcement, announcement_id) is None:
        raise ApiError(404, "NOT_FOUND", "公告不存在")
    existing = (
        db.query(AnnouncementFavorite)
        .filter(
            AnnouncementFavorite.announcement_id == announcement_id,
            AnnouncementFavorite.user_id == user.id,
        )
        .first()
    )
    if favored and existing is None:
        db.add(AnnouncementFavorite(user_id=user.id, announcement_id=announcement_id))
        db.commit()
    elif not favored and existing is not None:
        db.delete(existing)
        db.commit()
    return get_announcement(db, user, announcement_id)


def list_my_favorites(db: Session, user: User, limit: int, offset: int) -> tuple[list[dict], int]:
    base = (
        db.query(AnnouncementFavorite, Announcement)
        .join(Announcement, Announcement.id == AnnouncementFavorite.announcement_id)
        .filter(AnnouncementFavorite.user_id == user.id)
    )
    total = base.count()
    rows = base.order_by(AnnouncementFavorite.created_at.desc()).offset(offset).limit(limit).all()
    items = [
        {
            "id": announcement.id,
            "title": announcement.title,
            "created_at": announcement.created_at,
            "favorited_at": favorite.created_at,
        }
        for favorite, announcement in rows
    ]
    return items, total
