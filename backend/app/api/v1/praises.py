import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models import User
from app.schemas.common import Page
from app.schemas.praise import PraiseCreate, PraiseOut, PraiseUpdate
from app.services import praise_service

router = APIRouter(tags=["praises"])


@router.get("/praises/lookup-user")
def lookup_user(
    username: str = Query(..., min_length=1, max_length=64),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return praise_service.lookup_user(db, username)


@router.get("/praises", response_model=Page[PraiseOut])
def list_praises(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    items, total = praise_service.list_praises(db, user, limit, offset)
    return Page(items=items, total=total, limit=limit, offset=offset)


@router.post("/praises", response_model=PraiseOut)
def create_praise(body: PraiseCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return praise_service.create_praise(db, user, body)


@router.patch("/praises/{praise_id}", response_model=PraiseOut)
def update_praise(
    praise_id: uuid.UUID,
    body: PraiseUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return praise_service.update_praise(db, user, praise_id, body)


@router.delete("/praises/{praise_id}")
def delete_praise(praise_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    praise_service.delete_praise(db, user, praise_id)
    return {"ok": True}
