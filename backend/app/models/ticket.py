import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum as SAEnum, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.enums import TicketStatus


class Ticket(Base):
    __tablename__ = "ticket"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("item.id"), nullable=False)
    requester_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("user.id"), nullable=False)
    assignee_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("user.id"), nullable=True)
    status: Mapped[TicketStatus] = mapped_column(SAEnum(TicketStatus, native_enum=False, length=16), nullable=False, default=TicketStatus.pending)
    route_authorized: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    result: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)