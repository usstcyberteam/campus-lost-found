import io

import pytest
from PIL import Image

from app.core.security import hash_password
from app.database import SessionLocal
from app.models import Role, User
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


def create_staff(username: str = "staff1") -> None:
    db = SessionLocal()
    db.add(User(username=username, password_hash=hash_password("staff123"), role=Role.staff, display_name=username))
    db.commit()
    db.close()


def staff_login(client) -> str:
    r = client.post("/api/v1/auth/login", json={"username": "staff1", "password": "staff123"})
    assert r.status_code == 200
    return r.json()["token"]


def make_image(fmt: str = "JPEG", exif: Image.Exif | None = None) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (32, 32), (200, 30, 30)).save(buffer, format=fmt, exif=exif)
    return buffer.getvalue()


@pytest.fixture
def storage(monkeypatch, tmp_path):
    backend = LocalStorageBackend(str(tmp_path))
    monkeypatch.setattr("app.services.upload_service.get_storage", lambda: backend)
    return backend


def upload(client, token: str, data: bytes, filename: str = "photo.jpg", content_type: str = "image/jpeg"):
    return client.post(
        "/api/v1/uploads",
        files={"file": (filename, data, content_type)},
        headers=auth(token),
    )


def test_upload_and_download_photo(client, storage):
    token = register(client, "uploader")
    r = upload(client, token, make_image())
    assert r.status_code == 200
    body = r.json()
    assert body["mime"] == "image/jpeg"
    assert body["size"] > 0
    assert body["url"] == f"/api/v1/uploads/{body['id']}"

    download = client.get(body["url"], headers=auth(token))
    assert download.status_code == 200
    assert download.headers["content-type"] == "image/jpeg"
    assert len(download.content) == body["size"]


def test_upload_strips_exif(client, storage):
    token = register(client, "exifuser")
    exif = Image.Exif()
    exif[0x010F] = "SecretCamera"
    r = upload(client, token, make_image(exif=exif))
    assert r.status_code == 200
    body = r.json()

    download = client.get(body["url"], headers=auth(token))
    with Image.open(io.BytesIO(download.content)) as image:
        assert 0x010F not in image.getexif()


def test_upload_rejects_non_image(client, storage):
    token = register(client, "badfile")
    r = upload(client, token, b"not an image", filename="a.txt", content_type="text/plain")
    assert r.status_code == 400
    assert r.json()["code"] == "VALIDATION"


def test_upload_rejects_oversize(client, storage):
    token = register(client, "bigfile")
    r = upload(client, token, b"0" * (5 * 1024 * 1024 + 1))
    assert r.status_code == 400
    assert r.json()["code"] == "VALIDATION"


def test_upload_requires_login(client, storage):
    r = client.post(
        "/api/v1/uploads",
        files={"file": ("photo.jpg", make_image(), "image/jpeg")},
    )
    assert r.status_code == 401


def test_unbound_photo_only_visible_to_owner(client, storage):
    owner = register(client, "unbound_owner")
    other = register(client, "unbound_other")
    body = upload(client, owner, make_image()).json()

    assert client.get(body["url"], headers=auth(owner)).status_code == 200
    assert client.get(body["url"], headers=auth(other)).status_code == 403


def test_found_item_photo_hidden_from_others(client, storage):
    create_staff()
    owner = register(client, "found_owner")
    other = register(client, "found_other")
    photo = upload(client, owner, make_image()).json()
    r = client.post(
        "/api/v1/items",
        json={"direction": "found", "category": "雨伞", "title": "黑伞", "photo_ids": [photo["id"]]},
        headers=auth(owner),
    )
    assert r.status_code == 200

    assert client.get(photo["url"], headers=auth(other)).status_code == 403
    assert client.get(photo["url"], headers=auth(staff_login(client))).status_code == 200


def test_lost_item_photo_visible_to_others(client, storage):
    owner = register(client, "lost_owner")
    other = register(client, "lost_other")
    photo = upload(client, owner, make_image()).json()
    r = client.post(
        "/api/v1/items",
        json={"direction": "lost", "category": "水杯", "title": "蓝色水杯", "photo_ids": [photo["id"]]},
        headers=auth(owner),
    )
    assert r.status_code == 200
    assert client.get(photo["url"], headers=auth(other)).status_code == 200
