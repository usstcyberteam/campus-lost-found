import uuid

from app.database import SessionLocal
from app.models import Building, Layer
from app.services import building_service
from tests.test_acceptance import auth, register


def import_config() -> tuple[int, int]:
    db = SessionLocal()
    try:
        return building_service.import_buildings(db, building_service.load_config())
    finally:
        db.close()


def get_building_id(code: str) -> str:
    db = SessionLocal()
    try:
        building = db.query(Building).filter(Building.code == code).first()
        assert building is not None
        return str(building.id)
    finally:
        db.close()


def test_buildings_require_login(client):
    assert client.get("/api/v1/buildings").status_code == 401
    assert client.get(f"/api/v1/buildings/{uuid.uuid4()}").status_code == 401


def test_buildings_list_pagination_and_filter(client):
    token = register(client, "building_viewer")
    import_config()

    page = client.get("/api/v1/buildings?limit=3&offset=0", headers=auth(token))
    assert page.status_code == 200
    body = page.json()
    assert body["total"] == 8
    assert body["limit"] == 3
    assert len(body["items"]) == 3
    assert body["items"][0]["code"] == "B01"
    assert body["items"][0]["has_floor_map"] is False
    assert body["items"][0]["active_item_count"] == 0

    second = client.get("/api/v1/buildings?limit=3&offset=3", headers=auth(token)).json()
    assert [item["code"] for item in second["items"]] == ["B04", "B05", "B06"]

    canteens = client.get("/api/v1/buildings?category=食堂", headers=auth(token)).json()
    assert canteens["total"] == 1
    assert canteens["items"][0]["name"] == "第一食堂"


def test_building_detail_and_not_found(client):
    token = register(client, "building_detail")
    import_config()
    building_id = get_building_id("B02")

    detail = client.get(f"/api/v1/buildings/{building_id}", headers=auth(token))
    assert detail.status_code == 200
    body = detail.json()
    assert body["name"] == "图书馆"
    assert body["floors"] == 5
    assert len(body["click_region"]) == 4
    assert body["label_position"] == {"x": 0.6025, "y": 0.661}

    missing = client.get(f"/api/v1/buildings/{uuid.uuid4()}", headers=auth(token))
    assert missing.status_code == 404
    assert missing.json()["code"] == "NOT_FOUND"


def test_import_buildings_is_idempotent(client):
    assert import_config() == (8, 0)
    assert import_config() == (0, 8)

    db = SessionLocal()
    try:
        assert db.query(Building).count() == 8
        codes = {code for (code,) in db.query(Building.code).all()}
        assert "B05" in codes
    finally:
        db.close()


def test_building_counts_active_items_and_floor_map(client):
    token = register(client, "building_stats")
    import_config()
    building_id = get_building_id("B05")

    db = SessionLocal()
    try:
        db.add(
            Layer(
                name="综合楼 1F",
                width=1280,
                height=900,
                building_id=uuid.UUID(building_id),
                floor=1,
            )
        )
        db.commit()
    finally:
        db.close()

    created = client.post(
        "/api/v1/items",
        json={"direction": "lost", "category": "雨伞", "title": "丢伞", "building_id": building_id, "floor": 1},
        headers=auth(token),
    )
    assert created.status_code == 200
    assert created.json()["building_name"] == "综合楼"

    detail = client.get(f"/api/v1/buildings/{building_id}", headers=auth(token)).json()
    assert detail["active_item_count"] == 1
    assert detail["has_floor_map"] is True


def test_import_rejects_invalid_config(client):
    db = SessionLocal()
    try:
        try:
            building_service.import_buildings(db, [{"code": "X1", "name": "无类别", "floors": 1}])
        except ValueError as exc:
            assert "category" in str(exc)
        else:
            raise AssertionError("非法配置应抛出 ValueError")
        assert db.query(Building).count() == 0
    finally:
        db.close()
