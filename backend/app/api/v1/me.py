from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models import Badge, Claim, Item, Route, Ticket, User
from app.schemas.claim import ClaimOut
from app.schemas.item import MyItemOut
from app.schemas.ticket import TicketOut

router = APIRouter(tags=["me"])


@router.get("/items", response_model=list[MyItemOut])
def my_items(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(Item).filter(Item.owner_user_id == user.id).order_by(Item.created_at.desc()).all()


@router.get("/claims", response_model=list[ClaimOut])
def my_claims(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(Claim).filter(Claim.applicant_user_id == user.id).order_by(Claim.created_at.desc()).all()


@router.get("/tickets", response_model=list[TicketOut])
def my_tickets(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(Ticket).filter(Ticket.requester_user_id == user.id).order_by(Ticket.created_at.desc()).all()


@router.get("/badges")
def my_badges(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    badges = db.query(Badge).filter(Badge.user_id == user.id).all()
    return [{"id": b.id, "kind": b.kind, "awarded_at": b.awarded_at} for b in badges]


@router.get("/routes")
def my_routes(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    routes = (
        db.query(Route)
        .join(Item, Route.item_id == Item.id)
        .filter(Item.owner_user_id == user.id)
        .order_by(Route.id)
        .all()
    )
    return [
        {
            "id": r.id,
            "item_id": r.item_id,
            "layer_id": r.layer_id,
            "kind": r.kind.value,
            "geometry": r.geometry,
            "floor_segments": r.floor_segments,
        }
        for r in routes
    ]