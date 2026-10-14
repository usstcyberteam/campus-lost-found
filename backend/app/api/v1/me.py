from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models import Badge, User
from app.schemas.auth import BadgeOut
from app.schemas.claim import ClaimOut
from app.schemas.common import Page
from app.schemas.item import ItemPublic
from app.schemas.ticket import TicketOut
from app.services import claim_service, item_service, ticket_service

router = APIRouter(tags=["me"])


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
