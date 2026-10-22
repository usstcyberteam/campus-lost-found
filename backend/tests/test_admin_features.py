from app.core.security import hash_password
from app.database import SessionLocal
from app.models import Role, User


def create_user(username: str, password: str, role: Role):
    db = SessionLocal()
    db.add(User(username=username, password_hash=hash_password(password), role=role, display_name=username))
    db.commit()
    db.close()


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def register(client, username: str, password: str = "secret123") -> tuple[str, str]:
    r = client.post(
        "/api/v1/auth/register",
        json={"username": username, "password": password, "display_name": username},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    me = client.get("/api/v1/auth/me", headers=auth(body["token"])).json()
    return body["token"], me["id"]


def login(client, username: str, password: str) -> str:
    r = client.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["token"]


def new_item(client, token: str, direction: str = "lost", **extra) -> str:
    payload = {"direction": direction, "category": "雨伞", "title": "原题目", **extra}
    r = client.post("/api/v1/items", json=payload, headers=auth(token))
    assert r.status_code == 200, r.text
    return r.json()["id"]


# ---------------- 帖子编辑 ----------------
def test_owner_can_edit_active_item(client):
    token, _ = register(client, "editor1")
    item_id = new_item(client, token)
    r = client.patch(
        f"/api/v1/items/{item_id}",
        json={"title": "改过的标题", "location_area": "图书馆2F"},
        headers=auth(token),
    )
    assert r.status_code == 200, r.text
    assert r.json()["title"] == "改过的标题"
    assert r.json()["location_area"] == "图书馆2F"


def test_non_owner_cannot_edit(client):
    token, _ = register(client, "editor2")
    item_id = new_item(client, token)
    other, _ = register(client, "editor2b")
    r = client.patch(f"/api/v1/items/{item_id}", json={"title": "篡改"}, headers=auth(other))
    assert r.status_code == 403


def test_edit_rejected_for_closed_states(client):
    token, _ = register(client, "editor3")
    item_id = new_item(client, token)
    assert client.post(f"/api/v1/items/{item_id}/withdraw", headers=auth(token)).status_code == 200
    r = client.patch(f"/api/v1/items/{item_id}", json={"title": "无效"}, headers=auth(token))
    assert r.status_code == 409


def test_edit_rejects_unknown_building(client):
    token, _ = register(client, "editor4")
    item_id = new_item(client, token)
    r = client.patch(
        f"/api/v1/items/{item_id}",
        json={"building_id": "00000000-0000-0000-0000-000000000000"},
        headers=auth(token),
    )
    assert r.status_code == 404


# ---------------- 帖子删除/下架 ----------------
def test_owner_soft_delete_hides_from_list(client):
    token, _ = register(client, "del1")
    item_id = new_item(client, token)
    r = client.delete(f"/api/v1/items/{item_id}", headers=auth(token))
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "deleted"
    listing = client.get("/api/v1/items", headers=auth(token)).json()["items"]
    assert all(item["id"] != item_id for item in listing)
    detail = client.get(f"/api/v1/items/{item_id}", headers=auth(token))
    assert detail.status_code == 200
    assert detail.json()["status"] == "deleted"


def test_other_user_cannot_delete(client):
    token, _ = register(client, "del2")
    item_id = new_item(client, token)
    other, _ = register(client, "del2b")
    assert client.delete(f"/api/v1/items/{item_id}", headers=auth(other)).status_code == 403


def test_staff_can_delete_others_item(client):
    create_user("delstaff", "staff123", Role.staff)
    staff_token = login(client, "delstaff", "staff123")
    owner_token, _ = register(client, "del3")
    item_id = new_item(client, owner_token)
    r = client.delete(f"/api/v1/items/{item_id}", headers=auth(staff_token))
    assert r.status_code == 200
    assert r.json()["status"] == "deleted"


def test_delete_twice_conflicts(client):
    token, _ = register(client, "del4")
    item_id = new_item(client, token)
    assert client.delete(f"/api/v1/items/{item_id}", headers=auth(token)).status_code == 200
    assert client.delete(f"/api/v1/items/{item_id}", headers=auth(token)).status_code == 409


# ---------------- 个人资料 ----------------
def test_update_profile(client):
    token, _ = register(client, "prof1")
    r = client.patch("/api/v1/me", json={"display_name": "新昵称", "contact": "13800000000"}, headers=auth(token))
    assert r.status_code == 200, r.text
    assert r.json()["display_name"] == "新昵称"
    assert r.json()["contact"] == "13800000000"


def test_change_password(client):
    token, _ = register(client, "pw1", password="oldpass1")
    r = client.post(
        "/api/v1/me/password",
        json={"old_password": "oldpass1", "new_password": "newpass1"},
        headers=auth(token),
    )
    assert r.status_code == 200, r.text
    assert client.post("/api/v1/auth/login", json={"username": "pw1", "password": "oldpass1"}).status_code == 401
    assert client.post("/api/v1/auth/login", json={"username": "pw1", "password": "newpass1"}).status_code == 200


def test_change_password_wrong_old(client):
    token, _ = register(client, "pw2", password="oldpass2")
    r = client.post(
        "/api/v1/me/password",
        json={"old_password": "wrongpass", "new_password": "newpass2"},
        headers=auth(token),
    )
    assert r.status_code == 400


# ---------------- 管理员用户管理 ----------------
def test_admin_lists_and_updates_user(client):
    create_user("adm1", "admin123", Role.admin)
    admin_token = login(client, "adm1", "admin123")
    _, student_id = register(client, "managed1")

    listing = client.get("/api/v1/admin/users?q=managed1", headers=auth(admin_token))
    assert listing.status_code == 200
    assert any(u["username"] == "managed1" for u in listing.json()["items"])

    r = client.patch(f"/api/v1/admin/users/{student_id}", json={"role": "staff"}, headers=auth(admin_token))
    assert r.status_code == 200, r.text
    assert r.json()["role"] == "staff"


def test_banned_user_cannot_use_token(client):
    create_user("adm2", "admin123", Role.admin)
    admin_token = login(client, "adm2", "admin123")
    student_token, student_id = register(client, "banned1")

    r = client.patch(f"/api/v1/admin/users/{student_id}", json={"is_banned": True}, headers=auth(admin_token))
    assert r.status_code == 200
    assert r.json()["is_banned"] is True
    assert client.post("/api/v1/auth/login", json={"username": "banned1", "password": "secret123"}).status_code == 403
    assert client.get("/api/v1/auth/me", headers=auth(student_token)).status_code == 403


def test_admin_cannot_modify_self_or_peer_admin(client):
    create_user("adm3", "admin123", Role.admin)
    create_user("adm4", "admin123", Role.admin)
    admin_token = login(client, "adm3", "admin123")
    me = client.get("/api/v1/auth/me", headers=auth(admin_token)).json()
    peer = client.get("/api/v1/auth/me", headers=auth(login(client, "adm4", "admin123"))).json()

    assert client.patch(f"/api/v1/admin/users/{me['id']}", json={"role": "student"}, headers=auth(admin_token)).status_code == 409
    assert client.patch(f"/api/v1/admin/users/{peer['id']}", json={"is_banned": True}, headers=auth(admin_token)).status_code == 409


def test_non_admin_cannot_manage_users_or_stats(client):
    token, _ = register(client, "noperm1")
    assert client.get("/api/v1/admin/users", headers=auth(token)).status_code == 403
    assert client.get("/api/v1/admin/stats", headers=auth(token)).status_code == 403


# ---------------- 数据统计 ----------------
def test_admin_stats_overview(client):
    create_user("adm5", "admin123", Role.admin)
    admin_token = login(client, "adm5", "admin123")
    owner, _ = register(client, "statowner")
    new_item(client, owner, direction="lost")
    new_item(client, owner, direction="found")

    r = client.get("/api/v1/admin/stats", headers=auth(admin_token))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["lost_count"] >= 1
    assert body["found_count"] >= 1
    assert "recovery_rate" in body
    assert isinstance(body["by_category"], list)
    assert isinstance(body["by_status"], list)


def test_stats_excludes_deleted(client):
    create_user("adm6", "admin123", Role.admin)
    admin_token = login(client, "adm6", "admin123")
    owner, _ = register(client, "statdel")
    item_id = new_item(client, owner, direction="lost")
    before = client.get("/api/v1/admin/stats", headers=auth(admin_token)).json()["lost_count"]
    assert client.delete(f"/api/v1/items/{item_id}", headers=auth(owner)).status_code == 200
    after = client.get("/api/v1/admin/stats", headers=auth(admin_token)).json()["lost_count"]
    assert after == before - 1