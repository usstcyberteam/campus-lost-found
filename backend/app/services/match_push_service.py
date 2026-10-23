import logging
import re
import uuid
from datetime import timedelta

from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Direction, Item, ItemStatus, Notification, Source

logger = logging.getLogger("uvicorn.error")

# 规则参数：地点/类别由 SQL 精确匹配，关键词重叠在内存里计算（均为确定性规则，不调用模型）
KEYWORD_MIN_OVERLAP = 2
MATCH_WINDOW_DAYS = 30

# 智能匹配推送的触发场景与文案
LOST_OWNER_TEMPLATE = "🔔 你的失物可能有消息了！有人发布了「{title}」，地点：{location}。点击查看 → {link}"
FOUND_OWNER_TEMPLATE = "🔔 你拾获的物品可能有人正在寻找！发布了「{title}」，地点：{location}。点击查看 → {link}"

# 反向状态未完成集合：寻物=未找回，拾获=未归还
_ACTIVE_BY_DIRECTION = {
    Direction.lost: (ItemStatus.searching, ItemStatus.reviewing),
    Direction.found: (ItemStatus.pending, ItemStatus.reviewing),
}

_WORD_RE = re.compile(r"[A-Za-z0-9]+")
_CJK_RE = re.compile(r"[\u4e00-\u9fff]+")


def extract_keywords(*texts: str) -> set[str]:
    """关键词提取：英文/数字按词、中文按相邻双字，统一小写去重。"""
    keywords: set[str] = set()
    for text in texts:
        if not text:
            continue
        for match in _WORD_RE.finditer(text):
            keywords.add(match.group().lower())
        for match in _CJK_RE.finditer(text):
            segment = match.group()
            if len(segment) == 1:
                keywords.add(segment)
            for i in range(len(segment) - 1):
                keywords.add(segment[i : i + 2])
    return keywords


def find_matches(db: Session, new_item: Item) -> list[Item]:
    """检索新帖的历史匹配候选：反方向 + 同地点 + 同类别 + 状态未完成 + 30 天内 + 关键词重叠。"""
    opposite = Direction.found if new_item.direction == Direction.lost else Direction.lost
    if not new_item.location_area or new_item.created_at is None:
        return []
    # 以新帖自身创建时间回推窗口：与候选同为数据库时钟体系，规避本地/UTC 差异
    cutoff = new_item.created_at - timedelta(days=MATCH_WINDOW_DAYS)
    candidates = (
        db.query(Item)
        .filter(
            Item.direction == opposite,
            Item.status.in_(_ACTIVE_BY_DIRECTION[opposite]),
            Item.category == new_item.category,
            Item.location_area == new_item.location_area,
            Item.owner_user_id != new_item.owner_user_id,
            Item.id != new_item.id,
            Item.created_at >= cutoff,
        )
        .all()
    )
    new_keywords = extract_keywords(new_item.title, new_item.description)
    if len(new_keywords) < KEYWORD_MIN_OVERLAP:
        return []
    matched: list[Item] = []
    for candidate in candidates:
        overlap = new_keywords & extract_keywords(candidate.title, candidate.description)
        if len(overlap) >= KEYWORD_MIN_OVERLAP:
            matched.append(candidate)
    return matched


def _notify_matched(db: Session, new_item: Item, matched: Item) -> bool:
    """写一条匹配通知；dedup_key 唯一约束保证同组合只推一次。"""
    dedup_key = f"ai_match:{new_item.id}:{matched.id}"
    existed = db.query(Notification.id).filter(Notification.dedup_key == dedup_key).first()
    if existed is not None:
        return False
    link = f"/hall/{new_item.id}"
    if matched.direction == Direction.lost:
        content = LOST_OWNER_TEMPLATE.format(title=new_item.title, location=new_item.location_area, link=link)
    else:
        content = FOUND_OWNER_TEMPLATE.format(title=new_item.title, location=new_item.location_area, link=link)
    db.add(
        Notification(
            user_id=matched.owner_user_id,
            kind="ai_match",
            title=f"「{new_item.title}」匹配提醒",
            content=content,
            link=link,
            related_item_id=matched.id,
            source=Source.rule,
            dedup_key=dedup_key,
        )
    )
    return True


def push_matches(db: Session, item: Item) -> list[dict]:
    """对指定帖执行匹配并写通知，返回逐条命中详情（含本次是否新建通知）。"""
    results: list[dict] = []
    for matched in find_matches(db, item):
        created = _notify_matched(db, item, matched)
        results.append(
            {
                "item_id": str(matched.id),
                "title": matched.title,
                "category": matched.category,
                "location_area": matched.location_area,
                "notified": created,
            }
        )
    if results:
        db.commit()
    return results


def run_match_push(item_id: uuid.UUID | str) -> None:
    """BackgroundTasks 入口：独立会话执行推送；任何失败只记日志，不影响已发布的帖子。"""
    db = SessionLocal()
    try:
        item = db.get(Item, uuid.UUID(str(item_id)))
        if item is not None:
            push_matches(db, item)
    except Exception:
        logger.warning("ai match push failed for item %s", item_id, exc_info=True)
    finally:
        db.close()


def list_notifications(db: Session, user_id: uuid.UUID, limit: int, offset: int) -> tuple[list[Notification], int]:
    query = db.query(Notification).filter(Notification.user_id == user_id)
    total = query.count()
    rows = query.order_by(Notification.created_at.desc()).offset(offset).limit(limit).all()
    return rows, total
