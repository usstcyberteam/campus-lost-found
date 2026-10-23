import uuid
from datetime import timedelta

from sqlalchemy.orm import Session

from app.models import Item, ItemStatus
from app.services.match_push_service import extract_keywords

# 聚合规则（四条满足 2 条以上即同组）：同地点 / 同类别 / 关键词重叠率>50% / 时间差<7 天
# 候选检索窗口取 30 天：宽于 7 天，保证"时间差"条件真正参与判定而非恒真
GROUP_CANDIDATE_DAYS = 30
GROUP_TIME_WINDOW = timedelta(days=7)
GROUP_OVERLAP_RATE = 0.5
GROUP_MIN_CONDITIONS = 2


def _overlap_rate(a: set[str], b: set[str]) -> float:
    """关键词重叠率：交集 / 较小集合，避免长短描述悬殊时永远无法命中。"""
    if not a or not b:
        return 0.0
    return len(a & b) / min(len(a), len(b))


def _count_conditions(item: Item, item_keywords: set[str], candidate: Item) -> int:
    conditions = 0
    if item.location_area and candidate.location_area == item.location_area:
        conditions += 1
    if candidate.category == item.category:
        conditions += 1
    if _overlap_rate(item_keywords, extract_keywords(candidate.title, candidate.description)) > GROUP_OVERLAP_RATE:
        conditions += 1
    if candidate.created_at is not None and abs(candidate.created_at - item.created_at) < GROUP_TIME_WINDOW:
        conditions += 1
    return conditions


def assign_group(db: Session, item: Item) -> None:
    """发布时判定相似帖聚合：命中的帖子标记同一 group_id（与发布同事务提交）。

    命中多个已有组时归入最新候选的组；命中项均无组时新建 group_id 并把无组候选一并入组。
    """
    if item.created_at is None:
        # flush 后 server_default 尚未回填时刷新一次，保证时间条件可用
        db.refresh(item)
    if item.created_at is None:
        return
    candidates = (
        db.query(Item)
        .filter(
            Item.id != item.id,
            Item.status != ItemStatus.deleted,
            Item.created_at >= item.created_at - timedelta(days=GROUP_CANDIDATE_DAYS),
        )
        .order_by(Item.created_at.desc())
        .all()
    )
    item_keywords = extract_keywords(item.title, item.description)
    hits: list[Item] = []
    group_id: uuid.UUID | None = None
    for candidate in candidates:
        if _count_conditions(item, item_keywords, candidate) < GROUP_MIN_CONDITIONS:
            continue
        hits.append(candidate)
        if candidate.group_id is not None:
            group_id = candidate.group_id
    if not hits:
        return
    if group_id is None:
        group_id = uuid.uuid4()
    item.group_id = group_id
    for candidate in hits:
        if candidate.group_id is None:
            candidate.group_id = group_id
