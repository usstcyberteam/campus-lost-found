import json
import logging
import math
import re
import uuid
from collections import defaultdict

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.errors import ApiError
from app.models import Building, Item, Route, User
from app.models.enums import Direction, Role, Source, Visibility
from app.schemas.ai import SearchAdviceRequest
from app.services import model_client

logger = logging.getLogger(__name__)

MAX_LOCATIONS = 5
_BUILDING_HINTS = {
    "图书馆": ("书", "笔记本电脑", "耳机", "校园卡", "雨伞", "水杯"),
    "食堂": ("校园卡", "钱包", "雨伞", "水杯", "钥匙"),
    "教学楼": ("手机", "笔记本电脑", "耳机", "雨伞", "水杯", "充电宝", "眼镜"),
    "宿舍": ("钥匙", "校园卡", "衣物", "钱包", "耳机"),
}
_PRIVATE_PATTERNS = (
    re.compile(r"1[3-9]\d{9}"),
    re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+"),
    re.compile(r"\d{17}[\dXx]"),
)
_EXPLAIN_PROMPT = (
    "你是校园失物招领助手，只根据给定数据为每个建筑写一句寻找建议理由。"
    '只输出 JSON：{"locations":[{"building_code":"...","reason":"..."}]}。'
    "理由要简短，不得编造联系方式、精确位置、监控内容或他人路线。"
)


def _is_point(value: object) -> bool:
    return (
        isinstance(value, dict)
        and isinstance(value.get("x"), (int, float))
        and isinstance(value.get("y"), (int, float))
    )


def _points_from_geometry(geometry: dict | None) -> list[tuple[float, float]]:
    if not isinstance(geometry, dict):
        return []
    center = geometry.get("center")
    if _is_point(center):
        return [(float(center["x"]), float(center["y"]))]
    points = geometry.get("points")
    if isinstance(points, list):
        return [(float(point["x"]), float(point["y"])) for point in points if _is_point(point)]
    if _is_point(geometry):
        return [(float(geometry["x"]), float(geometry["y"]))]
    return []


def _item_points(db: Session, item: Item) -> list[tuple[float, float]]:
    route = db.query(Route).filter(Route.item_id == item.id).first()
    if route is not None:
        points = _points_from_geometry(route.geometry)
        if points:
            return points
    if item.norm_x is not None and item.norm_y is not None:
        return [(float(item.norm_x), float(item.norm_y))]
    return []


def _load_item(db: Session, user: User, item_id: uuid.UUID) -> Item:
    item = db.get(Item, item_id)
    if item is None:
        raise ApiError(404, "NOT_FOUND", "记录不存在")
    if item.owner_user_id == user.id or user.role in (Role.staff, Role.admin):
        return item
    private_route = db.query(Route.id).filter(Route.item_id == item.id, Route.visibility == Visibility.private).first()
    if private_route is not None:
        raise ApiError(403, "FORBIDDEN", "无权使用他人的私密路线")
    return item


def _building_stats(db: Session) -> dict[uuid.UUID, dict]:
    rows = (
        db.query(Item.building_id, Item.direction, Item.category, func.count(Item.id))
        .filter(Item.building_id.isnot(None))
        .group_by(Item.building_id, Item.direction, Item.category)
        .all()
    )
    stats: dict[uuid.UUID, dict] = defaultdict(lambda: {"lost": 0, "found": 0, "categories": {}})
    for building_id, direction, category, count in rows:
        entry = stats[building_id]
        entry["lost" if direction == Direction.lost else "found"] += count
        entry["categories"][category] = entry["categories"].get(category, 0) + count
    return stats


def _building_point(building: Building) -> tuple[float, float] | None:
    label = building.label_position
    if _is_point(label):
        return float(label["x"]), float(label["y"])
    region = building.click_region or []
    points = [(float(point["x"]), float(point["y"])) for point in region if _is_point(point)]
    if not points:
        return None
    return sum(x for x, _ in points) / len(points), sum(y for _, y in points) / len(points)


def _category_hint(building_category: str, category: str | None) -> bool:
    if not category:
        return False
    hints = _BUILDING_HINTS.get(building_category, ())
    return any(hint in category or category in hint for hint in hints)


def _score(building: Building, points: list[tuple[float, float]], stats: dict, category: str | None) -> dict:
    building_point = _building_point(building)
    distance = None
    if points and building_point is not None:
        distance = min(math.hypot(x - building_point[0], y - building_point[1]) for x, y in points)
    lost = stats.get("lost", 0)
    found = stats.get("found", 0)
    same = stats.get("categories", {}).get(category, 0) if category else 0
    hint = _category_hint(building.category, category)
    distance_score = max(0.0, 1 - distance / 0.45) * 40 if distance is not None else 0.0
    history_score = min((lost + found) / 12, 1) * 20
    same_score = min(same / 5, 1) * 25
    return {
        "building_code": building.code,
        "building_name": building.name,
        "score": round(distance_score + history_score + same_score + (15 if hint else 0), 1),
        "distance": distance,
        "lost": lost,
        "found": found,
        "same": same,
        "hint": hint,
    }


def _distance_level(distance: float | None) -> str:
    if distance is None:
        return "未知"
    if distance <= 0.08:
        return "近"
    if distance <= 0.25:
        return "中"
    return "远"


def _template_reason(row: dict) -> str:
    parts = []
    if row["distance"] is not None:
        parts.append(f"距离较{_distance_level(row['distance'])}")
    if row["lost"] or row["found"]:
        parts.append(f"历史寻物 {row['lost']} 条、拾获 {row['found']} 条")
    if row["same"]:
        parts.append(f"同类别记录 {row['same']} 条")
    if row["hint"]:
        parts.append("建筑类型与类别匹配")
    return "；".join(parts) + "。" if parts else "根据现有历史记录推荐。"


def _sanitize(value: str) -> str:
    result = value
    for pattern in _PRIVATE_PATTERNS:
        result = pattern.sub("[已脱敏]", result)
    return result


def _model_reasons(category: str | None, rows: list[dict]) -> dict[str, str] | None:
    if not model_client.is_available():
        return None
    payload = {
        "category": category,
        "locations": [
            {
                "building_code": row["building_code"],
                "building_name": row["building_name"],
                "distance_level": _distance_level(row["distance"]),
                "lost_count": row["lost"],
                "found_count": row["found"],
                "same_category_count": row["same"],
            }
            for row in rows
        ],
    }
    content = model_client.chat_completion(
        [
            {"role": "system", "content": _EXPLAIN_PROMPT},
            {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
        ]
    )
    if content is None:
        return None
    text = content.strip()
    if text.startswith("```"):
        text = text.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    try:
        data = json.loads(text)
    except (json.JSONDecodeError, TypeError):
        logger.warning("推荐解释无法解析，已降级")
        return None
    locations = data.get("locations") if isinstance(data, dict) else None
    if not isinstance(locations, list):
        return None
    reasons: dict[str, str] = {}
    for row in locations:
        if not isinstance(row, dict):
            continue
        code = row.get("building_code")
        reason = row.get("reason")
        if isinstance(code, str) and isinstance(reason, str) and reason.strip():
            reasons[code] = _sanitize(reason.strip())[:200]
    return reasons or None


def recommend(db: Session, user: User, body: SearchAdviceRequest) -> dict:
    if body.item_id is None and body.geometry is None:
        raise ApiError(400, "VALIDATION", "请提供寻物帖或绘制范围")
    item = _load_item(db, user, body.item_id) if body.item_id is not None else None
    category = (body.category or (item.category if item is not None else None) or "").strip() or None
    points = _points_from_geometry(body.geometry) if body.geometry is not None else []
    if not points and item is not None:
        points = _item_points(db, item)

    stats = _building_stats(db)
    ranked = [
        _score(building, points, stats.get(building.id, {}), category)
        for building in db.query(Building).order_by(Building.code).all()
    ]
    ranked.sort(key=lambda row: (-row["score"], row["building_code"]))
    top = ranked[:MAX_LOCATIONS]

    reasons = _model_reasons(category, top)
    locations = [
        {
            "building_code": row["building_code"],
            "building_name": row["building_name"],
            "reason": (reasons or {}).get(row["building_code"]) or _template_reason(row),
            "order": index,
        }
        for index, row in enumerate(top, start=1)
    ]
    return {
        "locations": locations,
        "source": Source.model if reasons is not None else Source.rule,
        "degraded": reasons is None,
    }
