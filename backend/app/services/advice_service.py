import json
import logging
import math
import re
import uuid
from collections import defaultdict
from typing import Literal

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.errors import ApiError
from app.models import Building, Item, Route, User
from app.models.enums import Direction, Role, Source, Visibility
from app.schemas.ai import SearchAdviceRequest
from app.services import building_service, model_client

logger = logging.getLogger(__name__)

MAX_LOCATIONS = 5
PointKind = Literal["range", "mark"]
_BUILDING_HINTS = {
    "图书馆": ("书", "笔记本电脑", "耳机", "校园卡", "雨伞", "水杯"),
    "食堂": ("校园卡", "钱包", "雨伞", "水杯", "钥匙"),
    "教学楼": ("手机", "笔记本电脑", "耳机", "雨伞", "水杯", "充电宝", "眼镜"),
    "宿舍": ("钥匙", "校园卡", "衣物", "钱包", "耳机"),
    "体育馆": ("水杯", "耳机", "钥匙", "衣物", "校园卡"),
    "运动场": ("水杯", "耳机", "钥匙", "衣物", "校园卡"),
    "球场": ("水杯", "耳机", "钥匙", "衣物", "校园卡"),
    "生活服务": ("校园卡", "钱包", "雨伞"),
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


def _points_from_geometry(geometry: dict | None) -> tuple[list[tuple[float, float]], PointKind | None]:
    if not isinstance(geometry, dict):
        return [], None
    center = geometry.get("center")
    if _is_point(center):
        return [(float(center["x"]), float(center["y"]))], "range"
    points = geometry.get("points")
    if isinstance(points, list):
        return [(float(point["x"]), float(point["y"])) for point in points if _is_point(point)], "range"
    if _is_point(geometry):
        return [(float(geometry["x"]), float(geometry["y"]))], "mark"
    return [], None


def _item_points(db: Session, item: Item) -> tuple[list[tuple[float, float]], PointKind | None, dict | None]:
    route = db.query(Route).filter(Route.item_id == item.id).first()
    if route is not None:
        points, kind = _points_from_geometry(route.geometry)
        if points:
            return points, kind, route.geometry
    if item.norm_x is not None and item.norm_y is not None:
        return [(float(item.norm_x), float(item.norm_y))], "mark", None
    return [], None, None


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


def _segment_distance(
    px: float,
    py: float,
    start: tuple[float, float],
    end: tuple[float, float],
) -> float:
    x1, y1 = start
    x2, y2 = end
    dx = x2 - x1
    dy = y2 - y1
    if dx == 0 and dy == 0:
        return math.hypot(px - x1, py - y1)
    ratio = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)
    ratio = min(1.0, max(0.0, ratio))
    return math.hypot(px - (x1 + ratio * dx), py - (y1 + ratio * dy))


def _edge_pixels(
    building_point: tuple[float, float],
    points: list[tuple[float, float]],
    geometry: dict | None,
    layer,
) -> float:
    width = float(layer.width)
    height = float(layer.height)
    bx = building_point[0] * width
    by = building_point[1] * height
    center = geometry.get("center") if isinstance(geometry, dict) else None
    radius = geometry.get("radius") if isinstance(geometry, dict) else None
    if _is_point(center) and isinstance(radius, (int, float)) and radius > 0:
        cx = float(center["x"]) * width
        cy = float(center["y"]) * height
        rx = float(radius) * width
        ry = float(radius) * height
        nx = (bx - cx) / rx
        ny = (by - cy) / ry
        norm = math.hypot(nx, ny)
        # 归一化坐标下圆在画布上是椭圆，按同一方向投影到边界才是视觉上的最近点
        if norm <= 1:
            return 0.0
        return math.hypot(bx - (cx + rx * nx / norm), by - (cy + ry * ny / norm))
    vertices = [(x * width, y * height) for x, y in points]
    if len(vertices) == 1:
        return math.hypot(bx - vertices[0][0], by - vertices[0][1])
    # 折线表示路线，不闭合成区域，按到线段的距离计算
    return min(_segment_distance(bx, by, vertices[index], vertices[index + 1]) for index in range(len(vertices) - 1))


def _meters(
    points: list[tuple[float, float]],
    building_point: tuple[float, float] | None,
    layer,
    geometry: dict | None,
) -> int | None:
    if layer is None or not layer.scale_calibrated or not layer.pixels_per_meter:
        return None
    if building_point is None or not points:
        return None
    pixels = _edge_pixels(building_point, points, geometry, layer)
    return round(pixels / float(layer.pixels_per_meter))


def _score(
    building: Building,
    points: list[tuple[float, float]],
    stats: dict,
    category: str | None,
    layer,
    geometry: dict | None,
) -> dict:
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
        "meters": _meters(points, building_point, layer, geometry),
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


def _template_reason(row: dict, point_kind: PointKind | None) -> str:
    parts = []
    if point_kind == "range" and row.get("meters") == 0:
        parts.append("就在你圈选的范围内")
    elif point_kind is not None and row.get("meters") is not None:
        where = "你标记的位置" if point_kind == "mark" else "你圈选的范围"
        parts.append(f"距{where}约 {row['meters']} 米")
    elif row["distance"] is not None:
        parts.append(f"距离较{_distance_level(row['distance'])}")
    if row["lost"] or row["found"]:
        parts.append(f"历史寻物 {row['lost']} 条、拾获 {row['found']} 条")
    if row["same"]:
        parts.append(f"同类别记录 {row['same']} 条")
    if row["hint"]:
        parts.append("建筑类型与类别匹配")
    return "；".join(parts) + "。" if parts else "根据现有历史记录推荐。"


def _compose_reason(row: dict, point_kind: PointKind | None, model_reason: str | None) -> str:
    template = _template_reason(row, point_kind)
    if not model_reason:
        return template
    room = 200 - len(template)
    text = model_reason[:room] if room > 0 else ""
    return f"{template}{text}" if text else template


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
                "distance_meters": row["meters"],
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
    points: list[tuple[float, float]] = []
    point_kind: PointKind | None = None
    geometry: dict | None = None
    if body.geometry is not None:
        points, point_kind = _points_from_geometry(body.geometry)
        if points:
            geometry = body.geometry
    if not points and item is not None:
        points, point_kind, geometry = _item_points(db, item)

    stats = _building_stats(db)
    layer = building_service.active_position_layer(db)
    ranked = [
        _score(building, points, stats.get(building.id, {}), category, layer, geometry)
        for building in db.query(Building)
        .filter(*building_service.recommendable_building_clauses())
        .order_by(Building.code)
        .all()
    ]
    ranked.sort(key=lambda row: (-row["score"], row["building_code"]))
    top = ranked[:MAX_LOCATIONS]

    reasons = _model_reasons(category, top)
    locations = [
        {
            "building_code": row["building_code"],
            "building_name": row["building_name"],
            "reason": _compose_reason(row, point_kind, (reasons or {}).get(row["building_code"])),
            "order": index,
        }
        for index, row in enumerate(top, start=1)
    ]
    return {
        "locations": locations,
        "source": Source.model if reasons is not None else Source.rule,
        "degraded": reasons is None,
    }
