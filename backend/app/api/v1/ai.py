from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models import User
from app.schemas.ai import (
    ChatOut,
    ChatRequest,
    DraftPostOut,
    DraftPostRequest,
    SearchAdviceOut,
    SearchAdviceRequest,
    SuggestLocationsOut,
)
from app.services import ai_service

router = APIRouter(tags=["ai"])


@router.post("/chat", response_model=ChatOut)
def chat(
    body: ChatRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return ai_service.chat(db, body.message, body.action, user)


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
