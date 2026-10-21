import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from app.models.enums import ClaimStatus, EvidenceKind


class EvidenceIn(BaseModel):
    kind: EvidenceKind
    content: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=5000)]


class ClaimCreate(BaseModel):
    found_item_id: uuid.UUID
    lost_item_id: uuid.UUID | None = None
    evidence: list[EvidenceIn] = Field(min_length=1, max_length=10)
    idempotency_key: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=64)]


class ClaimOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    found_item_id: uuid.UUID
    lost_item_id: uuid.UUID | None
    applicant_user_id: uuid.UUID
    reviewer_user_id: uuid.UUID | None
    status: ClaimStatus
    created_at: datetime


class ReviewRequest(BaseModel):
    approve: bool
    reason: Annotated[str, StringConstraints(max_length=500)] | None = None


class ClaimDetail(ClaimOut):
    evidence: list[EvidenceIn]
    review_reason: str | None = None


class MyClaimOut(ClaimOut):
    item_title: str
