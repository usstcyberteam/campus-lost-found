import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, func
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.enums import Source


class Notification(Base):
    __tablename__ = "notification"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("user.id"), nullable=False, index=True)
    # 通知类型：ai_match=智能匹配推送；后续新类型复用本表
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    title: Mapped[str] = mapped_column(String(128), nullable=False)
    content: Mapped[str] = mapped_column(String(500), nullable=False)
    # 前端站内路由（如 /hall/{item_id}），非外链
    link: Mapped[str] = mapped_column(String(256), nullable=False, default="")
    related_item_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True)
    source: Mapped[Source] = mapped_column(
        SAEnum(Source, native_enum=False, length=8), nullable=False, default=Source.rule
    )
    read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    # 去重键：同一触发帖+命中帖组合只推一次（如 ai_match:{new_id}:{matched_id}）
    dedup_key: Mapped[str] = mapped_column(String(160), nullable=False, unique=True)