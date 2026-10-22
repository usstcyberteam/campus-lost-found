import uuid

import pytest
from sqlalchemy.exc import IntegrityError

from app.database import SessionLocal
from app.models import HelperStatus, ItemHelper


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


def test_take_and_abandon_helper(client):
    owner, _ = register(client, "help_owner")
    helper, _ = register(client, "help_helper")
    item = create_item(client, owner)

    taken = client.post(f"/api/v1/items/{item['id']}/helpers", headers=auth(helper))
    assert taken.status_code == 200
    assert taken.json() == {"helper_count": 1, "is_helper": True}

    detail = client.get(f"/api/v1/items/{item['id']}", headers=auth(owner)).json()
    assert detail["helper_count"] == 1
    assert detail["is_helper"] is False
    assert [row["display_name"] for row in detail["helpers"]] == ["help_helper"]
    assert detail["helpers"][0]["title"] == "见习寻物人"

    again = client.post(f"/api/v1/items/{item['id']}/helpers", headers=auth(helper))
    assert again.status_code == 409

    abandoned = client.delete(f"/api/v1/items/{item['id']}/helpers", headers=auth(helper))
    assert abandoned.status_code == 200
    assert abandoned.json() == {"helper_count": 0, "is_helper": False}
    assert client.get(f"/api/v1/items/{item['id']}", headers=auth(owner)).json()["helpers"] == []

    repeated = client.delete(f"/api/v1/items/{item['id']}/helpers", headers=auth(helper))
    assert repeated.status_code == 409


def test_take_helper_permissions_and_states(client):
    owner, _ = register(client, "help_guard_owner")
    other, _ = register(client, "help_guard_other")
    lost = create_item(client, owner)
    found = create_item(client, owner, direction="found", title="捡到的伞")

    own = client.post(f"/api/v1/items/{lost['id']}/helpers", headers=auth(owner))
    assert own.status_code == 403

    unavailable = client.post(f"/api/v1/items/{found['id']}/helpers", headers=auth(other))
    assert unavailable.status_code == 409

    missing = uuid.uuid4()
    assert client.post(f"/api/v1/items/{missing}/helpers", headers=auth(other)).status_code == 404
    assert client.delete(f"/api/v1/items/{missing}/helpers", headers=auth(other)).status_code == 404
    assert client.post(f"/api/v1/items/{lost['id']}/helpers").status_code == 401
    assert client.delete(f"/api/v1/items/{lost['id']}/helpers").status_code == 401


def test_thank_awards_points_once(client):
    owner, _ = register(client, "thank_owner")
    helper, _ = register(client, "thank_helper")
    other, _ = register(client, "thank_other")
    item = create_item(client, owner)
    helper_id = client.post(f"/api/v1/items/{item['id']}/helpers", headers=auth(helper)).json()
    assert helper_id["helper_count"] == 1
    helper_rows = client.get(f"/api/v1/items/{item['id']}", headers=auth(owner)).json()["helpers"]

    early = client.post(
        f"/api/v1/items/{item['id']}/thank",
        json={"helper_ids": [helper_rows[0]["id"]]},
        headers=auth(owner),
    )
    assert early.status_code == 409

    assert client.post(f"/api/v1/items/{item['id']}/mark-found", headers=auth(owner)).status_code == 200

    forbidden = client.post(
        f"/api/v1/items/{item['id']}/thank",
        json={"helper_ids": [helper_rows[0]["id"]]},
        headers=auth(other),
    )
    assert forbidden.status_code == 403

    thanked = client.post(
        f"/api/v1/items/{item['id']}/thank",
        json={"helper_ids": [helper_rows[0]["id"]]},
        headers=auth(owner),
    )
    assert thanked.status_code == 200
    assert thanked.json()["thanked_count"] == 1

    points = client.get("/api/v1/me/points", headers=auth(helper)).json()
    assert points["total"] == 20
    assert points["title"] == "热心同学"
    assert points["records"]["items"][0]["reason"] == "thank"
    assert points["records"]["items"][0]["amount"] == 20

    repeated = client.post(
        f"/api/v1/items/{item['id']}/thank",
        json={"helper_ids": [helper_rows[0]["id"]]},
        headers=auth(owner),
    )
    assert repeated.status_code == 200
    assert client.get("/api/v1/me/points", headers=auth(helper)).json()["total"] == 20

    detail = client.get(f"/api/v1/items/{item['id']}", headers=auth(owner)).json()
    assert detail["helpers"][0]["thanked"] is True
    assert detail["helpers"][0]["title"] == "热心同学"


def test_thank_rejects_invalid_helper_selection(client):
    owner, _ = register(client, "thank_invalid_owner")
    item = create_item(client, owner)
    assert client.post(f"/api/v1/items/{item['id']}/mark-found", headers=auth(owner)).status_code == 200

    unknown = client.post(
        f"/api/v1/items/{item['id']}/thank",
        json={"helper_ids": [str(uuid.uuid4())]},
        headers=auth(owner),
    )
    assert unknown.status_code == 409

    empty = client.post(f"/api/v1/items/{item['id']}/thank", json={"helper_ids": []}, headers=auth(owner))
    assert empty.status_code == 400

    too_many = client.post(
        f"/api/v1/items/{item['id']}/thank",
        json={"helper_ids": [str(uuid.uuid4()) for _ in range(4)]},
        headers=auth(owner),
    )
    assert too_many.status_code == 400


def helper_rows(item_id: str, user_id: str) -> list[ItemHelper]:
    with SessionLocal() as db:
        return (
            db.query(ItemHelper)
            .filter(ItemHelper.item_id == uuid.UUID(item_id), ItemHelper.user_id == uuid.UUID(user_id))
            .all()
        )


def test_take_helper_twice_keeps_single_record(client):
    owner, _ = register(client, "dup_owner")
    helper, helper_id = register(client, "dup_helper")
    item = create_item(client, owner)

    first = client.post(f"/api/v1/items/{item['id']}/helpers", headers=auth(helper))
    assert first.status_code == 200
    assert first.json() == {"helper_count": 1, "is_helper": True}

    second = client.post(f"/api/v1/items/{item['id']}/helpers", headers=auth(helper))
    assert second.status_code == 409
    assert second.json() == {"code": "STATE_CONFLICT", "message": "已接取该委托"}

    rows = helper_rows(item["id"], helper_id)
    assert len(rows) == 1
    assert rows[0].status == HelperStatus.active
    assert rows[0].thanked is False

    mine = client.get("/api/v1/me/helping", headers=auth(helper)).json()
    assert mine["total"] == 1
    assert mine["items"][0]["helper_count"] == 1
    assert mine["items"][0]["is_helper"] is True

    detail = client.get(f"/api/v1/items/{item['id']}", headers=auth(owner)).json()
    assert detail["helper_count"] == 1
    assert len(detail["helpers"]) == 1


def test_item_helper_unique_constraint_rejects_duplicate_row(client):
    owner, _ = register(client, "dup_constraint_owner")
    helper, helper_id = register(client, "dup_constraint_helper")
    item = create_item(client, owner)
    assert client.post(f"/api/v1/items/{item['id']}/helpers", headers=auth(helper)).status_code == 200

    with SessionLocal() as db:
        db.add(
            ItemHelper(
                item_id=uuid.UUID(item["id"]),
                user_id=uuid.UUID(helper_id),
                status=HelperStatus.abandoned,
            )
        )
        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()
        assert db.query(ItemHelper).count() == 1

    rows = helper_rows(item["id"], helper_id)
    assert len(rows) == 1
    assert rows[0].status == HelperStatus.active

    assert client.get("/api/v1/me/helping", headers=auth(helper)).json()["total"] == 1


def test_take_helper_after_abandon_restores_record(client):
    owner, _ = register(client, "retake_owner")
    helper, helper_id = register(client, "retake_helper")
    item = create_item(client, owner)

    first = client.post(f"/api/v1/items/{item['id']}/helpers", headers=auth(helper))
    assert first.json() == {"helper_count": 1, "is_helper": True}
    before = helper_rows(item["id"], helper_id)
    assert len(before) == 1
    previous_id = before[0].id
    previous_created_at = before[0].created_at

    abandoned = client.delete(f"/api/v1/items/{item['id']}/helpers", headers=auth(helper))
    assert abandoned.json() == {"helper_count": 0, "is_helper": False}
    assert helper_rows(item["id"], helper_id)[0].status == HelperStatus.abandoned

    again = client.post(f"/api/v1/items/{item['id']}/helpers", headers=auth(helper))
    assert again.status_code == 200
    assert again.json() == {"helper_count": 1, "is_helper": True}

    after = helper_rows(item["id"], helper_id)
    assert len(after) == 1
    assert after[0].id == previous_id
    assert after[0].status == HelperStatus.active
    assert after[0].thanked is False
    assert after[0].created_at > previous_created_at

    detail = client.get(f"/api/v1/items/{item['id']}", headers=auth(owner)).json()
    assert detail["helper_count"] == 1
    assert [row["display_name"] for row in detail["helpers"]] == ["retake_helper"]

    mine = client.get("/api/v1/me/helping", headers=auth(helper)).json()
    assert mine["total"] == 1
    assert mine["items"][0]["helper_status"] == "active"
    assert mine["items"][0]["helper_count"] == 1
    assert mine["items"][0]["is_helper"] is True

    assert client.delete(f"/api/v1/items/{item['id']}/helpers", headers=auth(helper)).status_code == 200


def test_take_helper_after_abandon_rejects_closed_item(client):
    owner, _ = register(client, "retake_closed_owner")
    helper, helper_id = register(client, "retake_closed_helper")
    item = create_item(client, owner)
    assert client.post(f"/api/v1/items/{item['id']}/helpers", headers=auth(helper)).status_code == 200
    assert client.delete(f"/api/v1/items/{item['id']}/helpers", headers=auth(helper)).status_code == 200
    assert client.post(f"/api/v1/items/{item['id']}/mark-found", headers=auth(owner)).status_code == 200

    closed = client.post(f"/api/v1/items/{item['id']}/helpers", headers=auth(helper))
    assert closed.status_code == 409
    assert closed.json() == {"code": "STATE_CONFLICT", "message": "该记录当前不可接取"}

    rows = helper_rows(item["id"], helper_id)
    assert len(rows) == 1
    assert rows[0].status == HelperStatus.abandoned
