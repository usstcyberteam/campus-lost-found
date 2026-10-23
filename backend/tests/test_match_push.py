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


def my_notifications(client, token: str) -> dict:
    r = client.get("/api/v1/me/notifications", headers=auth(token))
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


def test_found_post_pushes_notification_to_lost_owner(client):
    token_lost = register(client, "lost_owner")
    post_item(client, token_lost, "lost")
    token_found = register(client, "found_owner")
    found = post_item(client, token_found, "found", title="捡到蓝色折叠伞", description="蓝色长柄伞一把")

    data = my_notifications(client, token_lost)
    assert data["total"] == 1
    notice = data["items"][0]
    assert notice["kind"] == "ai_match"
    assert "蓝色折叠伞" in notice["content"]
    assert "图书馆" in notice["content"]
    assert f"/hall/{found['id']}" in notice["content"]
    assert notice["source"] == "rule"
    # 发布者自己不应收到通知
    assert my_notifications(client, token_found)["total"] == 0


def test_lost_post_pushes_notification_to_found_owner(client):
    token_found = register(client, "finder_first")
    post_item(client, token_found, "found", title="捡到蓝色折叠伞", description="蓝色长柄伞一把")
    token_lost = register(client, "seeker_late")
    lost = post_item(client, token_lost, "lost")

    data = my_notifications(client, token_found)
    assert data["total"] == 1
    notice = data["items"][0]
    assert notice["kind"] == "ai_match"
    assert f"/hall/{lost['id']}" in notice["content"]
    assert my_notifications(client, token_lost)["total"] == 0


def test_match_requires_same_category(client):
    token_lost = register(client, "cat_lost")
    post_item(client, token_lost, "lost")
    token_found = register(client, "cat_found")
    post_item(client, token_found, "found", category="水杯", title="捡到蓝色折叠伞")

    assert my_notifications(client, token_lost)["total"] == 0


def test_match_requires_same_location(client):
    token_lost = register(client, "loc_lost")
    post_item(client, token_lost, "lost")
    token_found = register(client, "loc_found")
    post_item(client, token_found, "found", location_area="食堂", title="捡到蓝色折叠伞")

    assert my_notifications(client, token_lost)["total"] == 0


def test_match_requires_keyword_overlap(client):
    token_lost = register(client, "kw_lost")
    post_item(client, token_lost, "lost", title="不见了呀", description="")
    token_found = register(client, "kw_found")
    post_item(client, token_found, "found", title="捡到东西", description="")

    assert my_notifications(client, token_lost)["total"] == 0


def test_match_excludes_posts_older_than_30_days(client):
    token_lost = register(client, "old_lost")
    old = post_item(client, token_lost, "lost")
    age_item(old["id"], days=40)
    token_found = register(client, "fresh_found")
    post_item(client, token_found, "found", title="捡到蓝色折叠伞")

    assert my_notifications(client, token_lost)["total"] == 0


def test_match_skips_withdrawn_post(client):
    token_lost = register(client, "wd_lost")
    lost = post_item(client, token_lost, "lost")
    r = client.post(f"/api/v1/items/{lost['id']}/withdraw", headers=auth(token_lost))
    assert r.status_code == 200
    token_found = register(client, "wd_found")
    post_item(client, token_found, "found", title="捡到蓝色折叠伞")

    assert my_notifications(client, token_lost)["total"] == 0


def test_match_manual_endpoint_dedups_once(client):
    token_lost = register(client, "dup_lost")
    post_item(client, token_lost, "lost")
    token_found = register(client, "dup_found")
    found = post_item(client, token_found, "found", title="捡到蓝色折叠伞")

    r = client.post("/api/v1/ai/match", json={"item_id": found["id"]}, headers=auth(token_found))
    assert r.status_code == 200
    payload = r.json()
    assert payload["matched"] == 1
    assert payload["notified"] == 0  # 发布时已推送，去重生效
    assert payload["items"][0]["notified"] is False
    assert payload["source"] == "rule"
    assert my_notifications(client, token_lost)["total"] == 1


def test_match_manual_endpoint_requires_owner(client):
    token_lost = register(client, "perm_lost")
    post_item(client, token_lost, "lost")
    token_found = register(client, "perm_found")
    found = post_item(client, token_found, "found", title="捡到蓝色折叠伞")
    stranger = register(client, "perm_other")

    r = client.post("/api/v1/ai/match", json={"item_id": found["id"]}, headers=auth(stranger))
    assert r.status_code == 403


def test_match_manual_endpoint_item_not_found(client):
    token = register(client, "nf_user")
    r = client.post("/api/v1/ai/match", json={"item_id": "00000000-0000-0000-0000-000000000000"}, headers=auth(token))
    assert r.status_code == 404


def test_notifications_and_match_require_login(client):
    r = client.get("/api/v1/me/notifications")
    assert r.status_code == 401
    r = client.post("/api/v1/ai/match", json={"item_id": "00000000-0000-0000-0000-000000000000"})
    assert r.status_code == 401


def test_direction_pairing_is_opposite_only(client):
    token_a = register(client, "same_dir_a")
    post_item(client, token_a, "lost")
    token_b = register(client, "same_dir_b")
    post_item(client, token_b, "lost", title="蓝色折叠伞又丢了")

    assert my_notifications(client, token_a)["total"] == 0