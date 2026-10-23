import random
import secrets
import sys
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import or_  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.core.security import hash_password  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.models import (  # noqa: E402
    Attachment,
    Building,
    Candidate,
    Claim,
    ClaimEvidence,
    Comment,
    Item,
    ItemFavorite,
    ItemFeature,
    ItemHelper,
    ItemLike,
    Role,
    Route,
    Ticket,
    User,
)
from app.models.enums import Direction, ItemStatus  # noqa: E402
from app.services import building_service  # noqa: E402

DEMO_USERNAME = "demo_poster"
DEMO_COUNT = 60
DEMO_SEED = 20261020
DEMO_BASE_TIME = datetime(2026, 10, 20, 8, 0, 0)
DEMO_DESCRIPTION = "演示数据，仅用于 AI 地点推荐与热力图展示。"
MAX_SAMPLE_ATTEMPTS = 200
CATEGORY_WEIGHTS = {
    "食堂": 5,
    "图书馆": 5,
    "教学楼": 5,
    "宿舍": 2,
    "体育馆": 2,
    "运动场": 2,
    "球场": 2,
    "生活服务": 1,
    "其他": 1,
    "历史建筑": 1,
    "行政": 1,
    "园林": 1,
}
CATEGORY_ITEMS = {
    "食堂": ("校园卡", "雨伞", "水杯", "钱包", "餐具"),
    "图书馆": ("书", "笔记本电脑", "校园卡", "耳机", "充电宝"),
    "教学楼": ("手机", "笔记本电脑", "耳机", "眼镜", "充电宝", "雨伞"),
    "宿舍": ("钥匙", "校园卡", "衣物", "钱包", "耳机", "雨伞"),
    "体育馆": ("水杯", "耳机", "钥匙", "衣物", "校园卡"),
    "运动场": ("水杯", "耳机", "钥匙", "衣物", "校园卡"),
    "球场": ("水杯", "耳机", "钥匙", "衣物", "校园卡"),
    "生活服务": ("校园卡", "钱包", "雨伞", "钥匙"),
}
DEFAULT_ITEMS = ("雨伞", "校园卡", "手机", "钥匙", "水杯", "耳机", "书包", "钱包", "眼镜", "充电宝")


@dataclass
class DemoResult:
    created: int
    lost: int
    found: int
    buildings: int
    removed: int
    warnings: list[str] = field(default_factory=list)


def _ensure_owner(db: Session) -> User:
    owner = db.query(User).filter(User.username == DEMO_USERNAME).first()
    if owner is None:
        owner = User(
            username=DEMO_USERNAME,
            password_hash=hash_password(secrets.token_urlsafe(24)),
            role=Role.student,
            display_name="演示数据",
        )
        db.add(owner)
        db.flush()
    return owner


def _clear_demo(db: Session) -> int:
    demo_ids = [row[0] for row in db.query(Item.id).filter(Item.is_demo.is_(True)).all()]
    if not demo_ids:
        return 0
    claim_ids = [
        row[0]
        for row in db.query(Claim.id)
        .filter(or_(Claim.found_item_id.in_(demo_ids), Claim.lost_item_id.in_(demo_ids)))
        .all()
    ]
    if claim_ids:
        db.query(ClaimEvidence).filter(ClaimEvidence.claim_id.in_(claim_ids)).delete(synchronize_session=False)
        db.query(Claim).filter(Claim.id.in_(claim_ids)).delete(synchronize_session=False)
    db.query(Candidate).filter(or_(Candidate.lost_item_id.in_(demo_ids), Candidate.found_item_id.in_(demo_ids))).delete(
        synchronize_session=False
    )
    db.query(Route).filter(Route.item_id.in_(demo_ids)).delete(synchronize_session=False)
    db.query(ItemFeature).filter(ItemFeature.item_id.in_(demo_ids)).delete(synchronize_session=False)
    db.query(Attachment).filter(Attachment.item_id.in_(demo_ids)).delete(synchronize_session=False)
    db.query(Comment).filter(Comment.item_id.in_(demo_ids), Comment.parent_id.isnot(None)).delete(
        synchronize_session=False
    )
    db.query(Comment).filter(Comment.item_id.in_(demo_ids)).delete(synchronize_session=False)
    db.query(ItemLike).filter(ItemLike.item_id.in_(demo_ids)).delete(synchronize_session=False)
    db.query(ItemFavorite).filter(ItemFavorite.item_id.in_(demo_ids)).delete(synchronize_session=False)
    db.query(ItemHelper).filter(ItemHelper.item_id.in_(demo_ids)).delete(synchronize_session=False)
    db.query(Ticket).filter(Ticket.item_id.in_(demo_ids)).delete(synchronize_session=False)
    db.query(Item).filter(Item.id.in_(demo_ids)).delete(synchronize_session=False)
    return len(demo_ids)


def _candidates(db: Session) -> list[Building]:
    rows = db.query(Building).order_by(Building.code).all()
    return [
        building
        for building in rows
        if building_service.is_recommendable_building(building)
        and building.floors >= 1
        and isinstance(building.click_region, list)
        and len(building.click_region) >= 3
    ]


def _items_for(category: str) -> tuple[str, ...]:
    return CATEGORY_ITEMS.get(category, DEFAULT_ITEMS)


def _inside(x: float, y: float, polygon: list[dict[str, float]]) -> bool:
    inside = False
    count = len(polygon)
    for index in range(count):
        x1, y1 = float(polygon[index]["x"]), float(polygon[index]["y"])
        x2, y2 = float(polygon[(index + 1) % count]["x"]), float(polygon[(index + 1) % count]["y"])
        if (y1 > y) != (y2 > y):
            cross = (x2 - x1) * (y - y1) / (y2 - y1) + x1
            if x < cross:
                inside = not inside
    return inside


def _sample_point(rng: random.Random, building: Building, warnings: list[str]) -> tuple[float, float]:
    polygon = building.click_region or []
    xs = [float(point["x"]) for point in polygon]
    ys = [float(point["y"]) for point in polygon]
    for _ in range(MAX_SAMPLE_ATTEMPTS):
        x = rng.uniform(min(xs), max(xs))
        y = rng.uniform(min(ys), max(ys))
        if _inside(x, y, polygon):
            return x, y
    warnings.append(f"建筑 {building.code} 轮廓取点失败，已使用首个顶点")
    return float(polygon[0]["x"]), float(polygon[0]["y"])


def _status(direction: Direction, index: int) -> ItemStatus:
    if index % 3 == 0:
        return ItemStatus.searching if direction == Direction.lost else ItemStatus.pending
    return ItemStatus.found if direction == Direction.lost else ItemStatus.returned


def seed_demo(
    db: Session,
    *,
    count: int = DEMO_COUNT,
    seed_value: int = DEMO_SEED,
    asset: building_service.MapAsset | None = None,
) -> DemoResult:
    asset = asset or building_service.load_asset()
    building_service.import_buildings(db, asset)
    owner = _ensure_owner(db)
    layer = building_service.active_position_layer(db)
    if layer is None:
        raise RuntimeError("未找到室外平面图图层，请先执行 seed.py")
    removed = _clear_demo(db)
    candidates = _candidates(db)
    if not candidates:
        db.rollback()
        raise RuntimeError("没有可用于演示数据的建筑")
    warnings: list[str] = []
    rng = random.Random(seed_value)
    weights = [CATEGORY_WEIGHTS.get(building.category, 1) for building in candidates]
    pairs = max(count // 2, 1)
    chosen = rng.choices(candidates, weights=weights, k=pairs)
    records: list[dict] = []
    for building in chosen:
        category = rng.choice(_items_for(building.category))
        x, y = _sample_point(rng, building, warnings)
        floor = rng.randint(1, max(1, building.floors))
        for direction in (Direction.lost, Direction.found):
            records.append(
                {
                    "direction": direction,
                    "category": category,
                    "building": building,
                    "floor": floor,
                    "x": x,
                    "y": y,
                }
            )
    rng.shuffle(records)
    if len(records) < count:
        records.extend(records[: count - len(records)])
    records = records[:count]
    for index, record in enumerate(records):
        direction = record["direction"]
        building = record["building"]
        label = "寻物" if direction == Direction.lost else "拾获"
        db.add(
            Item(
                direction=direction,
                category=record["category"],
                title=f"演示：{building.name}{record['category']}{label}记录{index + 1:02d}",
                description=DEMO_DESCRIPTION,
                location_area=f"{building.name}{record['floor']}F",
                time_occurred=DEMO_BASE_TIME - timedelta(days=index % 30 + 1),
                status=_status(direction, index),
                owner_user_id=owner.id,
                layer_id=layer.id,
                building_id=building.id,
                floor=record["floor"],
                norm_x=round(record["x"], 8),
                norm_y=round(record["y"], 8),
                is_simulated=True,
                is_demo=True,
            )
        )
    db.commit()
    lost = sum(1 for record in records if record["direction"] == Direction.lost)
    return DemoResult(
        created=len(records),
        lost=lost,
        found=len(records) - lost,
        buildings=len({record["building"].id for record in records}),
        removed=removed,
        warnings=warnings,
    )


def main() -> None:
    db = SessionLocal()
    try:
        result = seed_demo(db)
    finally:
        db.close()
    print(f"demo: created={result.created} lost={result.lost} found={result.found}")
    print(f"demo: buildings={result.buildings} removed={result.removed}")
    for warning in result.warnings:
        print(f"WARN {warning}")


if __name__ == "__main__":
    main()
