import re
import uuid
from datetime import UTC, datetime

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.errors import ApiError
from app.models import (
    Attachment,
    AttachmentPurpose,
    AuditLog,
    Building,
    Claim,
    ClaimStatus,
    Direction,
    Item,
    ItemFeature,
    ItemStatus,
    Role,
    Route,
    RouteKind,
    Source,
    User,
    Visibility,
)
from app.schemas.item import ItemCreate, ItemUpdate
from app.schemas.layer import MapAnchorRequest, RouteCreate
from app.services import (
    building_service,
    helper_service,
    item_group_service,
    reaction_service,
    upload_service,
)
from app.services.matching_service import find_candidates
from app.services.model import extract_features

# 可编辑状态：仅进行中的记录允许修改，已找回/已撤销/已归还/已删除不可编辑
_EDITABLE_STATUSES = (ItemStatus.searching, ItemStatus.pending, ItemStatus.reviewing)

# ===== 公共字段脱敏：保存前替换手机号/微信/QQ/邮箱/宿舍号，原始文本不落库 =====
# 手机号：1 开头 + 第 2 位 3-9 的 11 位数字，词边界防止截断长数字串
_PHONE_PATTERN = re.compile(r"(?<!\d)(1[3-9]\d{9})(?!\d)")
# 微信号：wxid_ 前缀，或显式"微信/vx/wx + 号:分隔"语境下的自定义账号（字母开头 6-20 位字母数字_-）
_WECHAT_ID_PATTERN = re.compile(r"wxid_[A-Za-z0-9_-]{5,19}")
_WECHAT_CONTEXT_PATTERN = re.compile(r"(?:微信|加微|vx|wx)\s*(?:号|账号|id)?\s*[:：]?\s*([A-Za-z][A-Za-z0-9_-]{5,19})")
# QQ：带 QQ 语境的 5-11 位数字，或孤立的 6 位以上数字串（避免误伤楼层/门牌等短数字）
_QQ_CONTEXT_PATTERN = re.compile(r"(?:QQ|qq|扣扣)\s*(?:号|群)?\s*[:：]?\s*([1-9]\d{4,10})(?!\d)")
_QQ_BARE_PATTERN = re.compile(r"(?<!\d)([1-9]\d{5,10})(?!\d)")
# 邮箱
_EMAIL_PATTERN = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
# 宿舍号："3号楼502"、"2栋301"、"宿舍A-302"、"公寓5-601" 等形态
_DORM_BUILDING_PATTERN = re.compile(r"\d+\s*[号栋]\s*楼?\s*\d{1,4}")
_DORM_ROOM_PATTERN = re.compile(r"(?:宿舍|公寓)\s*[A-Za-z]?[-#]?\s*\d{1,4}")


def _mask_sensitive(text: str | None) -> str | None:
    """对公开字段（title/description）做联系方式与宿舍号脱敏，原始文本不保留。

    手机号保留前 3 后 4 便于失主辨认；其余敏感项整段替换为固定提示文案。
    """
    if not text:
        return text
    result = text
    result = _PHONE_PATTERN.sub(lambda m: f"{m.group(1)[:3]}****{m.group(1)[-4:]}", result)
    result = _EMAIL_PATTERN.sub("邮箱已隐藏", result)
    result = _WECHAT_ID_PATTERN.sub("微信账号已隐藏", result)
    result = _WECHAT_CONTEXT_PATTERN.sub("微信账号已隐藏", result)
    result = _QQ_CONTEXT_PATTERN.sub("QQ已隐藏", result)
    result = _QQ_BARE_PATTERN.sub("QQ已隐藏", result)
    result = _DORM_BUILDING_PATTERN.sub("宿舍号已隐藏", result)
    result = _DORM_ROOM_PATTERN.sub("宿舍号已隐藏", result)
    return result


def _get_owned_item(db: Session, user: User, item_id: uuid.UUID, forbidden_message: str) -> Item:
    item = db.get(Item, item_id)
    if item is None:
        raise ApiError(404, "NOT_FOUND", "记录不存在")
    if item.owner_user_id != user.id:
        raise ApiError(403, "FORBIDDEN", forbidden_message)
    return item


def _building_map(db: Session, items: list[Item]) -> dict[uuid.UUID, Building]:
    ids = {item.building_id for item in items if item.building_id is not None}
    if not ids:
        return {}
    rows = db.query(Building).filter(Building.id.in_(ids)).all()
    return {row.id: row for row in rows}


def _first_photo_map(db: Session, items: list[Item], user: User) -> dict[uuid.UUID, Attachment]:
    can_review = user.role in (Role.staff, Role.admin)
    ids = [
        item.id for item in items if item.direction != Direction.found or item.owner_user_id == user.id or can_review
    ]
    if not ids:
        return {}
    rows = (
        db.query(Attachment)
        .filter(Attachment.item_id.in_(ids), Attachment.purpose == AttachmentPurpose.item_photo)
        .order_by(Attachment.created_at)
        .all()
    )
    first: dict[uuid.UUID, Attachment] = {}
    for row in rows:
        if row.item_id is not None:
            first.setdefault(row.item_id, row)
    return first


def _group_counts(db: Session, items: list[Item]) -> dict[uuid.UUID, int]:
    """每组可见（未删除）帖子数：折叠卡片"N条相关帖子"的数据来源。"""
    ids = {item.group_id for item in items if item.group_id is not None}
    if not ids:
        return {}
    rows = (
        db.query(Item.group_id, func.count(Item.id))
        .filter(Item.group_id.in_(ids), Item.status != ItemStatus.deleted)
        .group_by(Item.group_id)
        .all()
    )
    return {gid: count for gid, count in rows}


def serialize_items(db: Session, items: list[Item], user: User) -> list[dict]:
    buildings = _building_map(db, items)
    photos = _first_photo_map(db, items, user)
    item_ids = [item.id for item in items]
    counts = reaction_service.counts_for_items(db, item_ids, user.id)
    helper_stats = helper_service.stats_for_items(db, item_ids, user.id)
    group_counts = _group_counts(db, items)
    result = []
    for item in items:
        building = buildings.get(item.building_id) if item.building_id is not None else None
        photo = photos.get(item.id)
        item_counts = counts.get(item.id, {})
        helper = helper_stats.get(item.id, {})
        result.append(
            {
                "id": item.id,
                "direction": item.direction,
                "category": item.category,
                "title": item.title,
                "description": item.description,
                "location_area": item.location_area,
                "time_occurred": item.time_occurred,
                "status": item.status,
                "is_simulated": item.is_simulated,
                "is_demo": item.is_demo,
                "source": item.source,
                "created_at": item.created_at,
                "group_id": item.group_id,
                "group_count": group_counts.get(item.group_id, 1) if item.group_id is not None else 1,
                "building_id": item.building_id,
                "building_name": building.name if building else None,
                "floor": item.floor,
                "first_photo": upload_service.to_upload_out(photo) if photo else None,
                "like_count": item_counts.get("like_count", 0),
                "comment_count": item_counts.get("comment_count", 0),
                "helper_count": helper.get("helper_count", 0),
                "favorite_count": item_counts.get("favorite_count", 0),
                "is_liked": item_counts.get("is_liked", False),
                "is_favorited": item_counts.get("is_favorited", False),
                "is_helper": helper.get("is_helper", False),
            }
        )
    return result


def _approved_claim_exists(db: Session, item_id: uuid.UUID) -> bool:
    return (
        db.query(Claim.id)
        .filter(
            or_(Claim.found_item_id == item_id, Claim.lost_item_id == item_id),
            Claim.status == ClaimStatus.approved,
        )
        .first()
        is not None
    )


def create_item(db: Session, user: User, body: ItemCreate) -> dict:
    if body.building_id is not None and db.get(Building, body.building_id) is None:
        raise ApiError(404, "NOT_FOUND", "建筑不存在")
    status = ItemStatus.searching if body.direction == Direction.lost else ItemStatus.pending
    # 公开字段保存前脱敏：联系方式与宿舍号替换，原始文本不落库
    item = Item(
        direction=body.direction,
        category=body.category,
        title=_mask_sensitive(body.title),
        description=_mask_sensitive(body.description),
        location_area=body.location_area,
        precise_location=body.precise_location,
        time_occurred=body.time_occurred,
        status=status,
        owner_user_id=user.id,
        is_simulated=body.is_simulated,
        building_id=body.building_id,
        floor=body.floor,
    )
    db.add(item)
    db.flush()
    # 相似帖聚合与发布同事务：命中即标记同一 group_id（纯规则，不依赖模型）
    item_group_service.assign_group(db, item)
    if body.photo_ids:
        upload_service.bind_photos_to_item(db, user, item, body.photo_ids)
    db.commit()
    db.refresh(item)
    return serialize_items(db, [item], user)[0]


def list_items(
    db: Session,
    user: User,
    direction: Direction | None = None,
    category: str | None = None,
    location_area: str | None = None,
    status: ItemStatus | None = None,
    q: str | None = None,
    building_id: uuid.UUID | None = None,
    group_id: uuid.UUID | None = None,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[dict], int]:
    # 软删除的记录不再出现在任何公开/后台列表中（等同于下架）
    query = db.query(Item).filter(Item.status != ItemStatus.deleted)
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
    if building_id is not None:
        query = query.filter(Item.building_id == building_id)
    if group_id is not None:
        query = query.filter(Item.group_id == group_id)
    total = query.count()
    items = query.order_by(Item.created_at.desc()).offset(offset).limit(limit).all()
    return serialize_items(db, items, user), total


def list_my_items(db: Session, user: User, limit: int, offset: int) -> tuple[list[dict], int]:
    query = db.query(Item).filter(Item.owner_user_id == user.id, Item.status != ItemStatus.deleted)
    total = query.count()
    items = query.order_by(Item.created_at.desc()).offset(offset).limit(limit).all()
    return serialize_items(db, items, user), total


def get_item_detail(db: Session, user: User, item_id: uuid.UUID) -> dict:
    item = db.get(Item, item_id)
    if item is None:
        raise ApiError(404, "NOT_FOUND", "记录不存在")
    photos, photos_hidden = upload_service.list_item_photos(db, user, item)
    building = _building_map(db, [item]).get(item.building_id) if item.building_id is not None else None
    counts = reaction_service.counts_for_items(db, [item.id], user.id).get(item.id, {})
    helper = helper_service.stats_for_items(db, [item.id], user.id).get(item.id, {})
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
        "is_demo": item.is_demo,
        "source": item.source,
        "created_at": item.created_at,
        "group_id": item.group_id,
        "norm_x": item.norm_x,
        "norm_y": item.norm_y,
        "layer_id": item.layer_id,
        "precise_location": item.precise_location if item.owner_user_id == user.id else None,
        "building_id": item.building_id,
        "building_name": building.name if building else None,
        "floor": item.floor,
        "photos": [upload_service.to_upload_out(photo) for photo in photos],
        "photos_hidden": photos_hidden,
        "like_count": counts.get("like_count", 0),
        "comment_count": counts.get("comment_count", 0),
        "helper_count": helper.get("helper_count", 0),
        "favorite_count": counts.get("favorite_count", 0),
        "is_liked": counts.get("is_liked", False),
        "is_favorited": counts.get("is_favorited", False),
        "is_helper": helper.get("is_helper", False),
        "helpers": helper_service.list_helpers(db, item.id),
    }


def update_item(db: Session, user: User, item_id: uuid.UUID, body: ItemUpdate) -> dict:
    item = _get_owned_item(db, user, item_id, "只能编辑自己发布的记录")
    if item.status not in _EDITABLE_STATUSES:
        raise ApiError(409, "STATE_CONFLICT", "当前状态不可编辑")
    if item.status == ItemStatus.reviewing and _approved_claim_exists(db, item.id):
        raise ApiError(409, "STATE_CONFLICT", "已有通过的认领，请走归还流程")
    data = body.model_dump(exclude_unset=True)
    building_id = data.get("building_id")
    if building_id is not None and db.get(Building, building_id) is None:
        raise ApiError(404, "NOT_FOUND", "建筑不存在")
    for field, value in data.items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return get_item_detail(db, user, item.id)


def delete_item(db: Session, user: User, item_id: uuid.UUID) -> dict:
    item = db.get(Item, item_id)
    if item is None:
        raise ApiError(404, "NOT_FOUND", "记录不存在")
    is_moderator = user.role in (Role.staff, Role.admin)
    if item.owner_user_id != user.id and not is_moderator:
        raise ApiError(403, "FORBIDDEN", "只能删除自己发布的记录")
    if item.status == ItemStatus.deleted:
        raise ApiError(409, "STATE_CONFLICT", "记录已删除")
    if _approved_claim_exists(db, item.id):
        raise ApiError(409, "STATE_CONFLICT", "已有通过的认领，请走归还流程")
    item.status = ItemStatus.deleted
    # 软删除留痕 + 审计日志：操作人、时间、帖子 id、操作类型
    item.deleted_at = datetime.now(UTC)
    item.deleted_by_id = user.id
    db.add(AuditLog(operator_user_id=user.id, item_id=item.id, action="soft_delete"))
    db.commit()
    db.refresh(item)
    return serialize_items(db, [item], user)[0]


def batch_delete_items(db: Session, admin: User, post_ids: list[uuid.UUID]) -> dict:
    """管理员批量软删除：逐条独立提交，部分失败不影响其余帖子，返回逐条结果。"""
    results = []
    for post_id in post_ids:
        try:
            delete_item(db, admin, post_id)
        except ApiError as exc:
            results.append({"post_id": post_id, "deleted": False, "reason": exc.message})
        else:
            results.append({"post_id": post_id, "deleted": True, "reason": None})
    return {"deleted": sum(1 for result in results if result["deleted"]), "results": results}


def bind_photos(db: Session, user: User, item_id: uuid.UUID, photo_ids: list[uuid.UUID]) -> Item:
    item = _get_owned_item(db, user, item_id, "只能给自己的记录添加照片")
    upload_service.bind_photos_to_item(db, user, item, photo_ids)
    db.commit()
    db.refresh(item)
    return item


def withdraw_item(db: Session, user: User, item_id: uuid.UUID) -> dict:
    item = _get_owned_item(db, user, item_id, "只能撤销自己发布的记录")
    if item.status in (ItemStatus.withdrawn, ItemStatus.found, ItemStatus.returned, ItemStatus.deleted):
        raise ApiError(409, "STATE_CONFLICT", "当前状态不可撤销")
    if item.status == ItemStatus.reviewing and _approved_claim_exists(db, item.id):
        raise ApiError(409, "STATE_CONFLICT", "已有通过的认领，请走归还流程")
    item.status = ItemStatus.withdrawn
    db.commit()
    db.refresh(item)
    return serialize_items(db, [item], user)[0]


def mark_found(db: Session, user: User, item_id: uuid.UUID) -> dict:
    item = _get_owned_item(db, user, item_id, "只能标记自己发布的记录")
    if item.direction != Direction.lost or item.status != ItemStatus.searching:
        raise ApiError(409, "STATE_CONFLICT", "只有寻找中的寻物记录可以标记已找回")
    if _approved_claim_exists(db, item.id):
        raise ApiError(409, "STATE_CONFLICT", "已有通过的认领，请走归还流程")
    item.status = ItemStatus.found
    db.commit()
    db.refresh(item)
    return serialize_items(db, [item], user)[0]


def set_map_anchor(db: Session, user: User, item_id: uuid.UUID, body: MapAnchorRequest) -> dict:
    item = _get_owned_item(db, user, item_id, "只能给自己的记录标点")
    layer = building_service.ensure_position_layer(db, body.layer_id)
    building_service.ensure_floor_anchor(layer, item.building_id, item.floor)
    item.layer_id = body.layer_id
    item.norm_x = body.norm_x
    item.norm_y = body.norm_y
    item.is_simulated = body.is_simulated
    db.commit()
    db.refresh(item)
    return {"ok": True}


def create_route(db: Session, user: User, item_id: uuid.UUID, body: RouteCreate) -> dict:
    _get_owned_item(db, user, item_id, "只能给自己的记录添加路线")
    if body.layer_id is not None:
        building_service.ensure_flat_layer(db, body.layer_id, "route")
    default_visibility = Visibility.public if body.kind == RouteKind.circle else Visibility.private
    route = Route(
        item_id=item_id,
        layer_id=body.layer_id,
        kind=body.kind,
        geometry=body.geometry.model_dump() if body.geometry is not None else None,
        floor_segments=body.floor_segments,
        visibility=body.visibility or default_visibility,
        authorized=False,
    )
    db.add(route)
    db.commit()
    db.refresh(route)
    return {"id": route.id, "kind": route.kind.value, "visibility": route.visibility.value}


def list_routes(db: Session, user: User, item_id: uuid.UUID) -> list[dict]:
    _get_owned_item(db, user, item_id, "路线默认私密")
    routes = db.query(Route).filter(Route.item_id == item_id).all()
    return [
        {
            "id": r.id,
            "kind": r.kind.value,
            "geometry": r.geometry,
            "floor_segments": r.floor_segments,
            "visibility": r.visibility.value,
            "authorized": r.authorized,
        }
        for r in routes
    ]


def extract_item_features(db: Session, user: User, item_id: uuid.UUID, text: str | None = None) -> dict:
    _get_owned_item(db, user, item_id, "只能提取自己记录的特征")
    result = extract_features(text)
    feature = db.query(ItemFeature).filter(ItemFeature.item_id == item_id, ItemFeature.confirmed.is_(False)).first()
    if feature is None:
        feature = ItemFeature(item_id=item_id, confirmed=False)
        db.add(feature)
    feature.labels = result["labels"]
    feature.extracted_text = result["extracted_text"]
    feature.source = Source.model if not result["degraded"] else Source.manual
    feature.confidence = result["confidence"]
    db.commit()
    return result


def get_candidates(db: Session, user: User, item_id: uuid.UUID) -> list[dict]:
    item = _get_owned_item(db, user, item_id, "只能查看自己记录的候选")
    if item.direction != Direction.lost:
        return []
    return find_candidates(db, item)
