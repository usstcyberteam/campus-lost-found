from tests.test_acceptance import auth, register
from tests.test_ai_draft import configure_model, install_fake_client

THANK_MODEL_JSON = (
    '{"warm":"感谢你在图书馆帮我捡回雨伞，这份善意我会记在心里。",'
    '"cute":"谢谢你帮我捡到伞伞～你真是天使！🌈",'
    '"formal":"您好，衷心感谢您拾获并归还本人雨伞，特此致谢。"}'
)

THANK_MODEL_INVALID = "三段感谢语：warm……cute……formal……（这不是 JSON）"


def test_thank_you_requires_login(client):
    response = client.post(
        "/api/v1/ai/thank-you",
        json={"item_title": "蓝色雨伞", "item_location": "图书馆"},
    )
    assert response.status_code == 401
    assert response.json()["code"] == "UNAUTH"


def test_thank_you_rejects_blank_title(client):
    token = register(client, "thanks_blank")
    response = client.post(
        "/api/v1/ai/thank-you",
        json={"item_title": "   ", "item_location": "图书馆"},
        headers=auth(token),
    )
    assert response.status_code == 400
    assert response.json()["code"] == "VALIDATION"


def test_thank_you_rejects_invalid_tone(client):
    token = register(client, "thanks_tone")
    response = client.post(
        "/api/v1/ai/thank-you",
        json={"item_title": "蓝色雨伞", "item_location": "图书馆", "tone": "angry"},
        headers=auth(token),
    )
    assert response.status_code == 400
    assert response.json()["code"] == "VALIDATION"


def test_thank_you_degrades_to_rule_templates(client):
    token = register(client, "thanks_rule")

    response = client.post(
        "/api/v1/ai/thank-you",
        json={"item_title": "蓝色雨伞", "item_location": "图书馆3楼"},
        headers=auth(token),
    )

    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"tone", "warm", "cute", "formal", "source", "degraded"}
    assert body["tone"] == "warm"
    assert body["source"] == "rule"
    assert body["degraded"] is True
    assert "蓝色雨伞" in body["warm"]
    assert "图书馆3楼" in body["warm"]
    assert "蓝色雨伞" in body["cute"]
    assert "蓝色雨伞" in body["formal"]
    assert body["cute"].endswith("✨")
    assert "特此致谢" in body["formal"]


def test_thank_you_echoes_requested_tone(client):
    token = register(client, "thanks_tone_echo")

    response = client.post(
        "/api/v1/ai/thank-you",
        json={"item_title": "保温杯", "item_location": "食堂", "tone": "cute"},
        headers=auth(token),
    )

    assert response.status_code == 200
    assert response.json()["tone"] == "cute"


def test_thank_you_model_returns_three_styles(client, monkeypatch):
    configure_model(monkeypatch)
    captured: dict = {}
    install_fake_client(monkeypatch, captured, content=THANK_MODEL_JSON)
    token = register(client, "thanks_model")

    response = client.post(
        "/api/v1/ai/thank-you",
        json={
            "item_title": "蓝色雨伞",
            "item_location": "图书馆",
            "finder_note": "在自习区捡到的",
            "tone": "warm",
        },
        headers=auth(token),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "model"
    assert body["degraded"] is False
    assert body["warm"] == "感谢你在图书馆帮我捡回雨伞，这份善意我会记在心里。"
    assert body["cute"] == "谢谢你帮我捡到伞伞～你真是天使！🌈"
    assert body["formal"] == "您好，衷心感谢您拾获并归还本人雨伞，特此致谢。"
    assert "蓝色雨伞" in captured["body"]["messages"][-1]["content"]
    assert "在自习区捡到的" in captured["body"]["messages"][-1]["content"]


def test_thank_you_model_invalid_output_degrades(client, monkeypatch):
    configure_model(monkeypatch)
    install_fake_client(monkeypatch, {}, content=THANK_MODEL_INVALID)
    token = register(client, "thanks_bad_model")

    response = client.post(
        "/api/v1/ai/thank-you",
        json={"item_title": "耳机", "item_location": "操场"},
        headers=auth(token),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "rule"
    assert body["degraded"] is True
    assert "耳机" in body["warm"]


def test_return_suggestion_requires_login(client):
    response = client.post("/api/v1/ai/return-suggestion", json={"item_type": "雨伞"})
    assert response.status_code == 401
    assert response.json()["code"] == "UNAUTH"


def test_return_suggestion_rejects_blank_type(client):
    token = register(client, "suggest_blank")
    response = client.post(
        "/api/v1/ai/return-suggestion",
        json={"item_type": "  "},
        headers=auth(token),
    )
    assert response.status_code == 400
    assert response.json()["code"] == "VALIDATION"


def test_return_suggestion_rejects_invalid_value(client):
    token = register(client, "suggest_value")
    response = client.post(
        "/api/v1/ai/return-suggestion",
        json={"item_type": "雨伞", "item_value": "超高"},
        headers=auth(token),
    )
    assert response.status_code == 400
    assert response.json()["code"] == "VALIDATION"


def test_return_suggestion_for_light_items(client):
    token = register(client, "suggest_umbrella")

    response = client.post(
        "/api/v1/ai/return-suggestion",
        json={"item_type": "雨伞"},
        headers=auth(token),
    )

    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"suggestions", "message"}
    assert body["suggestions"] == ["请喝杯奶茶", "说声谢谢就好"]
    assert body["message"]


def test_return_suggestion_for_valuable_electronics(client):
    token = register(client, "suggest_phone")

    response = client.post(
        "/api/v1/ai/return-suggestion",
        json={"item_type": "手机"},
        headers=auth(token),
    )

    assert response.status_code == 200
    assert response.json()["suggestions"] == ["发个小红包", "请吃顿饭", "送个小礼物"]


def test_return_suggestion_for_documents_and_keys(client):
    token = register(client, "suggest_card")

    response = client.post(
        "/api/v1/ai/return-suggestion",
        json={"item_type": "校园卡"},
        headers=auth(token),
    )

    assert response.status_code == 200
    assert response.json()["suggestions"] == ["请喝咖啡", "说声谢谢"]


def test_return_suggestion_valuable_fallback_when_type_unmatched(client):
    token = register(client, "suggest_valuable")

    response = client.post(
        "/api/v1/ai/return-suggestion",
        json={"item_type": "项链", "item_value": "高"},
        headers=auth(token),
    )

    assert response.status_code == 200
    assert response.json()["suggestions"] == ["正式感谢信", "送花/礼物", "发朋友圈表扬"]


def test_return_suggestion_unknown_type_uses_default(client):
    token = register(client, "suggest_unknown")

    response = client.post(
        "/api/v1/ai/return-suggestion",
        json={"item_type": "一颗贝壳"},
        headers=auth(token),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["suggestions"] == ["说声谢谢", "请喝杯奶茶"]
    assert body["message"]
