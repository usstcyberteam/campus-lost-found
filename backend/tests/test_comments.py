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


def create_item(client, token: str) -> dict:
    r = client.post(
        "/api/v1/items",
        json={"direction": "lost", "category": "钥匙", "title": "一串钥匙"},
        headers=auth(token),
    )
    assert r.status_code == 200
    return r.json()


def create_staff(username: str) -> str:
    db = SessionLocal()
    db.add(User(username=username, password_hash=hash_password("secret123"), role=Role.staff, display_name=username))
    db.commit()
    db.close()
    return username


def login(client, username: str) -> str:
    r = client.post("/api/v1/auth/login", json={"username": username, "password": "secret123"})
    assert r.status_code == 200
    return r.json()["token"]


def comment(client, token: str, item_id: str, content: str, **extra) -> dict:
    r = client.post(f"/api/v1/items/{item_id}/comments", json={"content": content} | extra, headers=auth(token))
    assert r.status_code == 200
    return r.json()


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


def test_create_and_list_comment(client):
    token = register(client, "comment_author")
    item = create_item(client, token)
    created = comment(client, token, item["id"], "我在图书馆门口捡到过")
    assert created["content"] == "我在图书馆门口捡到过"
    assert created["is_deleted"] is False
    assert created["author"]["display_name"] == "comment_author"
    r = client.get(f"/api/v1/items/{item['id']}/comments", headers=auth(token))
    assert r.status_code == 200
    assert r.json()["total"] == 1
    assert r.json()["items"][0]["replies"] == []


def test_comment_content_validation(client):
    token = register(client, "comment_validation")
    item = create_item(client, token)
    empty = client.post(f"/api/v1/items/{item['id']}/comments", json={"content": "   "}, headers=auth(token))
    assert empty.status_code == 400
    long = client.post(f"/api/v1/items/{item['id']}/comments", json={"content": "字" * 501}, headers=auth(token))
    assert long.status_code == 400


def test_comment_requires_login(client):
    token = register(client, "comment_anon")
    item = create_item(client, token)
    r = client.post(f"/api/v1/items/{item['id']}/comments", json={"content": "hi"})
    assert r.status_code == 401
    assert client.get(f"/api/v1/items/{item['id']}/comments").status_code == 401


def test_reply_is_limited_to_one_level(client):
    token = register(client, "comment_reply")
    item = create_item(client, token)
    parent = comment(client, token, item["id"], "顶层评论")
    reply = comment(client, token, item["id"], "一层回复", parent_id=parent["id"])
    assert reply["parent_id"] == parent["id"]
    too_deep = client.post(
        f"/api/v1/items/{item['id']}/comments",
        json={"content": "二层回复", "parent_id": reply["id"]},
        headers=auth(token),
    )
    assert too_deep.status_code == 409
    listed = client.get(f"/api/v1/items/{item['id']}/comments", headers=auth(token)).json()
    assert len(listed["items"][0]["replies"]) == 1


def test_reply_to_deleted_parent_conflicts(client):
    token = register(client, "comment_deleted_parent")
    item = create_item(client, token)
    parent = comment(client, token, item["id"], "将被删除")
    assert client.delete(f"/api/v1/comments/{parent['id']}", headers=auth(token)).status_code == 200
    r = client.post(
        f"/api/v1/items/{item['id']}/comments",
        json={"content": "回复", "parent_id": parent["id"]},
        headers=auth(token),
    )
    assert r.status_code == 409


def test_soft_delete_hides_content_and_count(client):
    token = register(client, "comment_delete")
    item = create_item(client, token)
    created = comment(client, token, item["id"], "待删除评论")
    assert client.delete(f"/api/v1/comments/{created['id']}", headers=auth(token)).status_code == 200
    assert client.delete(f"/api/v1/comments/{created['id']}", headers=auth(token)).status_code == 409
    listed = client.get(f"/api/v1/items/{item['id']}/comments", headers=auth(token)).json()
    assert listed["items"][0]["is_deleted"] is True
    assert listed["items"][0]["content"] == ""
    detail = client.get(f"/api/v1/items/{item['id']}", headers=auth(token)).json()
    assert detail["comment_count"] == 0


def test_only_author_or_staff_can_delete(client):
    author = register(client, "comment_owner")
    other = register(client, "comment_other")
    item = create_item(client, author)
    created = comment(client, author, item["id"], "评论")
    assert client.delete(f"/api/v1/comments/{created['id']}", headers=auth(other)).status_code == 403
    staff_name = create_staff("comment_staff")
    staff = login(client, staff_name)
    assert client.delete(f"/api/v1/comments/{created['id']}", headers=auth(staff)).status_code == 200


def test_comment_images_are_bound_and_limited(client, storage):
    token = register(client, "comment_images")
    item = create_item(client, token)
    photo = upload(client, token)
    created = comment(client, token, item["id"], "看图", photo_ids=[photo["id"]])
    assert len(created["images"]) == 1
    assert client.get(created["images"][0]["url"], headers=auth(token)).status_code == 200
    too_many = client.post(
        f"/api/v1/items/{item['id']}/comments",
        json={"content": "太多图", "photo_ids": [photo["id"]] * 4},
        headers=auth(token),
    )
    assert too_many.status_code == 400
