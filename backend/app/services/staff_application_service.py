import uuid

from sqlalchemy.orm import Session

from app.errors import ApiError
from app.models import Role, StaffStatus, User
from app.schemas.staff_application import StaffApplicationCreate, StaffRejectRequest


def submit_application(db: Session, user: User, body: StaffApplicationCreate) -> User:
    if user.role != Role.student:
        raise ApiError(403, "FORBIDDEN", "仅学生可提交教职工申请")
    if user.staff_status == StaffStatus.pending:
        raise ApiError(409, "STATE_CONFLICT", "申请正在审核中")
    if user.staff_status == StaffStatus.approved:
        raise ApiError(409, "STATE_CONFLICT", "申请已结束，不能重复提交")
    user.staff_no = body.staff_no
    user.department = body.department
    user.staff_status = StaffStatus.pending
    user.staff_reject_reason = None
    db.commit()
    db.refresh(user)
    return user


def list_applications(db: Session, status: StaffStatus, limit: int, offset: int) -> tuple[list[User], int]:
    query = db.query(User).filter(User.staff_status == status)
    total = query.count()
    users = query.order_by(User.created_at.asc()).offset(offset).limit(limit).all()
    return users, total


def _get_pending(db: Session, user_id: uuid.UUID) -> User:
    target = db.get(User, user_id)
    if target is None:
        raise ApiError(404, "NOT_FOUND", "用户不存在")
    if target.staff_status != StaffStatus.pending:
        raise ApiError(409, "STATE_CONFLICT", "申请状态不是待审核")
    return target


def approve(db: Session, user_id: uuid.UUID) -> User:
    target = _get_pending(db, user_id)
    target.staff_status = StaffStatus.approved
    target.role = Role.staff
    target.staff_reject_reason = None
    db.commit()
    db.refresh(target)
    return target


def reject(db: Session, user_id: uuid.UUID, body: StaffRejectRequest) -> User:
    target = _get_pending(db, user_id)
    target.staff_status = StaffStatus.rejected
    target.staff_reject_reason = body.reason
    db.commit()
    db.refresh(target)
    return target
