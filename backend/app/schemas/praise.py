import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, StringConstraints


class PraiseCreate(BaseModel):
    to_user_id: uuid.UUID
    content: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]
    item_id: uuid.UUID | None = None


class PraiseUpdate(BaseModel):
    content: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)] | None = None


class PraiseOut(BaseModel):
    id: uuid.UUID
    content: str
    item_id: uuid.UUID | None
    item_title: str | None
    from_user_id: uuid.UUID
    from_name: str
    to_user_id: uuid.UUID
    to_name: str
    created_at: datetime
    can_edit: bool = False