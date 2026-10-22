from sqlalchemy.orm import Session

from app.models import Direction, Item, ItemStatus


def find_candidates(db: Session, lost_item: Item) -> list[dict]:
    # 根据寻物记录的类别与地点，对候选拾获记录做规则打分，最多返回 3 个。
    found_items = (
        db.query(Item)
        .filter(Item.direction == Direction.found, Item.status.in_([ItemStatus.pending, ItemStatus.reviewing]))
        .all()
    )
    scored: list[tuple[Item, float, list[str]]] = []
    for found in found_items:
        if found.id == lost_item.id:
            continue
        score = 0.0
        reasons: list[str] = []
        if found.category == lost_item.category:
            score += 1.0
            reasons.append("类别一致")
        if lost_item.location_area and found.location_area == lost_item.location_area:
            score += 0.5
            reasons.append("地点一致")
        if score > 0:
            scored.append((found, score, reasons))

    scored.sort(key=lambda x: x[1], reverse=True)
    top = scored[:3]

    return [
        {
            "found_item_id": str(found.id),
            "score": score,
            "explanation": "；".join(reasons),
            "source": "rule",
            "title": found.title,
            "category": found.category,
            "location_area": found.location_area,
        }
        for found, score, reasons in top
    ]
