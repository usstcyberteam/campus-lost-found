import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints, model_validator

from app.models.enums import Role, StaffStatus
from app.schemas.validation import DisplayName, Password, Username


class RegisterRequest(BaseModel):
    username: Username
    password: Password
    display_name: DisplayName
    contact: Annotated[str, StringConstraints(max_length=100)] | None = None
    role: Role = Role.student
    staff_no: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=4, max_length=20, pattern=r"^[A-Za-z0-9]+$")]
        | None
    ) = None
    department: Annotated[str, StringConstraints(strip_whitespace=True, max_length=64)] | None = None

    @model_validator(mode="after")
    def validate_applicant_identity(self) -> "RegisterRequest":
        if self.role == Role.admin:
            raise ValueError("不允许自助注册管理员")
        if self.role == Role.staff and self.staff_no is None:
            raise ValueError("教职工注册必须填写工号")
        return self


class LoginRequest(BaseModel):
    username: Username
    password: Password


class TokenResponse(BaseModel):
    token: str
    role: Role


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    username: str
    display_name: str
    role: Role
    staff_status: StaffStatus
    staff_no: str | None
    department: str | None
    staff_reject_reason: str | None


class BadgeOut(BaseModel):
    id: uuid.UUID
    kind: str
    awarded_at: datetime
