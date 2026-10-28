"""管理员删帖治理接口：权限（401/403）、软删除留痕、审计日志、批量删除。"""

import uuid as uuid_mod

from app.database import SessionLocal
from app.models import AuditLog, Item, ItemStatus, Role, User
from tests.test_admin_features import auth, create_user, login, new_item, register


def make_admin(client, username: str) -> tuple[str, str]:
    create_user(username, "adminpass123", Role.admin)
    admin_id = None
    db = SessionLocal()
    try:
        admin_id = db.query(User).filter(User.username == username).first().id
    finally:
        db.close()
    return login(client, username, "adminpass123"), str(admin_id)


def db_item(item_id: str) -> Item | None:
    db = SessionLocal()
    try:
        return db.get(Item, uuid_mod.UUID(item_id))
    finally:
        db.close()


def audit_rows(item_id: str) -> list[AuditLog]:
    db = SessionLocal()
    try:
        return db.query(AuditLog).filter(AuditLog.item_id == uuid_mod.UUID(item_id)).all()
    finally:
        db.close()


def test_admin_delete_requires_login(client):
    token, _ = register(client, "adel_anon")
    item_id = new_item(client, token)
    r = client.delete(f"/api/v1/admin/posts/{item_id}")
    assert r.status_code == 401
    assert r.json()["code"] == "UNAUTH"


def test_admin_delete_rejects_student(client):
    token, _ = register(client, "adel_stu")
    item_id = new_item(client, token)
    r = client.delete(f"/api/v1/admin/posts/{item_id}", headers=auth(token))
    assert r.status_code == 403
    assert r.json()["code"] == "FORBIDDEN"


def test_admin_delete_rejects_staff(client):
    create_user("adel_staff", "staff123", Role.staff)
    staff_token = login(client, "adel_staff", "staff123")
    token, _ = register(client, "adel_stu2")
    item_id = new_item(client, token)
    r = client.delete(f"/api/v1/admin/posts/{item_id}", headers=auth(staff_token))
    assert r.status_code == 403


def test_admin_soft_deletes_others_item_with_trail_and_audit(client):
    admin_token, admin_id = make_admin(client, "adel_admin1")
    owner_token, owner_id = register(client, "adel_owner1")
    item_id = new_item(client, owner_token)

    r = client.delete(f"/api/v1/admin/posts/{item_id}", headers=auth(admin_token))
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "deleted"

    item = db_item(item_id)
    assert item.status == ItemStatus.deleted
    assert item.deleted_at is not None
    assert str(item.deleted_by_id) == admin_id

    rows = audit_rows(item_id)
    assert len(rows) == 1
    assert rows[0].action == "soft_delete"
    assert str(rows[0].operator_user_id) == admin_id

    listing = client.get("/api/v1/items", headers=auth(owner_token)).json()["items"]
    assert all(entry["id"] != item_id for entry in listing)


def test_admin_delete_missing_post_returns_404(client):
    admin_token, _ = make_admin(client, "adel_admin2")
    r = client.delete("/api/v1/admin/posts/00000000-0000-0000-0000-000000000000", headers=auth(admin_token))
    assert r.status_code == 404


def test_batch_delete_mixed_results(client):
    admin_token, _ = make_admin(client, "adel_admin3")
    owner_token, _ = register(client, "adel_owner3")
    first = new_item(client, owner_token)
    second = new_item(client, owner_token)

    r = client.post(
        "/api/v1/admin/posts/batch-delete",
        json={"post_ids": [first, second, "00000000-0000-0000-0000-000000000000"]},
        headers=auth(admin_token),
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["deleted"] == 2
    by_id = {entry["post_id"]: entry for entry in body["results"]}
    assert by_id[first]["deleted"] is True
    assert by_id[second]["deleted"] is True
    assert by_id["00000000-0000-0000-0000-000000000000"]["deleted"] is False
    assert by_id["00000000-0000-0000-0000-000000000000"]["reason"]

    listing = client.get("/api/v1/items", headers=auth(owner_token)).json()["items"]
    assert all(entry["id"] not in (first, second) for entry in listing)
    assert len(audit_rows(first)) == 1
    assert len(audit_rows(second)) == 1


def test_batch_delete_rejects_student_and_empty_list(client):
    token, _ = register(client, "adel_stu4")
    item_id = new_item(client, token)
    r = client.post(
        "/api/v1/admin/posts/batch-delete",
        json={"post_ids": [item_id]},
        headers=auth(token),
    )
    assert r.status_code == 403

    admin_token, _ = make_admin(client, "adel_admin4")
    r = client.post("/api/v1/admin/posts/batch-delete", json={"post_ids": []}, headers=auth(admin_token))
    assert r.status_code == 400


def test_owner_delete_via_items_route_also_trails(client):
    token, user_id = register(client, "adel_owner5")
    item_id = new_item(client, token)
    r = client.delete(f"/api/v1/items/{item_id}", headers=auth(token))
    assert r.status_code == 200
    item = db_item(item_id)
    assert item.deleted_at is not None
    assert str(item.deleted_by_id) == user_id
    assert len(audit_rows(item_id)) == 1
