import uuid

from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models import User
from app.schemas.upload import UploadOut
from app.services import upload_service

router = APIRouter(tags=["uploads"])


@router.post("", response_model=UploadOut)
async def upload(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    data = await file.read(upload_service.MAX_UPLOAD_BYTES + 1)
    attachment = upload_service.upload_photo(db, user, data)
    return upload_service.to_upload_out(attachment)


@router.get("/{attachment_id}")
def download(
    attachment_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    data, mime = upload_service.load_upload(db, user, attachment_id)
    return Response(content=data, media_type=mime, headers={"Cache-Control": "private, max-age=3600"})
