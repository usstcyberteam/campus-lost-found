import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import PointReason
from app.schemas.common import Page


class PointRecordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    reason: PointReason
    amount: int
    ref_id: uuid.UUID
    created_at: datetime


class MyPointsOut(BaseModel):
    total: int
    title: str
    next_title: str | None
    next_threshold: int | None
    records: Page[PointRecordOut]
