import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import Source


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    kind: str
    title: str
    content: str
    link: str
    related_item_id: uuid.UUID | None = None
    source: Source
    read: bool
    created_at: datetime