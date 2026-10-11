from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import require_role
from app.database import get_db
from app.models import Role, User
from app.schemas.auth import UserOut
from app.schemas.staff import StaffCreateRequest
from app.services import user_service

router = APIRouter(tags=["admin"])


@router.post("/staff", response_model=UserOut)
def create_staff(body: StaffCreateRequest, db: Session = Depends(get_db), _: User = Depends(require_role(Role.admin))):
    return user_service.create_user(db, body.username, body.password, body.display_name, body.contact, Role.staff)
