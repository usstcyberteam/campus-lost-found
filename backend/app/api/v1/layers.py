import os
import uuid

from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.deps import get_current_user, require_role
from app.database import get_db
from app.errors import ApiError
from app.models import Item, Layer, Role, SimulatedPoint, User
from app.schemas.layer import CalibrateRequest, LayerOut, MapItemOut, SimulatedPointCreate, SimulatedPointOut

router = APIRouter(tags=["layers"])


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
    return FileResponse(path, media_type="image/jpeg")


@router.post("/{layer_id}/calibrate", response_model=LayerOut)
def calibrate(layer_id: uuid.UUID, body: CalibrateRequest, db: Session = Depends(get_db), user: User = Depends(require_role(Role.admin))):
    layer = db.get(Layer, layer_id)
    if layer is None:
        raise ApiError(404, "NOT_FOUND", "图层不存在")
    layer.pixels_per_meter = body.pixels_per_meter
    layer.scale_calibrated = True
    db.commit()
    db.refresh(layer)
    return layer


@router.get("/{layer_id}/items", response_model=list[MapItemOut])
def list_layer_items(layer_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    layer = db.get(Layer, layer_id)
    if layer is None:
        raise ApiError(404, "NOT_FOUND", "图层不存在")
    return (
        db.query(Item)
        .filter(Item.layer_id == layer_id, Item.owner_user_id == user.id, Item.norm_x.isnot(None), Item.norm_y.isnot(None))
        .order_by(Item.created_at.desc())
        .all()
    )


@router.get("/{layer_id}/simulated-points", response_model=list[SimulatedPointOut])
def list_simulated_points(layer_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(require_role(Role.staff, Role.admin))):
    return db.query(SimulatedPoint).filter(SimulatedPoint.layer_id == layer_id).all()


@router.post("/{layer_id}/simulated-points", response_model=SimulatedPointOut)
def create_simulated_point(layer_id: uuid.UUID, body: SimulatedPointCreate, db: Session = Depends(get_db), user: User = Depends(require_role(Role.staff, Role.admin))):
    point = SimulatedPoint(
        layer_id=layer_id,
        label=body.label,
        norm_x=body.norm_x,
        norm_y=body.norm_y,
        is_simulated=True,
        description=body.description,
        created_by=user.id,
    )
    db.add(point)
    db.commit()
    db.refresh(point)
    return point