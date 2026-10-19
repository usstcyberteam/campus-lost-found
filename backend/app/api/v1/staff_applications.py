import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import require_role
from app.database import get_db
from app.models import Role, StaffStatus, User
from app.schemas.auth import UserOut
from app.schemas.common import Page
from app.schemas.staff_application import StaffApplicationOut, StaffRejectRequest
from app.services import staff_application_service

router = APIRouter(tags=["staff-applications"])


def _to_out(user: User) -> StaffApplicationOut:
    return StaffApplicationOut(
        user_id=user.id,
        username=user.username,
        display_name=user.display_name,
        staff_no=user.staff_no,
        department=user.department,
        staff_status=user.staff_status,
        created_at=user.created_at,
    )


@router.get("/staff-applications", response_model=Page[StaffApplicationOut])
def list_staff_applications(
    status: StaffStatus = Query(StaffStatus.pending),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    _: User = Depends(require_role(Role.admin)),
):
    users, total = staff_application_service.list_applications(db, status, limit, offset)
    return Page(items=[_to_out(u) for u in users], total=total, limit=limit, offset=offset)


@router.post("/staff-applications/{user_id}/approve", response_model=UserOut)
def approve_staff_application(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(Role.admin)),
):
    return staff_application_service.approve(db, user_id)


@router.post("/staff-applications/{user_id}/reject", response_model=UserOut)
def reject_staff_application(
    user_id: uuid.UUID,
    body: StaffRejectRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(Role.admin)),
):
    return staff_application_service.reject(db, user_id, body)
