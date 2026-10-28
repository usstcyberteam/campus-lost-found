import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import require_admin, require_role
from app.database import get_db
from app.models import Role, User
from app.schemas.auth import AdminUserOut, AdminUserUpdate, UserOut
from app.schemas.common import Page
from app.schemas.item import BatchDeleteOut, BatchDeleteRequest, ItemPublic
from app.schemas.staff import StaffCreateRequest
from app.schemas.stats import StatsOut
from app.services import item_service, stats_service, user_service

router = APIRouter(tags=["admin"])


@router.post("/staff", response_model=UserOut)
def create_staff(body: StaffCreateRequest, db: Session = Depends(get_db), _: User = Depends(require_role(Role.admin))):
    return user_service.create_user(db, body.username, body.password, body.display_name, body.contact, Role.staff)


@router.delete("/posts/{post_id}", response_model=ItemPublic)
def admin_delete_post(
    post_id: uuid.UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    # 管理员治理下架任意帖子：软删除 + 留痕（deleted_at/deleted_by_id）+ 审计日志
    return item_service.delete_item(db, admin, post_id)


@router.post("/posts/batch-delete", response_model=BatchDeleteOut)
def admin_batch_delete_posts(
    body: BatchDeleteRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return item_service.batch_delete_items(db, admin, body.post_ids)


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
