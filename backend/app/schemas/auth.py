import uuid
from datetime import datetime
from pathlib import PurePosixPath
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, computed_field, model_validator

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


def avatar_url_for(user_id: uuid.UUID, avatar_path: str | None) -> str | None:
    """头像访问地址；文件名随每次上传变化，作为 v 参数让浏览器缓存自动失效。"""
    if not avatar_path:
        return None
    return f"/api/v1/users/{user_id}/avatar?v={PurePosixPath(avatar_path).stem[:12]}"


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
    contact: str | None = None
    avatar_path: str | None = Field(default=None, exclude=True)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def avatar_url(self) -> str | None:
        return avatar_url_for(self.id, self.avatar_path)


class BadgeOut(BaseModel):
    id: uuid.UUID
    kind: str
    awarded_at: datetime


class ProfileUpdate(BaseModel):
    display_name: DisplayName | None = None
    contact: Annotated[str, StringConstraints(max_length=100)] | None = None


class PasswordChangeRequest(BaseModel):
    old_password: Password
    new_password: Password


class AdminUserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    username: str
    display_name: str
    role: Role
    staff_status: StaffStatus
    is_banned: bool
    created_at: datetime


class AdminUserUpdate(BaseModel):
    role: Role | None = None
    is_banned: bool | None = None
