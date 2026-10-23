import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_role
from app.database import get_db
from app.models import Role, User
from app.schemas.announcement import (
    AnnouncementCreate,
    AnnouncementFavoriteOut,
    AnnouncementOut,
    AnnouncementUpdate,
)
from app.schemas.common import Page
from app.services import announcement_service

router = APIRouter(tags=["announcements"])


@router.get("/announcements", response_model=Page[AnnouncementOut])
def list_announcements(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    items, total = announcement_service.list_announcements(db, user, limit, offset)
    return Page(items=items, total=total, limit=limit, offset=offset)


@router.get("/me/announcement-favorites", response_model=Page[AnnouncementFavoriteOut])
def my_announcement_favorites(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    items, total = announcement_service.list_my_favorites(db, user, limit, offset)
    return Page(items=items, total=total, limit=limit, offset=offset)


@router.post("/announcements", response_model=AnnouncementOut)
def create_announcement(
    body: AnnouncementCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_role(Role.admin)),
):
    return announcement_service.create_announcement(db, admin, body)


@router.get("/announcements/{announcement_id}", response_model=AnnouncementOut)
def get_announcement(
    announcement_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return announcement_service.get_announcement(db, user, announcement_id)


@router.patch("/announcements/{announcement_id}", response_model=AnnouncementOut)
def update_announcement(
    announcement_id: uuid.UUID,
    body: AnnouncementUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_role(Role.admin)),
):
    return announcement_service.update_announcement(db, admin, announcement_id, body)


@router.delete("/announcements/{announcement_id}")
def delete_announcement(
    announcement_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(Role.admin)),
):
    announcement_service.delete_announcement(db, announcement_id)
    return {"ok": True}


@router.post("/announcements/{announcement_id}/favorite", response_model=AnnouncementOut)
def favorite_announcement(
    announcement_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return announcement_service.set_favorite(db, user, announcement_id, True)


@router.delete("/announcements/{announcement_id}/favorite", response_model=AnnouncementOut)
def unfavorite_announcement(
    announcement_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return announcement_service.set_favorite(db, user, announcement_id, False)
