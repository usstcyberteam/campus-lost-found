import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Praise(Base):
    """公开表扬墙记录：由当事人或他人对某位用户的帮助行为进行公开致谢。"""

    __tablename__ = "praise"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    item_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("item.id"), nullable=True, index=True)
    from_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("user.id"), nullable=False, index=True)
    to_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("user.id"), nullable=False, index=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )