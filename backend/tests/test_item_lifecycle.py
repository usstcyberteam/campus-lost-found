import uuid

from app.database import SessionLocal
from app.models import Building, Claim, ClaimStatus, Item, ItemStatus


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def register(client, username: str) -> str:
    r = client.post(
        "/api/v1/auth/register",
        json={"username": username, "password": "secret123", "display_name": username},
    )
    assert r.status_code == 200
    return r.json()["token"]


def create_item(client, token: str, direction: str = "lost", **extra) -> dict:
    payload = {"direction": direction, "category": "钥匙", "title": "一串钥匙"} | extra
    r = client.post("/api/v1/items", json=payload, headers=auth(token))
    assert r.status_code == 200
    return r.json()


def create_building(code: str = "LIB", name: str = "图书馆", floors: int = 3) -> str:
    db = SessionLocal()
    building = Building(code=code, name=name, category="图书馆", floors=floors)
    db.add(building)
    db.commit()
    building_id = str(building.id)
    db.close()
    return building_id


def add_claim(found_item_id: str, applicant_id: str, status: ClaimStatus, lost_item_id: str | None = None) -> None:
    db = SessionLocal()
    db.add(
        Claim(
            found_item_id=uuid.UUID(found_item_id),
            lost_item_id=uuid.UUID(lost_item_id) if lost_item_id else None,
            applicant_user_id=uuid.UUID(applicant_id),
            status=status,
            idempotency_key=uuid.uuid4().hex,
        )
    )
    db.commit()
    db.close()


def set_status(item_id: str, status: ItemStatus) -> None:
    db = SessionLocal()
    item = db.get(Item, uuid.UUID(item_id))
    assert item is not None
    item.status = status
    db.commit()
    db.close()


def me(client, token: str) -> dict:
    r = client.get("/api/v1/auth/me", headers=auth(token))
    assert r.status_code == 200
    return r.json()


def test_owner_can_withdraw_lost_item(client):
    token = register(client, "withdraw_owner")
    item = create_item(client, token)
    r = client.post(f"/api/v1/items/{item['id']}/withdraw", headers=auth(token))
    assert r.status_code == 200
    assert r.json()["status"] == "withdrawn"
    detail = client.get(f"/api/v1/items/{item['id']}", headers=auth(token)).json()
    assert detail["status"] == "withdrawn"


def test_owner_can_mark_lost_item_found(client):
    token = register(client, "found_owner")
    item = create_item(client, token)
    r = client.post(f"/api/v1/items/{item['id']}/mark-found", headers=auth(token))
    assert r.status_code == 200
    assert r.json()["status"] == "found"


def test_non_owner_cannot_withdraw_or_mark_found(client):
    owner = register(client, "lifecycle_owner")
    other = register(client, "lifecycle_other")
    item = create_item(client, owner)
    assert client.post(f"/api/v1/items/{item['id']}/withdraw", headers=auth(other)).status_code == 403
    assert client.post(f"/api/v1/items/{item['id']}/mark-found", headers=auth(other)).status_code == 403


def test_lifecycle_requires_login(client):
    owner = register(client, "lifecycle_anon")
    item = create_item(client, owner)
    assert client.post(f"/api/v1/items/{item['id']}/withdraw").status_code == 401
    assert client.post(f"/api/v1/items/{item['id']}/mark-found").status_code == 401


def test_terminal_status_cannot_change_again(client):
    token = register(client, "lifecycle_terminal")
    item = create_item(client, token)
    assert client.post(f"/api/v1/items/{item['id']}/mark-found", headers=auth(token)).status_code == 200
    assert client.post(f"/api/v1/items/{item['id']}/withdraw", headers=auth(token)).status_code == 409
    assert client.post(f"/api/v1/items/{item['id']}/mark-found", headers=auth(token)).status_code == 409


def test_withdraw_twice_conflicts(client):
    token = register(client, "lifecycle_twice")
    item = create_item(client, token)
    assert client.post(f"/api/v1/items/{item['id']}/withdraw", headers=auth(token)).status_code == 200
    assert client.post(f"/api/v1/items/{item['id']}/withdraw", headers=auth(token)).status_code == 409


def test_mark_found_rejects_found_direction(client):
    token = register(client, "lifecycle_found_dir")
    item = create_item(client, token, direction="found")
    r = client.post(f"/api/v1/items/{item['id']}/mark-found", headers=auth(token))
    assert r.status_code == 409


def test_mark_found_rejects_approved_claim(client):
    token = register(client, "lifecycle_claim")
    user = me(client, token)
    lost = create_item(client, token)
    found = create_item(client, token, direction="found")
    add_claim(found["id"], user["id"], ClaimStatus.approved, lost["id"])
    r = client.post(f"/api/v1/items/{lost['id']}/mark-found", headers=auth(token))
    assert r.status_code == 409


def test_withdraw_reviewing_with_approved_claim_conflicts(client):
    token = register(client, "lifecycle_review")
    user = me(client, token)
    lost = create_item(client, token)
    found = create_item(client, token, direction="found")
    set_status(lost["id"], ItemStatus.reviewing)
    add_claim(found["id"], user["id"], ClaimStatus.approved, lost["id"])
    r = client.post(f"/api/v1/items/{lost['id']}/withdraw", headers=auth(token))
    assert r.status_code == 409


def test_withdraw_reviewing_without_claim_succeeds(client):
    token = register(client, "lifecycle_review_ok")
    item = create_item(client, token)
    set_status(item["id"], ItemStatus.reviewing)
    r = client.post(f"/api/v1/items/{item['id']}/withdraw", headers=auth(token))
    assert r.status_code == 200
    assert r.json()["status"] == "withdrawn"


def test_item_card_returns_building_and_counts(client):
    token = register(client, "lifecycle_card")
    building_id = create_building()
    create_item(client, token, building_id=building_id, floor=2)
    r = client.get("/api/v1/items", headers=auth(token))
    assert r.status_code == 200
    item = r.json()["items"][0]
    assert item["building_id"] == building_id
    assert item["building_name"] == "图书馆"
    assert item["floor"] == 2
    assert item["like_count"] == 0
    assert item["comment_count"] == 0
    assert item["helper_count"] == 0
    assert item["first_photo"] is None


def test_list_items_filters_by_building(client):
    token = register(client, "lifecycle_filter")
    library = create_building()
    canteen = create_building(code="canteen", name="第一食堂")
    create_item(client, token, building_id=library)
    create_item(client, token, building_id=canteen)
    r = client.get("/api/v1/items", params={"building_id": library}, headers=auth(token))
    assert r.status_code == 200
    assert r.json()["total"] == 1
    assert r.json()["items"][0]["building_name"] == "图书馆"


def test_create_item_rejects_unknown_building(client):
    token = register(client, "lifecycle_bad_building")
    r = client.post(
        "/api/v1/items",
        json={"direction": "lost", "category": "钥匙", "title": "钥匙", "building_id": str(uuid.uuid4())},
        headers=auth(token),
    )
    assert r.status_code == 404


def test_buildings_endpoint(client):
    token = register(client, "lifecycle_buildings")
    building_id = create_building()
    create_item(client, token, building_id=building_id)
    r = client.get("/api/v1/buildings", headers=auth(token))
    assert r.status_code == 200
    assert r.json()["total"] == 1
    assert r.json()["items"][0]["active_item_count"] == 1
    detail = client.get(f"/api/v1/buildings/{building_id}", headers=auth(token))
    assert detail.status_code == 200
    assert detail.json()["name"] == "图书馆"
    assert client.get(f"/api/v1/buildings/{uuid.uuid4()}", headers=auth(token)).status_code == 404
