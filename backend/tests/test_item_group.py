from datetime import datetime, timedelta
from uuid import UUID

from app.database import SessionLocal
from app.models import Item


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def register(client, username: str) -> str:
    r = client.post(
        "/api/v1/auth/register", json={"username": username, "password": "secret123", "display_name": username}
    )
    assert r.status_code == 200
    return r.json()["token"]


def post_item(client, token: str, direction: str, **overrides) -> dict:
    body = {
        "direction": direction,
        "category": "雨伞",
        "title": "蓝色折叠伞",
        "description": "蓝色长柄伞，伞柄有划痕",
        "location_area": "图书馆",
    }
    body.update(overrides)
    r = client.post("/api/v1/items", json=body, headers=auth(token))
    assert r.status_code == 200, r.text
    return r.json()


def age_item(item_id, days: int) -> None:
    db = SessionLocal()
    try:
        item = db.get(Item, UUID(item_id))
        item.created_at = datetime.utcnow() - timedelta(days=days)
        db.commit()
    finally:
        db.close()


def list_items(client, token: str, **params) -> dict:
    r = client.get("/api/v1/items", headers=auth(token), params=params)
    assert r.status_code == 200, r.text
    return r.json()


def test_similar_posts_share_group(client):
    token_a = register(client, "grp_a")
    first = post_item(client, token_a, "lost")
    token_b = register(client, "grp_b")
    second = post_item(client, token_b, "found", title="捡到蓝色折叠伞")

    assert first["group_id"] is None  # 第一条无相似历史帖，不入组
    assert second["group_id"] is not None
    assert second["group_count"] == 2
    listing = list_items(client, token_a, group_id=second["group_id"])
    assert listing["total"] == 2
    ids = {row["id"] for row in listing["items"]}
    assert ids == {first["id"], second["id"]}
    assert all(row["group_count"] == 2 for row in listing["items"])


def test_dissimilar_posts_stay_ungrouped(client):
    token_a = register(client, "sep_a")
    post_item(client, token_a, "lost", title="不见了呀", description="", category="雨伞", location_area="图书馆")
    token_b = register(client, "sep_b")
    second = post_item(
        client, token_b, "found", title="捡到东西", description="", category="水杯", location_area="食堂"
    )

    # 仅时间差<7天一条命中（地点/类别/关键词均不同），不满足两条不聚合
    assert second["group_id"] is None
    assert second["group_count"] == 1


def test_high_keyword_overlap_groups_without_place_or_category(client):
    token_a = register(client, "kw_a")
    post_item(client, token_a, "lost", category="雨伞", location_area="图书馆")
    token_b = register(client, "kw_b")
    second = post_item(client, token_b, "found", category="水杯", location_area="食堂", title="蓝色折叠伞一把")

    # 类别与地点均不同，但标题关键词重叠率>50% + 时间差<7天，两条命中聚合
    assert second["group_id"] is not None


def test_same_category_old_post_not_grouped(client):
    token_a = register(client, "old_a")
    old = post_item(client, token_a, "lost", category="雨伞", location_area="图书馆")
    age_item(old["id"], days=8)
    token_b = register(client, "old_b")
    second = post_item(client, token_b, "found", title="捡到不锈钢保温壶", description="银色壶身", location_area="食堂")

    # 仅同类别一条命中（时间差≥7天、地点不同、关键词无重叠），不聚合
    assert second["group_id"] is None


def test_third_similar_post_joins_existing_group(client):
    token_a = register(client, "chain_a")
    post_item(client, token_a, "lost")
    token_b = register(client, "chain_b")
    second = post_item(client, token_b, "found", title="捡到蓝色折叠伞")
    token_c = register(client, "chain_c")
    third = post_item(client, token_c, "found", title="蓝色折叠伞一把")

    assert third["group_id"] == second["group_id"]
    assert third["group_count"] == 3
    listing = list_items(client, token_a, group_id=second["group_id"])
    assert listing["total"] == 3


def test_group_id_filter_requires_login(client):
    r = client.get("/api/v1/items", params={"group_id": "00000000-0000-0000-0000-000000000000"})
    assert r.status_code == 401


def test_item_detail_contains_group_id(client):
    token_a = register(client, "detail_a")
    post_item(client, token_a, "lost")
    token_b = register(client, "detail_b")
    second = post_item(client, token_b, "found", title="捡到蓝色折叠伞")

    r = client.get(f"/api/v1/items/{second['id']}", headers=auth(token_b))
    assert r.status_code == 200
    assert r.json()["group_id"] == second["group_id"]
