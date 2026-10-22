import uuid

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.errors import ApiError
from app.models import Role, StaffStatus, User
from app.schemas.auth import AdminUserUpdate, PasswordChangeRequest, ProfileUpdate


def create_user(
    db: Session,
    username: str,
    password: str,
    display_name: str,
    contact: str | None,
    role: Role,
    staff_status: StaffStatus = StaffStatus.none,
    staff_no: str | None = None,
    department: str | None = None,
) -> User:
    exists = db.query(User).filter(User.username == username).first()
    if exists is not None:
        raise ApiError(409, "STATE_CONFLICT", "用户名已存在")
    user = User(
        username=username,
        password_hash=hash_password(password),
        display_name=display_name,
        contact=contact,
        role=role,
        staff_status=staff_status,
        staff_no=staff_no,
        department=department,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate(db: Session, username: str, password: str) -> User:
    user = db.query(User).filter(User.username == username).first()
    if user is None or not verify_password(password, user.password_hash):
        raise ApiError(401, "UNAUTH", "用户名或密码错误")
    if user.is_banned:
        raise ApiError(403, "FORBIDDEN", "账号已被封禁，请联系管理员")
    return user


def update_profile(db: Session, user: User, body: ProfileUpdate) -> User:
    data = body.model_dump(exclude_unset=True)
    if data.get("display_name") is not None:
        user.display_name = data["display_name"]
    if "contact" in data:
        user.contact = data["contact"]
    db.commit()
    db.refresh(user)
    return user


def change_password(db: Session, user: User, body: PasswordChangeRequest) -> User:
    if not verify_password(body.old_password, user.password_hash):
        raise ApiError(400, "VALIDATION", "原密码不正确")
    if body.old_password == body.new_password:
        raise ApiError(400, "VALIDATION", "新密码不能与原密码相同")
    user.password_hash = hash_password(body.new_password)
    db.commit()
    db.refresh(user)
    return user


def list_users(
    db: Session, q: str | None = None, role: Role | None = None, limit: int = 20, offset: int = 0
) -> tuple[list[User], int]:
    query = db.query(User)
    if q:
        pattern = f"%{q}%"
        query = query.filter(or_(User.username.ilike(pattern), User.display_name.ilike(pattern)))
    if role is not None:
        query = query.filter(User.role == role)
    total = query.count()
    users = query.order_by(User.created_at.desc()).offset(offset).limit(limit).all()
    return users, total


def update_user(db: Session, actor: User, target_id: uuid.UUID, body: AdminUserUpdate) -> User:
    target = db.get(User, target_id)
    if target is None:
        raise ApiError(404, "NOT_FOUND", "用户不存在")
    if target.id == actor.id:
        raise ApiError(409, "STATE_CONFLICT", "不能修改自己的账号")
    if target.role == Role.admin:
        raise ApiError(409, "STATE_CONFLICT", "不能修改其他管理员账号")
    data = body.model_dump(exclude_unset=True)
    if data.get("role") is not None:
        if data["role"] == Role.admin:
            raise ApiError(400, "VALIDATION", "不能直接提权为管理员")
        target.role = data["role"]
    if data.get("is_banned") is not None:
        target.is_banned = data["is_banned"]
    db.commit()
    db.refresh(target)
    return target