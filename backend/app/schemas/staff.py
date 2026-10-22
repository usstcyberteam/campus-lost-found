from typing import Annotated

from pydantic import BaseModel, StringConstraints

from app.schemas.validation import DisplayName, Password, Username


class StaffCreateRequest(BaseModel):
    username: Username
    display_name: DisplayName
    contact: Annotated[str, StringConstraints(max_length=100)] | None = None
    password: Password
