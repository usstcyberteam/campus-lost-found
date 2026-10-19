import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, UniqueConstraint, func
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.enums import PointReason


class PointRecord(Base):
    __tablename__ = "point_record"
    __table_args__ = (UniqueConstraint("user_id", "reason", "ref_id", name="uq_point_record_user_reason_ref"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("user.id"), nullable=False, index=True)
    reason: Mapped[PointReason] = mapped_column(
        SAEnum(
            PointReason, native_enum=False, length=16, values_callable=lambda enum: [member.value for member in enum]
        ),
        nullable=False,
    )
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    ref_id: Mapped[uuid.UUID] = mapped_column(nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
