from tests.test_acceptance import auth, register


def test_list_items_pagination_applies_limit_and_offset(client):
    token = register(client, "paginate")
    for i in range(5):
        r = client.post(
            "/api/v1/items",
            headers=auth(token),
            json={"direction": "found", "category": "书", "title": f"物品{i}"},
        )
        assert r.status_code == 200

    r = client.get("/api/v1/items", params={"limit": 2, "offset": 1}, headers=auth(token))
    assert r.status_code == 200
    data = r.json()
    assert data["total"] == 5
    assert data["limit"] == 2
    assert data["offset"] == 1
    assert len(data["items"]) == 2

    r = client.get("/api/v1/items", params={"limit": 3, "offset": 4}, headers=auth(token))
    data = r.json()
    assert data["total"] == 5
    assert data["offset"] == 4
    assert len(data["items"]) == 1


def test_list_items_limit_over_100_returns_400(client):
    token = register(client, "limitcheck")
    r = client.get("/api/v1/items", params={"limit": 101}, headers=auth(token))
    assert r.status_code == 400


def test_list_items_keyword_search_matches_title_description_category(client):
    token = register(client, "search")
    client.post(
        "/api/v1/items",
        headers=auth(token),
        json={"direction": "found", "category": "电子", "title": "蓝色蓝牙耳机", "description": "在图书馆捡到"},
    )
    client.post(
        "/api/v1/items",
        headers=auth(token),
        json={"direction": "found", "category": "书籍", "title": "高等数学", "description": "数学教材"},
    )
    client.post(
        "/api/v1/items",
        headers=auth(token),
        json={"direction": "found", "category": "手机", "title": "iPhone 15", "description": "白色手机"},
    )

    r = client.get("/api/v1/items", params={"q": "耳机"}, headers=auth(token))
    assert [i["title"] for i in r.json()["items"]] == ["蓝色蓝牙耳机"]

    r = client.get("/api/v1/items", params={"q": "图书馆"}, headers=auth(token))
    assert [i["title"] for i in r.json()["items"]] == ["蓝色蓝牙耳机"]

    r = client.get("/api/v1/items", params={"q": "书籍"}, headers=auth(token))
    assert [i["title"] for i in r.json()["items"]] == ["高等数学"]

    # 不区分大小写
    r = client.get("/api/v1/items", params={"q": "iphone"}, headers=auth(token))
    assert [i["title"] for i in r.json()["items"]] == ["iPhone 15"]


def test_item_detail_precise_location_hidden_from_non_owner(client):
    token = register(client, "preciseowner")
    r = client.post(
        "/api/v1/items",
        headers=auth(token),
        json={"direction": "found", "category": "雨伞", "title": "黑伞", "precise_location": "图书馆3楼角落"},
    )
    item_id = r.json()["id"]
    other = register(client, "preciseviewer")

    assert client.get(f"/api/v1/items/{item_id}", headers=auth(token)).json()["precise_location"] == "图书馆3楼角落"
    assert client.get(f"/api/v1/items/{item_id}", headers=auth(other)).json()["precise_location"] is None
