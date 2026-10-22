import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_role
from app.database import get_db
from app.models import Role, User
from app.schemas.comment import CommentCreate, CommentDeletedOut, CommentHiddenOut, CommentOut, ModerationCommentOut
from app.schemas.common import Page
from app.services import comment_service

router = APIRouter(tags=["comments"])


@router.get("/items/{item_id}/comments", response_model=Page[CommentOut])
def list_comments(
    item_id: uuid.UUID,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    items, total = comment_service.list_comments(db, item_id, limit, offset)
    return Page(items=items, total=total, limit=limit, offset=offset)


@router.post("/items/{item_id}/comments", response_model=CommentOut)
def create_comment(
    item_id: uuid.UUID,
    body: CommentCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return comment_service.create_comment(db, user, item_id, body)


@router.get("/comments/moderation", response_model=Page[ModerationCommentOut])
def moderation_list(
    hidden: bool | None = None,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    _: User = Depends(require_role(Role.staff, Role.admin)),
):
    items, total = comment_service.list_for_moderation(db, hidden, limit, offset)
    return Page(items=items, total=total, limit=limit, offset=offset)


@router.post("/comments/{comment_id}/hide", response_model=CommentHiddenOut)
def hide_comment(
    comment_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(Role.staff, Role.admin)),
):
    return comment_service.set_hidden(db, comment_id, True)


@router.post("/comments/{comment_id}/unhide", response_model=CommentHiddenOut)
def unhide_comment(
    comment_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(Role.staff, Role.admin)),
):
    return comment_service.set_hidden(db, comment_id, False)


@router.delete("/comments/{comment_id}", response_model=CommentDeletedOut)
def delete_comment(comment_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return comment_service.delete_comment(db, user, comment_id)