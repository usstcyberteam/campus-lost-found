import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models import User
from app.schemas.reaction import ReactionOut
from app.services import reaction_service

router = APIRouter(tags=["reactions"])


@router.post("/items/{item_id}/like", response_model=ReactionOut)
def like_item(item_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return reaction_service.set_like(db, user, item_id, True)


@router.delete("/items/{item_id}/like", response_model=ReactionOut)
def unlike_item(item_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return reaction_service.set_like(db, user, item_id, False)


@router.post("/items/{item_id}/favorite", response_model=ReactionOut)
def favorite_item(item_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return reaction_service.set_favorite(db, user, item_id, True)


@router.delete("/items/{item_id}/favorite", response_model=ReactionOut)
def unfavorite_item(item_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return reaction_service.set_favorite(db, user, item_id, False)
