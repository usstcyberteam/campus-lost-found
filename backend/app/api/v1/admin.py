import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import require_role
from app.database import get_db
from app.models import Role, User
from app.schemas.auth import AdminUserOut, AdminUserUpdate, UserOut
from app.schemas.common import Page
from app.schemas.staff import StaffCreateRequest
from app.schemas.stats import StatsOut
from app.services import stats_service, user_service

router = APIRouter(tags=["admin"])


@router.post("/staff", response_model=UserOut)
def create_staff(body: StaffCreateRequest, db: Session = Depends(get_db), _: User = Depends(require_role(Role.admin))):
    return user_service.create_user(db, body.username, body.password, body.display_name, body.contact, Role.staff)


@router.get("/users", response_model=Page[AdminUserOut])
def list_users(
    q: str | None = None,
    role: Role | None = None,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    _: User = Depends(require_role(Role.admin)),
):
    users, total = user_service.list_users(db, q, role, limit, offset)
    return Page(items=users, total=total, limit=limit, offset=offset)


@router.patch("/users/{user_id}", response_model=AdminUserOut)
def update_user(
    user_id: uuid.UUID,
    body: AdminUserUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_role(Role.admin)),
):
    return user_service.update_user(db, admin, user_id, body)


@router.get("/stats", response_model=StatsOut)
def stats(db: Session = Depends(get_db), _: User = Depends(require_role(Role.admin))):
    return stats_service.overview(db)