from tests.test_acceptance import auth, register


def create_item(client, token: str) -> str:
    response = client.post(
        "/api/v1/items",
        json={"direction": "lost", "category": "雨伞", "title": "丢伞"},
        headers=auth(token),
    )
    assert response.status_code == 200
    return response.json()["id"]


def create_route(client, token: str, item_id: str, body: dict) -> dict:
    response = client.post(f"/api/v1/items/{item_id}/route", json=body, headers=auth(token))
    assert response.status_code == 200
    return response.json()


def test_circle_route_defaults_public(client):
    token = register(client, "route_circle")
    item_id = create_item(client, token)

    created = create_route(
        client,
        token,
        item_id,
        {"kind": "circle", "geometry": {"center": {"x": 0.2, "y": 0.3}, "radius": 0.1}},
    )
    assert created["visibility"] == "public"
    assert "is_private" not in created

    routes = client.get(f"/api/v1/items/{item_id}/route", headers=auth(token)).json()
    assert routes[0]["visibility"] == "public"
    assert "is_private" not in routes[0]


def test_polyline_route_defaults_private_and_can_override(client):
    token = register(client, "route_polyline")
    item_id = create_item(client, token)

    polyline = create_route(
        client,
        token,
        item_id,
        {"kind": "polyline", "geometry": {"points": [{"x": 0.1, "y": 0.1}, {"x": 0.2, "y": 0.2}]}},
    )
    assert polyline["visibility"] == "private"

    public_circle = create_route(
        client,
        token,
        item_id,
        {
            "kind": "circle",
            "geometry": {"center": {"x": 0.5, "y": 0.5}, "radius": 0.05},
            "visibility": "private",
        },
    )
    assert public_circle["visibility"] == "private"

    public_polyline = create_route(
        client,
        token,
        item_id,
        {
            "kind": "polyline",
            "geometry": {"points": [{"x": 0.3, "y": 0.3}, {"x": 0.4, "y": 0.4}]},
            "visibility": "public",
        },
    )
    assert public_polyline["visibility"] == "public"

    routes = client.get(f"/api/v1/items/{item_id}/route", headers=auth(token)).json()
    assert [route["visibility"] for route in routes] == ["private", "private", "public"]


def test_route_only_visible_to_owner(client):
    token = register(client, "route_owner")
    item_id = create_item(client, token)
    create_route(
        client,
        token,
        item_id,
        {"kind": "polyline", "geometry": {"points": [{"x": 0.1, "y": 0.1}, {"x": 0.2, "y": 0.2}]}},
    )

    other = register(client, "route_viewer")
    assert client.get(f"/api/v1/items/{item_id}/route", headers=auth(other)).status_code == 403
    assert client.get(f"/api/v1/items/{item_id}/route").status_code == 401
