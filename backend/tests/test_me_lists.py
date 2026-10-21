from datetime import datetime


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def register(client, username: str) -> tuple[str, str]:
    r = client.post(
        "/api/v1/auth/register",
        json={"username": username, "password": "secret123", "display_name": username},
    )
    assert r.status_code == 200
    token = r.json()["token"]
    me = client.get("/api/v1/auth/me", headers=auth(token)).json()
    return token, me["id"]


def create_item(client, token: str, direction: str = "lost", title: str = "丢失的伞") -> dict:
    r = client.post(
        "/api/v1/items",
        json={"direction": direction, "category": "雨伞", "title": title},
        headers=auth(token),
    )
    assert r.status_code == 200
    return r.json()


def add_comment(client, token: str, item_id: str, content: str) -> dict:
    r = client.post(f"/api/v1/items/{item_id}/comments", json={"content": content}, headers=auth(token))
    assert r.status_code == 200
    return r.json()


def take(client, token: str, item_id: str) -> dict:
    r = client.post(f"/api/v1/items/{item_id}/helpers", headers=auth(token))
    assert r.status_code == 200
    return r.json()


def abandon(client, token: str, item_id: str) -> dict:
    r = client.delete(f"/api/v1/items/{item_id}/helpers", headers=auth(token))
    assert r.status_code == 200
    return r.json()


def thank(client, token: str, item_id: str, helper_display_name: str) -> dict:
    detail = client.get(f"/api/v1/items/{item_id}", headers=auth(token)).json()
    helper_id = next(row["id"] for row in detail["helpers"] if row["display_name"] == helper_display_name)
    r = client.post(f"/api/v1/items/{item_id}/thank", json={"helper_ids": [helper_id]}, headers=auth(token))
    assert r.status_code == 200
    return r.json()


def claim(client, token: str, found_item_id: str, key: str) -> dict:
    r = client.post(
        "/api/v1/claims",
        json={
            "found_item_id": found_item_id,
            "evidence": [{"kind": "text", "content": "物品特征描述"}],
            "idempotency_key": key,
        },
        headers=auth(token),
    )
    assert r.status_code == 200
    return r.json()


def parse_times(rows: list[dict], field: str) -> list[datetime]:
    return [datetime.fromisoformat(row[field]) for row in rows]


def test_me_comments_returns_only_own_and_undeleted(client):
    owner, _ = register(client, "me_comments_owner")
    other, _ = register(client, "me_comments_other")
    item = create_item(client, owner)
    mine = add_comment(client, owner, item["id"], "我的第一条评论")
    deleted = add_comment(client, owner, item["id"], "稍后删除的评论")
    add_comment(client, other, item["id"], "别人的评论")
    assert client.delete(f"/api/v1/comments/{deleted['id']}", headers=auth(owner)).status_code == 200

    body = client.get("/api/v1/me/comments", headers=auth(owner)).json()
    assert body["total"] == 1
    assert [row["id"] for row in body["items"]] == [mine["id"]]
    assert set(body["items"][0]) == {"id", "item_id", "item_title", "content", "created_at"}
    assert body["items"][0]["content"] == "我的第一条评论"
    assert body["items"][0]["item_id"] == item["id"]
    assert body["items"][0]["item_title"] == item["title"]


def test_me_comments_includes_withdrawn_item(client):
    owner, _ = register(client, "me_comments_withdraw")
    item = create_item(client, owner, title="撤销前的标题")
    add_comment(client, owner, item["id"], "撤销后仍可见")
    assert client.post(f"/api/v1/items/{item['id']}/withdraw", headers=auth(owner)).status_code == 200

    body = client.get("/api/v1/me/comments", headers=auth(owner)).json()
    assert body["total"] == 1
    assert body["items"][0]["item_id"] == item["id"]
    assert body["items"][0]["item_title"] == "撤销前的标题"


def test_me_comments_order_and_pagination(client):
    owner, _ = register(client, "me_comments_page")
    item = create_item(client, owner)
    expected = {add_comment(client, owner, item["id"], f"评论 {index}")["id"] for index in range(3)}

    first = client.get("/api/v1/me/comments", params={"limit": 2, "offset": 0}, headers=auth(owner)).json()
    second = client.get("/api/v1/me/comments", params={"limit": 2, "offset": 2}, headers=auth(owner)).json()
    assert first["limit"] == 2 and first["offset"] == 0
    assert second["limit"] == 2 and second["offset"] == 2
    assert len(first["items"]) == 2 and len(second["items"]) == 1
    page_ids = [row["id"] for row in first["items"]] + [row["id"] for row in second["items"]]
    assert len(page_ids) == len(set(page_ids))
    assert set(page_ids) == expected
    times = parse_times(first["items"] + second["items"], "created_at")
    assert times == sorted(times, reverse=True)


def test_me_comments_requires_login(client):
    r = client.get("/api/v1/me/comments")
    assert r.status_code == 401
    assert r.json()["code"] == "UNAUTH"


def test_me_comments_rejects_invalid_pagination(client):
    token, _ = register(client, "me_comments_bad_query")
    for params in ({"limit": 0}, {"limit": 101}, {"offset": -1}):
        r = client.get("/api/v1/me/comments", params=params, headers=auth(token))
        assert r.status_code == 400
        assert r.json()["code"] == "VALIDATION"


def test_me_claims_returns_item_title(client):
    owner, _ = register(client, "me_claims_owner")
    applicant, _ = register(client, "me_claims_applicant")
    other, _ = register(client, "me_claims_other")
    item = create_item(client, owner, direction="found", title="拾获的黑色雨伞")
    mine = claim(client, applicant, item["id"], "me-claims-mine")
    claim(client, other, item["id"], "me-claims-other")

    body = client.get("/api/v1/me/claims", headers=auth(applicant)).json()
    assert body["total"] == 1
    row = body["items"][0]
    assert row["id"] == mine["id"]
    assert row["found_item_id"] == item["id"]
    assert row["status"] == "pending"
    assert row["item_title"] == "拾获的黑色雨伞"
    assert row["created_at"]


def test_me_helping_returns_item_summary_and_helper_state(client):
    owner, _ = register(client, "me_helping_owner")
    helper, _ = register(client, "me_helping_helper")
    other, _ = register(client, "me_helping_other")
    first = create_item(client, owner, title="丢失的钥匙")
    second = create_item(client, owner, title="丢失的校园卡")
    take(client, helper, first["id"])
    take(client, other, second["id"])

    body = client.get("/api/v1/me/helping", headers=auth(helper)).json()
    assert body["total"] == 1
    row = body["items"][0]
    assert row["id"] == first["id"]
    assert row["title"] == "丢失的钥匙"
    assert row["status"] == "searching"
    assert "building_name" in row and "first_photo" in row
    assert row["helper_status"] == "active"
    assert row["thanked"] is False
    assert row["helper_id"]
    assert row["taken_at"]


def test_me_helping_reports_abandoned_and_thanked(client):
    owner, _ = register(client, "me_helping_state_owner")
    helper, _ = register(client, "me_helping_state_helper")
    abandoned_item = create_item(client, owner, title="放弃的委托")
    thanked_item = create_item(client, owner, title="被致谢的委托")
    take(client, helper, abandoned_item["id"])
    take(client, helper, thanked_item["id"])
    abandon(client, helper, abandoned_item["id"])
    assert client.post(f"/api/v1/items/{thanked_item['id']}/mark-found", headers=auth(owner)).status_code == 200
    thank(client, owner, thanked_item["id"], "me_helping_state_helper")

    body = client.get("/api/v1/me/helping", headers=auth(helper)).json()
    assert body["total"] == 2
    rows = {row["id"]: row for row in body["items"]}
    assert set(rows) == {abandoned_item["id"], thanked_item["id"]}
    assert rows[abandoned_item["id"]]["helper_status"] == "abandoned"
    assert rows[thanked_item["id"]]["helper_status"] == "active"
    assert rows[thanked_item["id"]]["thanked"] is True


def test_me_helping_order_and_pagination(client):
    owner, _ = register(client, "me_helping_page_owner")
    helper, _ = register(client, "me_helping_page_helper")
    expected = set()
    for index in range(3):
        item = create_item(client, owner, title=f"委托 {index}")
        take(client, helper, item["id"])
        expected.add(item["id"])

    first = client.get("/api/v1/me/helping", params={"limit": 2, "offset": 0}, headers=auth(helper)).json()
    second = client.get("/api/v1/me/helping", params={"limit": 2, "offset": 2}, headers=auth(helper)).json()
    assert first["total"] == 3
    assert len(first["items"]) == 2 and len(second["items"]) == 1
    page_ids = [row["id"] for row in first["items"]] + [row["id"] for row in second["items"]]
    assert len(page_ids) == len(set(page_ids))
    assert set(page_ids) == expected
    times = parse_times(first["items"] + second["items"], "taken_at")
    assert times == sorted(times, reverse=True)


def test_me_helping_requires_login(client):
    r = client.get("/api/v1/me/helping")
    assert r.status_code == 401
    assert r.json()["code"] == "UNAUTH"


def test_me_helping_rejects_invalid_pagination(client):
    token, _ = register(client, "me_helping_bad_query")
    for params in ({"limit": 0}, {"limit": 101}, {"offset": -1}):
        r = client.get("/api/v1/me/helping", params=params, headers=auth(token))
        assert r.status_code == 400
        assert r.json()["code"] == "VALIDATION"


def test_me_lists_ignore_foreign_user_id(client):
    owner, owner_id = register(client, "me_lists_owner")
    mine, _ = register(client, "me_lists_mine")
    lost = create_item(client, owner, title="他人的寻物")
    found = create_item(client, owner, direction="found", title="他人的拾获")
    add_comment(client, owner, lost["id"], "他人的评论")
    add_comment(client, mine, lost["id"], "我的评论")
    take(client, mine, lost["id"])
    claim(client, mine, found["id"], "me-lists-foreign")
    params = {"user_id": owner_id, "limit": 20, "offset": 0}

    comments = client.get("/api/v1/me/comments", params=params, headers=auth(mine)).json()
    helping = client.get("/api/v1/me/helping", params=params, headers=auth(mine)).json()
    claims = client.get("/api/v1/me/claims", params=params, headers=auth(mine)).json()
    assert comments["total"] == 1
    assert comments["items"][0]["content"] == "我的评论"
    assert helping["total"] == 1
    assert {row["id"] for row in helping["items"]} == {lost["id"]}
    assert claims["total"] == 1
    assert claims["items"][0]["found_item_id"] == found["id"]


def test_me_lists_hide_private_fields(client):
    owner, _ = register(client, "me_lists_private_owner")
    helper, _ = register(client, "me_lists_private_helper")
    lost = create_item(client, owner, title="私密字段检查")
    found = create_item(client, owner, direction="found", title="私密认领检查")
    take(client, helper, lost["id"])
    claim(client, helper, found["id"], "me-lists-private")

    helping = client.get("/api/v1/me/helping", headers=auth(helper)).json()["items"][0]
    claims = client.get("/api/v1/me/claims", headers=auth(helper)).json()["items"][0]
    forbidden = {"precise_location", "norm_x", "norm_y", "layer_id", "routes", "contact", "evidence"}
    assert forbidden.isdisjoint(helping)
    assert forbidden.isdisjoint(claims)
    assert helping["id"] == lost["id"]
    assert claims["found_item_id"] == found["id"]
