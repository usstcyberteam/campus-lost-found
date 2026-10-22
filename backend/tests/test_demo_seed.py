from app.database import SessionLocal
from app.models import Item
from scripts.seed_demo import seed_demo


def test_seed_demo_is_idempotent(client):
    db = SessionLocal()
    try:
        assert seed_demo(db) == 60
        assert seed_demo(db) == 0
        demo_items = db.query(Item).filter(Item.is_demo.is_(True))
        assert demo_items.count() == 60
        assert demo_items.filter(Item.is_simulated.is_(True)).count() == 60
        assert db.query(Item.building_id).filter(Item.is_demo.is_(True)).distinct().count() == 8
    finally:
        db.close()
