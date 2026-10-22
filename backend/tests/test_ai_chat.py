import httpx

from tests.test_acceptance import auth, register
from tests.test_ai_draft import configure_model, install_fake_client
from tests.test_buildings import import_config

CHAT_MODEL_JSON = (
    "```json\n"
    '{"intent":"draft","reply":"**已整理**出草稿，请确认：\\n- 类别：雨伞\\n- 地点：图书馆3F",'
    '"form_patch":{"category":"雨伞","title":"图书馆丢了一把蓝色雨伞","description":"蓝色折叠伞，伞柄有划痕",'
    '"location_area":"图书馆3F","building_code":"B02","floor":3,"time_occurred":"2026-10-18T15:00:00"},'
    '"actions":["prefill_form","hack_action"]}'
    "\n```"
)

CHAT_MODEL_PLAIN = (
    '{"intent":"chat","reply":"你好，我是失物招领助手，请描述你丢失或拾获的物品。","form_patch":null,"actions":[]}'
)

CHAT_MODEL_VAGUE = (
    '{"intent":"chat","reply":"别着急，伞是什么颜色和样式的？大概什么时间、在哪栋楼丢的？",'
    '"form_patch":null,"actions":[]}'
)

CHAT_MODEL_PARTIAL = (
    '{"intent":"draft","reply":"已记录你丢的蓝色雨伞，方便的话补充下时间和地点。",'
    '"form_patch":{"category":"雨伞","title":"蓝色雨伞","description":"蓝色雨伞"},'
    '"actions":["prefill_form"]}'
)


def test_chat_requires_login(client):
    response = client.post("/api/v1/ai/chat", json={"message": "图书馆丢了一把雨伞"})
    assert response.status_code == 401
    assert response.json()["code"] == "UNAUTH"


def test_chat_rejects_blank_message(client):
    token = register(client, "chat_blank")
    response = client.post("/api/v1/ai/chat", json={"message": "   "}, headers=auth(token))
    assert response.status_code == 400
    assert response.json()["code"] == "VALIDATION"


def test_chat_returns_locked_json_and_strips_markdown(client, monkeypatch):
    import_config()
    configure_model(monkeypatch)
    captured: dict = {}
    install_fake_client(monkeypatch, captured, content=CHAT_MODEL_JSON)
    token = register(client, "chat_model")

    response = client.post(
        "/api/v1/ai/chat",
        json={"message": "今天下午三点在图书馆3楼靠窗位置丢了一把蓝色折叠伞"},
        headers=auth(token),
    )

    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"intent", "reply", "form_patch", "actions", "source", "degraded"}
    assert body["intent"] == "draft"
    assert body["source"] == "model"
    assert body["degraded"] is False
    assert "**" not in body["reply"]
    assert "```" not in body["reply"]
    assert body["reply"].startswith("已整理")
    assert body["form_patch"]["category"] == "雨伞"
    assert body["form_patch"]["building_code"] == "B02"
    assert body["form_patch"]["floor"] == 3
    assert body["actions"] == ["prefill_form"]
    assert captured["timeout"] == 10


def test_chat_plain_intent_has_no_form_patch(client, monkeypatch):
    configure_model(monkeypatch)
    captured: dict = {}
    install_fake_client(monkeypatch, captured, content=CHAT_MODEL_PLAIN)
    token = register(client, "chat_plain")

    response = client.post("/api/v1/ai/chat", json={"message": "你好"}, headers=auth(token))

    assert response.status_code == 200
    body = response.json()
    assert body["intent"] == "chat"
    assert body["form_patch"] is None
    assert body["actions"] == []
    assert body["reply"].startswith("你好")


def test_chat_degrades_on_model_timeout(client, monkeypatch):
    import_config()
    configure_model(monkeypatch)
    captured: dict = {}
    install_fake_client(monkeypatch, captured, error=httpx.ReadTimeout("timeout"))
    token = register(client, "chat_timeout")

    response = client.post(
        "/api/v1/ai/chat",
        json={"message": "图书馆3楼丢了一把雨伞"},
        headers=auth(token),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["intent"] == "draft"
    assert body["source"] == "rule"
    assert body["degraded"] is True
    assert body["reply"]
    assert body["form_patch"]["category"] == "雨伞"
    assert body["form_patch"]["building_code"] == "B02"
    assert body["form_patch"]["floor"] == 3
    assert body["actions"] == ["prefill_form"]


def test_chat_greeting_without_item_degrades_to_plain_chat(client):
    token = register(client, "chat_greeting")
    response = client.post("/api/v1/ai/chat", json={"message": "你是谁呀"}, headers=auth(token))

    assert response.status_code == 200
    body = response.json()
    assert body["intent"] == "chat"
    assert body["form_patch"] is None
    assert body["source"] == "rule"
    assert body["degraded"] is True


def test_chat_request_excludes_private_fields(client, monkeypatch):
    configure_model(monkeypatch)
    captured: dict = {}
    install_fake_client(monkeypatch, captured, content=CHAT_MODEL_JSON)
    token = register(client, "chat_private")

    client.post(
        "/api/v1/ai/chat",
        json={"message": "我的手机 13800138000，邮箱 student@example.com，在图书馆3楼丢了伞"},
        headers=auth(token),
    )

    messages = captured["body"]["messages"]
    assert [message["role"] for message in messages] == ["system", "user"]
    sent = " ".join(message["content"] for message in messages)
    assert "13800138000" not in sent
    assert "student@example.com" not in sent
    assert "[已脱敏]" in sent


def test_chat_vague_description_guides_instead_of_prefill(client, monkeypatch):
    configure_model(monkeypatch)
    captured: dict = {}
    install_fake_client(monkeypatch, captured, content=CHAT_MODEL_VAGUE)
    token = register(client, "chat_vague")

    response = client.post("/api/v1/ai/chat", json={"message": "刚才掉了一把伞"}, headers=auth(token))

    assert response.status_code == 200
    body = response.json()
    assert body["intent"] == "chat"
    assert body["form_patch"] is None
    assert body["actions"] == []
    assert body["source"] == "model"
    assert "颜色" in body["reply"]


def test_chat_form_patch_skips_unmentioned_fields(client, monkeypatch):
    import_config()
    configure_model(monkeypatch)
    captured: dict = {}
    install_fake_client(monkeypatch, captured, content=CHAT_MODEL_PARTIAL)
    token = register(client, "chat_partial")

    response = client.post(
        "/api/v1/ai/chat",
        json={"message": "丢了一把蓝色雨伞"},
        headers=auth(token),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["intent"] == "draft"
    patch = body["form_patch"]
    assert patch["category"] == "雨伞"
    assert patch["title"] == "蓝色雨伞"
    assert patch["building_code"] is None
    assert patch["location_area"] is None
    assert patch["floor"] is None
    assert patch["time_occurred"] is None
    assert body["actions"] == ["prefill_form"]
    assert body["source"] == "model"


def test_chat_draft_action_forces_extraction(client, monkeypatch):
    import_config()
    configure_model(monkeypatch)
    captured: dict = {}
    install_fake_client(monkeypatch, captured, content=CHAT_MODEL_PARTIAL)
    token = register(client, "chat_draft_action")

    response = client.post(
        "/api/v1/ai/chat",
        json={"message": "蓝色雨伞", "page": "ai", "action": "draft"},
        headers=auth(token),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["intent"] == "draft"
    assert body["source"] == "model"
    assert body["form_patch"]["category"] == "雨伞"
    assert body["form_patch"]["title"] == "蓝色雨伞"
    system = captured["body"]["messages"][0]["content"]
    assert "整理草稿" in system


def test_chat_draft_action_degrades_to_rule_patch(client):
    token = register(client, "chat_draft_rule")
    response = client.post(
        "/api/v1/ai/chat",
        json={"message": "一把蓝色雨伞", "action": "draft"},
        headers=auth(token),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["intent"] == "draft"
    assert body["source"] == "rule"
    assert body["degraded"] is True
    patch = body["form_patch"]
    assert patch is not None
    assert patch["category"] == "雨伞"
    assert patch["title"]


def test_chat_rejects_unknown_action(client):
    token = register(client, "chat_bad_action")
    response = client.post(
        "/api/v1/ai/chat",
        json={"message": "你好", "action": "hack"},
        headers=auth(token),
    )
    assert response.status_code == 400
    assert response.json()["code"] == "VALIDATION"


def test_suggest_locations_requires_login(client):
    response = client.get("/api/v1/ai/suggest-locations")
    assert response.status_code == 401


def test_suggest_locations_ranks_by_frequency(client):
    from tests.test_item_lifecycle import create_item

    token = register(client, "suggest_owner")
    headers = auth(token)
    for area in ("图书馆3F", "图书馆3F", "一食堂2F"):
        create_item(client, token, location_area=area, title="雨伞", category="雨伞")

    response = client.get("/api/v1/ai/suggest-locations", params={"keyword": "图书馆"}, headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert body["locations"] == ["图书馆3F"]

    response_all = client.get("/api/v1/ai/suggest-locations", headers=headers)
    all_locations = response_all.json()["locations"]
    assert all_locations[0] == "图书馆3F"
    assert "一食堂2F" in all_locations
