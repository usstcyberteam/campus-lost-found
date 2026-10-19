import uuid
from typing import Annotated

from pydantic import BaseModel, Field


class UploadOut(BaseModel):
    id: uuid.UUID
    url: str
    mime: str
    size: int


class PhotoBindRequest(BaseModel):
    photo_ids: Annotated[list[uuid.UUID], Field(min_length=1, max_length=6)]
