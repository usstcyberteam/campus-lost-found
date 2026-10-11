from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.errors import ApiError
from app.models import Role, User


def create_user(db: Session, username: str, password: str, display_name: str, contact: str | None, role: Role) -> User:
    exists = db.query(User).filter(User.username == username).first()
    if exists is not None:
        raise ApiError(409, "STATE_CONFLICT", "用户名已存在")
    user = User(
        username=username,
        password_hash=hash_password(password),
        display_name=display_name,
        contact=contact,
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate(db: Session, username: str, password: str) -> User:
    user = db.query(User).filter(User.username == username).first()
    if user is None or not verify_password(password, user.password_hash):
        raise ApiError(401, "UNAUTH", "用户名或密码错误")
    return user
