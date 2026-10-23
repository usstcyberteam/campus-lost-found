import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import Role, StaffStatus


class User(Base):
    __tablename__ = "user"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[Role] = mapped_column(SAEnum(Role, native_enum=False, length=16), nullable=False, default=Role.student)
    display_name: Mapped[str] = mapped_column(String(64), nullable=False)
    contact: Mapped[str | None] = mapped_column(Text, nullable=True)
    staff_status: Mapped[StaffStatus] = mapped_column(
        SAEnum(StaffStatus, native_enum=False, length=16), nullable=False, default=StaffStatus.none
    )
    staff_no: Mapped[str | None] = mapped_column(String(20), nullable=True)
    department: Mapped[str | None] = mapped_column(String(64), nullable=True)
    staff_reject_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    # 封禁后无法登录，且已签发的令牌在下次请求时立即失效（见 deps.get_current_user）
    is_banned: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Badge(Base):
    __tablename__ = "badge"
    __table_args__ = (UniqueConstraint("user_id", "kind", name="uq_badge_user_kind"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("user.id"), nullable=False)
    kind: Mapped[str] = mapped_column(String(32), nullable=False)
    awarded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user: Mapped[User] = relationship("User")
