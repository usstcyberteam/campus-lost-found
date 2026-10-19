import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models import User
from app.schemas.helper import HelperOut, ThankOut, ThankRequest
from app.services import helper_service

router = APIRouter(tags=["helpers"])


@router.post("/items/{item_id}/helpers", response_model=HelperOut)
def take_helper(item_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return helper_service.take_helper(db, user, item_id)


@router.delete("/items/{item_id}/helpers", response_model=HelperOut)
def abandon_helper(item_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return helper_service.abandon_helper(db, user, item_id)


@router.post("/items/{item_id}/thank", response_model=ThankOut)
def thank_helpers(
    item_id: uuid.UUID,
    body: ThankRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return helper_service.thank_helpers(db, user, item_id, body)
