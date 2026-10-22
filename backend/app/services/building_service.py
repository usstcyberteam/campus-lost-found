import json
import uuid
from pathlib import Path
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.errors import ApiError
from app.models import Building, Item, ItemStatus, Layer

ACTIVE_ITEM_STATUSES = (ItemStatus.searching, ItemStatus.pending, ItemStatus.reviewing)
CONFIG_PATH = Path(__file__).resolve().parents[1] / "data" / "buildings.json"
_FIELD_LIMITS = {"code": 32, "name": 64, "category": 32}


def load_config() -> list[dict[str, Any]]:
    with CONFIG_PATH.open(encoding="utf-8") as handle:
        rows = json.load(handle)
    if not isinstance(rows, list):
        raise ValueError("建筑配置必须是数组")
    return rows


def _normalize_point(point: Any, field: str) -> dict[str, float]:
    if not isinstance(point, dict) or "x" not in point or "y" not in point:
        raise ValueError(f"{field} 必须包含 x/y")
    x, y = float(point["x"]), float(point["y"])
    if not (0 <= x <= 1 and 0 <= y <= 1):
        raise ValueError(f"{field} 坐标必须在 0~1 之间")
    return {"x": round(x, 8), "y": round(y, 8)}


def _prepare(row: Any) -> dict[str, Any]:
    if not isinstance(row, dict):
        raise ValueError("建筑配置项必须是对象")
    prepared: dict[str, Any] = {}
    for field, limit in _FIELD_LIMITS.items():
        value = str(row.get(field, "")).strip()
        if not value:
            raise ValueError(f"建筑缺少 {field}")
        if len(value) > limit:
            raise ValueError(f"建筑 {field} 超过 {limit} 字符")
        prepared[field] = value
    floors = row.get("floors", 1)
    if not isinstance(floors, int) or not 1 <= floors <= 100:
        raise ValueError("建筑 floors 必须是 1~100 的整数")
    prepared["floors"] = floors
    region = row.get("click_region")
    prepared["click_region"] = None if region is None else [_normalize_point(p, "click_region") for p in region]
    label = row.get("label_position")
    prepared["label_position"] = None if label is None else _normalize_point(label, "label_position")
    return prepared


def import_buildings(db: Session, rows: list[dict[str, Any]]) -> tuple[int, int]:
    prepared = {item["code"]: item for item in (_prepare(row) for row in rows)}
    existing = (
        {building.code: building for building in db.query(Building).filter(Building.code.in_(prepared)).all()}
        if prepared
        else {}
    )
    created = updated = 0
    for code, data in prepared.items():
        building = existing.get(code)
        if building is None:
            building = Building(code=code)
            db.add(building)
            created += 1
        else:
            updated += 1
        for field, value in data.items():
            setattr(building, field, value)
    db.commit()
    return created, updated


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
