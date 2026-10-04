import uuid

from sqlalchemy import Boolean, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


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


class SimulatedPoint(Base):
    __tablename__ = "simulated_point"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    layer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("layer.id"), nullable=False)
    label: Mapped[str] = mapped_column(String(64), nullable=False)
    norm_x: Mapped[float] = mapped_column(Numeric(12, 8), nullable=False)
    norm_y: Mapped[float] = mapped_column(Numeric(12, 8), nullable=False)
    is_simulated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("user.id"), nullable=True)

    layer: Mapped[Layer] = relationship("Layer")