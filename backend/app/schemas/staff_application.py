import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, StringConstraints

from app.models.enums import StaffStatus


class StaffApplicationCreate(BaseModel):
    staff_no: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=4, max_length=20, pattern=r"^[A-Za-z0-9]+$")
    ]
    department: Annotated[str, StringConstraints(strip_whitespace=True, max_length=64)] | None = None


class StaffRejectRequest(BaseModel):
    reason: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]


class StaffApplicationOut(BaseModel):
    user_id: uuid.UUID
    username: str
    display_name: str
    staff_no: str | None
    department: str | None
    staff_status: StaffStatus
    created_at: datetime
