import os
import uuid

from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.deps import get_current_user, require_role
from app.database import get_db
from app.errors import ApiError
from app.models import Layer, Role, SimulatedPoint, User
from app.models.enums import SimulatedPointKind
from app.schemas.layer import (
    CalibrateRequest,
    LayerOut,
    LayerPointsOut,
    SimulatedPointCreate,
    SimulatedPointOut,
)

router = APIRouter(tags=["layers"])

_IMAGE_MEDIA_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
}


@router.get("", response_model=list[LayerOut])
def list_layers(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(Layer).order_by(Layer.name).all()


@router.get("/{layer_id}/image")
def get_layer_image(layer_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    layer = db.get(Layer, layer_id)
    if layer is None:
        raise ApiError(404, "NOT_FOUND", "图层不存在")
    if layer.image_path is None:
        raise ApiError(404, "NOT_FOUND", "底图未上传")
    settings = get_settings()
    path = os.path.join(settings.file_storage_dir, layer.image_path)
    if not os.path.exists(path):
        raise ApiError(404, "NOT_FOUND", "底图文件不存在")
    media_type = _IMAGE_MEDIA_TYPES.get(os.path.splitext(path)[1].lower(), "image/jpeg")
    return FileResponse(path, media_type=media_type)


@router.post("/{layer_id}/calibrate", response_model=LayerOut)
def calibrate(
    layer_id: uuid.UUID,
    body: CalibrateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.admin)),
):
    layer = db.get(Layer, layer_id)
    if layer is None:
        raise ApiError(404, "NOT_FOUND", "图层不存在")
    layer.pixels_per_meter = body.pixels_per_meter
    layer.scale_calibrated = True
    db.commit()
    db.refresh(layer)
    return layer


@router.get("/{layer_id}/points", response_model=LayerPointsOut)
def list_layer_points(layer_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if db.get(Layer, layer_id) is None:
        raise ApiError(404, "NOT_FOUND", "图层不存在")
    staff = user.role in (Role.staff, Role.admin)
    query = db.query(SimulatedPoint).filter(SimulatedPoint.layer_id == layer_id)
    if not staff:
        query = query.filter(
            SimulatedPoint.kind == SimulatedPointKind.help_point,
            SimulatedPoint.is_public.is_(True),
        )
    points = query.order_by(SimulatedPoint.label).all()
    return LayerPointsOut(points=points, has_monitor=staff)


@router.get("/{layer_id}/simulated-points", response_model=list[SimulatedPointOut])
def list_simulated_points(
    layer_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(require_role(Role.staff, Role.admin))
):
    return db.query(SimulatedPoint).filter(SimulatedPoint.layer_id == layer_id).all()


@router.post("/{layer_id}/simulated-points", response_model=SimulatedPointOut)
def create_simulated_point(
    layer_id: uuid.UUID,
    body: SimulatedPointCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.staff, Role.admin)),
):
    if db.get(Layer, layer_id) is None:
        raise ApiError(404, "NOT_FOUND", "图层不存在")
    point = SimulatedPoint(
        layer_id=layer_id,
        label=body.label,
        norm_x=body.norm_x,
        norm_y=body.norm_y,
        is_simulated=True,
        kind=SimulatedPointKind.help_point,
        is_public=True,
        description=body.description,
        created_by=user.id,
    )
    db.add(point)
    db.commit()
    db.refresh(point)
    return point
