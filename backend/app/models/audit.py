import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AuditLog(Base):
    """治理审计日志：记录操作人、时间、目标帖子与操作类型。

    不设外键约束：审计记录须在目标行（帖子/用户）被清理后仍可追溯，
    仅保留 id 引用与索引。
    """

    __tablename__ = "audit_log"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    operator_user_id: Mapped[uuid.UUID] = mapped_column(nullable=False, index=True)
    item_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(32), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
