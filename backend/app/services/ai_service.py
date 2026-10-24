import json
import logging
import re
from datetime import datetime

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.errors import ApiError
from app.models import Building, Item, User
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
_BOLD_PATTERN = re.compile(r"\*\*([^*]+)\*\*|__([^_]+)__")
_HEADING_PATTERN = re.compile(r"^\s*#{1,6}\s*", re.MULTILINE)
_LIST_BULLET_PATTERN = re.compile(r"^\s*[-*]\s+", re.MULTILINE)
_SYSTEM_PROMPT = (
    "你是校园失物招领助手，只负责把用户描述整理成发布草稿，不批准认领、不确认归还。"
    "只输出一个 JSON 对象，字段为 category、title、description、location_area、building_code、"
    "floor、time_occurred；未知字段填 null。location_area 只能写到建筑与楼层级，"
    "禁止输出精确位置、联系方式、认领证据或他人私密路线。"
)
_CHAT_SYSTEM_PROMPT = (
    "你是校园失物招领智能助手，专注校园场景（图书馆、食堂、教学楼、宿舍、操场等），"
    "职责是把用户描述整理成发帖草稿并引导补充信息，不批准认领、不确认归还。"
    "只输出一个 JSON 对象，字段固定为 intent、reply、form_patch、actions，不得增删字段、不得输出 JSON 以外的任何文本。"
    "reply 为纯文本，语气亲切简短（不超过 60 字），禁止任何 markdown 标记。"
    "intent 判断：用户描述丢失或拾获物品，且除物品名称外还提到颜色样式、时间、建筑楼层中至少一项时，"
    'intent 为 "draft"，reply 直接确认已整理好草稿；'
    '描述模糊、只有物品名称（如只说"掉了一把伞"）时，intent 为 "chat"，'
    "reply 用一句话引导补充颜色样式、时间、具体建筑与楼层，此时 form_patch 必须为 null，不要强行预填；"
    '普通咨询或寒暄时，intent 为 "chat"，form_patch 为 null。'
    "form_patch 仅在 intent 为 draft 时为对象，字段为 category、title、description、location_area、"
    "building_code、floor、time_occurred。只填用户明确提到的信息："
    "未提及的字段一律填 null，禁止填空字符串，禁止推断或编造；"
    "category 从雨伞、水杯、手机、笔记本电脑、耳机、钱包、校园卡、钥匙、书包、衣物、身份证、充电宝中选取，"
    "都不符合时填 null；title 为一句话概括（不超过 30 字）；description 摘录用户描述中的物品特征；"
    "location_area 只能写到建筑与楼层级（如 图书馆3F）；building_code 填校园建筑编码（如图书馆为 B02），"
    "无法确定就填 null；time_occurred 填 ISO 格式日期时间，相对时间（如今天下午3点）按当天换算，无法确定就填 null。"
    'actions 为字符串数组，仅在 intent 为 draft 且 form_patch 至少一个字段非 null 时包含 "prefill_form"，否则为空数组。'
    "禁止输出精确到座位、柜号的私密位置、联系方式、认领证据或他人路线。"
)
_CHAT_HISTORY_PROMPT = (
    "历史消息会提供此前几轮对话：结合上下文累积理解用户信息，用户已回答过的问题不要重复追问；"
    "当物品名称及颜色样式、时间、建筑楼层等信息攒齐时，输出 intent=draft 并返回完整 form_patch；"
    "仍缺关键信息时，一次只追问 1-2 个最关键的缺失项，form_patch 保持 null。"
)
_CHAT_EMOTION_PROMPT = (
    "情绪安抚：识别用户消息中的焦虑或沮丧情绪（如出现 急、烦、怎么办、找不到了、好难过 等词）。"
    "检测到情绪时，约六成概率在 reply 的开头或结尾加一句不超过 20 字的轻安抚，"
    '例如"别着急，慢慢想 🍀""丢东西确实心烦，深呼吸～""会找到的，我帮你一起回忆"；'
    "其余四成概率以及用户无明显情绪时省略安抚，正常回应即可。"
    "禁止说教、禁止每次都加、禁止连续多轮重复同一句安抚。"
)
_CHAT_POLISH_PROMPT = (
    "用户要求润色发布描述：message 是表单字段摘要（类型/类别/标题/地点/时间/现有描述）。"
    "基于这些信息写一段 60-120 字、有温度的失物或招领描述：交代时间地点、物品特征，"
    "结尾加一句自然的求助或致谢。reply 放润色后的完整描述；form_patch 仅含 description 字段"
    "（与 reply 相同的润色文案）；intent 为 draft；actions 为空数组。不得编造摘要中没有的信息。"
)
_CHAT_FALLBACK_REPLY = "模型暂不可用，已按规则整理出草稿，请手动补充。"
_CHAT_INTRO_REPLY = "我在这里帮你整理丢失或拾获物品的描述，直接告诉我物品特征和地点即可。"
_FORM_PATCH_KEYS = ("category", "title", "description", "location_area", "building_code", "floor", "time_occurred")


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


def _strip_markdown(text: str) -> str:
    without_fence = _FENCE_PATTERN.sub("", text).strip()
    without_bold = _BOLD_PATTERN.sub(r"\1\2", without_fence)
    without_heading = _HEADING_PATTERN.sub("", without_bold)
    return _LIST_BULLET_PATTERN.sub("", without_heading).strip()


def _merge_draft(db: Session, text: str, payload: dict) -> dict:
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


def _model_draft(db: Session, text: str) -> dict | None:
    content = model_client.chat_completion(_model_messages(text))
    if content is None:
        return None
    payload = _parse_model_json(content)
    if payload is None:
        logger.warning("模型输出无法解析，已降级")
        return None
    return _merge_draft(db, text, payload)


def draft_post(db: Session, text: str) -> dict:
    cleaned = _sanitize(text.strip())
    if model_client.is_available():
        draft = _model_draft(db, cleaned)
        if draft is not None:
            return draft
    return _rule_draft(db, cleaned)


def _chat_messages(
    text: str,
    action: str | None = None,
    history_places: list[str] | None = None,
    history: list[dict[str, str]] | None = None,
) -> list[dict[str, str]]:
    # 注入当前时间，供模型换算"今天/昨天"等相对时间，避免幻觉日期。
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    system = _CHAT_SYSTEM_PROMPT + _CHAT_EMOTION_PROMPT + f"当前时间：{now}。"
    if action == "draft":
        system += (
            "用户明确要求整理草稿：无论信息是否完整，都输出 intent=draft，"
            "把能识别到的字段全部填入 form_patch（能提取多少提取多少），不要追问。"
        )
    if action == "polish":
        system += _CHAT_POLISH_PROMPT
    if history:
        system += _CHAT_HISTORY_PROMPT
    if history_places:
        system += f"该用户历史发帖常涉及的地点：{'、'.join(history_places)}（可在回复中适当参考推荐）。"
    messages: list[dict[str, str]] = [{"role": "system", "content": system}]
    for item in history or []:
        messages.append({"role": item["role"], "content": _sanitize(item["text"])})
    messages.append({"role": "user", "content": _sanitize(text)})
    return messages


def _chat_intent(payload: dict) -> str:
    return payload.get("intent") if payload.get("intent") in ("draft", "chat") else "draft"


def _chat_reply(payload: dict, fallback: str) -> str:
    value = payload.get("reply")
    if not isinstance(value, str):
        return fallback
    cleaned = _sanitize(_strip_markdown(value))
    return _clip(cleaned, 2000) if cleaned else fallback


def _chat_actions(payload: dict) -> list[str]:
    value = payload.get("actions")
    if not isinstance(value, list):
        return []
    return [item for item in value if item == "prefill_form"]


def _form_patch_only(draft: dict) -> dict:
    return {key: draft.get(key) for key in _FORM_PATCH_KEYS}


def _chat_form_patch(db: Session, text: str, payload: dict) -> dict | None:
    """只提取模型明确给出的字段，不做规则兜底填充：未提及即 null，全空则不预填。

    例外：floor 允许用原文正则兜底——楼层若在原文明确写出（如"3楼"），属于用户明确提到的信息。
    """
    patch_payload = payload.get("form_patch")
    if not isinstance(patch_payload, dict):
        return None
    patch = {
        "category": _optional_str(patch_payload, "category", 32),
        "title": _optional_str(patch_payload, "title", 128),
        "description": _optional_str(patch_payload, "description", 2000),
        "location_area": _optional_str(patch_payload, "location_area", 128),
        "building_code": None,
        "floor": _optional_floor(patch_payload),
        "time_occurred": _optional_time(patch_payload),
    }
    if patch["floor"] is None:
        patch["floor"] = _parse_floor(text)
    code = _optional_str(patch_payload, "building_code", 32)
    building = db.query(Building).filter(Building.code == code).first() if code else None
    if building is not None:
        patch["building_code"] = building.code
        # 地点只保留建筑与楼层级，避免模型把楼内精确位置写进公开字段。
        patch["location_area"] = _area_label(building, patch["floor"]) or patch["location_area"]
    if all(value is None for value in patch.values()):
        return None
    return patch


def _model_chat(db: Session, text: str, payload: dict) -> dict:
    intent = _chat_intent(payload)
    form_patch = _chat_form_patch(db, text, payload) if intent == "draft" else None
    actions = _chat_actions(payload)
    if form_patch is not None:
        actions = list(dict.fromkeys([*actions, "prefill_form"]))
    return {
        "intent": intent,
        "reply": _chat_reply(payload, "已整理出草稿，请确认或修改后发布。" if intent == "draft" else "收到。"),
        "form_patch": form_patch,
        "actions": actions,
        "source": Source.model,
        "degraded": False,
    }


_POLISH_FIELD_PATTERN = re.compile(r"(类型|类别|标题|地点|时间|现有描述)：(.*)")


def _rule_polish(text: str) -> dict:
    """润色降级：从字段摘要正则抽取，套固定模板拼一段基础描述。"""
    fields = {key.strip(): value.strip() for key, value in _POLISH_FIELD_PATTERN.findall(text)}
    kind = "不慎遗失" if "丢失" in fields.get("类型", "") else "拾获"
    lead = ""
    if fields.get("时间"):
        lead += fields["时间"]
    if fields.get("地点"):
        lead += f"在{fields['地点']}"
    sentence = f"{lead}{kind}了{fields.get('类别') or '一件物品'}"
    if fields.get("标题"):
        sentence += f"（{fields['标题']}）"
    parts = [sentence.rstrip()]
    if fields.get("现有描述"):
        parts.append(fields["现有描述"])
    parts.append("如有同学发现，恳请与我联系，非常感谢！")
    reply = _clip("，".join(part for part in parts if part), 2000)
    return {
        "intent": "draft",
        "reply": reply,
        "form_patch": {"description": reply},
        "actions": [],
        "source": Source.rule,
        "degraded": True,
    }


def _rule_chat(db: Session, text: str, action: str | None = None) -> dict:
    if action == "polish":
        return _rule_polish(text)
    draft = _rule_draft(db, text)
    has_item_signal = any(draft.get(key) is not None for key in ("category", "building_code", "floor"))
    if action == "draft":
        # 强制整理草稿：规则路径也要返回 form_patch（模糊输入时 title 兜底为原文）
        patch = _form_patch_only(draft)
        if patch.get("title") is None:
            patch["title"] = _clip(text, 128) or None
        if not any(value is not None for value in patch.values()):
            patch["title"] = _clip(text, 128)
        return {
            "intent": "draft",
            "reply": "模型暂不可用，已按规则整理出草稿，请手动补充。",
            "form_patch": patch,
            "actions": ["prefill_form"],
            "source": Source.rule,
            "degraded": True,
        }
    if has_item_signal:
        return {
            "intent": "draft",
            "reply": _CHAT_FALLBACK_REPLY,
            "form_patch": _form_patch_only(draft),
            "actions": ["prefill_form"],
            "source": Source.rule,
            "degraded": True,
        }
    return {
        "intent": "chat",
        "reply": _CHAT_INTRO_REPLY,
        "form_patch": None,
        "actions": [],
        "source": Source.rule,
        "degraded": True,
    }


def _user_history_places(db: Session, user: User, limit: int = 3) -> list[str]:
    rows = (
        db.query(Item.location_area, func.count(Item.id).label("count"))
        .filter(Item.owner_user_id == user.id, Item.location_area != "")
        .group_by(Item.location_area)
        .order_by(func.count(Item.id).desc())
        .limit(limit)
        .all()
    )
    return [row[0] for row in rows]


_TRANSLATE_LANG_NAMES = {"en": "English", "ja": "Japanese (日本語)", "ko": "Korean (한국어)"}


def _translate_messages(text: str, target_lang: str) -> list[dict[str, str]]:
    system = (
        f"你是专业翻译引擎。把用户文本完整翻译成{_TRANSLATE_LANG_NAMES[target_lang]}。"
        "只输出译文本身：不要解释、不要引号、不要重复原文、不要添加任何额外说明。"
        "保留数字、标点与换行；无法翻译的专有名词保持原样。"
    )
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": text},
    ]


def _translate(text: str, target_lang: str | None) -> dict:
    """action=translate 分支：模型可用走模型，不可用/失败一律 degraded 降级（reply 为空，前端提示稍后重试）。"""
    if target_lang not in _TRANSLATE_LANG_NAMES:
        raise ApiError(400, "VALIDATION", "翻译必须指定目标语言（en/ja/ko）")
    cleaned = _clip(_sanitize(text.strip()), 2000)
    if not cleaned:
        raise ApiError(400, "VALIDATION", "待翻译文本不能为空")
    if model_client.is_available():
        content = model_client.chat_completion(_translate_messages(cleaned, target_lang))
        if content is not None:
            translated = _clip(_strip_markdown(content.strip()), 2000)
            if translated:
                return {
                    "intent": "chat",
                    "reply": translated,
                    "form_patch": None,
                    "actions": [],
                    "source": Source.model,
                    "degraded": False,
                }
        logger.warning("翻译模型调用失败或输出为空，已降级")
    return {
        "intent": "chat",
        "reply": "",
        "form_patch": None,
        "actions": [],
        "source": Source.rule,
        "degraded": True,
    }


def chat(
    db: Session,
    message: str,
    action: str | None = None,
    user: User | None = None,
    history: list[dict[str, str]] | None = None,
    text: str | None = None,
    target_lang: str | None = None,
) -> dict:
    # 翻译是单轮确定性任务：不走多轮历史与意图判定，直接短路
    if action == "translate":
        source = text.strip() if text is not None and text.strip() else message
        return _translate(source, target_lang)
    cleaned = _sanitize(message.strip())
    history_places = _user_history_places(db, user) if user is not None else []
    if model_client.is_available():
        content = model_client.chat_completion(_chat_messages(cleaned, action, history_places, history))
        if content is not None:
            payload = _parse_model_json(content)
            if payload is not None:
                if action == "draft":
                    payload["intent"] = "draft"
                result = _model_chat(db, cleaned, payload)
                if action == "polish":
                    # 润色场景语义收敛：reply 即润色文案，form_patch 仅透出 description，不触发预填
                    result["actions"] = []
                    if result["form_patch"] is not None:
                        result["form_patch"] = {"description": result["form_patch"].get("description")}
                return result
            logger.warning("模型输出无法解析，已降级")
    # 规则降级同样要吃进多轮信息：把历史用户消息拼接进提取文本，
    # 避免模型不可用时只按最后一轮提取（信息分散在几轮补充里会被丢弃）。
    # polish 的 message 是字段摘要格式，拼接历史会破坏解析，跳过。
    if history and action != "polish":
        user_texts = [_sanitize(item["text"]) for item in history if item.get("role") == "user"]
        cleaned = _clip(" ".join([*user_texts, cleaned]), 2000)
    return _rule_chat(db, cleaned, action)


def suggest_locations(db: Session, keyword: str | None, limit: int = 5) -> dict:
    """按历史发帖频次推荐地点：keyword 过滤（模糊输入时返回全局热门）。纯规则，不依赖模型。"""
    query = db.query(Item.location_area, func.count(Item.id).label("count")).filter(Item.location_area != "")
    if keyword:
        query = query.filter(Item.location_area.contains(keyword.strip()))
    rows = (
        query.group_by(Item.location_area).order_by(func.count(Item.id).desc(), Item.location_area).limit(limit).all()
    )
    return {"locations": [row[0] for row in rows]}


def search_advice(db: Session, user: User, body: SearchAdviceRequest) -> dict:
    return advice_service.recommend(db, user, body)


_THANK_YOU_SYSTEM_PROMPT = (
    "你是校园失物招领助手，帮找回物品的用户向拾获者写感谢语。"
    "只输出一个 JSON 对象，字段固定为 warm、cute、formal，不得增删字段、不得输出 JSON 以外的任何文本。"
    "三种风格各写一段：warm 温暖真诚（40-80 字）；cute 活泼可爱、可用表情符号（30-60 字）；"
    "formal 正式得体（50-100 字）。内容围绕物品与找回地点，拾获者留言如有提供则适当呼应。"
    "tone 为 short 时三段整体写得更简短。禁止出现联系方式、真实姓名、认领证据等私密信息，禁止 markdown 标记。"
)
_THANK_YOU_TEMPLATES = {
    "warm": "感谢好心人捡到我的{item_title}！在{location}找回来真的太幸运了，非常感谢你的善意 🙏",
    "cute": "呜呜呜谢谢你捡到我的{item_title}！你人好好哦～祝你天天开心万事胜意 ✨",
    "formal": "您好，感谢您捡到并归还我的{item_title}。您的善举让我深受感动，特此致谢。",
}
_THANK_YOU_TONE_LABELS = {"warm": "温暖", "cute": "活泼", "formal": "正式", "short": "简短"}


def _thank_you_messages(
    item_title: str, item_location: str, finder_note: str | None, tone: str
) -> list[dict[str, str]]:
    parts = [f"物品：{item_title}", f"找回地点：{item_location}"]
    if finder_note:
        parts.append(f"拾获者留言：{finder_note}")
    parts.append(f"首选风格：{tone}（{_THANK_YOU_TONE_LABELS.get(tone, tone)}）")
    return [
        {"role": "system", "content": _THANK_YOU_SYSTEM_PROMPT},
        {"role": "user", "content": _sanitize("；".join(parts))},
    ]


def _rule_thank_you(item_title: str, item_location: str) -> dict:
    # 模板内的占位符按需替换：cute/formal 模板不含地点，format 忽略多余命名参数
    return {
        key: template.format(item_title=item_title, location=item_location)
        for key, template in _THANK_YOU_TEMPLATES.items()
    }


def _model_thank_you(payload: dict) -> dict | None:
    """提取三风格感谢语；任一风格缺失即整体降级，保证前端总能拿到三段可选项。"""
    styles = {key: _optional_str(payload, key, 500) for key in ("warm", "cute", "formal")}
    if any(value is None for value in styles.values()):
        return None
    return {key: _strip_markdown(value) for key, value in styles.items()}


def thank_you(item_title: str, item_location: str, finder_note: str | None, tone: str) -> dict:
    cleaned_title = _sanitize(item_title.strip())
    cleaned_location = _sanitize(item_location.strip())
    cleaned_note = _sanitize(finder_note.strip()) if finder_note else None
    if model_client.is_available():
        content = model_client.chat_completion(_thank_you_messages(cleaned_title, cleaned_location, cleaned_note, tone))
        if content is not None:
            payload = _parse_model_json(content)
            if payload is not None:
                styles = _model_thank_you(payload)
                if styles is not None:
                    return {**styles, "tone": tone, "source": Source.model, "degraded": False}
            logger.warning("感谢语模型输出无法解析，已降级")
    return {
        **_rule_thank_you(cleaned_title, cleaned_location),
        "tone": tone,
        "source": Source.rule,
        "degraded": True,
    }


# 归还建议：纯规则的关键词映射，顺序即优先级（证件类在前避免"校园卡"被泛类误吞）
_RETURN_TYPE_SUGGESTIONS = (
    (
        ("证件", "校园卡", "学生证", "身份证", "一卡通", "饭卡", "钥匙", "护照", "卡包"),
        ("请喝咖啡", "说声谢谢"),
    ),
    (
        ("手机", "电话", "电脑", "笔记本", "平板", "钱包", "相机", "手表", "耳机"),
        ("发个小红包", "请吃顿饭", "送个小礼物"),
    ),
    (("雨伞", "伞", "水杯", "杯子", "文具", "笔", "书本", "书包", "充电宝", "数据线"), ("请喝杯奶茶", "说声谢谢就好")),
)
_RETURN_VALUABLE_SUGGESTIONS = ("正式感谢信", "送花/礼物", "发朋友圈表扬")
_RETURN_DEFAULT_SUGGESTIONS = ("说声谢谢", "请喝杯奶茶")
_RETURN_SUGGESTION_MESSAGE = "失而复得已是很幸运的事，一份小小心意，让善意继续传递。"


def return_suggestion(item_type: str, item_value: str | None) -> dict:
    """按物品类型关键词映射感谢方式；类型未命中且价值为高时走贵重物品清单，其余给默认建议。"""
    cleaned = _sanitize(item_type.strip())
    lowered = cleaned.lower()
    suggestions: tuple[str, ...] = _RETURN_DEFAULT_SUGGESTIONS
    for keywords, mapped in _RETURN_TYPE_SUGGESTIONS:
        if any(keyword.lower() in lowered for keyword in keywords):
            suggestions = mapped
            break
    if suggestions is _RETURN_DEFAULT_SUGGESTIONS and item_value == "高":
        suggestions = _RETURN_VALUABLE_SUGGESTIONS
    return {"suggestions": list(suggestions), "message": _RETURN_SUGGESTION_MESSAGE}
