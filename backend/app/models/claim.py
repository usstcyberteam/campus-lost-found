import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.enums import ClaimStatus, EvidenceKind


class Claim(Base):
    __tablename__ = "claim"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    found_item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("item.id"), nullable=False)
    lost_item_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("item.id"), nullable=True)
    applicant_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("user.id"), nullable=False)
    reviewer_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("user.id"), nullable=True)
    status: Mapped[ClaimStatus] = mapped_column(
        SAEnum(ClaimStatus, native_enum=False, length=16), nullable=False, default=ClaimStatus.pending
    )
    idempotency_key: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class ClaimEvidence(Base):
    __tablename__ = "claim_evidence"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    claim_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("claim.id"), nullable=False)
    kind: Mapped[EvidenceKind] = mapped_column(SAEnum(EvidenceKind, native_enum=False, length=8), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
