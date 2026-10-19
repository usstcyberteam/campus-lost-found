from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models import Badge, User
from app.schemas.auth import BadgeOut, UserOut
from app.schemas.claim import ClaimOut
from app.schemas.common import Page
from app.schemas.item import ItemPublic
from app.schemas.points import MyPointsOut, PointRecordOut
from app.schemas.staff_application import StaffApplicationCreate
from app.schemas.ticket import TicketOut
from app.services import (
    claim_service,
    item_service,
    points_service,
    reaction_service,
    staff_application_service,
    ticket_service,
)

router = APIRouter(tags=["me"])


@router.post("/staff-application", response_model=UserOut)
def submit_staff_application(
    body: StaffApplicationCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return staff_application_service.submit_application(db, user, body)


@router.get("/items", response_model=Page[ItemPublic])
def my_items(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    items, total = item_service.list_my_items(db, user, limit, offset)
    return Page(items=items, total=total, limit=limit, offset=offset)


@router.get("/claims", response_model=Page[ClaimOut])
def my_claims(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    items, total = claim_service.list_my_claims(db, user, limit, offset)
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
