import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints

from app.schemas.upload import UploadOut


class CommentCreate(BaseModel):
    content: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]
    parent_id: uuid.UUID | None = None
    photo_ids: list[uuid.UUID] = Field(default_factory=list, max_length=3)


class CommentAuthorOut(BaseModel):
    id: uuid.UUID
    display_name: str
    role_label: str
    title: str


class CommentOut(BaseModel):
    id: uuid.UUID
    item_id: uuid.UUID
    author: CommentAuthorOut
    content: str
    parent_id: uuid.UUID | None
    is_deleted: bool
    images: list[UploadOut] = Field(default_factory=list)
    created_at: datetime
    replies: list["CommentOut"] = Field(default_factory=list)


class CommentDeletedOut(BaseModel):
    id: uuid.UUID
    is_deleted: bool = True
