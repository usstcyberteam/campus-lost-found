import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, StringConstraints
from typing import Annotated

from app.models.enums import Direction, ItemStatus, Source


class ItemCreate(BaseModel):
    direction: Direction
    category: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=32)]
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=128)]
    description: str = ""
    location_area: Annotated[str, StringConstraints(strip_whitespace=True, max_length=128)] = ""
    precise_location: str | None = None
    time_occurred: datetime | None = None
    is_simulated: bool = False


class ItemPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    direction: Direction
    category: str
    title: str
    description: str
    location_area: str
    time_occurred: datetime | None
    status: ItemStatus
    is_simulated: bool
    source: Source
    created_at: datetime
