from app.database import SessionLocal
from app.models import Building, Item, Layer
from app.models.enums import LayerKind
from scripts.seed_demo import seed_demo


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


def test_seed_demo_is_idempotent(seeded_map):
    asset, _ = seeded_map
    db = SessionLocal()
    try:
        first = seed_demo(db, asset=asset)
        assert first.created == 60
        assert first.lost == 30
        assert first.found == 30

        flat = db.query(Layer).filter(Layer.kind == LayerKind.flat).one()
        demo_items = db.query(Item).filter(Item.is_demo.is_(True)).all()
        assert len(demo_items) == 60
        assert sum(1 for item in demo_items if item.is_simulated) == 60
        assert sum(1 for item in demo_items if item.building_id is not None) == 60
        assert {item.direction.value for item in demo_items} == {"lost", "found"}

        for item in demo_items:
            assert item.layer_id == flat.id
            building = db.get(Building, item.building_id)
            assert building is not None
            assert _inside(float(item.norm_x), float(item.norm_y), building.click_region)

        second = seed_demo(db, asset=asset)
        assert second.created == 60
        assert db.query(Item).filter(Item.is_demo.is_(True)).count() == 60
    finally:
        db.close()
