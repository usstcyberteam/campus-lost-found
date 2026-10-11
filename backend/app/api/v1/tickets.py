import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_role
from app.database import get_db
from app.models import Role, TicketStatus, User
from app.schemas.ticket import FeedbackRequest, TicketCreate, TicketOut
from app.services import ticket_service

router = APIRouter(tags=["tickets"])


@router.get("", response_model=list[TicketOut])
def list_tickets(
    status: TicketStatus | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return ticket_service.list_tickets(db, user, status)


@router.post("", response_model=TicketOut)
def create_ticket(body: TicketCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return ticket_service.create_ticket(db, user, body)


@router.post("/{ticket_id}/assign", response_model=TicketOut)
def assign(ticket_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(require_role(Role.staff))):
    return ticket_service.assign(db, user, ticket_id)


@router.post("/{ticket_id}/authorize-route", response_model=TicketOut)
def authorize_route(ticket_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return ticket_service.authorize_route(db, user, ticket_id)


@router.get("/{ticket_id}/route")
def get_ticket_route(ticket_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return ticket_service.get_ticket_route(db, user, ticket_id)


@router.post("/{ticket_id}/feedback", response_model=TicketOut)
def feedback(
    ticket_id: uuid.UUID,
    body: FeedbackRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.staff)),
):
    return ticket_service.feedback(db, user, ticket_id, body)
