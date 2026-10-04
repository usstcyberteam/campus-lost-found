from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models import Badge, Claim, Item, Ticket, User
from app.schemas.claim import ClaimOut
from app.schemas.item import ItemPublic
from app.schemas.ticket import TicketOut

router = APIRouter(tags=["me"])


@router.get("/items", response_model=list[ItemPublic])
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