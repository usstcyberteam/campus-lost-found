from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import require_role
from app.core.security import hash_password
from app.database import get_db
from app.errors import ApiError
from app.models import Role, User
from app.schemas.auth import UserOut
from app.schemas.staff import StaffCreateRequest

router = APIRouter(tags=["admin"])


@router.post("/staff", response_model=UserOut)
def create_staff(body: StaffCreateRequest, db: Session = Depends(get_db), _: User = Depends(require_role(Role.admin))):
    exists = db.query(User).filter(User.username == body.username).first()
    if exists is not None:
        raise ApiError(409, "STATE_CONFLICT", "用户名已存在")
    user = User(
        username=body.username,
        password_hash=hash_password(body.password),
        display_name=body.display_name,
        contact=body.contact,
        role=Role.staff,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
