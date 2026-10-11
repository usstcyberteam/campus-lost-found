import uuid
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.enums import CandidateSource, Direction, ItemStatus, RouteKind, Source


class Item(Base):
    __tablename__ = "item"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    direction: Mapped[Direction] = mapped_column(SAEnum(Direction, native_enum=False, length=8), nullable=False)
    category: Mapped[str] = mapped_column(String(32), nullable=False)
    title: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    location_area: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    precise_location: Mapped[str | None] = mapped_column(Text, nullable=True)
    time_occurred: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[ItemStatus] = mapped_column(SAEnum(ItemStatus, native_enum=False, length=16), nullable=False)
    owner_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("user.id"), nullable=False)
    layer_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("layer.id"), nullable=True)
    norm_x: Mapped[float | None] = mapped_column(Numeric(12, 8), nullable=True)
    norm_y: Mapped[float | None] = mapped_column(Numeric(12, 8), nullable=True)
    is_simulated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    source: Mapped[Source] = mapped_column(
        SAEnum(Source, native_enum=False, length=8), nullable=False, default=Source.manual
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class Attachment(Base):
    __tablename__ = "attachment"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("item.id"), nullable=False)
    file_path: Mapped[str] = mapped_column(Text, nullable=False)
    is_evidence: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class ItemFeature(Base):
    __tablename__ = "item_feature"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("item.id"), nullable=False)
    labels: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    extracted_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[Source] = mapped_column(
        SAEnum(Source, native_enum=False, length=8), nullable=False, default=Source.manual
    )
    confirmed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    confidence: Mapped[float | None] = mapped_column(Numeric(6, 4), nullable=True)


class Route(Base):
    __tablename__ = "route"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("item.id"), nullable=False)
    layer_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("layer.id"), nullable=True)
    kind: Mapped[RouteKind] = mapped_column(SAEnum(RouteKind, native_enum=False, length=16), nullable=False)
    geometry: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    floor_segments: Mapped[list | None] = mapped_column(JSON, nullable=True)
    is_private: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    authorized: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class Candidate(Base):
    __tablename__ = "candidate"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    lost_item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("item.id"), nullable=False)
    found_item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("item.id"), nullable=False)
    score: Mapped[float] = mapped_column(Numeric(8, 4), nullable=False, default=0)
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[CandidateSource] = mapped_column(
        SAEnum(CandidateSource, native_enum=False, length=16), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
