import uuid

from pydantic import BaseModel, ConfigDict

from app.models.enums import RouteKind


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


class MapAnchorOut(BaseModel):
    ok: bool


class RouteOut(BaseModel):
    id: uuid.UUID
    kind: RouteKind
    is_private: bool


class RouteDetail(BaseModel):
    id: uuid.UUID
    kind: RouteKind
    geometry: dict | None
    floor_segments: list | None
    is_private: bool
    authorized: bool
