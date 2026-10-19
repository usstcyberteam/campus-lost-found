import json
import logging
import re
from datetime import datetime

from sqlalchemy.orm import Session

from app.models import Building, User
from app.models.enums import Source
from app.schemas.ai import SearchAdviceRequest
from app.services import advice_service, model_client

logger = logging.getLogger(__name__)

_PRIVATE_PATTERNS = (
    (re.compile(r"1[3-9]\d{9}"), "[已脱敏]"),
    (re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+"), "[已脱敏]"),
    (re.compile(r"\d{17}[\dXx]"), "[已脱敏]"),
)
_CATEGORY_KEYWORDS = (
    ("校园卡", ("校园卡", "一卡通", "学生卡", "饭卡")),
    ("身份证", ("身份证",)),
    ("手机", ("手机", "iphone", "华为", "小米")),
    ("笔记本电脑", ("笔记本", "电脑", "macbook")),
    ("耳机", ("耳机", "airpods", "耳塞")),
    ("充电宝", ("充电宝", "移动电源")),
    ("钥匙", ("钥匙", "钥匙扣")),
    ("钱包", ("钱包", "卡包")),
    ("雨伞", ("雨伞", "伞")),
    ("水杯", ("水杯", "保温杯", "杯子")),
    ("书包", ("书包", "背包", "双肩包")),
    ("眼镜", ("眼镜", "墨镜")),
    ("自行车", ("自行车", "单车")),
    ("衣物", ("外套", "衣服", "围巾", "帽子")),
)
_FLOOR_PATTERNS = (
    re.compile(r"(\d{1,2})\s*(?:F|f|层)"),
    re.compile(r"(\d{1,2})\s*楼(?!号)"),
)
_DATE_PATTERN = re.compile(r"(\d{4})[-/](\d{1,2})[-/](\d{1,2})")
_FENCE_PATTERN = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)
_SYSTEM_PROMPT = (
    "你是校园失物招领助手，只负责把用户描述整理成发布草稿，不批准认领、不确认归还。"
    "只输出一个 JSON 对象，字段为 category、title、description、location_area、building_code、"
    "floor、time_occurred；未知字段填 null。location_area 只能写到建筑与楼层级，"
    "禁止输出精确位置、联系方式、认领证据或他人私密路线。"
)


def _sanitize(value: str) -> str:
    result = value
    for pattern, replacement in _PRIVATE_PATTERNS:
        result = pattern.sub(replacement, result)
    return result


def _clip(value: str, limit: int) -> str:
    return value[:limit]


def _parse_floor(text: str) -> int | None:
    for pattern in _FLOOR_PATTERNS:
        match = pattern.search(text)
        if match is None:
            continue
        floor = int(match.group(1))
        if -3 <= floor <= 100:
            return floor
    return None


def _parse_time(text: str) -> datetime | None:
    match = _DATE_PATTERN.search(text)
    if match is None:
        return None
    try:
        return datetime(int(match.group(1)), int(match.group(2)), int(match.group(3)))
    except ValueError:
        return None


def _match_building(db: Session, text: str) -> Building | None:
    lowered = text.lower()
    for building in db.query(Building).order_by(Building.code).all():
        if building.name in text or building.code.lower() in lowered:
            return building
    return None


def _area_label(building: Building | None, floor: int | None) -> str | None:
    if building is None:
        return None
    return f"{building.name}{floor}F" if floor is not None else building.name


def _detect_category(text: str) -> str | None:
    lowered = text.lower()
    for category, keywords in _CATEGORY_KEYWORDS:
        if any(keyword.lower() in lowered for keyword in keywords):
            return category
    return None


def _first_sentence(text: str) -> str:
    return re.split(r"[。！？!?\n]", text, maxsplit=1)[0].strip() or text


def _rule_draft(db: Session, text: str) -> dict:
    building = _match_building(db, text)
    floor = _parse_floor(text)
    return {
        "category": _detect_category(text),
        "title": _clip(_first_sentence(text), 128),
        "description": _clip(text, 2000),
        "location_area": _area_label(building, floor),
        "building_code": building.code if building is not None else None,
        "floor": floor,
        "time_occurred": _parse_time(text),
        "source": Source.rule,
        "degraded": True,
    }


def _model_messages(text: str) -> list[dict[str, str]]:
    return [
        {"role": "system", "content": _SYSTEM_PROMPT},
        {"role": "user", "content": _sanitize(text)},
    ]


def _parse_model_json(content: str) -> dict | None:
    stripped = _FENCE_PATTERN.sub("", content).strip()
    try:
        payload = json.loads(stripped)
    except (json.JSONDecodeError, TypeError):
        return None
    return payload if isinstance(payload, dict) else None


def _optional_str(payload: dict, key: str, limit: int) -> str | None:
    value = payload.get(key)
    if not isinstance(value, str):
        return None
    cleaned = _sanitize(value.strip())
    return _clip(cleaned, limit) if cleaned else None


def _optional_floor(payload: dict) -> int | None:
    value = payload.get("floor")
    if value is None or isinstance(value, bool):
        return None
    try:
        floor = int(value)
    except (TypeError, ValueError):
        return None
    return floor if -3 <= floor <= 100 else None


def _optional_time(payload: dict) -> datetime | None:
    value = payload.get("time_occurred")
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        return datetime.fromisoformat(value.strip())
    except ValueError:
        return None


def _model_draft(db: Session, text: str) -> dict | None:
    content = model_client.chat_completion(_model_messages(text))
    if content is None:
        return None
    payload = _parse_model_json(content)
    if payload is None:
        logger.warning("模型输出无法解析，已降级")
        return None

    draft = _rule_draft(db, text)
    draft["category"] = _optional_str(payload, "category", 32) or draft["category"]
    draft["title"] = _optional_str(payload, "title", 128) or draft["title"]
    draft["description"] = _optional_str(payload, "description", 2000) or draft["description"]
    floor = _optional_floor(payload)
    draft["floor"] = floor if floor is not None else draft["floor"]
    draft["time_occurred"] = _optional_time(payload) or draft["time_occurred"]

    code = _optional_str(payload, "building_code", 32)
    building = db.query(Building).filter(Building.code == code).first() if code else None
    if building is not None:
        draft["building_code"] = building.code
        # 只回填建筑与楼层，避免模型把楼内精确位置写进公开地点。
        draft["location_area"] = _area_label(building, draft["floor"])
    else:
        draft["location_area"] = _optional_str(payload, "location_area", 128) or draft["location_area"]

    draft["source"] = Source.model
    draft["degraded"] = False
    return draft


def draft_post(db: Session, text: str) -> dict:
    cleaned = _sanitize(text.strip())
    if model_client.is_available():
        draft = _model_draft(db, cleaned)
        if draft is not None:
            return draft
    return _rule_draft(db, cleaned)


def search_advice(db: Session, user: User, body: SearchAdviceRequest) -> dict:
    return advice_service.recommend(db, user, body)
