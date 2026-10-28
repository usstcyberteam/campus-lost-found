"""模型不可用时的规则整理：抽取关键词后组句，不能整段照抄用户原话。"""

from app.database import SessionLocal
from app.models import Building
from app.services import ai_service


def draft(text: str) -> dict:
    db = SessionLocal()
    try:
        return ai_service._rule_draft(db, text)
    finally:
        db.close()


def add_building(code: str, name: str) -> None:
    db = SessionLocal()
    db.add(Building(code=code, name=name, category="食堂", floors=3))
    db.commit()
    db.close()


def test_rule_draft_builds_title_and_description_from_keywords():
    text = "今天下午在图书馆3楼自习区丢了一把蓝色折叠伞，伞柄有磨损，伞套上贴了小熊贴纸"
    result = draft(text)

    assert result["title"] == "图书馆3楼自习区丢失蓝色雨伞"
    assert result["description"] != text
    assert "物品：蓝色雨伞" in result["description"]
    assert "时间：今天下午" in result["description"]
    assert "特征：伞柄有磨损，伞套上贴了小熊贴纸" in result["description"]
    assert result["floor"] == 3


def test_rule_draft_color_only_from_main_clause():
    result = draft("昨天晚上在图书馆丢了校园卡，卡套是黑色的")

    assert result["title"] == "图书馆丢失校园卡"
    assert "特征：卡套是黑色的" in result["description"]


def test_rule_draft_found_post_asks_owner_for_private_features():
    result = draft("在图书馆捡到一个黑色钱包，里面有几张银行卡")

    assert result["title"] == "图书馆捡到黑色钱包"
    assert "核验后归还" in result["description"]
    assert "请在帖子下留言或私信我" not in result["description"]


def test_rule_draft_matches_building_without_ordinal_and_chinese_floor():
    add_building("T01", "第一食堂")

    result = draft("中午在一食堂二楼丢了白色耳机")

    assert result["location_area"] == "第一食堂2F"
    assert result["floor"] == 2
    assert result["title"] == "第一食堂2F丢失白色耳机"


def test_rule_draft_without_item_keeps_original_text():
    text = "有人看到我的东西吗"
    result = draft(text)

    assert result["category"] is None
    assert result["title"] == text
    assert result["description"] == text


def test_rule_chat_reply_lists_what_was_extracted(client):
    token = client.post(
        "/api/v1/auth/register",
        json={"username": "rule_reply", "password": "secret123", "display_name": "rule_reply"},
    ).json()["token"]

    response = client.post(
        "/api/v1/ai/chat",
        json={"message": "在图书馆丢了一把蓝色雨伞"},
        headers={"Authorization": f"Bearer {token}"},
    )

    body = response.json()
    assert body["source"] == "rule"
    assert "蓝色雨伞" in body["reply"]
    assert body["form_patch"]["title"] == "图书馆丢失蓝色雨伞"
