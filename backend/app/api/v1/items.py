import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models import Direction, ItemStatus, User
from app.schemas.item import ItemCreate, ItemPublic
from app.schemas.layer import MapAnchorRequest, RouteCreate
from app.services import item_service

router = APIRouter(tags=["items"])


@router.post("", response_model=ItemPublic)
def create_item(body: ItemCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return item_service.create_item(db, user, body)


@router.get("", response_model=list[ItemPublic])
def list_items(
    direction: Direction | None = None,
    category: str | None = None,
    location_area: str | None = None,
    status: ItemStatus | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return item_service.list_items(db, direction, category, location_area, status)


@router.get("/{item_id}")
def get_item(item_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return item_service.get_item_detail(db, user, item_id)


@router.post("/{item_id}/map-anchor")
def set_map_anchor(
    item_id: uuid.UUID, body: MapAnchorRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    return item_service.set_map_anchor(db, user, item_id, body)


@router.post("/{item_id}/route")
def create_route(
    item_id: uuid.UUID, body: RouteCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    return item_service.create_route(db, user, item_id, body)


@router.get("/{item_id}/route")
def get_route(item_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return item_service.list_routes(db, user, item_id)


@router.post("/{item_id}/extract")
def extract(
    item_id: uuid.UUID, text: str | None = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    return item_service.extract_item_features(db, user, item_id, text)


@router.get("/{item_id}/candidates")
def get_candidates(item_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return item_service.get_candidates(db, user, item_id)
