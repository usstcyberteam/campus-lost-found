import io

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


def make_image(size: tuple[int, int] = (400, 300), fmt: str = "PNG", exif: Image.Exif | None = None) -> bytes:
    buffer = io.BytesIO()
    image = Image.new("RGB", size, (40, 90, 160))
    # Pillow 11 起显式传 exif=None 会报错，未提供 EXIF 时不能带该参数
    if exif is None:
        image.save(buffer, format=fmt)
    else:
        image.save(buffer, format=fmt, exif=exif)
    return buffer.getvalue()


@pytest.fixture
def storage(monkeypatch, tmp_path):
    backend = LocalStorageBackend(str(tmp_path))
    monkeypatch.setattr("app.services.user_service.get_storage", lambda: backend)
    return backend


def upload_avatar(client, token: str, data: bytes, filename: str = "avatar.png", content_type: str = "image/png"):
    return client.post("/api/v1/me/avatar", files={"file": (filename, data, content_type)}, headers=auth(token))


def test_new_user_has_no_avatar(client):
    token = register(client, "avatar_none")
    r = client.get("/api/v1/auth/me", headers=auth(token))
    assert r.status_code == 200
    assert r.json()["avatar_url"] is None
    assert "avatar_path" not in r.json()


def test_upload_avatar_crops_to_square_webp(client, storage):
    token = register(client, "avatar_up")
    r = upload_avatar(client, token, make_image((400, 300)))
    assert r.status_code == 200
    url = r.json()["avatar_url"]
    assert url.startswith(f"/api/v1/users/{r.json()['id']}/avatar?v=")

    me = client.get("/api/v1/auth/me", headers=auth(token)).json()
    assert me["avatar_url"] == url

    image = client.get(url, headers=auth(token))
    assert image.status_code == 200
    assert image.headers["content-type"] == "image/webp"
    with Image.open(io.BytesIO(image.content)) as saved:
        assert saved.format == "WEBP"
        assert saved.size == (256, 256)


def test_avatar_strips_exif(client, storage):
    token = register(client, "avatar_exif")
    exif = Image.Exif()
    exif[0x010F] = "SecretCam"
    r = upload_avatar(client, token, make_image(fmt="JPEG", exif=exif), "a.jpg", "image/jpeg")
    assert r.status_code == 200
    data = client.get(r.json()["avatar_url"], headers=auth(token)).content
    with Image.open(io.BytesIO(data)) as saved:
        assert not saved.getexif()


def test_other_users_can_view_avatar_but_anonymous_cannot(client, storage):
    owner = register(client, "avatar_owner")
    viewer = register(client, "avatar_viewer")
    url = upload_avatar(client, owner, make_image()).json()["avatar_url"]

    assert client.get(url, headers=auth(viewer)).status_code == 200
    assert client.get(url).status_code == 401


def test_replacing_avatar_changes_url_and_deletes_old_file(client, storage, tmp_path):
    token = register(client, "avatar_swap")
    first = upload_avatar(client, token, make_image()).json()["avatar_url"]
    second = upload_avatar(client, token, make_image((120, 200))).json()["avatar_url"]

    assert first != second
    assert len(list((tmp_path / "avatars").iterdir())) == 1


def test_delete_avatar(client, storage, tmp_path):
    token = register(client, "avatar_del")
    upload = upload_avatar(client, token, make_image()).json()
    url = upload["avatar_url"]

    r = client.delete("/api/v1/me/avatar", headers=auth(token))
    assert r.status_code == 200
    assert r.json()["avatar_url"] is None
    assert client.get(url, headers=auth(token)).status_code == 404
    assert list((tmp_path / "avatars").iterdir()) == []


@pytest.mark.parametrize(
    ("data", "message"),
    [
        (b"", "上传文件为空"),
        (b"not an image", "图片格式不合法"),
        (b"0" * (5 * 1024 * 1024 + 1), "图片不能超过 5MB"),
    ],
    ids=["empty", "not_image", "too_large"],
)
def test_invalid_avatar_rejected(client, storage, data, message):
    token = register(client, "avatar_bad")
    r = upload_avatar(client, token, data)
    assert r.status_code == 400
    assert r.json()["code"] == "VALIDATION"
    assert r.json()["message"] == message
    assert client.get("/api/v1/auth/me", headers=auth(token)).json()["avatar_url"] is None


def test_unsupported_format_rejected(client, storage):
    token = register(client, "avatar_gif")
    r = upload_avatar(client, token, make_image(fmt="GIF"), "a.gif", "image/gif")
    assert r.status_code == 400


def test_comment_author_includes_avatar(client, storage):
    token = register(client, "avatar_commenter")
    url = upload_avatar(client, token, make_image()).json()["avatar_url"]
    item = client.post(
        "/api/v1/items",
        json={
            "direction": "lost",
            "category": "雨伞",
            "title": "丢了伞",
            "description": "蓝色折叠伞",
            "location_area": "一食堂",
        },
        headers=auth(token),
    )
    assert item.status_code == 200, item.text
    item_id = item.json()["id"]
    r = client.post(f"/api/v1/items/{item_id}/comments", json={"content": "有人看到吗"}, headers=auth(token))
    assert r.status_code == 200, r.text
    comments = client.get(f"/api/v1/items/{item_id}/comments", headers=auth(token)).json()
    rows = comments["items"] if isinstance(comments, dict) else comments
    assert rows[0]["author"]["avatar_url"] == url
