import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.errors import ApiError
from app.models import Direction, Item, ItemFeature, ItemStatus, Route, Source, User
from app.schemas.item import ItemCreate, ItemPublic
from app.schemas.layer import MapAnchorRequest, RouteCreate
from app.services.model import extract_features

router = APIRouter(tags=["items"])


@router.post("", response_model=ItemPublic)
def create_item(body: ItemCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    status = ItemStatus.searching if body.direction == Direction.lost else ItemStatus.pending
    item = Item(
        direction=body.direction,
        category=body.category,
        title=body.title,
        description=body.description,
        location_area=body.location_area,
        precise_location=body.precise_location,
        time_occurred=body.time_occurred,
        status=status,
        owner_user_id=user.id,
        is_simulated=body.is_simulated,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get("", response_model=list[ItemPublic])
def list_items(
    direction: Direction | None = None,
    category: str | None = None,
    location_area: str | None = None,
    status: ItemStatus | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = db.query(Item)
    if direction is not None:
        query = query.filter(Item.direction == direction)
    if category:
        query = query.filter(Item.category == category)
    if location_area:
        query = query.filter(Item.location_area.ilike(f"%{location_area}%"))
    if status is not None:
        query = query.filter(Item.status == status)
    return query.order_by(Item.created_at.desc()).all()


@router.get("/{item_id}")
def get_item(item_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    item = db.get(Item, item_id)
    if item is None:
        raise ApiError(404, "NOT_FOUND", "记录不存在")
    return {
        "id": item.id,
        "is_owner": item.owner_user_id == user.id,
        "direction": item.direction,
        "category": item.category,
        "title": item.title,
        "description": item.description,
        "location_area": item.location_area,
        "time_occurred": item.time_occurred,
        "status": item.status,
        "is_simulated": item.is_simulated,
        "source": item.source,
        "created_at": item.created_at,
        "norm_x": item.norm_x,
        "norm_y": item.norm_y,
        "layer_id": item.layer_id,
        "precise_location": item.precise_location if item.owner_user_id == user.id else None,
    }


@router.post("/{item_id}/map-anchor")
def set_map_anchor(
    item_id: uuid.UUID, body: MapAnchorRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    item = db.get(Item, item_id)
    if item is None:
        raise ApiError(404, "NOT_FOUND", "记录不存在")
    if item.owner_user_id != user.id:
        raise ApiError(403, "FORBIDDEN", "只能给自己的记录标点")
    if not (0 <= body.norm_x <= 1 and 0 <= body.norm_y <= 1):
        raise ApiError(400, "VALIDATION", "坐标须在 0 到 1 之间")
    item.layer_id = body.layer_id
    item.norm_x = body.norm_x
    item.norm_y = body.norm_y
    item.is_simulated = body.is_simulated
    db.commit()
    db.refresh(item)
    return {"ok": True}


@router.post("/{item_id}/route")
def create_route(
    item_id: uuid.UUID, body: RouteCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    item = db.get(Item, item_id)
    if item is None:
        raise ApiError(404, "NOT_FOUND", "记录不存在")
    if item.owner_user_id != user.id:
        raise ApiError(403, "FORBIDDEN", "只能给自己的记录添加路线")
    route = Route(
        item_id=item_id,
        layer_id=body.layer_id,
        kind=body.kind,
        geometry=body.geometry,
        floor_segments=body.floor_segments,
        is_private=True,
        authorized=False,
    )
    db.add(route)
    db.commit()
    db.refresh(route)
    return {"id": route.id, "kind": route.kind.value, "is_private": route.is_private}


@router.get("/{item_id}/route")
def get_route(item_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    item = db.get(Item, item_id)
    if item is None:
        raise ApiError(404, "NOT_FOUND", "记录不存在")
    if item.owner_user_id != user.id:
        raise ApiError(403, "FORBIDDEN", "路线默认私密")
    routes = db.query(Route).filter(Route.item_id == item_id).all()
    return [
        {
            "id": r.id,
            "kind": r.kind.value,
            "geometry": r.geometry,
            "floor_segments": r.floor_segments,
            "is_private": r.is_private,
            "authorized": r.authorized,
        }
        for r in routes
    ]


@router.post("/{item_id}/extract")
def extract(
    item_id: uuid.UUID, text: str | None = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    item = db.get(Item, item_id)
    if item is None:
        raise ApiError(404, "NOT_FOUND", "记录不存在")
    if item.owner_user_id != user.id:
        raise ApiError(403, "FORBIDDEN", "只能提取自己记录的特征")
    result = extract_features(text)
    feature = ItemFeature(
        item_id=item_id,
        labels=result["labels"],
        extracted_text=result["extracted_text"],
        source=Source.model if not result["degraded"] else Source.manual,
        confirmed=False,
        confidence=result["confidence"],
    )
    db.add(feature)
    db.commit()
    return result


@router.get("/{item_id}/candidates")
def get_candidates(item_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    item = db.get(Item, item_id)
    if item is None:
        raise ApiError(404, "NOT_FOUND", "记录不存在")
    if item.owner_user_id != user.id:
        raise ApiError(403, "FORBIDDEN", "只能查看自己记录的候选")
    if item.direction != Direction.lost:
        return []

    found_items = (
        db.query(Item)
        .filter(Item.direction == Direction.found, Item.status.in_([ItemStatus.pending, ItemStatus.reviewing]))
        .all()
    )
    scored: list[tuple[Item, float, list[str]]] = []
    for found in found_items:
        if found.id == item.id:
            continue
        score = 0.0
        reasons: list[str] = []
        if found.category == item.category:
            score += 1.0
            reasons.append("类别一致")
        if item.location_area and found.location_area == item.location_area:
            score += 0.5
            reasons.append("地点一致")
        if score > 0:
            scored.append((found, score, reasons))

    scored.sort(key=lambda x: x[1], reverse=True)
    top = scored[:3]

    return [
        {
            "found_item_id": str(found.id),
            "score": score,
            "explanation": "；".join(reasons),
            "source": "rule",
            "title": found.title,
            "category": found.category,
            "location_area": found.location_area,
        }
        for found, score, reasons in top
    ]
