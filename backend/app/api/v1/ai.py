from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.errors import ApiError
from app.models import Item, Role, User
from app.schemas.ai import (
    ChatOut,
    ChatRequest,
    DraftPostOut,
    DraftPostRequest,
    MatchOut,
    MatchRequest,
    SearchAdviceOut,
    SearchAdviceRequest,
    SuggestLocationsOut,
)
from app.services import ai_service, match_push_service

router = APIRouter(tags=["ai"])


@router.post("/chat", response_model=ChatOut)
def chat(
    body: ChatRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    history = [{"role": item.role, "text": item.text} for item in body.history]
    return ai_service.chat(db, body.message, body.action, user, history, body.text, body.target_lang)


@router.post("/match", response_model=MatchOut)
def match(
    body: MatchRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # 手动触发匹配仅限帖主与管理员：避免他人借接口探测别人帖子的匹配关系
    item = db.get(Item, body.item_id)
    if item is None:
        raise ApiError(404, "NOT_FOUND", "帖子不存在")
    if item.owner_user_id != user.id and user.role != Role.admin:
        raise ApiError(403, "FORBIDDEN", "只能对自己的帖子触发匹配")
    results = match_push_service.push_matches(db, item)
    return {
        "item_id": str(item.id),
        "matched": len(results),
        "notified": sum(1 for r in results if r["notified"]),
        "items": results,
        "source": "rule",
    }


@router.get("/suggest-locations", response_model=SuggestLocationsOut)
def suggest_locations(
    keyword: str | None = Query(default=None, max_length=64),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return ai_service.suggest_locations(db, keyword)


@router.post("/draft-post", response_model=DraftPostOut)
def draft_post(
    body: DraftPostRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return ai_service.draft_post(db, body.text)


@router.post("/search-advice", response_model=SearchAdviceOut)
def search_advice(
    body: SearchAdviceRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return ai_service.search_advice(db, user, body)
