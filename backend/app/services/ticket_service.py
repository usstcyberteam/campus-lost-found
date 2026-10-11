import uuid

from sqlalchemy import update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.errors import ApiError
from app.models import Badge, Direction, Item, ItemStatus, Role, Route, Ticket, TicketStatus, User
from app.schemas.ticket import FeedbackRequest, TicketCreate


def list_tickets(db: Session, user: User, status: TicketStatus | None = None) -> list[Ticket]:
    query = db.query(Ticket)
    if status is not None:
        query = query.filter(Ticket.status == status)
    if user.role not in (Role.staff, Role.admin):
        query = query.filter(Ticket.requester_user_id == user.id)
    return query.order_by(Ticket.created_at.desc()).all()


def create_ticket(db: Session, user: User, body: TicketCreate) -> Ticket:
    item = db.get(Item, body.item_id)
    if item is None:
        raise ApiError(404, "NOT_FOUND", "记录不存在")
    if item.owner_user_id != user.id:
        raise ApiError(403, "FORBIDDEN", "只能为自己的记录申请协助")
    if item.direction != Direction.lost or item.status not in (ItemStatus.searching, ItemStatus.reviewing):
        raise ApiError(409, "STATE_CONFLICT", "只能为未关闭的寻物记录申请协助")
    ticket = Ticket(item_id=body.item_id, requester_user_id=user.id, status=TicketStatus.pending)
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return ticket


def assign(db: Session, user: User, ticket_id: uuid.UUID) -> Ticket:
    ticket = db.get(Ticket, ticket_id)
    if ticket is None:
        raise ApiError(404, "NOT_FOUND", "工单不存在")
    result = db.execute(
        update(Ticket)
        .where(Ticket.id == ticket_id, Ticket.status == TicketStatus.pending)
        .values(assignee_user_id=user.id, status=TicketStatus.processing)
    )
    if result.rowcount != 1:
        db.rollback()
        raise ApiError(409, "STATE_CONFLICT", "工单已被接单或已反馈")
    db.commit()
    db.refresh(ticket)
    return ticket


def authorize_route(db: Session, user: User, ticket_id: uuid.UUID) -> Ticket:
    ticket = db.get(Ticket, ticket_id)
    if ticket is None:
        raise ApiError(404, "NOT_FOUND", "工单不存在")
    if ticket.requester_user_id != user.id:
        raise ApiError(403, "FORBIDDEN", "只能授权自己的工单")
    ticket.route_authorized = True
    db.commit()
    db.refresh(ticket)
    return ticket


def get_ticket_route(db: Session, user: User, ticket_id: uuid.UUID) -> list[dict]:
    ticket = db.get(Ticket, ticket_id)
    if ticket is None:
        raise ApiError(404, "NOT_FOUND", "工单不存在")
    is_requester = ticket.requester_user_id == user.id
    is_assigned = ticket.assignee_user_id == user.id
    if not (is_requester or (is_assigned and ticket.route_authorized)):
        raise ApiError(403, "FORBIDDEN", "路线未授权或工单未分配")
    routes = db.query(Route).filter(Route.item_id == ticket.item_id).all()
    return [
        {
            "id": r.id,
            "kind": r.kind.value,
            "geometry": r.geometry,
            "floor_segments": r.floor_segments,
        }
        for r in routes
    ]


def feedback(db: Session, user: User, ticket_id: uuid.UUID, body: FeedbackRequest) -> Ticket:
    ticket = db.get(Ticket, ticket_id)
    if ticket is None:
        raise ApiError(404, "NOT_FOUND", "工单不存在")
    if ticket.assignee_user_id != user.id:
        raise ApiError(403, "FORBIDDEN", "只有接单人员可以反馈")
    if ticket.status != TicketStatus.processing:
        raise ApiError(409, "STATE_CONFLICT", "工单状态不允许反馈")
    ticket.result = body.result
    ticket.status = TicketStatus.feedback
    db.commit()
    db.refresh(ticket)

    try:
        db.add(Badge(user_id=user.id, kind="assist"))
        db.commit()
    except IntegrityError:
        db.rollback()

    return ticket
