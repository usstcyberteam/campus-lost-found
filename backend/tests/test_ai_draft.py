import httpx

from app.services import model_client
from tests.test_acceptance import auth, register

MODEL_JSON = (
    '{"category":"雨伞","title":"图书馆丢了一把蓝色雨伞","description":"蓝色折叠伞，伞柄有划痕",'
    '"location_area":"测试图书馆3F","building_code":"DUP-f003","floor":3,'
    '"time_occurred":"2026-10-18T15:00:00"}'
)


def configure_model(monkeypatch) -> None:
    monkeypatch.setattr(model_client.settings, "model_disabled", False)
    monkeypatch.setattr(model_client.settings, "model_base_url", "https://model.example/v1")
    monkeypatch.setattr(model_client.settings, "model_name", "demo-model")
    monkeypatch.setattr(model_client.settings, "model_api_key", "test-key")


class FakeResponse:
    def __init__(self, content: str, reasoning_content: str | None = None):
        self.content = content
        self.reasoning_content = reasoning_content

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict:
        message: dict = {"content": self.content}
        if self.reasoning_content is not None:
            message["reasoning_content"] = self.reasoning_content
        return {"choices": [{"message": message}]}


def install_fake_client(
    monkeypatch,
    captured: dict,
    content: str | None = None,
    error: Exception | None = None,
    reasoning_content: str | None = None,
    # 重试测试：按调用序返回不同输出（解析失败 → 重试恢复）
    contents_by_call: list[tuple[str, str | None]] | None = None,
) -> None:
    calls: list[int] = [0]

    class FakeClient:
        def __init__(self, *args, **kwargs):
            captured["timeout"] = kwargs.get("timeout")

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        def post(self, url, json=None, headers=None):
            captured["url"] = url
            captured.setdefault("bodies", []).append(json)
            captured["body"] = json
            captured["headers"] = headers
            if error is not None:
                raise error
            if contents_by_call is not None:
                index = min(calls[0], len(contents_by_call) - 1)
                item_content, item_reasoning = contents_by_call[index]
                calls[0] += 1
                return FakeResponse(item_content, item_reasoning)
            return FakeResponse(content or "", reasoning_content)

    monkeypatch.setattr(model_client.httpx, "Client", FakeClient)


def test_draft_requires_login(client):
    response = client.post("/api/v1/ai/draft-post", json={"text": "图书馆丢了一把雨伞"})
    assert response.status_code == 401
    assert response.json()["code"] == "UNAUTH"


def test_draft_rejects_blank_text(client):
    token = register(client, "ai_blank")
    response = client.post("/api/v1/ai/draft-post", json={"text": "   "}, headers=auth(token))
    assert response.status_code == 400
    assert response.json()["code"] == "VALIDATION"


def test_draft_uses_model_output(client, monkeypatch, import_map):
    configure_model(monkeypatch)
    captured: dict = {}
    install_fake_client(monkeypatch, captured, content=MODEL_JSON)
    token = register(client, "ai_model")

    response = client.post(
        "/api/v1/ai/draft-post",
        json={"text": "今天下午三点在测试图书馆3楼靠窗位置丢了一把蓝色折叠伞"},
        headers=auth(token),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "model"
    assert body["degraded"] is False
    assert body["category"] == "雨伞"
    assert body["title"] == "图书馆丢了一把蓝色雨伞"
    assert body["building_code"] == "DUP-f003"
    assert body["floor"] == 3
    assert body["location_area"] == "测试图书馆3F"
    assert body["time_occurred"].startswith("2026-10-18T15:00:00")
    assert captured["url"] == "https://model.example/v1/chat/completions"
    assert captured["timeout"] == 10


def test_draft_degrades_on_model_timeout(client, monkeypatch, import_map):
    configure_model(monkeypatch)
    captured: dict = {}
    install_fake_client(monkeypatch, captured, error=httpx.ReadTimeout("timeout"))
    token = register(client, "ai_timeout")

    response = client.post(
        "/api/v1/ai/draft-post",
        json={"text": "测试图书馆3楼丢了一把雨伞"},
        headers=auth(token),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "rule"
    assert body["degraded"] is True
    assert body["category"] == "雨伞"
    assert body["building_code"] == "DUP-f003"
    assert body["floor"] == 3


def test_draft_degrades_when_model_not_configured(client):
    token = register(client, "ai_unconfigured")
    response = client.post(
        "/api/v1/ai/draft-post",
        json={"text": "在图书馆门口捡到一张校园卡"},
        headers=auth(token),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "rule"
    assert body["degraded"] is True


def test_draft_request_excludes_private_fields(client, monkeypatch):
    configure_model(monkeypatch)
    captured: dict = {}
    install_fake_client(monkeypatch, captured, content=MODEL_JSON)
    token = register(client, "ai_private")

    client.post(
        "/api/v1/ai/draft-post",
        json={"text": "我的手机 13800138000，邮箱 student@example.com，在图书馆3楼丢了伞"},
        headers=auth(token),
    )

    messages = captured["body"]["messages"]
    assert [message["role"] for message in messages] == ["system", "user"]
    sent = " ".join(message["content"] for message in messages)
    assert "13800138000" not in sent
    assert "student@example.com" not in sent
    assert "[已脱敏]" in sent
    assert set(captured["body"]) == {"model", "messages", "temperature"}
