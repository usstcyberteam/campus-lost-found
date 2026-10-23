import json
import uuid
from collections import Counter, defaultdict
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.config import get_settings
from app.errors import ApiError
from app.models import (
    Attachment,
    Building,
    Candidate,
    Claim,
    Comment,
    Item,
    ItemFavorite,
    ItemFeature,
    ItemHelper,
    ItemLike,
    ItemStatus,
    Layer,
    Route,
    SimulatedPoint,
    Ticket,
)
from app.models.enums import LayerKind, SimulatedPointKind

ACTIVE_ITEM_STATUSES = (ItemStatus.searching, ItemStatus.pending, ItemStatus.reviewing)
ASSET_PATH = Path(__file__).resolve().parents[1] / "data" / "campus_buildings.json"
FLOOR_ASSET_PATH = Path(__file__).resolve().parents[1] / "data" / "campus_floors.json"
ROADS_ASSET_PATH = Path(__file__).resolve().parents[1] / "data" / "campus_roads.json"
FLOOR_IMAGE_DIR = Path("floors")
DEFAULT_FLOOR_LAYERS = ((21, 1), (21, 2), (17, 1))
PLACEHOLDER_FLOOR_SIZE = (1000, 1000)
FLOOR_ASSET_MISSING = "未找到楼层素材，已创建占位楼层"
FLOOR_ASSET_EMPTY = "楼层素材为空，已创建占位楼层"
FloorAssetState = Literal["loaded", "missing", "empty"]

FLAT_LAYER_NAME = "校园室外地图"
ISO_LAYER_NAME = "校园 2.5D 选楼图"
HELP_POINT_NAME = "校园求助点"
GATE_MONITOR_NAME = "校门模拟监控点"
GUARD_BUILDING_CODE = "19"
SERVICE_BUILDING_CODE = "16"

MAX_CODE_LENGTH = 32
MAX_FLOORS = 200
MAX_ROOM_NAME_LENGTH = 32
UNNAMED_BUILDING = "未命名建筑"
OTHER_CATEGORY = "其他"

CATEGORY_MAP = {
    "teaching": "教学楼",
    "library": "图书馆",
    "dorm": "宿舍",
    "historic": "历史建筑",
    "admin": "行政",
    "sports": "体育馆",
    "track": "运动场",
    "court": "球场",
    "park": "园林",
    "bridge": "天桥",
    "gate": "校门",
}

EXCLUDED_BUILDING_CATEGORIES = frozenset({"天桥", "校门"})

LAYER_NOT_FOUND = "图层不存在"
ISO_LAYER_MESSAGE = "2.5D 图仅用于选楼，请在室外地图上标注"
FLOOR_ROUTE_MESSAGE = "楼层图仅支持标点，绘制请返回室外地图"
FLOOR_HELP_POINT_MESSAGE = "求助点仅在室外平面图创建"
FLOOR_ANCHOR_MESSAGE = "在楼层图标点需要先选择建筑与楼层"
FLOOR_BUILDING_MESSAGE = "建筑与当前楼层图不一致"
FLOOR_LEVEL_MESSAGE = "楼层与当前楼层图不一致"
NO_FLAT_LAYER_MESSAGE = "尚未创建室外平面图图层"

PositionAction = Literal["route", "help_point"]


@dataclass(frozen=True)
class MapAsset:
    version: int
    flat_image: str
    flat_width: int
    flat_height: int
    meters_per_pixel: float
    iso_image: str
    iso_width: int
    iso_height: int
    flat_to_iso: tuple[tuple[float, float, float], tuple[float, float, float]]
    buildings: tuple[Mapping[str, Any], ...]


@dataclass(frozen=True)
class BuildingData:
    code: str
    name: str
    category: str
    floors: int
    click_region: list[dict[str, float]] | None
    label_position: dict[str, float] | None
    iso_hit_area: list[dict[str, float]] | None
    iso_label_position: dict[str, float] | None
    draw_order: int
    entrance_node: int | None


@dataclass
class BuildingImportResult:
    created: int
    updated: int
    deleted: int
    skipped: int
    warnings: list[str]


@dataclass(frozen=True)
class FloorSpec:
    building_code: str
    floor: int
    name: str | None
    image: str | None
    width: int
    height: int
    rooms: tuple[dict[str, Any], ...]


@dataclass
class FloorImportResult:
    created: int
    updated: int
    skipped: int
    warnings: list[str]


@dataclass
class LayerSyncResult:
    created: int
    updated: int
    removed: int
    warnings: list[str]


@dataclass
class PointSyncResult:
    created: int
    updated: int
    removed: int
    warnings: list[str]


@dataclass(frozen=True)
class MapInputs:
    asset: MapAsset
    floor_specs: list[FloorSpec]
    floor_state: FloorAssetState
    warnings: list[str]


@dataclass
class MapImportResult:
    buildings: BuildingImportResult
    floors: FloorImportResult
    layers: LayerSyncResult
    points: PointSyncResult
    buildings_total: int
    floors_total: int
    layers_total: int
    points_total: int
    floors_state: FloorAssetState
    warnings: list[str]


@dataclass(frozen=True)
class _PointSpec:
    label: str
    kind: SimulatedPointKind
    x: float
    y: float
    is_public: bool
    description: str


def _require_mapping(raw: Mapping[str, Any], key: str) -> Mapping[str, Any]:
    value = raw.get(key)
    if not isinstance(value, Mapping):
        raise ValueError(f"素材缺少 {key} 对象")
    return value


def _require_int(section: Mapping[str, Any], key: str, label: str) -> int:
    value = section.get(key)
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValueError(f"素材 {label}.{key} 必须是整数")
    return value


def _require_number(section: Mapping[str, Any], key: str, label: str) -> float:
    value = section.get(key)
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"素材 {label}.{key} 必须是数字")
    return float(value)


def _load_matrix(raw: Mapping[str, Any]) -> tuple[tuple[float, float, float], tuple[float, float, float]]:
    matrix = raw.get("flat_to_iso")
    if not isinstance(matrix, list) or len(matrix) != 2:
        raise ValueError("素材 flat_to_iso 必须是 2×3 数组")
    rows: list[tuple[float, float, float]] = []
    for row in matrix:
        if not isinstance(row, list) or len(row) != 3:
            raise ValueError("素材 flat_to_iso 必须是 2×3 数组")
        cells: list[float] = []
        for cell in row:
            if isinstance(cell, bool) or not isinstance(cell, (int, float)):
                raise ValueError("素材 flat_to_iso 必须是数字")
            cells.append(float(cell))
        rows.append((cells[0], cells[1], cells[2]))
    return (rows[0], rows[1])


def load_asset(path: Path | None = None) -> MapAsset:
    asset_path = path or ASSET_PATH
    try:
        raw = json.loads(asset_path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ValueError(f"建筑素材不存在：{asset_path}") from exc
    except json.JSONDecodeError as exc:
        raise ValueError(f"建筑素材不是合法 JSON：{asset_path}") from exc
    if not isinstance(raw, Mapping):
        raise ValueError("建筑素材顶层必须是对象")
    buildings = raw.get("buildings")
    if not isinstance(buildings, list):
        raise ValueError("建筑素材 buildings 必须是数组")
    flat = _require_mapping(raw, "flat")
    iso = _require_mapping(raw, "iso")
    version = raw.get("version", 0)
    if isinstance(version, bool) or not isinstance(version, int):
        raise ValueError("建筑素材 version 必须是整数")
    return MapAsset(
        version=version,
        flat_image=str(flat.get("image") or ""),
        flat_width=_require_int(flat, "width", "flat"),
        flat_height=_require_int(flat, "height", "flat"),
        meters_per_pixel=_require_number(flat, "meters_per_pixel", "flat"),
        iso_image=str(iso.get("image") or ""),
        iso_width=_require_int(iso, "width", "iso"),
        iso_height=_require_int(iso, "height", "iso"),
        flat_to_iso=_load_matrix(raw),
        buildings=tuple(buildings),
    )


def load_map_inputs(buildings_path: Path | None = None, floors_path: Path | None = None) -> MapInputs:
    asset = load_asset(buildings_path)
    if asset.version < 1:
        raise ValueError(f"未知的素材版本：{asset.version}")
    floor_path = floors_path or FLOOR_ASSET_PATH
    warnings: list[str] = []
    specs = load_floor_specs(floor_path, warnings)
    # 楼层状态由 floor_state 单独表达，避免脚本重复提示
    warnings = [warning for warning in warnings if warning not in (FLOOR_ASSET_MISSING, FLOOR_ASSET_EMPTY)]
    if not floor_path.exists():
        state: FloorAssetState = "missing"
    elif not specs:
        state = "empty"
    else:
        state = "loaded"
    return MapInputs(asset=asset, floor_specs=specs, floor_state=state, warnings=warnings)


def _as_point(value: Any) -> dict[str, float]:
    if not isinstance(value, (list, tuple)) or len(value) != 2:
        raise ValueError("坐标必须是 [x, y]")
    x, y = value
    for number in (x, y):
        if isinstance(number, bool) or not isinstance(number, (int, float)):
            raise ValueError("坐标必须是数字")
    if not (0 <= x <= 1 and 0 <= y <= 1):
        raise ValueError("坐标必须在 0~1 之间")
    return {"x": round(float(x), 8), "y": round(float(y), 8)}


def _as_polygon(value: Any) -> list[dict[str, float]] | None:
    if not isinstance(value, (list, tuple)):
        return None
    return [_as_point(point) for point in value]


def _polygon_center(points: list[dict[str, float]] | None) -> dict[str, float] | None:
    if not points:
        return None
    return {
        "x": round(sum(point["x"] for point in points) / len(points), 8),
        "y": round(sum(point["y"] for point in points) / len(points), 8),
    }


def _to_iso_point(
    point: dict[str, float], matrix: tuple[tuple[float, float, float], tuple[float, float, float]]
) -> dict[str, float]:
    (a, b, c), (d, e, f) = matrix
    return {
        "x": round(a * point["x"] + b * point["y"] + c, 8),
        "y": round(d * point["x"] + e * point["y"] + f, 8),
    }


def _code_counts(entries: tuple[Mapping[str, Any], ...]) -> Counter[str]:
    counts: Counter[str] = Counter()
    for entry in entries:
        if not isinstance(entry, Mapping):
            continue
        code = str(entry.get("code") or "").strip()
        if code:
            counts[code] += 1
    return counts


def _resolve_code(
    raw_code: str,
    raw_id: str,
    counts: Counter[str],
    seen: set[str],
    reported_duplicates: set[str],
    warnings: list[str],
) -> str:
    if not raw_code:
        if not raw_id:
            raise ValueError("缺少建筑编号")
        code = raw_id
        warnings.append(f"建筑 {code} 编号为空，已使用素材编号")
    else:
        code = raw_code
        if counts[raw_code] > 1:
            if not raw_id:
                raise ValueError("编号重复且缺少素材编号")
            code = f"{raw_code}-{raw_id}"
            if raw_code not in reported_duplicates:
                reported_duplicates.add(raw_code)
                warnings.append(f"建筑 {code} 编号 {raw_code} 重复，已追加素材编号")
    if len(code) > MAX_CODE_LENGTH:
        code = code[:MAX_CODE_LENGTH]
        warnings.append(f"建筑 {code} 编号超过 {MAX_CODE_LENGTH} 字符，已截断")
    if code in seen:
        fallback = f"{code}-{raw_id}"[:MAX_CODE_LENGTH] if raw_id else ""
        if not fallback or fallback in seen:
            raise ValueError("编号冲突，无法生成唯一编号")
        warnings.append(f"建筑 {fallback} 编号冲突，已追加素材编号")
        code = fallback
    return code


def _resolve_category(raw_category: str, name: str, code: str, warnings: list[str]) -> str:
    if raw_category in CATEGORY_MAP:
        return CATEGORY_MAP[raw_category]
    if raw_category == "life":
        return "食堂" if ("食堂" in name or "餐厅" in name) else "生活服务"
    warnings.append(f"建筑 {code} 未知类别 {raw_category or '空'}，已归为{OTHER_CATEGORY}")
    return OTHER_CATEGORY


def _clamp_floors(value: Any, code: str, warnings: list[str]) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        warnings.append(f"建筑 {code} 层数不是整数，已记为 0")
        return 0
    if value < 0:
        warnings.append(f"建筑 {code} 层数 {value} 小于 0，已截断为 0")
        return 0
    if value > MAX_FLOORS:
        warnings.append(f"建筑 {code} 层数 {value} 超过 {MAX_FLOORS}，已截断")
        return MAX_FLOORS
    return value


def _resolve_draw_order(value: Any, code: str, warnings: list[str]) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        warnings.append(f"建筑 {code} 绘制层级不是整数，已记为 0")
        return 0
    return value


def _resolve_entrance_node(value: Any, code: str, warnings: list[str]) -> int | None:
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, int):
        warnings.append(f"建筑 {code} 入口节点不是整数，已忽略")
        return None
    return value


def _convert_one(
    entry: Mapping[str, Any],
    raw_id: str,
    raw_code: str,
    counts: Counter[str],
    seen: set[str],
    reported_duplicates: set[str],
    matrix: tuple[tuple[float, float, float], tuple[float, float, float]],
    warnings: list[str],
) -> BuildingData:
    code = _resolve_code(raw_code, raw_id, counts, seen, reported_duplicates, warnings)
    raw_name = str(entry.get("name") or "").strip()
    name = UNNAMED_BUILDING if entry.get("named") is False or not raw_name else raw_name
    category = _resolve_category(str(entry.get("category") or "").strip(), name, code, warnings)
    floors = _clamp_floors(entry.get("floors", 0), code, warnings)
    draw_order = _resolve_draw_order(entry.get("draw_order", 0), code, warnings)
    entrance_node = _resolve_entrance_node(entry.get("entrance_node"), code, warnings)

    flat_value = entry.get("flat")
    flat: Mapping[str, Any] = flat_value if isinstance(flat_value, Mapping) else {}
    iso_value = entry.get("iso")
    iso: Mapping[str, Any] = iso_value if isinstance(iso_value, Mapping) else {}

    try:
        click_region = _as_polygon(flat.get("footprint"))
    except ValueError as exc:
        raise ValueError(f"平面轮廓{exc}") from exc
    if click_region is not None and len(click_region) < 3:
        warnings.append(f"建筑 {code} 平面轮廓点数不足 3，无法点击")
        click_region = None

    try:
        flat_label = flat.get("label_anchor")
        label_position = _as_point(flat_label) if flat_label is not None else None
    except ValueError as exc:
        raise ValueError(f"平面标签{exc}") from exc
    if label_position is None:
        label_position = _polygon_center(click_region)
        if label_position is None:
            warnings.append(f"建筑 {code} 缺少平面标签且无轮廓，无法定位")

    try:
        iso_hit_area = _as_polygon(iso.get("hit_area"))
    except ValueError as exc:
        raise ValueError(f"2.5D 命中区{exc}") from exc
    if iso_hit_area is not None and len(iso_hit_area) < 3:
        warnings.append(f"建筑 {code} 2.5D 命中区点数不足 3，室内不可点击")
        iso_hit_area = None

    try:
        iso_label = iso.get("label_anchor")
        iso_label_position = _as_point(iso_label) if iso_label is not None else None
    except ValueError as exc:
        raise ValueError(f"2.5D 标签{exc}") from exc
    if iso_label_position is None and label_position is not None:
        iso_label_position = _to_iso_point(label_position, matrix)
    if iso_label_position is None:
        warnings.append(f"建筑 {code} 缺少 2.5D 标签，无法显示角标")

    return BuildingData(
        code=code,
        name=name,
        category=category,
        floors=floors,
        click_region=click_region,
        label_position=label_position,
        iso_hit_area=iso_hit_area,
        iso_label_position=iso_label_position,
        draw_order=draw_order,
        entrance_node=entrance_node,
    )


def convert_buildings(asset: MapAsset) -> tuple[list[BuildingData], list[str]]:
    warnings: list[str] = []
    counts = _code_counts(asset.buildings)
    seen: set[str] = set()
    reported_duplicates: set[str] = set()
    converted: list[BuildingData] = []
    for index, entry in enumerate(asset.buildings):
        if not isinstance(entry, Mapping):
            warnings.append(f"建筑 第{index + 1}项 不是对象，已跳过")
            continue
        raw_id = str(entry.get("id") or "").strip()
        raw_code = str(entry.get("code") or "").strip()
        label = raw_code or raw_id or f"第{index + 1}项"
        try:
            data = _convert_one(entry, raw_id, raw_code, counts, seen, reported_duplicates, asset.flat_to_iso, warnings)
        except ValueError as exc:
            warnings.append(f"建筑 {label} {exc}，已跳过")
            continue
        seen.add(data.code)
        converted.append(data)
    return converted, warnings


def _has_user_reference(db: Session, items: list[Item], layers: list[Layer]) -> bool:
    if any(not item.is_demo for item in items):
        return True
    layer_ids = [layer.id for layer in layers]
    if not layer_ids:
        return False
    return db.query(Item.id).filter(Item.layer_id.in_(layer_ids), Item.is_demo.is_(False)).first() is not None


def _has_user_interaction(db: Session, item_ids: list[uuid.UUID]) -> bool:
    if not item_ids:
        return False
    checks = (
        (Claim, or_(Claim.found_item_id.in_(item_ids), Claim.lost_item_id.in_(item_ids))),
        (Comment, Comment.item_id.in_(item_ids)),
        (ItemLike, ItemLike.item_id.in_(item_ids)),
        (ItemFavorite, ItemFavorite.item_id.in_(item_ids)),
        (ItemHelper, ItemHelper.item_id.in_(item_ids)),
        (Ticket, Ticket.item_id.in_(item_ids)),
    )
    return any(db.query(model.id).filter(condition).first() is not None for model, condition in checks)


def _delete_demo_items(db: Session, item_ids: list[uuid.UUID]) -> None:
    if not item_ids:
        return
    db.query(Candidate).filter(or_(Candidate.lost_item_id.in_(item_ids), Candidate.found_item_id.in_(item_ids))).delete(
        synchronize_session=False
    )
    db.query(Route).filter(Route.item_id.in_(item_ids)).delete(synchronize_session=False)
    db.query(ItemFeature).filter(ItemFeature.item_id.in_(item_ids)).delete(synchronize_session=False)
    db.query(Attachment).filter(Attachment.item_id.in_(item_ids)).delete(synchronize_session=False)
    db.query(Item).filter(Item.id.in_(item_ids), Item.is_demo.is_(True)).delete(synchronize_session=False)


def _remove_obsolete_buildings(db: Session, keep_codes: set[str], warnings: list[str]) -> int:
    query = db.query(Building)
    if keep_codes:
        query = query.filter(Building.code.notin_(keep_codes))
    deleted = 0
    for building in query.all():
        items = db.query(Item).filter(Item.building_id == building.id).all()
        layers = db.query(Layer).filter(Layer.building_id == building.id).all()
        if _has_user_reference(db, items, layers):
            user_items = sum(1 for item in items if not item.is_demo)
            warnings.append(f"建筑 {building.code} 有 {user_items} 条非演示引用，未删除")
            continue
        item_ids = [item.id for item in items if item.is_demo]
        if _has_user_interaction(db, item_ids):
            warnings.append(f"建筑 {building.code} 的演示帖存在用户互动，未删除")
            continue
        _delete_demo_items(db, item_ids)
        for layer in layers:
            db.delete(layer)
        db.delete(building)
        deleted += 1
    return deleted


def import_buildings(db: Session, asset: MapAsset, *, prune: bool = True) -> BuildingImportResult:
    converted, warnings = convert_buildings(asset)
    by_code = {data.code: data for data in converted}
    skipped = len(asset.buildings) - len(converted)
    existing = (
        {building.code: building for building in db.query(Building).filter(Building.code.in_(by_code)).all()}
        if by_code
        else {}
    )
    created = updated = 0
    for code, data in by_code.items():
        building = existing.get(code)
        if building is None:
            building = Building(code=code)
            db.add(building)
            created += 1
        else:
            updated += 1
        building.name = data.name
        building.category = data.category
        building.floors = data.floors
        building.click_region = data.click_region
        building.label_position = data.label_position
        building.iso_hit_area = data.iso_hit_area
        building.iso_label_position = data.iso_label_position
        building.draw_order = data.draw_order
        building.entrance_node = data.entrance_node
    deleted = _remove_obsolete_buildings(db, set(by_code), warnings) if prune else 0
    db.commit()
    return BuildingImportResult(
        created=created,
        updated=updated,
        deleted=deleted,
        skipped=skipped,
        warnings=warnings,
    )


def _floor_image_path(image: str | None, warnings: list[str], label: str) -> str | None:
    if not image:
        return None
    if ".." in image or "/" in image or "\\" in image:
        warnings.append(f"{label} 底图文件名不合法，已按无底图处理")
        return None
    if not (Path(get_settings().file_storage_dir) / FLOOR_IMAGE_DIR / image).is_file():
        warnings.append(f"{label} 底图文件缺失（{image}），已按无底图处理")
        return None
    return str(FLOOR_IMAGE_DIR / image)


def _clean_rooms(rooms: Any, label: str, warnings: list[str]) -> list[dict[str, Any]] | None:
    if not isinstance(rooms, (list, tuple)):
        return None
    cleaned: list[dict[str, Any]] = []
    for room in rooms:
        if not isinstance(room, Mapping):
            warnings.append(f"{label} 房间项不是对象，已丢弃")
            continue
        name = str(room.get("name") or "").strip()
        x, y = room.get("x"), room.get("y")
        valid = (
            name
            and len(name) <= MAX_ROOM_NAME_LENGTH
            and not isinstance(x, bool)
            and not isinstance(y, bool)
            and isinstance(x, (int, float))
            and isinstance(y, (int, float))
            and 0 <= x <= 1
            and 0 <= y <= 1
        )
        if not valid:
            warnings.append(f"{label} 房间 {name or '未命名'} 名称或坐标不合法，已丢弃")
            continue
        cleaned.append({"name": name, "x": round(float(x), 8), "y": round(float(y), 8)})
    return cleaned or None


def _parse_floor_spec(raw: Mapping[str, Any]) -> FloorSpec | None:
    building_code = str(raw.get("building_code") or "").strip()
    floor = raw.get("floor")
    if not building_code or isinstance(floor, bool) or not isinstance(floor, int):
        return None
    width = raw.get("width")
    height = raw.get("height")
    width = width if isinstance(width, int) and not isinstance(width, bool) and width > 0 else 0
    height = height if isinstance(height, int) and not isinstance(height, bool) and height > 0 else 0
    image = raw.get("image")
    image = str(image).strip() if image else None
    name = raw.get("name")
    name = str(name).strip() if name else None
    rooms = raw.get("rooms")
    rooms = tuple(rooms) if isinstance(rooms, list) else ()
    return FloorSpec(
        building_code=building_code,
        floor=floor,
        name=name,
        image=image,
        width=width,
        height=height,
        rooms=rooms,
    )


def load_floor_specs(path: Path | None = None, warnings: list[str] | None = None) -> list[FloorSpec]:
    floor_path = path or FLOOR_ASSET_PATH
    if not floor_path.exists():
        if warnings is not None:
            warnings.append(FLOOR_ASSET_MISSING)
        return []
    try:
        raw = json.loads(floor_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ValueError(f"楼层素材不是合法 JSON：{floor_path}") from exc
    if not isinstance(raw, Mapping):
        raise ValueError("楼层素材顶层必须是对象")
    floors = raw.get("floors")
    if not isinstance(floors, list):
        raise ValueError("楼层素材 floors 必须是数组")
    if not floors and warnings is not None:
        warnings.append(FLOOR_ASSET_EMPTY)
    specs: dict[tuple[str, int], FloorSpec] = {}
    for entry in floors:
        if not isinstance(entry, Mapping):
            continue
        spec = _parse_floor_spec(entry)
        if spec is None:
            if warnings is not None:
                warnings.append("楼层素材存在缺少建筑编号或楼层号的条目，已忽略")
            continue
        key = (spec.building_code, spec.floor)
        if key in specs and warnings is not None:
            warnings.append(f"楼层 {spec.building_code} {spec.floor}F 重复，已保留最后一条")
        specs[key] = spec
    return list(specs.values())


def _placeholder_specs(specs: list[FloorSpec]) -> list[FloorSpec]:
    provided = {(spec.building_code, spec.floor) for spec in specs}
    merged = list(specs)
    for code, floor in DEFAULT_FLOOR_LAYERS:
        key = (str(code), floor)
        if key not in provided:
            merged.append(
                FloorSpec(
                    building_code=str(code),
                    floor=floor,
                    name=None,
                    image=None,
                    width=PLACEHOLDER_FLOOR_SIZE[0],
                    height=PLACEHOLDER_FLOOR_SIZE[1],
                    rooms=(),
                )
            )
    return merged


def _unique_floor_name(db: Session, name: str, code: str, floor: int, layer_id: uuid.UUID | None) -> str:
    query = db.query(Layer).filter(Layer.name == name)
    if layer_id is not None:
        query = query.filter(Layer.id != layer_id)
    if query.first() is None:
        return name
    return f"{name}（{code} {floor}F）"


def import_floors(db: Session, asset: MapAsset, specs: list[FloorSpec]) -> FloorImportResult:
    warnings: list[str] = []

    created = updated = skipped = 0
    for spec in _placeholder_specs(specs):
        label = f"楼层 {spec.building_code} {spec.floor}F"
        building = db.query(Building).filter(Building.code == spec.building_code).first()
        if building is None:
            warnings.append(f"{label} 对应的建筑不存在，已跳过")
            skipped += 1
            continue
        name = spec.name or f"{building.name} {spec.floor}F"
        rooms = _clean_rooms(spec.rooms, label, warnings)
        image_path = _floor_image_path(spec.image, warnings, label)
        width = spec.width or PLACEHOLDER_FLOOR_SIZE[0]
        height = spec.height or PLACEHOLDER_FLOOR_SIZE[1]
        if spec.image and image_path is not None and (spec.width <= 0 or spec.height <= 0):
            warnings.append(f"{label} 底图存在但缺少尺寸，已使用占位尺寸")
        layer = (
            db.query(Layer)
            .filter(
                Layer.building_id == building.id,
                Layer.floor == spec.floor,
                Layer.kind == LayerKind.floor,
            )
            .first()
        )
        if layer is None:
            final_name = _unique_floor_name(db, name, spec.building_code, spec.floor, None)
            if final_name != name:
                warnings.append(f"{label} 名称 {name} 已被占用，已使用 {final_name}")
            layer = Layer(
                name=final_name,
                kind=LayerKind.floor,
                building_id=building.id,
                floor=spec.floor,
            )
            db.add(layer)
            created += 1
        else:
            final_name = _unique_floor_name(db, name, spec.building_code, spec.floor, layer.id)
            if final_name != name:
                warnings.append(f"{label} 名称 {name} 已被占用，保留原名称 {layer.name}")
            else:
                layer.name = final_name
            updated += 1
        layer.image_path = image_path
        layer.width = width
        layer.height = height
        layer.rooms = rooms
    db.commit()
    return FloorImportResult(created=created, updated=updated, skipped=skipped, warnings=warnings)


def _is_coordinate(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and 0 <= float(value) <= 1


def _layer_referenced(db: Session, layer_id: uuid.UUID) -> bool:
    if db.query(Item.id).filter(Item.layer_id == layer_id).first() is not None:
        return True
    if db.query(Route.id).filter(Route.layer_id == layer_id).first() is not None:
        return True
    return db.query(SimulatedPoint.id).filter(SimulatedPoint.layer_id == layer_id).first() is not None


def sync_layers(db: Session, asset: MapAsset) -> LayerSyncResult:
    warnings: list[str] = []
    created = updated = removed = 0
    calibrated = asset.meters_per_pixel > 0
    if not calibrated:
        warnings.append(f"室外平面图比例尺无效（{asset.meters_per_pixel}），未标记比例尺")
    iso_transform = [list(row) for row in asset.flat_to_iso]
    specs = (
        (
            LayerKind.flat,
            FLAT_LAYER_NAME,
            asset.flat_image,
            asset.flat_width,
            asset.flat_height,
            calibrated,
            round(1 / asset.meters_per_pixel, 4) if calibrated else None,
            None,
        ),
        (
            LayerKind.iso,
            ISO_LAYER_NAME,
            asset.iso_image,
            asset.iso_width,
            asset.iso_height,
            False,
            None,
            iso_transform,
        ),
    )
    for kind, name, image, width, height, scale_calibrated, pixels_per_meter, transform in specs:
        records = db.query(Layer).filter(Layer.kind == kind).order_by(Layer.created_at.asc(), Layer.id.asc()).all()
        target = records[0] if records else None
        for extra in records[1:]:
            if _layer_referenced(db, extra.id):
                warnings.append(f"图层 {extra.name}（{extra.id}）存在引用，未删除")
                continue
            db.delete(extra)
            db.flush()
            removed += 1
        if target is None:
            target = Layer(name=name, kind=kind, version="1")
            db.add(target)
            db.flush()
            created += 1
        else:
            updated += 1
        if db.query(Layer.id).filter(Layer.name == name, Layer.id != target.id).first() is not None:
            warnings.append(f"图层名称 {name} 已被其他记录占用，保留 {target.name}")
        else:
            target.name = name
        target.image_path = image or None
        target.width = width
        target.height = height
        target.scale_calibrated = scale_calibrated
        target.pixels_per_meter = pixels_per_meter
        target.transform = transform
    db.commit()
    return LayerSyncResult(created=created, updated=updated, removed=removed, warnings=warnings)


def _building_label_point(db: Session, code: str, label: str, warnings: list[str]) -> tuple[float, float] | None:
    building = db.query(Building).filter(Building.code == code).first()
    if building is None:
        warnings.append(f"{HELP_POINT_NAME}：未找到编号 {code} 的建筑，跳过{label}")
        return None
    point = building.label_position
    if not isinstance(point, Mapping):
        warnings.append(f"{HELP_POINT_NAME}：建筑 {building.name} 缺少标签位置，跳过{label}")
        return None
    x, y = point.get("x"), point.get("y")
    if not _is_coordinate(x) or not _is_coordinate(y):
        warnings.append(f"{HELP_POINT_NAME}：建筑 {building.name} 的标签位置无效，跳过{label}")
        return None
    return float(x), float(y)


def _help_point_specs(db: Session, warnings: list[str]) -> list[_PointSpec]:
    specs: list[_PointSpec] = []
    guard = _building_label_point(db, GUARD_BUILDING_CODE, "保卫处", warnings)
    if guard is not None:
        specs.append(
            _PointSpec(
                label="保卫处",
                kind=SimulatedPointKind.help_point,
                x=guard[0],
                y=guard[1],
                is_public=True,
                description="24 小时值班，可协助查询监控与登记失物",
            )
        )
        specs.append(
            _PointSpec(
                label="失物招领处",
                kind=SimulatedPointKind.help_point,
                x=min(1.0, guard[0] + 0.01),
                y=guard[1],
                is_public=True,
                description="设于保卫处，位置待核实",
            )
        )
    service = _building_label_point(db, SERVICE_BUILDING_CODE, "校园服务台", warnings)
    if service is not None:
        specs.append(
            _PointSpec(
                label="校园服务台",
                kind=SimulatedPointKind.help_point,
                x=service[0],
                y=service[1],
                is_public=True,
                description="提供咨询与失物登记指引",
            )
        )
    return specs


def _gate_node_specs(roads_path: Path | None, warnings: list[str]) -> list[_PointSpec]:
    path = roads_path or ROADS_ASSET_PATH
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        warnings.append(f"{GATE_MONITOR_NAME}：路网素材不存在，未创建监控点")
        return []
    except (OSError, json.JSONDecodeError):
        warnings.append(f"{GATE_MONITOR_NAME}：路网素材无法解析，未创建监控点")
        return []
    nodes = raw.get("nodes") if isinstance(raw, Mapping) else None
    if not isinstance(nodes, list):
        warnings.append(f"{GATE_MONITOR_NAME}：路网素材缺少节点列表，未创建监控点")
        return []
    specs: list[_PointSpec] = []
    seen: set[str] = set()
    for node in nodes:
        if not isinstance(node, Mapping):
            continue
        gate = node.get("gate")
        if not isinstance(gate, str) or not gate.strip():
            continue
        label = f"{gate.strip()}监控（模拟）"
        x, y = node.get("x"), node.get("y")
        if label in seen or not _is_coordinate(x) or not _is_coordinate(y):
            continue
        seen.add(label)
        specs.append(
            _PointSpec(
                label=label,
                kind=SimulatedPointKind.monitor_point,
                x=float(x),
                y=float(y),
                is_public=False,
                description="模拟监控点位，仅工作人员可见",
            )
        )
    if not specs:
        warnings.append(f"{GATE_MONITOR_NAME}：路网素材没有校门节点，未创建监控点")
    return specs


def sync_points(db: Session, asset: MapAsset, roads_path: Path | None = None) -> PointSyncResult:
    warnings: list[str] = []
    flat = active_position_layer(db)
    if flat is None:
        return PointSyncResult(
            created=0,
            updated=0,
            removed=0,
            warnings=[f"{HELP_POINT_NAME}：{NO_FLAT_LAYER_MESSAGE}，未同步点位"],
        )
    specs = _help_point_specs(db, warnings) + _gate_node_specs(roads_path, warnings)
    desired = {(spec.kind, spec.label) for spec in specs}
    records = (
        db.query(SimulatedPoint)
        .filter(
            SimulatedPoint.layer_id == flat.id,
            SimulatedPoint.kind.in_((SimulatedPointKind.help_point, SimulatedPointKind.monitor_point)),
        )
        .order_by(SimulatedPoint.id.asc())
        .all()
    )
    grouped: dict[tuple[SimulatedPointKind, str], list[SimulatedPoint]] = defaultdict(list)
    for record in records:
        grouped[(record.kind, record.label)].append(record)
    created = updated = removed = 0
    for spec in specs:
        rows = grouped.get((spec.kind, spec.label), [])
        if rows:
            point = rows[0]
            for extra in rows[1:]:
                db.delete(extra)
                removed += 1
            updated += 1
        else:
            point = SimulatedPoint(layer_id=flat.id, label=spec.label)
            db.add(point)
            created += 1
        point.layer_id = flat.id
        point.kind = spec.kind
        point.label = spec.label
        point.norm_x = spec.x
        point.norm_y = spec.y
        point.is_public = spec.is_public
        point.is_simulated = True
        point.description = spec.description
    for key, rows in grouped.items():
        if key in desired:
            continue
        for point in rows:
            if point.is_simulated and point.created_by is None:
                db.delete(point)
                removed += 1
            else:
                warnings.append(f"{point.label} 为手动创建的点位，已保留")
    return PointSyncResult(created=created, updated=updated, removed=removed, warnings=warnings)


def import_map_data(
    db: Session,
    inputs: MapInputs,
    *,
    roads_path: Path | None = None,
    prune: bool = True,
) -> MapImportResult:
    """按建筑、楼层、图层、点位的顺序导入素材，供初始化与导入脚本共用。"""
    buildings = import_buildings(db, inputs.asset, prune=prune)
    floors = import_floors(db, inputs.asset, inputs.floor_specs)
    layers = sync_layers(db, inputs.asset)
    points = sync_points(db, inputs.asset, roads_path)
    # sync_points 只组装待写入对象，统一在这里提交，确保统计读到最新数据
    db.commit()
    warnings = [
        *inputs.warnings,
        *buildings.warnings,
        *floors.warnings,
        *layers.warnings,
        *points.warnings,
    ]
    return MapImportResult(
        buildings=buildings,
        floors=floors,
        layers=layers,
        points=points,
        buildings_total=db.query(Building).count(),
        floors_total=db.query(Layer).filter(Layer.kind == LayerKind.floor).count(),
        layers_total=db.query(Layer).filter(Layer.kind.in_((LayerKind.flat, LayerKind.iso))).count(),
        points_total=db.query(SimulatedPoint)
        .filter(SimulatedPoint.kind.in_((SimulatedPointKind.help_point, SimulatedPointKind.monitor_point)))
        .count(),
        floors_state=inputs.floor_state,
        warnings=warnings,
    )


def _serialize(db: Session, building: Building) -> dict:
    active_item_count = (
        db.query(func.count(Item.id))
        .filter(Item.building_id == building.id, Item.status.in_(ACTIVE_ITEM_STATUSES))
        .scalar()
    )
    has_floor_map = db.query(Layer.id).filter(Layer.building_id == building.id).first() is not None
    return {
        "id": building.id,
        "code": building.code,
        "name": building.name,
        "category": building.category,
        "floors": building.floors,
        "click_region": building.click_region,
        "label_position": building.label_position,
        "iso_hit_area": building.iso_hit_area,
        "iso_label_position": building.iso_label_position,
        "draw_order": building.draw_order,
        "entrance_node": building.entrance_node,
        "active_item_count": int(active_item_count or 0),
        "has_floor_map": has_floor_map,
    }


def list_buildings(
    db: Session, category: str | None = None, limit: int = 20, offset: int = 0
) -> tuple[list[dict], int]:
    query = db.query(Building)
    if category:
        query = query.filter(Building.category == category)
    total = query.count()
    rows = query.order_by(Building.code).offset(offset).limit(limit).all()
    return [_serialize(db, row) for row in rows], total


def get_building(db: Session, building_id: uuid.UUID) -> dict:
    building = db.get(Building, building_id)
    if building is None:
        raise ApiError(404, "NOT_FOUND", "建筑不存在")
    return _serialize(db, building)


def _oldest_layer(db: Session, kind: LayerKind) -> Layer | None:
    return db.query(Layer).filter(Layer.kind == kind).order_by(Layer.created_at.asc(), Layer.id.asc()).first()


def active_position_layer(db: Session) -> Layer | None:
    return _oldest_layer(db, LayerKind.flat)


def active_position_layer_id(db: Session) -> uuid.UUID:
    layer = active_position_layer(db)
    if layer is None:
        raise ApiError(404, "NOT_FOUND", NO_FLAT_LAYER_MESSAGE)
    return layer.id


def recommendable_building_clauses() -> tuple:
    return (
        Building.category.notin_(EXCLUDED_BUILDING_CATEGORIES),
        Building.name != UNNAMED_BUILDING,
    )


def is_recommendable_building(building: Building) -> bool:
    return building.category not in EXCLUDED_BUILDING_CATEGORIES and building.name != UNNAMED_BUILDING


def _transform_matrix(value: Any) -> list[list[float]] | None:
    if not isinstance(value, list) or len(value) != 2:
        return None
    rows: list[list[float]] = []
    for row in value:
        if not isinstance(row, list) or len(row) != 3:
            return None
        cells: list[float] = []
        for cell in row:
            if isinstance(cell, bool) or not isinstance(cell, (int, float)):
                return None
            cells.append(float(cell))
        rows.append(cells)
    return rows


def get_map_meta(db: Session) -> dict:
    flat = _oldest_layer(db, LayerKind.flat)
    if flat is None:
        raise ApiError(404, "NOT_FOUND", "缺少室外平面图图层，请先初始化地图数据")
    iso = _oldest_layer(db, LayerKind.iso)
    if iso is None:
        raise ApiError(404, "NOT_FOUND", "缺少 2.5D 选楼图层，请先初始化地图数据")
    matrix = _transform_matrix(iso.transform)
    if matrix is None:
        raise ApiError(404, "NOT_FOUND", "尚未导入地图素材")
    return {
        "flat_layer_id": flat.id,
        "iso_layer_id": iso.id,
        "flat_to_iso": matrix,
    }


def get_layer_or_404(db: Session, layer_id: uuid.UUID) -> Layer:
    layer = db.get(Layer, layer_id)
    if layer is None:
        raise ApiError(404, "NOT_FOUND", LAYER_NOT_FOUND)
    return layer


def ensure_position_layer(db: Session, layer_id: uuid.UUID) -> Layer:
    layer = get_layer_or_404(db, layer_id)
    if layer.kind == LayerKind.iso:
        raise ApiError(400, "VALIDATION", ISO_LAYER_MESSAGE)
    return layer


def ensure_flat_layer(db: Session, layer_id: uuid.UUID, action: PositionAction) -> Layer:
    layer = ensure_position_layer(db, layer_id)
    if layer.kind == LayerKind.floor:
        message = FLOOR_ROUTE_MESSAGE if action == "route" else FLOOR_HELP_POINT_MESSAGE
        raise ApiError(400, "VALIDATION", message)
    return layer


def ensure_floor_anchor(layer: Layer, building_id: uuid.UUID | None, floor: int | None) -> None:
    if layer.kind != LayerKind.floor:
        return
    if building_id is None or floor is None:
        raise ApiError(400, "VALIDATION", FLOOR_ANCHOR_MESSAGE)
    if building_id != layer.building_id:
        raise ApiError(400, "VALIDATION", FLOOR_BUILDING_MESSAGE)
    if floor != layer.floor:
        raise ApiError(400, "VALIDATION", FLOOR_LEVEL_MESSAGE)
