import uuid
from typing import Annotated

from pydantic import BaseModel, Field


class ThankRequest(BaseModel):
    helper_ids: Annotated[list[uuid.UUID], Field(min_length=1, max_length=3)]


class HelperOut(BaseModel):
    helper_count: int
    is_helper: bool


class ThankOut(BaseModel):
    thanked_count: int


class HelperUserOut(BaseModel):
    id: uuid.UUID
    display_name: str
    title: str
    thanked: bool = False
    avatar_url: str | None = None
