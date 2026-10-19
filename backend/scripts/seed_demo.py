import secrets
import sys
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy.orm import Session  # noqa: E402

from app.core.security import hash_password  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.models import Building, Item, Role, User  # noqa: E402
from app.models.enums import Direction, ItemStatus  # noqa: E402
from app.services import building_service  # noqa: E402

DEMO_USERNAME = "demo_poster"
DEMO_COUNT = 60
DEMO_CATEGORIES = ("雨伞", "校园卡", "手机", "钥匙", "水杯", "耳机", "书包", "钱包", "眼镜", "充电宝")


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


def _status(direction: Direction, index: int) -> ItemStatus:
    if index % 3 == 0:
        return ItemStatus.searching if direction == Direction.lost else ItemStatus.pending
    return ItemStatus.found if direction == Direction.lost else ItemStatus.returned


def _title(index: int, building: Building, category: str, direction: Direction) -> str:
    label = "寻物" if direction == Direction.lost else "拾获"
    return f"演示：{building.name}{category}{label}记录{index + 1:02d}"


def _coords(building: Building, index: int) -> tuple[float, float]:
    label = building.label_position or {}
    x = float(label.get("x", 0.5))
    y = float(label.get("y", 0.5))
    offset = ((index % 5) - 2) * 0.008
    return min(1.0, max(0.0, x + offset)), min(1.0, max(0.0, y - offset))


def seed_demo(db: Session) -> int:
    building_service.import_buildings(db, building_service.load_config())
    owner = _ensure_owner(db)
    buildings = db.query(Building).order_by(Building.code).all()
    if not buildings:
        raise RuntimeError("未找到建筑数据")

    created = 0
    for index in range(DEMO_COUNT):
        building = buildings[index % len(buildings)]
        category = DEMO_CATEGORIES[index % len(DEMO_CATEGORIES)]
        direction = Direction.lost if index % 2 == 0 else Direction.found
        title = _title(index, building, category, direction)
        exists = db.query(Item.id).filter(Item.is_demo.is_(True), Item.title == title).first()
        if exists is not None:
            continue
        floor = index % building.floors + 1
        x, y = _coords(building, index)
        db.add(
            Item(
                direction=direction,
                category=category,
                title=title,
                description="演示数据，仅用于 AI 地点推荐与热力图展示。",
                location_area=f"{building.name}{floor}F",
                time_occurred=datetime.now() - timedelta(days=index % 30 + 1),
                status=_status(direction, index),
                owner_user_id=owner.id,
                building_id=building.id,
                floor=floor,
                norm_x=x,
                norm_y=y,
                is_simulated=True,
                is_demo=True,
            )
        )
        created += 1
    db.commit()
    return created


def main() -> None:
    db = SessionLocal()
    try:
        created = seed_demo(db)
    finally:
        db.close()
    print(f"demo items created: {created}")


if __name__ == "__main__":
    main()
