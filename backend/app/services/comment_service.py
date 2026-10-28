import uuid

from sqlalchemy.orm import Session

from app.errors import ApiError
from app.models import Attachment, AttachmentPurpose, Comment, Item, Role, User
from app.schemas.auth import avatar_url_for
from app.schemas.comment import CommentCreate
from app.services import upload_service

ROLE_LABELS = {Role.student: "学生", Role.staff: "工作人员", Role.admin: "管理员"}
DEFAULT_TITLE = "见习寻物人"


def _author_map(db: Session, user_ids: set[uuid.UUID]) -> dict[uuid.UUID, User]:
    if not user_ids:
        return {}
    rows = db.query(User).filter(User.id.in_(user_ids)).all()
    return {row.id: row for row in rows}


def _image_map(db: Session, comment_ids: list[uuid.UUID]) -> dict[uuid.UUID, list[Attachment]]:
    if not comment_ids:
        return {}
    rows = (
        db.query(Attachment)
        .filter(Attachment.comment_id.in_(comment_ids), Attachment.purpose == AttachmentPurpose.comment_image)
        .order_by(Attachment.created_at)
        .all()
    )
    images: dict[uuid.UUID, list[Attachment]] = {}
    for row in rows:
        if row.comment_id is not None:
            images.setdefault(row.comment_id, []).append(row)
    return images


def _serialize(comment: Comment, author: User | None, images: list[Attachment]) -> dict:
    author_out = {
        "id": author.id if author else comment.author_user_id,
        "display_name": author.display_name if author else "已注销用户",
        "role_label": ROLE_LABELS.get(author.role, "学生") if author else "学生",
        "title": DEFAULT_TITLE,
        "avatar_url": avatar_url_for(author.id, author.avatar_path) if author else None,
    }
    return {
        "id": comment.id,
        "item_id": comment.item_id,
        "author": author_out,
        "content": "" if comment.is_deleted else comment.content,
        "parent_id": comment.parent_id,
        "is_deleted": comment.is_deleted,
        "is_hidden": comment.is_hidden,
        "images": [] if comment.is_deleted else [upload_service.to_upload_out(image) for image in images],
        "created_at": comment.created_at,
        "replies": [],
    }


def list_comments(db: Session, item_id: uuid.UUID, limit: int = 20, offset: int = 0) -> tuple[list[dict], int]:
    if db.get(Item, item_id) is None:
        raise ApiError(404, "NOT_FOUND", "记录不存在")
    # 被工作人员隐藏的评论对访客不可见
    query = db.query(Comment).filter(
        Comment.item_id == item_id, Comment.parent_id.is_(None), Comment.is_hidden.is_(False)
    )
    total = query.count()
    parents = query.order_by(Comment.created_at.asc(), Comment.id.asc()).offset(offset).limit(limit).all()
    parent_ids = [parent.id for parent in parents]
    replies: list[Comment] = []
    if parent_ids:
        replies = (
            db.query(Comment)
            .filter(Comment.parent_id.in_(parent_ids), Comment.is_hidden.is_(False))
            .order_by(Comment.created_at.asc(), Comment.id.asc())
            .all()
        )
    all_comments = [*parents, *replies]
    authors = _author_map(db, {comment.author_user_id for comment in all_comments})
    images = _image_map(db, [comment.id for comment in all_comments])
    replies_by_parent: dict[uuid.UUID, list[Comment]] = {}
    for reply in replies:
        if reply.parent_id is not None:
            replies_by_parent.setdefault(reply.parent_id, []).append(reply)

    items = []
    for parent in parents:
        data = _serialize(
            parent,
            authors.get(parent.author_user_id),
            images.get(parent.id, []),
        )
        data["replies"] = [
            _serialize(reply, authors.get(reply.author_user_id), images.get(reply.id, []))
            for reply in replies_by_parent.get(parent.id, [])
        ]
        items.append(data)
    return items, total


def list_my_comments(db: Session, user: User, limit: int, offset: int) -> tuple[list[dict], int]:
    total = db.query(Comment).filter(Comment.author_user_id == user.id, Comment.is_deleted.is_(False)).count()
    rows = (
        db.query(Comment, Item.title)
        .join(Item, Item.id == Comment.item_id)
        .filter(Comment.author_user_id == user.id, Comment.is_deleted.is_(False))
        .order_by(Comment.created_at.desc(), Comment.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    items = [
        {
            "id": comment.id,
            "item_id": comment.item_id,
            "item_title": item_title,
            "content": comment.content,
            "created_at": comment.created_at,
        }
        for comment, item_title in rows
    ]
    return items, total


def list_for_moderation(db: Session, only_hidden: bool | None, limit: int, offset: int) -> tuple[list[dict], int]:
    """工作人员评论审核列表：仅未删除评论，可按“仅隐藏”过滤。"""
    query = db.query(Comment, Item.title).join(Item, Item.id == Comment.item_id).filter(Comment.is_deleted.is_(False))
    if only_hidden:
        query = query.filter(Comment.is_hidden.is_(True))
    total = query.count()
    rows = query.order_by(Comment.created_at.desc(), Comment.id.desc()).offset(offset).limit(limit).all()
    authors = _author_map(db, {comment.author_user_id for comment, _ in rows})
    items = [
        {
            "id": comment.id,
            "item_id": comment.item_id,
            "item_title": item_title,
            "author_id": comment.author_user_id,
            "author_name": authors[comment.author_user_id].display_name
            if comment.author_user_id in authors
            else "已注销用户",
            "content": comment.content,
            "is_hidden": comment.is_hidden,
            "is_deleted": comment.is_deleted,
            "created_at": comment.created_at,
        }
        for comment, item_title in rows
    ]
    return items, total


def create_comment(db: Session, user: User, item_id: uuid.UUID, body: CommentCreate) -> dict:
    if db.get(Item, item_id) is None:
        raise ApiError(404, "NOT_FOUND", "记录不存在")
    if body.parent_id is not None:
        parent = db.get(Comment, body.parent_id)
        if parent is None or parent.item_id != item_id:
            raise ApiError(404, "NOT_FOUND", "父评论不存在")
        if parent.parent_id is not None:
            raise ApiError(409, "STATE_CONFLICT", "仅支持一层回复")
        if parent.is_deleted:
            raise ApiError(409, "STATE_CONFLICT", "父评论已删除")
        if parent.is_hidden:
            raise ApiError(409, "STATE_CONFLICT", "父评论已被隐藏")
    comment = Comment(
        item_id=item_id,
        author_user_id=user.id,
        parent_id=body.parent_id,
        content=body.content,
    )
    db.add(comment)
    db.flush()
    if body.photo_ids:
        upload_service.bind_comment_photos(db, user, comment, body.photo_ids)
    db.commit()
    db.refresh(comment)
    images = _image_map(db, [comment.id]).get(comment.id, [])
    return _serialize(comment, user, images)


def delete_comment(db: Session, user: User, comment_id: uuid.UUID) -> dict:
    comment = db.get(Comment, comment_id)
    if comment is None:
        raise ApiError(404, "NOT_FOUND", "评论不存在")
    if comment.is_deleted:
        raise ApiError(409, "STATE_CONFLICT", "评论已删除")
    if comment.author_user_id != user.id and user.role not in (Role.staff, Role.admin):
        raise ApiError(403, "FORBIDDEN", "只能删除自己的评论")
    comment.is_deleted = True
    db.commit()
    return {"id": comment.id, "is_deleted": True}


def set_hidden(db: Session, comment_id: uuid.UUID, hidden: bool) -> dict:
    comment = db.get(Comment, comment_id)
    if comment is None:
        raise ApiError(404, "NOT_FOUND", "评论不存在")
    if comment.is_deleted:
        raise ApiError(409, "STATE_CONFLICT", "评论已删除")
    if comment.is_hidden != hidden:
        comment.is_hidden = hidden
        db.commit()
    return {"id": comment.id, "is_hidden": comment.is_hidden}
