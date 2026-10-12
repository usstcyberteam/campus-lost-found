import uuid

from pydantic import BaseModel, ConfigDict

from app.models.enums import Direction, ItemStatus, RouteKind


class LayerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    version: str
    width: int
    height: int
    scale_calibrated: bool
    image_path: str | None


class CalibrateRequest(BaseModel):
    pixels_per_meter: float


class SimulatedPointCreate(BaseModel):
    label: str
    norm_x: float
    norm_y: float
    description: str | None = None


class SimulatedPointOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    label: str
    norm_x: float
    norm_y: float
    is_simulated: bool
    description: str | None


class MapItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    direction: Direction
    category: str
    title: str
    status: ItemStatus
    is_simulated: bool
    norm_x: float | None
    norm_y: float | None


class MapAnchorRequest(BaseModel):
    layer_id: uuid.UUID
    norm_x: float
    norm_y: float
    is_simulated: bool = False


class RouteCreate(BaseModel):
    kind: RouteKind
    layer_id: uuid.UUID | None = None
    geometry: dict | None = None
    floor_segments: list | None = None