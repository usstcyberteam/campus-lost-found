import uuid

from sqlalchemy.orm import Session

from app.errors import ApiError
from app.models import Item, Praise, Role, User
from app.schemas.praise import PraiseCreate, PraiseUpdate


def _serialize(praise: Praise, from_user: User | None, to_user: User | None, item_title: str | None, viewer: User) -> dict:
    return {
        "id": praise.id,
        "content": praise.content,
        "item_id": praise.item_id,
        "item_title": item_title,
        "from_user_id": praise.from_user_id,
        "from_name": from_user.display_name if from_user else "已注销用户",
        "to_user_id": praise.to_user_id,
        "to_name": to_user.display_name if to_user else "已注销用户",
        "created_at": praise.created_at,
        "can_edit": praise.from_user_id == viewer.id or viewer.role == Role.admin,
    }


def _load_context(db: Session, rows: list[Praise], viewer: User) -> list[dict]:
    if not rows:
        return []
    user_ids = {row.from_user_id for row in rows} | {row.to_user_id for row in rows}
    users = {user.id: user for user in db.query(User).filter(User.id.in_(user_ids)).all()}
    item_ids = {row.item_id for row in rows if row.item_id is not None}
    titles = (
        {item.id: item.title for item in db.query(Item).filter(Item.id.in_(item_ids)).all()} if item_ids else {}
    )
    return [
        _serialize(row, users.get(row.from_user_id), users.get(row.to_user_id), titles.get(row.item_id), viewer)
        for row in rows
    ]


def lookup_user(db: Session, username: str) -> dict:
    """按用户名精确查找被表扬人，仅返回公开字段，避免用户枚举。"""
    target = db.query(User).filter(User.username == username).first()
    if target is None:
        raise ApiError(404, "NOT_FOUND", "用户不存在")
    return {"id": target.id, "display_name": target.display_name}


def list_praises(db: Session, user: User, limit: int, offset: int) -> tuple[list[dict], int]:
    total = db.query(Praise).count()
    rows = db.query(Praise).order_by(Praise.created_at.desc(), Praise.id.desc()).offset(offset).limit(limit).all()
    return _load_context(db, rows, user), total


def create_praise(db: Session, user: User, body: PraiseCreate) -> dict:
    target = db.get(User, body.to_user_id)
    if target is None:
        raise ApiError(404, "NOT_FOUND", "被表扬的用户不存在")
    if target.id == user.id:
        raise ApiError(409, "STATE_CONFLICT", "不能表扬自己")
    if body.item_id is not None and db.get(Item, body.item_id) is None:
        raise ApiError(404, "NOT_FOUND", "关联记录不存在")
    praise = Praise(item_id=body.item_id, from_user_id=user.id, to_user_id=target.id, content=body.content)
    db.add(praise)
    db.commit()
    db.refresh(praise)
    return _load_context(db, [praise], user)[0]


def _get_editable(db: Session, user: User, praise_id: uuid.UUID) -> Praise:
    praise = db.get(Praise, praise_id)
    if praise is None:
        raise ApiError(404, "NOT_FOUND", "表扬不存在")
    if praise.from_user_id != user.id and user.role != Role.admin:
        raise ApiError(403, "FORBIDDEN", "只能修改自己发布的表扬")
    return praise


def update_praise(db: Session, user: User, praise_id: uuid.UUID, body: PraiseUpdate) -> dict:
    praise = _get_editable(db, user, praise_id)
    if body.content is not None:
        praise.content = body.content
    db.commit()
    db.refresh(praise)
    return _load_context(db, [praise], user)[0]


def delete_praise(db: Session, user: User, praise_id: uuid.UUID) -> None:
    praise = _get_editable(db, user, praise_id)
    db.delete(praise)
    db.commit()