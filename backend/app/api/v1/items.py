import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models import Direction, ItemStatus, User
from app.schemas.common import Page
from app.schemas.item import (
    CandidateOut,
    FeatureExtractionOut,
    FeatureExtractRequest,
    ItemCreate,
    ItemDetail,
    ItemPublic,
    ItemUpdate,
)
from app.schemas.layer import MapAnchorOut, MapAnchorRequest, RouteCreate, RouteDetail, RouteOut
from app.schemas.upload import PhotoBindRequest
from app.services import item_service, match_push_service

router = APIRouter(tags=["items"])


@router.post("", response_model=ItemPublic)
def create_item(
    body: ItemCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = item_service.create_item(db, user, body)
    # 发布成功后异步匹配历史帖；推送失败只记日志，不影响发布结果
    background_tasks.add_task(match_push_service.run_match_push, result["id"])
    return result


@router.patch("/{item_id}", response_model=ItemDetail)
def update_item(
    item_id: uuid.UUID, body: ItemUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    return item_service.update_item(db, user, item_id, body)


@router.delete("/{item_id}", response_model=ItemPublic)
def delete_item(item_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return item_service.delete_item(db, user, item_id)


@router.get("", response_model=Page[ItemPublic])
def list_items(
    direction: Direction | None = None,
    category: str | None = None,
    location_area: str | None = None,
    status: ItemStatus | None = None,
    q: str | None = None,
    building_id: uuid.UUID | None = None,
    group_id: uuid.UUID | None = None,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    items, total = item_service.list_items(
        db, user, direction, category, location_area, status, q, building_id, group_id, limit, offset
    )
    return Page(items=items, total=total, limit=limit, offset=offset)


@router.get("/{item_id}", response_model=ItemDetail)
def get_item(item_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return item_service.get_item_detail(db, user, item_id)


@router.post("/{item_id}/withdraw", response_model=ItemPublic)
def withdraw_item(item_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return item_service.withdraw_item(db, user, item_id)


@router.post("/{item_id}/mark-found", response_model=ItemPublic)
def mark_found(item_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return item_service.mark_found(db, user, item_id)


@router.post("/{item_id}/photos", response_model=ItemDetail)
def bind_photos(
    item_id: uuid.UUID, body: PhotoBindRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    item_service.bind_photos(db, user, item_id, body.photo_ids)
    return item_service.get_item_detail(db, user, item_id)


@router.post("/{item_id}/map-anchor", response_model=MapAnchorOut)
def set_map_anchor(
    item_id: uuid.UUID, body: MapAnchorRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    return item_service.set_map_anchor(db, user, item_id, body)


@router.post("/{item_id}/route", response_model=RouteOut)
def create_route(
    item_id: uuid.UUID, body: RouteCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    return item_service.create_route(db, user, item_id, body)


@router.get("/{item_id}/route", response_model=list[RouteDetail])
def get_route(item_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return item_service.list_routes(db, user, item_id)


@router.post("/{item_id}/extract", response_model=FeatureExtractionOut)
def extract(
    item_id: uuid.UUID,
    body: FeatureExtractRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return item_service.extract_item_features(db, user, item_id, body.text)


@router.get("/{item_id}/candidates", response_model=list[CandidateOut])
def get_candidates(item_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return item_service.get_candidates(db, user, item_id)
