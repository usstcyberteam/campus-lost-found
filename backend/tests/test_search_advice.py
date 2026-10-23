import httpx

from app.database import SessionLocal
from app.models import Layer
from app.models.enums import LayerKind
from tests.test_acceptance import auth, register
from tests.test_ai_draft import configure_model, install_fake_client

ADVICE_JSON = '{"locations":[{"building_code":"T2","reason":"食堂距离较近且历史记录较多。"}]}'
CIRCLE = {"center": {"x": 0.375, "y": 0.16}, "radius": 0.05}
FAR_CIRCLE = {"center": {"x": 0.375, "y": 0.4}, "radius": 0.02}


def create_lost_item(client, token: str) -> str:
    response = client.post(
        "/api/v1/items",
        json={"direction": "lost", "category": "雨伞", "title": "丢伞"},
        headers=auth(token),
    )
    assert response.status_code == 200
    return response.json()["id"]


def flat_layer_id() -> str:
    db = SessionLocal()
    try:
        layer = db.query(Layer).filter(Layer.kind == LayerKind.flat).one()
        return str(layer.id)
    finally:
        db.close()


def test_search_advice_requires_login(client):
    response = client.post("/api/v1/ai/search-advice", json={"geometry": CIRCLE})
    assert response.status_code == 401
    assert response.json()["code"] == "UNAUTH"


def test_search_advice_requires_item_or_geometry(client, seeded_map):
    token = register(client, "advice_empty")
    response = client.post("/api/v1/ai/search-advice", json={}, headers=auth(token))
    assert response.status_code == 400
    assert response.json()["code"] == "VALIDATION"


def test_search_advice_scores_by_rule(client, seeded_map):
    token = register(client, "advice_rule")

    response = client.post("/api/v1/ai/search-advice", json={"geometry": CIRCLE}, headers=auth(token))

    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "rule"
    assert body["degraded"] is True
    assert 1 <= len(body["locations"]) <= 5
    assert [row["order"] for row in body["locations"]] == list(range(1, len(body["locations"]) + 1))
    assert body["locations"][0]["building_code"] == "T2"
    assert body["locations"][0]["reason"]


def test_search_advice_uses_model_explanations(client, seeded_map, monkeypatch):
    configure_model(monkeypatch)
    captured: dict = {}
    install_fake_client(monkeypatch, captured, content=ADVICE_JSON)
    token = register(client, "advice_model")

    response = client.post("/api/v1/ai/search-advice", json={"geometry": CIRCLE}, headers=auth(token))

    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "model"
    assert body["degraded"] is False
    assert body["locations"][0]["building_code"] == "T2"
    assert "食堂距离较近且历史记录较多。" in body["locations"][0]["reason"]

    sent = captured["body"]["messages"][1]["content"]
    assert "center" not in sent
    assert "0.375" not in sent
    assert "0.16" not in sent


def test_search_advice_degrades_on_model_timeout(client, seeded_map, monkeypatch):
    configure_model(monkeypatch)
    captured: dict = {}
    install_fake_client(monkeypatch, captured, error=httpx.ReadTimeout("timeout"))
    token = register(client, "advice_timeout")

    response = client.post("/api/v1/ai/search-advice", json={"geometry": CIRCLE}, headers=auth(token))

    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "rule"
    assert body["degraded"] is True
    assert len(body["locations"]) > 0


def test_search_advice_rejects_other_private_route(client, seeded_map):
    owner = register(client, "advice_owner")
    item_id = create_lost_item(client, owner)
    route = client.post(
        f"/api/v1/items/{item_id}/route",
        json={"kind": "polyline", "geometry": {"points": [{"x": 0.1, "y": 0.1}, {"x": 0.2, "y": 0.2}]}},
        headers=auth(owner),
    )
    assert route.status_code == 200
    assert route.json()["visibility"] == "private"

    other = register(client, "advice_other")
    response = client.post("/api/v1/ai/search-advice", json={"item_id": item_id}, headers=auth(other))
    assert response.status_code == 403
    assert response.json()["code"] == "FORBIDDEN"


def test_search_advice_reports_inside_saved_range(client, seeded_map):
    token = register(client, "advice_inside_range")
    item_id = create_lost_item(client, token)
    route = client.post(
        f"/api/v1/items/{item_id}/route",
        json={"kind": "circle", "geometry": CIRCLE},
        headers=auth(token),
    )
    assert route.status_code == 200

    response = client.post("/api/v1/ai/search-advice", json={"item_id": item_id}, headers=auth(token))

    assert response.status_code == 200
    locations = response.json()["locations"]
    assert locations[0]["building_code"] == "T2"
    assert "就在你圈选的范围内" in locations[0]["reason"]
    assert "0 米" not in locations[0]["reason"]


def test_search_advice_reports_meters_from_saved_range_edge(client, seeded_map):
    token = register(client, "advice_saved_range")
    item_id = create_lost_item(client, token)
    route = client.post(
        f"/api/v1/items/{item_id}/route",
        json={"kind": "circle", "geometry": FAR_CIRCLE},
        headers=auth(token),
    )
    assert route.status_code == 200

    response = client.post("/api/v1/ai/search-advice", json={"item_id": item_id}, headers=auth(token))

    assert response.status_code == 200
    locations = response.json()["locations"]
    assert locations
    assert any("米" in row["reason"] for row in locations)
    assert locations[0]["building_code"] == "T2"
    # 楼纵向 0.16×600=96 像素，圈心 0.4×600=240 像素，半径 0.02×600=12 像素，
    # 到圈边缘 240-12-96=132 像素，比例尺 0.5 米/像素，即 66 米
    assert "距你圈选的范围约 66 米" in locations[0]["reason"]


def test_search_advice_reports_saved_anchor_as_marked_position(client, seeded_map):
    token = register(client, "advice_saved_anchor")
    item_id = create_lost_item(client, token)
    anchor = client.post(
        f"/api/v1/items/{item_id}/map-anchor",
        json={"layer_id": flat_layer_id(), "norm_x": 0.375, "norm_y": 0.16},
        headers=auth(token),
    )
    assert anchor.status_code == 200

    response = client.post("/api/v1/ai/search-advice", json={"item_id": item_id}, headers=auth(token))

    assert response.status_code == 200
    assert "距你标记的位置约" in response.json()["locations"][0]["reason"]
