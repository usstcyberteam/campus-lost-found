import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints

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


class ChatHistoryItem(BaseModel):
    role: Literal["user", "assistant"]
    text: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]


class ChatRequest(BaseModel):
    message: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]
    page: str | None = None
    action: Literal["draft", "polish"] | None = None
    history: list[ChatHistoryItem] = Field(default_factory=list, max_length=10)


class SuggestLocationsOut(BaseModel):
    locations: list[str]


class ChatFormPatch(BaseModel):
    category: str | None = None
    title: str | None = None
    description: str | None = None
    location_area: str | None = None
    building_code: str | None = None
    floor: int | None = None
    time_occurred: datetime | None = None


class ChatOut(BaseModel):
    intent: str
    reply: str
    form_patch: ChatFormPatch | None = None
    actions: list[str]
    source: Source
    degraded: bool


class MatchRequest(BaseModel):
    item_id: uuid.UUID


class MatchedItemOut(BaseModel):
    item_id: str
    title: str
    category: str
    location_area: str
    # False 表示该组合此前已推送过（去重生效），本次未新建通知
    notified: bool


class MatchOut(BaseModel):
    item_id: str
    matched: int
    notified: int
    items: list[MatchedItemOut]
    source: Source
