import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Building(Base):
    __tablename__ = "building"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    category: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    floors: Mapped[int] = mapped_column(nullable=False, default=1)
    click_region: Mapped[list | None] = mapped_column(JSON, nullable=True)
    label_position: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    iso_hit_area: Mapped[list | None] = mapped_column(JSON, nullable=True)
    iso_label_position: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    draw_order: Mapped[int] = mapped_column(nullable=False, default=0)
    entrance_node: Mapped[int | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
