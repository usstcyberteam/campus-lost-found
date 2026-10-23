import uuid
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import LayerKind, SimulatedPointKind


class Layer(Base):
    __tablename__ = "layer"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    image_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    version: Mapped[str] = mapped_column(String(32), nullable=False, default="1")
    width: Mapped[int] = mapped_column(nullable=False, default=0)
    height: Mapped[int] = mapped_column(nullable=False, default=0)
    scale_calibrated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    pixels_per_meter: Mapped[float | None] = mapped_column(Numeric(12, 4), nullable=True)
    building_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("building.id"), nullable=True, index=True)
    floor: Mapped[int | None] = mapped_column(nullable=True)
    kind: Mapped[LayerKind] = mapped_column(
        SAEnum(LayerKind, native_enum=False, length=16), nullable=False, default=LayerKind.flat, index=True
    )
    rooms: Mapped[list | None] = mapped_column(JSON, nullable=True)
    # 平面图到 2.5D 图的 2×3 换算矩阵，仅 2.5D 图层使用
    transform: Mapped[list | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )


class SimulatedPoint(Base):
    __tablename__ = "simulated_point"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    layer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("layer.id"), nullable=False, index=True)
    label: Mapped[str] = mapped_column(String(64), nullable=False)
    norm_x: Mapped[float] = mapped_column(Numeric(12, 8), nullable=False)
    norm_y: Mapped[float] = mapped_column(Numeric(12, 8), nullable=False)
    is_simulated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    kind: Mapped[SimulatedPointKind] = mapped_column(
        SAEnum(SimulatedPointKind, native_enum=False, length=16), nullable=False, default=SimulatedPointKind.help_point
    )
    is_public: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("user.id"), nullable=True)

    layer: Mapped[Layer] = relationship("Layer")
