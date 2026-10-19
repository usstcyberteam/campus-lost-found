import io
import uuid

from PIL import Image, ImageOps, UnidentifiedImageError
from sqlalchemy.orm import Session

from app.errors import ApiError
from app.models import Attachment, AttachmentPurpose, Comment, Direction, Item, Role, User
from app.services.storage import get_storage

MAX_UPLOAD_BYTES = 5 * 1024 * 1024
MAX_IMAGE_SIDE = 10000
MAX_ITEM_PHOTOS = 6
MAX_COMMENT_IMAGES = 3

_FORMATS = {
    "JPEG": ("image/jpeg", ".jpg"),
    "PNG": ("image/png", ".png"),
    "WEBP": ("image/webp", ".webp"),
}


def _normalize(data: bytes) -> tuple[bytes, str, str]:
    try:
        with Image.open(io.BytesIO(data)) as image:
            fmt = (image.format or "").upper()
            if fmt not in _FORMATS:
                raise ApiError(400, "VALIDATION", "仅支持 JPG、PNG、WebP 图片")
            if image.width > MAX_IMAGE_SIDE or image.height > MAX_IMAGE_SIDE:
                raise ApiError(400, "VALIDATION", "图片尺寸过大")
            upright = ImageOps.exif_transpose(image)
            # 新建画布重绘像素，保存时不写 EXIF，剥离拍摄位置等元数据
            mode = "RGB" if fmt == "JPEG" else "RGBA"
            clean = Image.new(mode, upright.size)
            clean.paste(upright.convert(mode))
    except UnidentifiedImageError as exc:
        raise ApiError(400, "VALIDATION", "图片格式不合法") from exc
    except OSError as exc:
        raise ApiError(400, "VALIDATION", "图片格式不合法") from exc

    mime, ext = _FORMATS[fmt]
    buffer = io.BytesIO()
    if fmt == "JPEG":
        clean.save(buffer, format="JPEG", quality=85, optimize=True)
    elif fmt == "PNG":
        clean.save(buffer, format="PNG", optimize=True)
    else:
        clean.save(buffer, format="WEBP", quality=85, method=4)
    return buffer.getvalue(), mime, ext


def upload_photo(db: Session, user: User, data: bytes) -> Attachment:
    if not data:
        raise ApiError(400, "VALIDATION", "上传文件为空")
    if len(data) > MAX_UPLOAD_BYTES:
        raise ApiError(400, "VALIDATION", "图片不能超过 5MB")

    payload, mime, ext = _normalize(data)
    key = f"items/{uuid.uuid4().hex}{ext}"
    stored_path = get_storage().save(key, payload, mime)
    attachment = Attachment(
        item_id=None,
        comment_id=None,
        owner_user_id=user.id,
        purpose=AttachmentPurpose.item_photo,
        file_path=stored_path,
        mime=mime,
        size=len(payload),
        is_evidence=False,
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)
    return attachment


def to_upload_out(attachment: Attachment) -> dict:
    return {
        "id": attachment.id,
        "url": f"/api/v1/uploads/{attachment.id}",
        "mime": attachment.mime or "application/octet-stream",
        "size": attachment.size or 0,
    }


def bind_photos_to_item(db: Session, user: User, item: Item, photo_ids: list[uuid.UUID]) -> None:
    unique_ids = list(dict.fromkeys(photo_ids))
    existing_count = (
        db.query(Attachment)
        .filter(Attachment.item_id == item.id, Attachment.purpose == AttachmentPurpose.item_photo)
        .count()
    )
    pending: list[Attachment] = []
    for photo_id in unique_ids:
        attachment = db.get(Attachment, photo_id)
        if (
            attachment is None
            or attachment.owner_user_id != user.id
            or attachment.purpose != AttachmentPurpose.item_photo
        ):
            raise ApiError(400, "VALIDATION", "照片不存在或无权使用")
        if attachment.item_id is not None and attachment.item_id != item.id:
            raise ApiError(400, "VALIDATION", "照片已绑定其他帖子")
        if attachment.item_id is None:
            pending.append(attachment)
    if existing_count + len(pending) > MAX_ITEM_PHOTOS:
        raise ApiError(400, "VALIDATION", "最多上传 6 张照片")
    for attachment in pending:
        attachment.item_id = item.id


def bind_comment_photos(db: Session, user: User, comment: Comment, photo_ids: list[uuid.UUID]) -> None:
    unique_ids = list(dict.fromkeys(photo_ids))
    if len(unique_ids) > MAX_COMMENT_IMAGES:
        raise ApiError(400, "VALIDATION", "评论最多上传 3 张图片")
    pending: list[Attachment] = []
    for photo_id in unique_ids:
        attachment = db.get(Attachment, photo_id)
        if (
            attachment is None
            or attachment.owner_user_id != user.id
            or attachment.purpose != AttachmentPurpose.item_photo
            or attachment.item_id is not None
            or attachment.comment_id is not None
        ):
            raise ApiError(400, "VALIDATION", "图片不存在或无权使用")
        pending.append(attachment)
    for attachment in pending:
        attachment.comment_id = comment.id
        attachment.purpose = AttachmentPurpose.comment_image


def list_item_photos(db: Session, user: User, item: Item) -> tuple[list[Attachment], bool]:
    can_review = user.role in (Role.staff, Role.admin)
    if item.direction == Direction.found and item.owner_user_id != user.id and not can_review:
        return [], True
    rows = (
        db.query(Attachment)
        .filter(Attachment.item_id == item.id, Attachment.purpose == AttachmentPurpose.item_photo)
        .order_by(Attachment.created_at)
        .all()
    )
    return rows, False


def load_upload(db: Session, user: User, attachment_id: uuid.UUID) -> tuple[bytes, str]:
    attachment = db.get(Attachment, attachment_id)
    if attachment is None:
        raise ApiError(404, "NOT_FOUND", "图片不存在")

    if attachment.purpose == AttachmentPurpose.evidence:
        if attachment.owner_user_id != user.id and user.role not in (Role.staff, Role.admin):
            raise ApiError(403, "FORBIDDEN", "无权查看该图片")
    elif attachment.comment_id is None:
        if attachment.item_id is not None:
            item = db.get(Item, attachment.item_id)
            if item is None:
                raise ApiError(404, "NOT_FOUND", "图片不存在")
            can_review = user.role in (Role.staff, Role.admin)
            if item.direction == Direction.found and item.owner_user_id != user.id and not can_review:
                raise ApiError(403, "FORBIDDEN", "为防冒领，照片已隐藏")
        elif attachment.owner_user_id != user.id:
            raise ApiError(403, "FORBIDDEN", "无权查看该图片")

    try:
        data = get_storage().load(attachment.file_path)
    except FileNotFoundError as exc:
        raise ApiError(404, "NOT_FOUND", "图片不存在") from exc
    return data, attachment.mime or "application/octet-stream"
