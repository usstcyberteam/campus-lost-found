import httpx

from app.services import model_client


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def register(client, username: str) -> str:
    r = client.post(
        "/api/v1/auth/register", json={"username": username, "password": "secret123", "display_name": username}
    )
    assert r.status_code == 200
    return r.json()["token"]


def configure_model(monkeypatch) -> None:
    monkeypatch.setattr(model_client.settings, "model_disabled", False)
    monkeypatch.setattr(model_client.settings, "model_base_url", "https://model.example/v1")
    monkeypatch.setattr(model_client.settings, "model_name", "demo-model")
    monkeypatch.setattr(model_client.settings, "model_api_key", "test-key")


def install_fake_client(monkeypatch, content: str | None = None, error: Exception | None = None) -> None:
    class FakeResponse:
        def __init__(self, payload: dict):
            self._payload = payload

        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict:
            return self._payload

    class FakeClient:
        def __init__(self, *args, **kwargs):
            return None

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        def post(self, url, json=None, headers=None):
            if error is not None:
                raise error
            return FakeResponse({"choices": [{"message": {"content": content or ""}}]})

    monkeypatch.setattr(model_client.httpx, "Client", FakeClient)


def translate(client, token: str, source: str, target_lang: str | None = "en", **overrides) -> object:
    body = {"message": source, "action": "translate", "text": source, "target_lang": target_lang}
    body.update(overrides)
    return client.post("/api/v1/ai/chat", json=body, headers=auth(token))


def test_translate_requires_login(client):
    r = client.post(
        "/api/v1/ai/chat", json={"message": "蓝色雨伞", "action": "translate", "target_lang": "en"}
    )
    assert r.status_code == 401


def test_translate_model_success(client, monkeypatch):
    configure_model(monkeypatch)
    install_fake_client(monkeypatch, content="A blue umbrella")
    token = register(client, "tr_ok")

    r = translate(client, token, "蓝色雨伞")
    assert r.status_code == 200
    data = r.json()
    assert data["reply"] == "A blue umbrella"
    assert data["source"] == "model"
    assert data["degraded"] is False
    assert data["intent"] == "chat"
    assert data["form_patch"] is None


def test_translate_falls_back_text_field_over_message(client, monkeypatch):
    configure_model(monkeypatch)
    install_fake_client(monkeypatch, content="translated")
    token = register(client, "tr_fallback")

    r = translate(client, token, "占位消息", text="蓝色雨伞")
    assert r.status_code == 200
    assert r.json()["reply"] == "translated"


def test_translate_model_failure_degrades(client, monkeypatch):
    configure_model(monkeypatch)
    install_fake_client(monkeypatch, error=httpx.ConnectError("boom"))
    token = register(client, "tr_err")

    r = translate(client, token, "蓝色雨伞", target_lang="ja")
    assert r.status_code == 200
    data = r.json()
    assert data["degraded"] is True
    assert data["source"] == "rule"
    assert data["reply"] == ""


def test_translate_model_disabled_degrades(client):
    # conftest 默认禁用模型：直接走规则降级
    token = register(client, "tr_off")

    r = translate(client, token, "蓝色雨伞", target_lang="ko")
    assert r.status_code == 200
    assert r.json()["degraded"] is True


def test_translate_rejects_missing_target_lang(client):
    token = register(client, "tr_nolang")

    r = translate(client, token, "蓝色雨伞", target_lang=None)
    assert r.status_code == 400
    assert r.json()["code"] == "VALIDATION"


def test_translate_rejects_invalid_target_lang(client):
    token = register(client, "tr_badlang")

    # 项目全局把 RequestValidationError 统一转成 400 VALIDATION
    r = translate(client, token, "蓝色雨伞", target_lang="fr")
    assert r.status_code == 400
    assert r.json()["code"] == "VALIDATION"