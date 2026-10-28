import uuid

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models import User
from app.services import user_service

router = APIRouter(tags=["users"])


@router.get("/{user_id}/avatar")
def avatar(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    data = user_service.load_avatar(db, user_id)
    # 地址带版本参数，换头像后 URL 会变，可以放心长缓存
    return Response(content=data, media_type="image/webp", headers={"Cache-Control": "private, max-age=86400"})
