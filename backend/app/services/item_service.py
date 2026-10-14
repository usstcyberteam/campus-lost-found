import uuid

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.errors import ApiError
from app.models import Direction, Item, ItemFeature, ItemStatus, Route, Source, User
from app.schemas.item import ItemCreate
from app.schemas.layer import MapAnchorRequest, RouteCreate
from app.services.matching_service import find_candidates
from app.services.model import extract_features


def _get_owned_item(db: Session, user: User, item_id: uuid.UUID, forbidden_message: str) -> Item:
    item = db.get(Item, item_id)
    if item is None:
        raise ApiError(404, "NOT_FOUND", "记录不存在")
    if item.owner_user_id != user.id:
        raise ApiError(403, "FORBIDDEN", forbidden_message)
    return item


def create_item(db: Session, user: User, body: ItemCreate) -> Item:
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


def list_items(
    db: Session,
    direction: Direction | None = None,
    category: str | None = None,
    location_area: str | None = None,
    status: ItemStatus | None = None,
    q: str | None = None,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[Item], int]:
    query = db.query(Item)
    if direction is not None:
        query = query.filter(Item.direction == direction)
    if q:
        pattern = f"%{q}%"
        query = query.filter(
            or_(Item.title.ilike(pattern), Item.description.ilike(pattern), Item.category.ilike(pattern))
        )
    if category:
        query = query.filter(Item.category.ilike(f"%{category}%"))
    if location_area:
        query = query.filter(Item.location_area.ilike(f"%{location_area}%"))
    if status is not None:
        query = query.filter(Item.status == status)
    total = query.count()
    items = query.order_by(Item.created_at.desc()).offset(offset).limit(limit).all()
    return items, total


def list_my_items(db: Session, user: User, limit: int, offset: int) -> tuple[list[Item], int]:
    query = db.query(Item).filter(Item.owner_user_id == user.id)
    total = query.count()
    items = query.order_by(Item.created_at.desc()).offset(offset).limit(limit).all()
    return items, total


def get_item_detail(db: Session, user: User, item_id: uuid.UUID) -> dict:
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


def set_map_anchor(db: Session, user: User, item_id: uuid.UUID, body: MapAnchorRequest) -> dict:
    item = _get_owned_item(db, user, item_id, "只能给自己的记录标点")
    if not (0 <= body.norm_x <= 1 and 0 <= body.norm_y <= 1):
        raise ApiError(400, "VALIDATION", "坐标须在 0 到 1 之间")
    item.layer_id = body.layer_id
    item.norm_x = body.norm_x
    item.norm_y = body.norm_y
    item.is_simulated = body.is_simulated
    db.commit()
    db.refresh(item)
    return {"ok": True}


def create_route(db: Session, user: User, item_id: uuid.UUID, body: RouteCreate) -> dict:
    _get_owned_item(db, user, item_id, "只能给自己的记录添加路线")
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


def list_routes(db: Session, user: User, item_id: uuid.UUID) -> list[dict]:
    _get_owned_item(db, user, item_id, "路线默认私密")
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


def extract_item_features(db: Session, user: User, item_id: uuid.UUID, text: str | None = None) -> dict:
    _get_owned_item(db, user, item_id, "只能提取自己记录的特征")
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


def get_candidates(db: Session, user: User, item_id: uuid.UUID) -> list[dict]:
    item = _get_owned_item(db, user, item_id, "只能查看自己记录的候选")
    if item.direction != Direction.lost:
        return []
    return find_candidates(db, item)
