import uuid


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def register(client, username: str) -> str:
    r = client.post(
        "/api/v1/auth/register",
        json={"username": username, "password": "secret123", "display_name": username},
    )
    assert r.status_code == 200
    return r.json()["token"]


def create_item(client, token: str) -> dict:
    r = client.post(
        "/api/v1/items",
        json={"direction": "found", "category": "雨伞", "title": "黑伞"},
        headers=auth(token),
    )
    assert r.status_code == 200
    return r.json()


def test_like_is_idempotent_and_cancellable(client):
    token = register(client, "reaction_like")
    item = create_item(client, token)
    first = client.post(f"/api/v1/items/{item['id']}/like", headers=auth(token))
    assert first.status_code == 200
    assert first.json()["liked"] is True
    assert first.json()["like_count"] == 1
    again = client.post(f"/api/v1/items/{item['id']}/like", headers=auth(token))
    assert again.json()["like_count"] == 1
    removed = client.delete(f"/api/v1/items/{item['id']}/like", headers=auth(token))
    assert removed.json()["liked"] is False
    assert removed.json()["like_count"] == 0
    assert client.delete(f"/api/v1/items/{item['id']}/like", headers=auth(token)).json()["like_count"] == 0


def test_favorite_is_idempotent_and_cancellable(client):
    token = register(client, "reaction_favorite")
    item = create_item(client, token)
    assert client.post(f"/api/v1/items/{item['id']}/favorite", headers=auth(token)).json()["favorite_count"] == 1
    assert client.post(f"/api/v1/items/{item['id']}/favorite", headers=auth(token)).json()["favorite_count"] == 1
    removed = client.delete(f"/api/v1/items/{item['id']}/favorite", headers=auth(token))
    assert removed.json()["favorited"] is False
    assert removed.json()["favorite_count"] == 0


def test_reactions_require_login_and_existing_item(client):
    token = register(client, "reaction_guard")
    item = create_item(client, token)
    assert client.post(f"/api/v1/items/{item['id']}/like").status_code == 401
    assert client.post(f"/api/v1/items/{item['id']}/favorite").status_code == 401
    missing = uuid.uuid4()
    assert client.post(f"/api/v1/items/{missing}/like", headers=auth(token)).status_code == 404
    assert client.post(f"/api/v1/items/{missing}/favorite", headers=auth(token)).status_code == 404


def test_detail_and_list_expose_reaction_state(client):
    owner = register(client, "reaction_owner")
    other = register(client, "reaction_other")
    item = create_item(client, owner)
    client.post(f"/api/v1/items/{item['id']}/like", headers=auth(other))
    client.post(f"/api/v1/items/{item['id']}/favorite", headers=auth(other))
    detail = client.get(f"/api/v1/items/{item['id']}", headers=auth(other)).json()
    assert detail["like_count"] == 1
    assert detail["favorite_count"] == 1
    assert detail["is_liked"] is True
    assert detail["is_favorited"] is True
    listed = client.get("/api/v1/items", headers=auth(other)).json()
    row = next(entry for entry in listed["items"] if entry["id"] == item["id"])
    assert row["like_count"] == 1
    assert row["is_favorited"] is True


def test_me_likes_and_favorites_lists(client):
    owner = register(client, "reaction_lists")
    item = create_item(client, owner)
    client.post(f"/api/v1/items/{item['id']}/like", headers=auth(owner))
    client.post(f"/api/v1/items/{item['id']}/favorite", headers=auth(owner))
    likes = client.get("/api/v1/me/likes", headers=auth(owner)).json()
    favorites = client.get("/api/v1/me/favorites", headers=auth(owner)).json()
    assert likes["total"] == 1
    assert likes["items"][0]["id"] == item["id"]
    assert favorites["total"] == 1
    assert favorites["items"][0]["id"] == item["id"]


def test_like_counts_are_per_user(client):
    owner = register(client, "reaction_count_owner")
    first = register(client, "reaction_count_first")
    second = register(client, "reaction_count_second")
    item = create_item(client, owner)
    client.post(f"/api/v1/items/{item['id']}/like", headers=auth(first))
    client.post(f"/api/v1/items/{item['id']}/like", headers=auth(second))
    detail = client.get(f"/api/v1/items/{item['id']}", headers=auth(owner)).json()
    assert detail["like_count"] == 2
    assert detail["is_liked"] is False
