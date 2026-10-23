import httpx

from app.database import SessionLocal
from app.models import Building, Layer, Role
from app.models.enums import LayerKind
from tests.test_acceptance import auth, create_user, login, register
from tests.test_ai_draft import configure_model, install_fake_client

CIRCLE = {"center": {"x": 0.375, "y": 0.16}, "radius": 0.05}
NEARLY_CIRCLE = {"center": {"x": 0.5, "y": 0.5}, "radius": 0.1}


def _layer_id(kind: LayerKind) -> str:
    db = SessionLocal()
    try:
        layer = db.query(Layer).filter(Layer.kind == kind).first()
        assert layer is not None
        return str(layer.id)
    finally:
        db.close()


def _building_id(code: str) -> str:
    db = SessionLocal()
    try:
        building = db.query(Building).filter(Building.code == code).first()
        assert building is not None
        return str(building.id)
    finally:
        db.close()


def _create_item(client, token: str, **extra) -> str:
    payload = {"direction": "lost", "category": "雨伞", "title": "丢伞", **extra}
    response = client.post("/api/v1/items", json=payload, headers=auth(token))
    assert response.status_code == 200
    return response.json()["id"]


def test_map_meta(seeded_map, client):
    token = register(client, "meta_viewer")

    response = client.get("/api/v1/map/meta", headers=auth(token))

    assert response.status_code == 200
    body = response.json()
    assert body["flat_layer_id"] == _layer_id(LayerKind.flat)
    assert body["iso_layer_id"] == _layer_id(LayerKind.iso)
    assert body["flat_to_iso"] == [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0]]


def test_map_meta_requires_login(seeded_map, client):
    response = client.get("/api/v1/map/meta")

    assert response.status_code == 401
    assert response.json()["code"] == "UNAUTH"


def test_map_meta_missing_iso_layer(seeded_map, client):
    db = SessionLocal()
    try:
        db.query(Layer).filter(Layer.kind == LayerKind.iso).delete()
        db.commit()
    finally:
        db.close()
    token = register(client, "meta_missing")

    response = client.get("/api/v1/map/meta", headers=auth(token))

    assert response.status_code == 404
    assert response.json()["code"] == "NOT_FOUND"
    assert "2.5D 选楼图层" in response.json()["message"]


def test_map_meta_reads_transform_from_database(seeded_map, client):
    db = SessionLocal()
    try:
        iso = db.query(Layer).filter(Layer.kind == LayerKind.iso).one()
        iso.transform = [[2.0, 0.0, 0.1], [0.0, 2.0, 0.2]]
        db.commit()
    finally:
        db.close()
    token = register(client, "meta_transform")

    response = client.get("/api/v1/map/meta", headers=auth(token))

    assert response.status_code == 200
    assert response.json()["flat_to_iso"] == [[2.0, 0.0, 0.1], [0.0, 2.0, 0.2]]


def test_map_meta_missing_transform(seeded_map, client):
    db = SessionLocal()
    try:
        iso = db.query(Layer).filter(Layer.kind == LayerKind.iso).one()
        iso.transform = None
        db.commit()
    finally:
        db.close()
    token = register(client, "meta_no_transform")

    response = client.get("/api/v1/map/meta", headers=auth(token))

    assert response.status_code == 404
    assert response.json()["code"] == "NOT_FOUND"
    assert response.json()["message"] == "尚未导入地图素材"


def test_iso_layer_rejects_map_anchor(seeded_map, client):
    token = register(client, "anchor_iso")
    item_id = _create_item(client, token)

    response = client.post(
        f"/api/v1/items/{item_id}/map-anchor",
        json={"layer_id": _layer_id(LayerKind.iso), "norm_x": 0.2, "norm_y": 0.2},
        headers=auth(token),
    )

    assert response.status_code == 400
    assert response.json()["code"] == "VALIDATION"


def test_iso_and_floor_layers_reject_route(seeded_map, client):
    token = register(client, "route_iso")
    item_id = _create_item(client, token)
    body = {"kind": "polyline", "geometry": {"points": [{"x": 0.1, "y": 0.1}, {"x": 0.2, "y": 0.2}]}}

    for kind in (LayerKind.iso, LayerKind.floor):
        response = client.post(
            f"/api/v1/items/{item_id}/route",
            json={**body, "layer_id": _layer_id(kind)},
            headers=auth(token),
        )
        assert response.status_code == 400
        assert response.json()["code"] == "VALIDATION"


def test_iso_and_floor_layers_reject_help_point(seeded_map, client):
    create_user("map_staff", "staff123", Role.staff)
    token = login(client, "map_staff", "staff123")

    for kind in (LayerKind.iso, LayerKind.floor):
        response = client.post(
            f"/api/v1/layers/{_layer_id(kind)}/simulated-points",
            json={"label": "求助点", "norm_x": 0.2, "norm_y": 0.2},
            headers=auth(token),
        )
        assert response.status_code == 400
        assert response.json()["code"] == "VALIDATION"


def test_floor_anchor_requires_building_and_floor(seeded_map, client):
    token = register(client, "anchor_missing")
    item_id = _create_item(client, token)

    response = client.post(
        f"/api/v1/items/{item_id}/map-anchor",
        json={"layer_id": _layer_id(LayerKind.floor), "norm_x": 0.2, "norm_y": 0.2},
        headers=auth(token),
    )

    assert response.status_code == 400
    message = response.json()["message"]
    assert "建筑" in message
    assert "楼层" in message


def test_floor_anchor_rejects_other_building(seeded_map, client):
    token = register(client, "anchor_other")
    item_id = _create_item(client, token, building_id=_building_id("T2"), floor=1)

    response = client.post(
        f"/api/v1/items/{item_id}/map-anchor",
        json={"layer_id": _layer_id(LayerKind.floor), "norm_x": 0.2, "norm_y": 0.2},
        headers=auth(token),
    )

    assert response.status_code == 400
    assert "建筑与当前楼层图不一致" in response.json()["message"]


def test_layers_expose_kind_and_rooms(seeded_map, client):
    token = register(client, "layer_viewer")

    response = client.get("/api/v1/layers", headers=auth(token))

    assert response.status_code == 200
    layers = {layer["kind"]: layer for layer in response.json()}
    assert set(layers) == {"flat", "iso", "floor"}
    assert layers["iso"]["rooms"] is None
    floors = [layer for layer in response.json() if layer["kind"] == "floor"]
    first_floor = next(layer for layer in floors if layer["floor"] == 1)
    assert first_floor["rooms"] == [{"name": "自习室", "x": 0.3, "y": 0.4}]


def test_recommend_excludes_bridge_and_unnamed(seeded_map, client):
    token = register(client, "advice_exclude")

    response = client.post("/api/v1/ai/search-advice", json={"geometry": NEARLY_CIRCLE}, headers=auth(token))

    assert response.status_code == 200
    locations = response.json()["locations"]
    assert 1 <= len(locations) <= 5
    codes = {row["building_code"] for row in locations}
    assert "b005" not in codes
    assert "DUP-f004" not in codes
    assert all("天桥" not in row["building_name"] for row in locations)


def test_recommend_reports_meters(seeded_map, client):
    token = register(client, "advice_meters")

    response = client.post(
        "/api/v1/ai/search-advice",
        json={"geometry": {"points": [{"x": 0.225, "y": 0.16}, {"x": 0.225, "y": 0.16}]}},
        headers=auth(token),
    )

    assert response.status_code == 200
    first = response.json()["locations"][0]
    assert first["building_code"] == "T1"
    assert "20 米" in first["reason"]


def test_recommend_degrades_on_model_timeout(seeded_map, client, monkeypatch):
    configure_model(monkeypatch)
    captured: dict = {}
    install_fake_client(monkeypatch, captured, error=httpx.ReadTimeout("timeout"))
    token = register(client, "advice_map_timeout")

    response = client.post("/api/v1/ai/search-advice", json={"geometry": CIRCLE}, headers=auth(token))

    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "rule"
    assert body["degraded"] is True
    assert body["locations"]
    assert any("米" in row["reason"] for row in body["locations"])


def test_building_out_exposes_iso_fields(seeded_map, client):
    token = register(client, "building_iso")

    response = client.get(f"/api/v1/buildings/{_building_id('T1')}", headers=auth(token))

    assert response.status_code == 200
    body = response.json()
    assert body["draw_order"] == 1
    assert body["entrance_node"] == 2
    assert body["iso_label_position"] == {"x": 0.195, "y": 0.18}
    assert len(body["iso_hit_area"]) == 4
    assert body["iso_hit_area"][0] == {"x": 0.12, "y": 0.12}
