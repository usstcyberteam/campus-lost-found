import io
import uuid

import pytest
from PIL import Image

from app.services.storage import LocalStorageBackend


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def register(client, username: str) -> str:
    r = client.post(
        "/api/v1/auth/register",
        json={"username": username, "password": "secret123", "display_name": username},
    )
    assert r.status_code == 200
    return r.json()["token"]


def make_image() -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (16, 16), (30, 120, 220)).save(buffer, format="JPEG")
    return buffer.getvalue()


@pytest.fixture
def storage(monkeypatch, tmp_path):
    backend = LocalStorageBackend(str(tmp_path))
    monkeypatch.setattr("app.services.upload_service.get_storage", lambda: backend)
    return backend


def upload(client, token: str) -> dict:
    r = client.post(
        "/api/v1/uploads",
        files={"file": ("photo.jpg", make_image(), "image/jpeg")},
        headers=auth(token),
    )
    assert r.status_code == 200
    return r.json()


def create_item(client, token: str, photo_ids: list[str] | None = None) -> dict:
    payload = {"direction": "lost", "category": "钥匙", "title": "一串钥匙"}
    if photo_ids is not None:
        payload["photo_ids"] = photo_ids
    r = client.post("/api/v1/items", json=payload, headers=auth(token))
    assert r.status_code == 200
    return r.json()


def test_create_item_binds_photos(client, storage):
    token = register(client, "owner1")
    photo = upload(client, token)
    item = create_item(client, token, [photo["id"]])

    detail = client.get(f"/api/v1/items/{item['id']}", headers=auth(token))
    assert detail.status_code == 200
    assert [p["id"] for p in detail.json()["photos"]] == [photo["id"]]
    assert detail.json()["photos_hidden"] is False


def test_found_item_detail_hides_photos_for_others(client, storage):
    owner = register(client, "owner2")
    other = register(client, "other2")
    photo = upload(client, owner)
    r = client.post(
        "/api/v1/items",
        json={"direction": "found", "category": "雨伞", "title": "黑伞", "photo_ids": [photo["id"]]},
        headers=auth(owner),
    )
    item_id = r.json()["id"]

    detail = client.get(f"/api/v1/items/{item_id}", headers=auth(other)).json()
    assert detail["photos"] == []
    assert detail["photos_hidden"] is True


def test_owner_can_add_photos_after_publish(client, storage):
    token = register(client, "owner3")
    item = create_item(client, token)
    photo = upload(client, token)

    r = client.post(f"/api/v1/items/{item['id']}/photos", json={"photo_ids": [photo["id"]]}, headers=auth(token))
    assert r.status_code == 200
    assert [p["id"] for p in r.json()["photos"]] == [photo["id"]]


def test_non_owner_cannot_add_photos(client, storage):
    owner = register(client, "owner4")
    other = register(client, "other4")
    item = create_item(client, owner)
    photo = upload(client, other)

    r = client.post(f"/api/v1/items/{item['id']}/photos", json={"photo_ids": [photo["id"]]}, headers=auth(other))
    assert r.status_code == 403


def test_add_photos_missing_item_returns_404(client, storage):
    token = register(client, "owner5")
    photo = upload(client, token)
    r = client.post(f"/api/v1/items/{uuid.uuid4()}/photos", json={"photo_ids": [photo["id"]]}, headers=auth(token))
    assert r.status_code == 404


def test_cannot_exceed_six_photos(client, storage):
    token = register(client, "owner6")
    photos = [upload(client, token) for _ in range(6)]
    item = create_item(client, token, [p["id"] for p in photos])
    extra = upload(client, token)

    r = client.post(f"/api/v1/items/{item['id']}/photos", json={"photo_ids": [extra["id"]]}, headers=auth(token))
    assert r.status_code == 400


def test_rejects_others_photo_and_unknown_id(client, storage):
    owner = register(client, "owner7")
    other = register(client, "other7")
    item = create_item(client, owner)
    foreign = upload(client, other)

    r = client.post(f"/api/v1/items/{item['id']}/photos", json={"photo_ids": [foreign["id"]]}, headers=auth(owner))
    assert r.status_code == 400

    r = client.post(f"/api/v1/items/{item['id']}/photos", json={"photo_ids": [str(uuid.uuid4())]}, headers=auth(owner))
    assert r.status_code == 400
