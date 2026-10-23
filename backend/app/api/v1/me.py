from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models import Badge, Item, ItemHelper, User
from app.schemas.auth import BadgeOut, PasswordChangeRequest, ProfileUpdate, UserOut
from app.schemas.claim import ClaimOut, MyClaimOut
from app.schemas.comment import MyCommentOut
from app.schemas.common import Page
from app.schemas.item import ItemPublic, MyHelpingOut
from app.schemas.notification import NotificationOut
from app.schemas.points import MyPointsOut, PointRecordOut
from app.schemas.staff_application import StaffApplicationCreate
from app.schemas.ticket import TicketOut
from app.services import (
    claim_service,
    comment_service,
    helper_service,
    item_service,
    match_push_service,
    points_service,
    reaction_service,
    staff_application_service,
    ticket_service,
    user_service,
)

router = APIRouter(tags=["me"])


@router.patch("", response_model=UserOut)
def update_me(
    body: ProfileUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return user_service.update_profile(db, user, body)


@router.post("/password", response_model=UserOut)
def change_password(
    body: PasswordChangeRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return user_service.change_password(db, user, body)


def _merge_helping(db: Session, user: User, rows: list[tuple[ItemHelper, Item]]) -> list[dict]:
    if not rows:
        return []
    payload = item_service.serialize_items(db, [item for _, item in rows], user)
    by_id = {row["id"]: row for row in payload}
    return [
        {
            **by_id[item.id],
            "helper_id": helper.id,
            "helper_status": helper.status,
            "thanked": helper.thanked,
            "taken_at": helper.created_at,
        }
        for helper, item in rows
    ]


@router.post("/staff-application", response_model=UserOut)
def submit_staff_application(
    body: StaffApplicationCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return staff_application_service.submit_application(db, user, body)


@router.get("/notifications", response_model=Page[NotificationOut])
def my_notifications(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows, total = match_push_service.list_notifications(db, user.id, limit, offset)
    return Page(items=rows, total=total, limit=limit, offset=offset)


@router.get("/items", response_model=Page[ItemPublic])
def my_items(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    items, total = item_service.list_my_items(db, user, limit, offset)
    return Page(items=items, total=total, limit=limit, offset=offset)


@router.get("/claims", response_model=Page[MyClaimOut])
def my_claims(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows, total = claim_service.list_my_claims(db, user, limit, offset)
    items = [MyClaimOut(**ClaimOut.model_validate(claim).model_dump(), item_title=title) for claim, title in rows]
    return Page(items=items, total=total, limit=limit, offset=offset)


@router.get("/tickets", response_model=Page[TicketOut])
def my_tickets(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    items, total = ticket_service.list_my_tickets(db, user, limit, offset)
    return Page(items=items, total=total, limit=limit, offset=offset)


@router.get("/badges", response_model=list[BadgeOut])
def my_badges(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    badges = db.query(Badge).filter(Badge.user_id == user.id).all()
    return [{"id": b.id, "kind": b.kind, "awarded_at": b.awarded_at} for b in badges]


@router.get("/likes", response_model=Page[ItemPublic])
def my_likes(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    items, total = reaction_service.list_liked_items(db, user, limit, offset)
    return Page(items=item_service.serialize_items(db, items, user), total=total, limit=limit, offset=offset)


@router.get("/favorites", response_model=Page[ItemPublic])
def my_favorites(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    items, total = reaction_service.list_favorited_items(db, user, limit, offset)
    return Page(items=item_service.serialize_items(db, items, user), total=total, limit=limit, offset=offset)


@router.get("/comments", response_model=Page[MyCommentOut])
def my_comments(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    items, total = comment_service.list_my_comments(db, user, limit, offset)
    return Page(items=items, total=total, limit=limit, offset=offset)


@router.get("/helping", response_model=Page[MyHelpingOut])
def my_helping(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows, total = helper_service.list_my_helping(db, user, limit, offset)
    return Page(items=_merge_helping(db, user, rows), total=total, limit=limit, offset=offset)


@router.get("/points", response_model=MyPointsOut)
def my_points(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    data = points_service.get_my_points(db, user, limit, offset)
    records = data["records"]
    return MyPointsOut(
        total=data["total"],
        title=data["title"],
        next_title=data["next_title"],
        next_threshold=data["next_threshold"],
        records=Page[PointRecordOut](
            items=records,
            total=data["record_count"],
            limit=limit,
            offset=offset,
        ),
    )
