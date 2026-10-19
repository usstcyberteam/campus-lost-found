import httpx

from tests.test_acceptance import auth, register
from tests.test_ai_draft import configure_model, install_fake_client
from tests.test_buildings import import_config

ADVICE_JSON = '{"locations":[{"building_code":"B02","reason":"图书馆距离较近且历史记录较多。"}]}'
CIRCLE = {"center": {"x": 0.60, "y": 0.66}, "radius": 0.05}


def create_lost_item(client, token: str) -> str:
    response = client.post(
        "/api/v1/items",
        json={"direction": "lost", "category": "雨伞", "title": "丢伞"},
        headers=auth(token),
    )
    assert response.status_code == 200
    return response.json()["id"]


def test_search_advice_requires_login(client):
    response = client.post("/api/v1/ai/search-advice", json={"geometry": CIRCLE})
    assert response.status_code == 401
    assert response.json()["code"] == "UNAUTH"


def test_search_advice_requires_item_or_geometry(client):
    token = register(client, "advice_empty")
    response = client.post("/api/v1/ai/search-advice", json={}, headers=auth(token))
    assert response.status_code == 400
    assert response.json()["code"] == "VALIDATION"


def test_search_advice_scores_by_rule(client):
    import_config()
    token = register(client, "advice_rule")

    response = client.post("/api/v1/ai/search-advice", json={"geometry": CIRCLE}, headers=auth(token))

    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "rule"
    assert body["degraded"] is True
    assert 1 <= len(body["locations"]) <= 5
    assert [row["order"] for row in body["locations"]] == list(range(1, len(body["locations"]) + 1))
    assert body["locations"][0]["building_code"] == "B02"
    assert body["locations"][0]["reason"]


def test_search_advice_uses_model_explanations(client, monkeypatch):
    import_config()
    configure_model(monkeypatch)
    captured: dict = {}
    install_fake_client(monkeypatch, captured, content=ADVICE_JSON)
    token = register(client, "advice_model")

    response = client.post("/api/v1/ai/search-advice", json={"geometry": CIRCLE}, headers=auth(token))

    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "model"
    assert body["degraded"] is False
    assert body["locations"][0]["building_code"] == "B02"
    assert body["locations"][0]["reason"] == "图书馆距离较近且历史记录较多。"

    sent = captured["body"]["messages"][1]["content"]
    assert "center" not in sent
    assert "0.60" not in sent
    assert "0.66" not in sent


def test_search_advice_degrades_on_model_timeout(client, monkeypatch):
    import_config()
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


def test_search_advice_rejects_other_private_route(client):
    import_config()
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
