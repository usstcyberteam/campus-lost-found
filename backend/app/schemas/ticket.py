import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints

from app.models.enums import RouteKind, TicketStatus


class TicketCreate(BaseModel):
    item_id: uuid.UUID


class TicketOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    item_id: uuid.UUID
    requester_user_id: uuid.UUID
    assignee_user_id: uuid.UUID | None
    status: TicketStatus
    route_authorized: bool
    result: str | None
    created_at: datetime


class FeedbackRequest(BaseModel):
    result: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=5000)]


class TicketRouteOut(BaseModel):
    id: uuid.UUID
    kind: RouteKind
    geometry: dict | None
    floor_segments: list | None
