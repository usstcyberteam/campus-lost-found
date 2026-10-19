import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, StringConstraints

from app.models.enums import Source


class DraftPostRequest(BaseModel):
    text: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]


class DraftPostOut(BaseModel):
    category: str | None = None
    title: str | None = None
    description: str | None = None
    location_area: str | None = None
    building_code: str | None = None
    floor: int | None = None
    time_occurred: datetime | None = None
    source: Source
    degraded: bool


class SearchAdviceRequest(BaseModel):
    item_id: uuid.UUID | None = None
    geometry: dict | None = None
    category: str | None = None


class SearchAdviceLocation(BaseModel):
    building_code: str
    building_name: str
    reason: str
    order: int


class SearchAdviceOut(BaseModel):
    locations: list[SearchAdviceLocation]
    source: Source
    degraded: bool
