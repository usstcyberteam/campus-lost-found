import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_role
from app.database import get_db
from app.models import ClaimStatus, Role, User
from app.schemas.claim import ClaimCreate, ClaimDetail, ClaimOut, ReviewRequest
from app.schemas.common import Page
from app.services import claim_service

router = APIRouter(tags=["claims"])


@router.get("", response_model=Page[ClaimOut])
def list_claims(
    status: ClaimStatus | None = None,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.staff, Role.admin)),
):
    items, total = claim_service.list_claims(db, status, limit, offset)
    return Page(items=items, total=total, limit=limit, offset=offset)


@router.get("/{claim_id}", response_model=ClaimDetail)
def get_claim(claim_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return claim_service.get_claim(db, user, claim_id)


@router.post("", response_model=ClaimOut)
def create_claim(body: ClaimCreate, db: Session = Depends(get_db), user: User = Depends(require_role(Role.student))):
    return claim_service.create_claim(db, user, body)


@router.post("/{claim_id}/review", response_model=ClaimOut)
def review_claim(
    claim_id: uuid.UUID,
    body: ReviewRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.staff, Role.admin)),
):
    return claim_service.review_claim(db, user, claim_id, body)


@router.post("/{claim_id}/complete", response_model=ClaimOut)
def complete_claim(
    claim_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(require_role(Role.staff, Role.admin))
):
    return claim_service.complete_claim(db, user, claim_id)
