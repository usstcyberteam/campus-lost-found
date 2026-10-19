import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from app.models.enums import Direction, ItemStatus, Source
from app.schemas.helper import HelperUserOut
from app.schemas.upload import UploadOut


class ItemCreate(BaseModel):
    direction: Direction
    category: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=32)]
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=128)]
    description: Annotated[str, StringConstraints(max_length=2000)] = ""
    location_area: Annotated[str, StringConstraints(strip_whitespace=True, max_length=128)] = ""
    precise_location: Annotated[str, StringConstraints(max_length=200)] | None = None
    time_occurred: datetime | None = None
    is_simulated: bool = False
    building_id: uuid.UUID | None = None
    floor: int | None = Field(default=None, ge=-3, le=100)
    photo_ids: list[uuid.UUID] = Field(default_factory=list, max_length=6)


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
    is_demo: bool = False
    source: Source
    created_at: datetime
    building_id: uuid.UUID | None = None
    building_name: str | None = None
    floor: int | None = None
    first_photo: UploadOut | None = None
    like_count: int = 0
    comment_count: int = 0
    helper_count: int = 0
    favorite_count: int = 0
    is_liked: bool = False
    is_favorited: bool = False
    is_helper: bool = False


class ItemDetail(BaseModel):
    id: uuid.UUID
    is_owner: bool
    direction: Direction
    category: str
    title: str
    description: str
    location_area: str
    time_occurred: datetime | None
    status: ItemStatus
    is_simulated: bool
    is_demo: bool = False
    source: Source
    created_at: datetime
    norm_x: float | None
    norm_y: float | None
    layer_id: uuid.UUID | None
    precise_location: str | None
    building_id: uuid.UUID | None = None
    building_name: str | None = None
    floor: int | None = None
    photos: list[UploadOut] = Field(default_factory=list)
    photos_hidden: bool = False
    like_count: int = 0
    comment_count: int = 0
    helper_count: int = 0
    favorite_count: int = 0
    is_liked: bool = False
    is_favorited: bool = False
    is_helper: bool = False
    helpers: list[HelperUserOut] = Field(default_factory=list)


class FeatureExtractRequest(BaseModel):
    text: Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)] | None = None


class FeatureExtractionOut(BaseModel):
    labels: dict | None = None
    extracted_text: str | None = None
    confidence: float | None = None
    source: str = "manual"
    degraded: bool = True


class CandidateOut(BaseModel):
    found_item_id: str
    score: float
    explanation: str
    source: str
    title: str
    category: str
    location_area: str
