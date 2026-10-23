import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, StringConstraints


class AnnouncementCreate(BaseModel):
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=128)]
    content: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=5000)]
    is_pinned: bool = False


class AnnouncementUpdate(BaseModel):
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=128)] | None = None
    content: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=5000)] | None = None
    is_pinned: bool | None = None


class AnnouncementOut(BaseModel):
    id: uuid.UUID
    title: str
    content: str
    is_pinned: bool
    author_name: str | None = None
    created_at: datetime
    updated_at: datetime
    favorite_count: int = 0
    is_favorited: bool = False


class AnnouncementFavoriteOut(BaseModel):
    id: uuid.UUID
    title: str
    created_at: datetime
    favorited_at: datetime
