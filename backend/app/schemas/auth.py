import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import Role
from app.schemas.validation import DisplayName, Password, Username


class RegisterRequest(BaseModel):
    username: Username
    password: Password
    display_name: DisplayName
    contact: str | None = None


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


class BadgeOut(BaseModel):
    id: uuid.UUID
    kind: str
    awarded_at: datetime
