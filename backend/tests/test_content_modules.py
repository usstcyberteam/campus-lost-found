from app.core.security import hash_password
from app.database import SessionLocal
from app.models import Role, User


def create_user(username: str, password: str, role: Role) -> str:
    db = SessionLocal()
    user = User(username=username, password_hash=hash_password(password), role=role, display_name=username)
    db.add(user)
    db.commit()
    db.refresh(user)
    user_id = str(user.id)
    db.close()
    return user_id


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


def new_item(client, token: str, title: str = "公告测试帖") -> str:
    r = client.post(
        "/api/v1/items", json={"direction": "lost", "category": "雨伞", "title": title}, headers=auth(token)
    )
    assert r.status_code == 200, r.text
    return r.json()["id"]


# ---------------- 公告 ----------------
def test_admin_seeds_and_student_reads_announcement(client):
    create_user("ann_admin", "admin123", Role.admin)
    admin = login(client, "ann_admin", "admin123")
    stu, _ = register(client, "ann_stu")

    r = client.post(
        "/api/v1/announcements",
        json={"title": "失物招领处开放时间", "content": "工作日 9:00-17:00", "is_pinned": True},
        headers=auth(admin),
    )
    assert r.status_code == 200, r.text
    ann_id = r.json()["id"]

    listing = client.get("/api/v1/announcements", headers=auth(stu))
    assert listing.status_code == 200
    assert any(a["id"] == ann_id for a in listing.json()["items"])

    student_create = client.post("/api/v1/announcements", json={"title": "越权", "content": "x"}, headers=auth(stu))
    assert student_create.status_code == 403


def test_announcement_favorite_flow(client):
    create_user("ann_admin2", "admin123", Role.admin)
    admin = login(client, "ann_admin2", "admin123")
    stu, _ = register(client, "ann_fav")

    ann_id = client.post(
        "/api/v1/announcements", json={"title": "公告A", "content": "内容"}, headers=auth(admin)
    ).json()["id"]

    favorited = client.post(f"/api/v1/announcements/{ann_id}/favorite", headers=auth(stu))
    assert favorited.status_code == 200
    assert favorited.json()["is_favorited"] is True
    assert favorited.json()["favorite_count"] == 1

    # 幂等：重复收藏不重复计数
    again = client.post(f"/api/v1/announcements/{ann_id}/favorite", headers=auth(stu)).json()
    assert again["favorite_count"] == 1

    mine = client.get("/api/v1/me/announcement-favorites", headers=auth(stu)).json()
    assert any(item["id"] == ann_id for item in mine["items"])

    unfav = client.delete(f"/api/v1/announcements/{ann_id}/favorite", headers=auth(stu)).json()
    assert unfav["is_favorited"] is False
    assert unfav["favorite_count"] == 0


def test_announcement_update_and_delete(client):
    create_user("ann_admin3", "admin123", Role.admin)
    admin = login(client, "ann_admin3", "admin123")
    ann_id = client.post(
        "/api/v1/announcements", json={"title": "旧标题", "content": "内容"}, headers=auth(admin)
    ).json()["id"]

    updated = client.patch(
        f"/api/v1/announcements/{ann_id}", json={"title": "新标题", "is_pinned": True}, headers=auth(admin)
    )
    assert updated.status_code == 200
    assert updated.json()["title"] == "新标题"
    assert updated.json()["is_pinned"] is True

    assert client.delete(f"/api/v1/announcements/{ann_id}", headers=auth(admin)).status_code == 200
    assert client.get(f"/api/v1/announcements/{ann_id}", headers=auth(admin)).status_code == 404


# ---------------- 评论审核 ----------------
def test_comment_moderation_hide_and_restore(client):
    create_user("mod_staff", "staff123", Role.staff)
    staff = login(client, "mod_staff", "staff123")
    owner, _ = register(client, "mod_owner")
    item_id = new_item(client, owner)

    created = client.post(f"/api/v1/items/{item_id}/comments", json={"content": "含不当内容"}, headers=auth(owner))
    assert created.status_code == 200
    comment_id = created.json()["id"]

    assert client.post(f"/api/v1/comments/{comment_id}/hide", headers=auth(staff)).status_code == 200
    visible = client.get(f"/api/v1/items/{item_id}/comments", headers=auth(owner)).json()["items"]
    assert all(c["id"] != comment_id for c in visible)

    moderated = client.get("/api/v1/comments/moderation?hidden=true", headers=auth(staff))
    assert moderated.status_code == 200
    assert any(c["id"] == comment_id and c["is_hidden"] for c in moderated.json()["items"])

    assert client.post(f"/api/v1/comments/{comment_id}/unhide", headers=auth(staff)).status_code == 200
    restored = client.get(f"/api/v1/items/{item_id}/comments", headers=auth(owner)).json()["items"]
    assert any(c["id"] == comment_id for c in restored)


def test_student_cannot_moderate_comments(client):
    owner, _ = register(client, "mod_stu1")
    other, _ = register(client, "mod_stu2")
    item_id = new_item(client, owner)
    comment_id = client.post(
        f"/api/v1/items/{item_id}/comments", json={"content": "普通评论"}, headers=auth(owner)
    ).json()["id"]

    assert client.post(f"/api/v1/comments/{comment_id}/hide", headers=auth(other)).status_code == 403
    assert client.get("/api/v1/comments/moderation", headers=auth(other)).status_code == 403


# ---------------- 表扬墙 ----------------
def test_praise_create_list_edit_delete(client):
    author, author_id = register(client, "pra_author")
    target, target_id = register(client, "pra_target")

    created = client.post(
        "/api/v1/praises",
        json={"to_user_id": target_id, "content": "帮我找回了钱包，非常感谢！"},
        headers=auth(author),
    )
    assert created.status_code == 200, created.text
    praise_id = created.json()["id"]
    assert created.json()["can_edit"] is True
    assert created.json()["to_name"] == "pra_target"

    listing = client.get("/api/v1/praises", headers=auth(target)).json()["items"]
    row = next(p for p in listing if p["id"] == praise_id)
    assert row["can_edit"] is False

    updated = client.patch(f"/api/v1/praises/{praise_id}", json={"content": "改后的致谢"}, headers=auth(author))
    assert updated.status_code == 200
    assert updated.json()["content"] == "改后的致谢"

    assert client.delete(f"/api/v1/praises/{praise_id}", headers=auth(author)).status_code == 200
    assert client.patch(f"/api/v1/praises/{praise_id}", json={"content": "x"}, headers=auth(author)).status_code == 404


def test_praise_rejects_self_and_unknown_user(client):
    author, author_id = register(client, "pra_self")
    self_praise = client.post(
        "/api/v1/praises",
        json={"to_user_id": author_id, "content": "自夸"},
        headers=auth(author),
    )
    assert self_praise.status_code == 409

    unknown = client.post(
        "/api/v1/praises",
        json={"to_user_id": "00000000-0000-0000-0000-000000000000", "content": "x"},
        headers=auth(author),
    )
    assert unknown.status_code == 404


def test_third_party_cannot_edit_others_praise(client):
    author, _ = register(client, "pra_a2")
    target, target_id = register(client, "pra_t2")
    other, _ = register(client, "pra_o2")
    praise_id = client.post(
        "/api/v1/praises", json={"to_user_id": target_id, "content": "x"}, headers=auth(author)
    ).json()["id"]

    denied = client.patch(f"/api/v1/praises/{praise_id}", json={"content": "篡改"}, headers=auth(other))
    assert denied.status_code == 403
    assert client.delete(f"/api/v1/praises/{praise_id}", headers=auth(other)).status_code == 403

    create_user("pra_admin", "admin123", Role.admin)
    admin = login(client, "pra_admin", "admin123")
    assert client.delete(f"/api/v1/praises/{praise_id}", headers=auth(admin)).status_code == 200
