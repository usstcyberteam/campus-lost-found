import uuid
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

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
    pixels_per_meter: float = Field(gt=0)


class SimulatedPointCreate(BaseModel):
    label: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=64)]
    norm_x: float = Field(ge=0, le=1)
    norm_y: float = Field(ge=0, le=1)
    description: Annotated[str, StringConstraints(max_length=500)] | None = None


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
    norm_x: float = Field(ge=0, le=1)
    norm_y: float = Field(ge=0, le=1)
    is_simulated: bool = False


class RoutePoint(BaseModel):
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)


class PolylineGeometry(BaseModel):
    points: list[RoutePoint] = Field(min_length=2, max_length=200)


class CircleGeometry(BaseModel):
    center: RoutePoint
    radius: float = Field(gt=0, le=1)


class RouteCreate(BaseModel):
    kind: RouteKind
    layer_id: uuid.UUID | None = None
    geometry: PolylineGeometry | CircleGeometry | None = None
    floor_segments: list | None = None

    @model_validator(mode="after")
    def _check_geometry_matches_kind(self) -> "RouteCreate":
        if self.geometry is None:
            return self
        if self.kind == RouteKind.polyline and not isinstance(self.geometry, PolylineGeometry):
            raise ValueError("polyline 路线的 geometry 必须包含 points")
        if self.kind == RouteKind.circle and not isinstance(self.geometry, CircleGeometry):
            raise ValueError("circle 路线的 geometry 必须包含 center 和 radius")
        return self


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
