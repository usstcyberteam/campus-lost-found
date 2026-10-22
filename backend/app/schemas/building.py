import uuid

from pydantic import BaseModel


class BuildingOut(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    category: str
    floors: int
    click_region: list[dict] | None
    label_position: dict | None
    active_item_count: int
    has_floor_map: bool
