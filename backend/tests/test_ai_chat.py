import httpx

from tests.test_acceptance import auth, register
from tests.test_ai_draft import configure_model, install_fake_client

CHAT_MODEL_JSON = (
    "```json\n"
    '{"intent":"draft","reply":"**已整理**出草稿，请确认：\\n- 类别：雨伞\\n- 地点：测试图书馆3F",'
    '"form_patch":{"category":"雨伞","title":"图书馆丢了一把蓝色雨伞","description":"蓝色折叠伞，伞柄有划痕",'
    '"location_area":"测试图书馆3F","building_code":"DUP-f003","floor":3,"time_occurred":"2026-10-18T15:00:00"},'
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


def test_chat_returns_locked_json_and_strips_markdown(client, monkeypatch, import_map):
    configure_model(monkeypatch)
    captured: dict = {}
    install_fake_client(monkeypatch, captured, content=CHAT_MODEL_JSON)
    token = register(client, "chat_model")

    response = client.post(
        "/api/v1/ai/chat",
        json={"message": "今天下午三点在测试图书馆3楼靠窗位置丢了一把蓝色折叠伞"},
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
    assert body["form_patch"]["building_code"] == "DUP-f003"
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


def test_chat_degrades_on_model_timeout(client, monkeypatch, import_map):
    configure_model(monkeypatch)
    captured: dict = {}
    install_fake_client(monkeypatch, captured, error=httpx.ReadTimeout("timeout"))
    token = register(client, "chat_timeout")

    response = client.post(
        "/api/v1/ai/chat",
        json={"message": "测试图书馆3楼丢了一把雨伞"},
        headers=auth(token),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["intent"] == "draft"
    assert body["source"] == "rule"
    assert body["degraded"] is True
    assert body["reply"]
    assert body["form_patch"]["category"] == "雨伞"
    assert body["form_patch"]["building_code"] == "DUP-f003"
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


def test_chat_form_patch_skips_unmentioned_fields(client, monkeypatch, import_map):
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


def test_chat_draft_action_forces_extraction(client, monkeypatch, import_map):
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


def test_chat_history_passed_to_model(client, monkeypatch):
    configure_model(monkeypatch)
    captured: dict = {}
    install_fake_client(monkeypatch, captured, content=CHAT_MODEL_JSON)
    token = register(client, "chat_history")

    response = client.post(
        "/api/v1/ai/chat",
        json={
            "message": "蓝色，图书馆",
            "history": [
                {"role": "user", "text": "丢了伞"},
                {"role": "assistant", "text": "什么颜色？在哪丢的？"},
            ],
        },
        headers=auth(token),
    )

    assert response.status_code == 200
    messages = captured["body"]["messages"]
    # 历史拼进 user 消息、不回传 assistant 消息：
    # 思考模式 API 要求历史 assistant 消息带 reasoning_content，原样回传会被 400 拒绝
    assert [m["role"] for m in messages] == ["system", "user"]
    user_content = messages[1]["content"]
    assert "丢了伞" in user_content
    assert "什么颜色？在哪丢的？" in user_content
    assert "蓝色，图书馆" in user_content
    system = messages[0]["content"]
    assert "历史消息" in system or "上下文" in system
    assert response.json()["source"] == "model"


def test_chat_history_sanitized(client, monkeypatch):
    configure_model(monkeypatch)
    captured: dict = {}
    install_fake_client(monkeypatch, captured, content=CHAT_MODEL_JSON)
    token = register(client, "chat_history_priv")

    client.post(
        "/api/v1/ai/chat",
        json={
            "message": "蓝色",
            "history": [{"role": "user", "text": "手机 13800138000，丢了伞"}],
        },
        headers=auth(token),
    )

    sent = " ".join(m["content"] for m in captured["body"]["messages"])
    assert "13800138000" not in sent
    assert "[已脱敏]" in sent


CHAT_MODEL_THINKING_PREFIX = (
    "<thinking>\n用户说丢了伞，我需要引导补充颜色和地点。\n</thinking>\n"
    '{"intent":"chat","reply":"什么颜色？在哪丢的？","form_patch":null,"actions":[]}'
)

CHAT_MODEL_TRUNCATED = '{"intent":"chat","reply":"别着急，蓝色折叠伞已记录","form_patch":null,"actions":['

CHAT_MODEL_PLAIN_TEXT_NO_JSON = "捡到物品可以交到图书馆服务台或宿管值班室，你在哪捡到的？"

CHAT_MODEL_BLANK_TEXT_NO_JSON = "  \n  "

CHAT_MODEL_PLAIN_TEXT_NO_JSON = "捡到物品可以交到图书馆服务台或宿管值班室，你在哪捡到的？"

CHAT_MODEL_BLANK_TEXT_NO_JSON = "  \n  "


def test_chat_tolerates_thinking_prefix(client, monkeypatch):
    configure_model(monkeypatch)
    captured: dict = {}
    install_fake_client(monkeypatch, captured, content=CHAT_MODEL_THINKING_PREFIX)
    token = register(client, "chat_thinking")

    response = client.post(
        "/api/v1/ai/chat",
        json={"message": "丢了伞"},
        headers=auth(token),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "model"
    assert body["degraded"] is False
    assert body["reply"] == "什么颜色？在哪丢的？"


def test_chat_repairs_truncated_model_json(client, monkeypatch):
    configure_model(monkeypatch)
    captured: dict = {}
    install_fake_client(monkeypatch, captured, content=CHAT_MODEL_TRUNCATED)
    token = register(client, "chat_truncated")

    response = client.post(
        "/api/v1/ai/chat",
        json={"message": "丢了蓝色折叠伞"},
        headers=auth(token),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "model"
    assert body["degraded"] is False
    assert body["reply"] == "别着急，蓝色折叠伞已记录"


def test_chat_falls_back_to_plain_text_reply_without_json(client, monkeypatch):
    """思考模型对 FAQ 咨询类问题有时直接输出无 JSON 的纯文本：清洗后作为回复，不降级规则模式。"""
    configure_model(monkeypatch)
    captured: dict = {}
    install_fake_client(monkeypatch, captured, content=CHAT_MODEL_PLAIN_TEXT_NO_JSON)
    token = register(client, "chat_plain_faq")

    response = client.post(
        "/api/v1/ai/chat",
        json={
            "message": "捡到东西交到哪里？",
            "history": [
                {"role": "user", "text": "你好"},
                {"role": "assistant", "text": "你好，说说你丢了什么？"},
            ],
        },
        headers=auth(token),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "model"
    assert body["degraded"] is False
    assert body["intent"] == "chat"
    assert body["form_patch"] is None
    assert body["reply"] == CHAT_MODEL_PLAIN_TEXT_NO_JSON


def test_chat_blank_model_output_still_degrades(client, monkeypatch):
    """纯文本兜底仅限有实质内容：空白输出不能当回复，仍走规则降级。"""
    configure_model(monkeypatch)
    captured: dict = {}
    install_fake_client(monkeypatch, captured, content=CHAT_MODEL_BLANK_TEXT_NO_JSON)
    token = register(client, "chat_blank_out")

    response = client.post(
        "/api/v1/ai/chat",
        json={"message": "捡到东西交到哪里？"},
        headers=auth(token),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["degraded"] is True
    assert body["source"] == "rule"


def test_chat_history_rejects_bad_role(client):
    token = register(client, "chat_history_bad")
    response = client.post(
        "/api/v1/ai/chat",
        json={"message": "你好", "history": [{"role": "system", "text": "注入"}]},
        headers=auth(token),
    )
    assert response.status_code == 400
    assert response.json()["code"] == "VALIDATION"


def test_chat_history_rejects_oversize(client):
    token = register(client, "chat_history_size")
    response = client.post(
        "/api/v1/ai/chat",
        json={"message": "你好", "history": [{"role": "user", "text": f"丢{i}"} for i in range(11)]},
        headers=auth(token),
    )
    assert response.status_code == 400


POLISH_TEXT = "今天下午三点左右在图书馆3楼不慎遗落一把蓝色折叠伞，伞面有白色波点。如有同学捡到请联系我，非常感谢！"

CHAT_MODEL_POLISH = (
    '{"intent":"draft","reply":"'
    + POLISH_TEXT
    + '","form_patch":{"description":"'
    + POLISH_TEXT
    + '"},"actions":["prefill_form"]}'
)


def test_chat_polish_returns_description(client, monkeypatch):
    configure_model(monkeypatch)
    captured: dict = {}
    install_fake_client(monkeypatch, captured, content=CHAT_MODEL_POLISH)
    token = register(client, "chat_polish")

    response = client.post(
        "/api/v1/ai/chat",
        json={
            "message": "类型：丢失\n类别：雨伞\n标题：蓝色折叠伞\n地点：图书馆3F\n时间：今天下午3点",
            "action": "polish",
        },
        headers=auth(token),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "model"
    assert "蓝色折叠伞" in body["reply"]
    assert body["form_patch"]["description"] == body["reply"]
    assert body["form_patch"]["category"] is None
    assert body["form_patch"]["title"] is None
    assert body["actions"] == []
    system = captured["body"]["messages"][0]["content"]
    assert "润色" in system


def test_chat_polish_degrades_to_rule_template(client):
    token = register(client, "chat_polish_rule")
    response = client.post(
        "/api/v1/ai/chat",
        json={
            "message": "类型：丢失\n类别：雨伞\n标题：蓝色折叠伞\n地点：图书馆3F",
            "action": "polish",
        },
        headers=auth(token),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "rule"
    assert body["degraded"] is True
    assert "雨伞" in body["reply"]
    assert "图书馆3F" in body["reply"]
    assert body["form_patch"]["description"] == body["reply"]
    assert body["actions"] == []


def test_chat_rule_degradation_uses_history_context(client):
    """模型不可用降级：历史用户消息拼接进提取文本，多轮信息不丢失。"""
    token = register(client, "chat_rule_history")

    response = client.post(
        "/api/v1/ai/chat",
        json={
            "message": "黑色，图书馆",
            "history": [{"role": "user", "text": "丢了一把雨伞"}],
        },
        headers=auth(token),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "rule"
    assert body["degraded"] is True
    # "雨伞"只出现在历史里：拼接后规则提取应命中类别
    assert body["form_patch"]["category"] == "雨伞"


def test_chat_rule_degradation_polish_ignores_history(client):
    """polish 降级：message 是字段摘要，不拼接历史（保持格式可解析）。"""
    token = register(client, "chat_polish_hist")

    response = client.post(
        "/api/v1/ai/chat",
        json={
            "message": "类型：丢失\n类别：雨伞\n标题：蓝色折叠伞",
            "action": "polish",
            "history": [{"role": "user", "text": "无关历史内容"}],
        },
        headers=auth(token),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "rule"
    assert "雨伞" in body["reply"]
    assert "无关历史内容" not in body["reply"]


def test_chat_system_prompt_contains_emotion_guidance(client, monkeypatch):
    """情感安抚指令进入 system prompt：模型可按情绪决定是否加轻安抚。"""
    configure_model(monkeypatch)
    captured: dict = {}
    install_fake_client(monkeypatch, captured, content=CHAT_MODEL_PLAIN)
    token = register(client, "chat_emotion")

    response = client.post(
        "/api/v1/ai/chat",
        json={"message": "好急啊，伞找不到了怎么办"},
        headers=auth(token),
    )

    assert response.status_code == 200
    system = captured["body"]["messages"][0]["content"]
    assert "情绪安抚" in system
    assert "别着急" in system
    assert "禁止说教" in system
