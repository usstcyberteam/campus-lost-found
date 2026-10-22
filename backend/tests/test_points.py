import uuid

from app.database import SessionLocal
from app.models import PointReason, Role
from app.services import points_service
from tests.test_acceptance import auth, create_user, login, register


def register_with_id(client, username: str) -> tuple[str, uuid.UUID]:
    token = register(client, username)
    me = client.get("/api/v1/auth/me", headers=auth(token)).json()
    return token, uuid.UUID(me["id"])


def award(user_id: uuid.UUID, amount: int, reason: PointReason = PointReason.thank) -> uuid.UUID:
    ref_id = uuid.uuid4()
    db = SessionLocal()
    assert points_service.add(db, user_id, reason, amount, ref_id) is True
    db.commit()
    db.close()
    return ref_id


def test_points_titles_and_next_threshold(client):
    token, user_id = register_with_id(client, "points_title")

    empty = client.get("/api/v1/me/points", headers=auth(token)).json()
    assert empty["total"] == 0
    assert empty["title"] == "见习寻物人"
    assert empty["next_title"] == "热心同学"
    assert empty["next_threshold"] == 20

    award(user_id, 20)
    first = client.get("/api/v1/me/points", headers=auth(token)).json()
    assert first["total"] == 20
    assert first["title"] == "热心同学"
    assert first["next_title"] == "寻物能手"
    assert first["next_threshold"] == 60

    award(user_id, 40)
    second = client.get("/api/v1/me/points", headers=auth(token)).json()
    assert second["total"] == 60
    assert second["title"] == "寻物能手"
    assert second["next_title"] == "校园守护者"
    assert second["next_threshold"] == 150

    award(user_id, 90)
    third = client.get("/api/v1/me/points", headers=auth(token)).json()
    assert third["title"] == "校园守护者"
    award(user_id, 150)
    top = client.get("/api/v1/me/points", headers=auth(token)).json()
    assert top["total"] == 300
    assert top["title"] == "寻物传说"
    assert top["next_title"] is None
    assert top["next_threshold"] is None


def test_points_record_unique_and_paginated(client):
    token, user_id = register_with_id(client, "points_unique")
    ref_id = uuid.uuid4()
    db = SessionLocal()
    assert points_service.add(db, user_id, PointReason.thank, 20, ref_id) is True
    db.commit()
    assert points_service.add(db, user_id, PointReason.thank, 20, ref_id) is False
    db.commit()
    db.close()

    award(user_id, 15, PointReason.return_)
    page = client.get("/api/v1/me/points?limit=1&offset=0", headers=auth(token)).json()
    assert page["total"] == 35
    assert page["records"]["total"] == 2
    assert page["records"]["limit"] == 1
    assert len(page["records"]["items"]) == 1
    second = client.get("/api/v1/me/points?limit=1&offset=1", headers=auth(token)).json()
    assert len(second["records"]["items"]) == 1

    # 两条记录 created_at 可能相同，顺序由 id 兜底，只断言分页合起来完整且不重复
    reasons = [row["reason"] for row in page["records"]["items"] + second["records"]["items"]]
    assert sorted(reasons) == ["return", "thank"]
    assert len(reasons) == len(set(reasons))

    assert client.get("/api/v1/me/points").status_code == 401


def test_return_awards_finder(client):
    create_user("points_staff", "staff123", Role.staff)
    staff = login(client, "points_staff", "staff123")
    founder, _ = register_with_id(client, "points_founder")
    owner, _ = register_with_id(client, "points_owner")

    found = client.post(
        "/api/v1/items",
        json={"direction": "found", "category": "雨伞", "title": "捡到的伞"},
        headers=auth(founder),
    ).json()
    lost = client.post(
        "/api/v1/items",
        json={"direction": "lost", "category": "雨伞", "title": "丢伞"},
        headers=auth(owner),
    ).json()
    claim = client.post(
        "/api/v1/claims",
        json={
            "found_item_id": found["id"],
            "lost_item_id": lost["id"],
            "evidence": [{"kind": "text", "content": "伞柄划痕"}],
            "idempotency_key": "points-return-1",
        },
        headers=auth(owner),
    ).json()
    assert (
        client.post(f"/api/v1/claims/{claim['id']}/review", json={"approve": True}, headers=auth(staff)).status_code
        == 200
    )
    assert client.post(f"/api/v1/claims/{claim['id']}/complete", headers=auth(staff)).status_code == 200

    points = client.get("/api/v1/me/points", headers=auth(founder)).json()
    assert points["total"] == 15
    assert points["records"]["items"][0]["reason"] == "return"
    assert points["records"]["items"][0]["amount"] == 15
    assert client.get("/api/v1/me/points", headers=auth(owner)).json()["total"] == 0


def test_ticket_feedback_awards_staff(client):
    create_user("points_ticket_staff", "staff123", Role.staff)
    staff = login(client, "points_ticket_staff", "staff123")
    owner, _ = register_with_id(client, "points_ticket_owner")
    item = client.post(
        "/api/v1/items",
        json={"direction": "lost", "category": "钥匙", "title": "丢失钥匙"},
        headers=auth(owner),
    ).json()
    ticket = client.post("/api/v1/tickets", json={"item_id": item["id"]}, headers=auth(owner)).json()
    assert client.post(f"/api/v1/tickets/{ticket['id']}/assign", headers=auth(staff)).status_code == 200
    assert (
        client.post(
            f"/api/v1/tickets/{ticket['id']}/feedback",
            json={"result": "已协助查看监控"},
            headers=auth(staff),
        ).status_code
        == 200
    )

    points = client.get("/api/v1/me/points", headers=auth(staff)).json()
    assert points["total"] == 10
    assert points["title"] == "见习寻物人"
    assert points["records"]["items"][0]["reason"] == "ticket_feedback"
