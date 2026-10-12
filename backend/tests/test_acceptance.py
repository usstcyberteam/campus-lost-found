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


def register(client, username: str) -> str:
    r = client.post("/api/v1/auth/register", json={"username": username, "password": "secret123", "display_name": username})
    assert r.status_code == 200
    return r.json()["token"]


def login(client, username: str, password: str) -> str:
    r = client.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200
    return r.json()["token"]


def test_register_defaults_to_student(client):
    token = register(client, "stu1")
    r = client.get("/api/v1/auth/me", headers=auth(token))
    assert r.status_code == 200
    assert r.json()["role"] == "student"


def test_self_register_cannot_become_staff(client):
    r = client.post("/api/v1/auth/register", json={"username": "selfreg", "password": "secret123", "display_name": "X", "role": "staff"})
    assert r.status_code == 200
    assert r.json()["role"] == "student"


def test_private_fields_not_in_public_list(client):
    token = register(client, "owner")
    r = client.post("/api/v1/items", json={"direction": "found", "category": "雨伞", "title": "黑伞", "precise_location": "图书馆3楼角落"}, headers=auth(token))
    assert r.status_code == 200
    other = register(client, "viewer")
    r = client.get("/api/v1/items", headers=auth(other))
    item = r.json()[0]
    assert "precise_location" not in item


def test_student_cannot_review(client):
    create_user("staff1", "staff123", Role.staff)
    t_staff = login(client, "staff1", "staff123")
    t_founder = register(client, "founder")
    r = client.post("/api/v1/items", json={"direction": "found", "category": "雨伞", "title": "黑伞"}, headers=auth(t_founder))
    found_id = r.json()["id"]
    t_owner = register(client, "owner")
    r = client.post("/api/v1/claims", json={"found_item_id": found_id, "evidence": [{"kind": "text", "content": "划痕"}], "idempotency_key": "k1"}, headers=auth(t_owner))
    claim_id = r.json()["id"]
    r = client.post(f"/api/v1/claims/{claim_id}/review", json={"approve": True}, headers=auth(t_owner))
    assert r.status_code == 403


def test_return_once_and_conflict(client):
    create_user("staff1", "staff123", Role.staff)
    t_staff = login(client, "staff1", "staff123")
    t_founder = register(client, "founder")
    r = client.post("/api/v1/items", json={"direction": "found", "category": "雨伞", "title": "黑伞"}, headers=auth(t_founder))
    found_id = r.json()["id"]
    t_owner = register(client, "owner")
    r = client.post("/api/v1/items", json={"direction": "lost", "category": "雨伞", "title": "丢伞"}, headers=auth(t_owner))
    lost_id = r.json()["id"]

    r = client.post("/api/v1/claims", json={"found_item_id": found_id, "lost_item_id": lost_id, "evidence": [{"kind": "text", "content": "划痕"}], "idempotency_key": "k1"}, headers=auth(t_owner))
    claim_id = r.json()["id"]

    r = client.post(f"/api/v1/claims/{claim_id}/review", json={"approve": True}, headers=auth(t_staff))
    assert r.status_code == 200
    r = client.post(f"/api/v1/claims/{claim_id}/complete", headers=auth(t_staff))
    assert r.status_code == 200
    r = client.post(f"/api/v1/claims/{claim_id}/complete", headers=auth(t_staff))
    assert r.status_code == 409


def test_ticket_visibility_and_route_authorization(client):
    create_user("staff1", "staff123", Role.staff)
    t_staff = login(client, "staff1", "staff123")
    t_owner = register(client, "owner")
    t_other = register(client, "other")

    r = client.post("/api/v1/items", json={"direction": "lost", "category": "卡", "title": "校园卡"}, headers=auth(t_owner))
    lost_id = r.json()["id"]

    r = client.post("/api/v1/tickets", json={"item_id": lost_id}, headers=auth(t_other))
    assert r.status_code == 403

    r = client.post("/api/v1/tickets", json={"item_id": lost_id}, headers=auth(t_owner))
    assert r.status_code == 200
    ticket_id = r.json()["id"]

    r = client.get(f"/api/v1/tickets/{ticket_id}/route", headers=auth(t_staff))
    assert r.status_code == 403

    r = client.post(f"/api/v1/tickets/{ticket_id}/assign", headers=auth(t_staff))
    assert r.status_code == 200
    r = client.get(f"/api/v1/tickets/{ticket_id}/route", headers=auth(t_staff))
    assert r.status_code == 403

    r = client.post(f"/api/v1/tickets/{ticket_id}/authorize-route", headers=auth(t_owner))
    assert r.status_code == 200
    r = client.get(f"/api/v1/tickets/{ticket_id}/route", headers=auth(t_staff))
    assert r.status_code == 200