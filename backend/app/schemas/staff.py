from pydantic import BaseModel
from app.schemas.validation import DisplayName, Password, Username


class StaffCreateRequest(BaseModel):
    username: Username
    display_name: DisplayName
    contact: str | None = None
    password: Password
