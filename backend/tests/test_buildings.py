import json
import uuid

import pytest

from app.database import SessionLocal
from app.models import Building, Layer
from app.models.enums import LayerKind
from app.services import building_service
from tests.test_acceptance import auth, register


def import_config(map_asset_path) -> building_service.BuildingImportResult:
    db = SessionLocal()
    try:
        return building_service.import_buildings(db, building_service.load_asset(map_asset_path))
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


def test_buildings_list_pagination_and_filter(client, map_asset_path):
    token = register(client, "building_viewer")
    import_config(map_asset_path)

    page = client.get("/api/v1/buildings?limit=3&offset=0", headers=auth(token))
    assert page.status_code == 200
    body = page.json()
    assert body["total"] == 5
    assert body["limit"] == 3
    assert len(body["items"]) == 3
    assert [item["code"] for item in body["items"]] == ["DUP-f003", "DUP-f004", "T1"]
    assert body["items"][0]["has_floor_map"] is False
    assert body["items"][0]["active_item_count"] == 0

    second = client.get("/api/v1/buildings?limit=3&offset=3", headers=auth(token)).json()
    assert [item["code"] for item in second["items"]] == ["T2", "b005"]

    canteens = client.get("/api/v1/buildings?category=食堂", headers=auth(token)).json()
    assert canteens["total"] == 1
    assert canteens["items"][0]["name"] == "测试食堂"


def test_building_detail_and_not_found(client, map_asset_path):
    token = register(client, "building_detail")
    import_config(map_asset_path)
    building_id = get_building_id("T1")

    detail = client.get(f"/api/v1/buildings/{building_id}", headers=auth(token))
    assert detail.status_code == 200
    body = detail.json()
    assert body["name"] == "测试教学楼"
    assert body["floors"] == 3
    assert len(body["click_region"]) == 4
    assert body["label_position"] == {"x": 0.175, "y": 0.16}

    missing = client.get(f"/api/v1/buildings/{uuid.uuid4()}", headers=auth(token))
    assert missing.status_code == 404
    assert missing.json()["code"] == "NOT_FOUND"


def test_import_buildings_is_idempotent(client, map_asset_path):
    first = import_config(map_asset_path)
    assert (first.created, first.updated) == (5, 0)
    second = import_config(map_asset_path)
    assert (second.created, second.updated) == (0, 5)

    db = SessionLocal()
    try:
        assert db.query(Building).count() == 5
        codes = {code for (code,) in db.query(Building.code).all()}
        assert "T2" in codes
    finally:
        db.close()


def test_building_counts_active_items_and_floor_map(client, map_asset_path):
    token = register(client, "building_stats")
    import_config(map_asset_path)
    building_id = get_building_id("T1")

    db = SessionLocal()
    try:
        db.add(
            Layer(
                name="测试教学楼 1F",
                width=1280,
                height=900,
                building_id=uuid.UUID(building_id),
                floor=1,
                kind=LayerKind.floor,
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
    assert created.json()["building_name"] == "测试教学楼"

    detail = client.get(f"/api/v1/buildings/{building_id}", headers=auth(token)).json()
    assert detail["active_item_count"] == 1
    assert detail["has_floor_map"] is True


def test_import_rejects_asset_without_flat_section(tmp_path):
    path = tmp_path / "map_asset.json"
    path.write_text(
        json.dumps({"version": 1, "iso": {"image": "iso.webp", "width": 10, "height": 10}, "buildings": []}),
        encoding="utf-8",
    )

    with pytest.raises(ValueError, match="flat"):
        building_service.load_asset(path)

    db = SessionLocal()
    try:
        assert db.query(Building).count() == 0
    finally:
        db.close()
