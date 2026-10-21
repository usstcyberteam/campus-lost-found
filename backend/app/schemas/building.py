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
    iso_hit_area: list[dict] | None
    iso_label_position: dict | None
    draw_order: int
    entrance_node: int | None
    active_item_count: int
    has_floor_map: bool
