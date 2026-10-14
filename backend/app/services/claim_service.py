import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.errors import ApiError
from app.models import Claim, ClaimEvidence, ClaimStatus, Direction, Item, ItemStatus, Role, User
from app.schemas.claim import ClaimCreate, ClaimDetail, ClaimOut, EvidenceIn, ReviewRequest

ACTIVE = (ClaimStatus.pending, ClaimStatus.approved)


def serialize_claim_mutation(db: Session) -> None:
    # Prototype: serialize claim writes across processes, including shared lost
    # records referenced by claims for different found items.
    if db.get_bind().dialect.name == "postgresql":
        db.execute(select(func.pg_advisory_xact_lock(13000338)))


def lock_items(db: Session, ids: list[uuid.UUID | None]) -> dict:
    return {
        i.id: i
        for i in db.query(Item)
        .filter(Item.id.in_([i for i in ids if i]))
        .order_by(Item.id)
        .with_for_update()
        .populate_existing()
        .all()
    }


def replay(db: Session, existing: Claim, body: ClaimCreate, user: User) -> Claim:
    if existing.applicant_user_id != user.id:
        raise ApiError(409, "STATE_CONFLICT", "幂等键已被使用")
    saved = sorted((e.kind.value, e.content) for e in db.query(ClaimEvidence).filter_by(claim_id=existing.id))
    incoming = sorted((e.kind.value, e.content) for e in body.evidence)
    if existing.found_item_id != body.found_item_id or existing.lost_item_id != body.lost_item_id or saved != incoming:
        raise ApiError(409, "STATE_CONFLICT", "同一幂等键不能用于不同申请内容")
    return existing


def restore_unclaimed(db: Session, item_id: uuid.UUID | None) -> None:
    if item_id is None:
        return
    item = db.get(Item, item_id)
    if item is None or item.status != ItemStatus.reviewing:
        return
    active = db.query(Claim).filter(Claim.status.in_(ACTIVE))
    active = (
        active.filter(Claim.found_item_id == item_id)
        if item.direction == Direction.found
        else active.filter(Claim.lost_item_id == item_id)
    )
    if active.first() is None:
        item.status = ItemStatus.pending if item.direction == Direction.found else ItemStatus.searching


def list_claims(
    db: Session, status: ClaimStatus | None = None, limit: int = 20, offset: int = 0
) -> tuple[list[Claim], int]:
    query = db.query(Claim)
    if status is not None:
        query = query.filter(Claim.status == status)
    total = query.count()
    items = query.order_by(Claim.created_at.desc(), Claim.id).offset(offset).limit(limit).all()
    return items, total


def list_my_claims(db: Session, user: User, limit: int, offset: int) -> tuple[list[Claim], int]:
    query = db.query(Claim).filter(Claim.applicant_user_id == user.id)
    total = query.count()
    items = query.order_by(Claim.created_at.desc()).offset(offset).limit(limit).all()
    return items, total


def get_claim(db: Session, user: User, claim_id: uuid.UUID) -> ClaimDetail:
    claim = db.get(Claim, claim_id)
    if claim is None:
        raise ApiError(404, "NOT_FOUND", "认领不存在")
    if user.role != Role.staff and claim.applicant_user_id != user.id:
        raise ApiError(403, "FORBIDDEN", "只能查看本人的认领证据")
    evidence = (
        db.query(ClaimEvidence).filter_by(claim_id=claim.id).order_by(ClaimEvidence.created_at, ClaimEvidence.id).all()
    )
    return ClaimDetail(
        **ClaimOut.model_validate(claim).model_dump(),
        evidence=[EvidenceIn(kind=e.kind, content=e.content) for e in evidence],
    )


def create_claim(db: Session, user: User, body: ClaimCreate) -> Claim:
    serialize_claim_mutation(db)
    existing = db.query(Claim).filter_by(idempotency_key=body.idempotency_key).first()
    if existing is not None:
        return replay(db, existing, body, user)
    items = lock_items(db, [body.found_item_id, body.lost_item_id])
    found = items.get(body.found_item_id)
    if found is None or found.direction != Direction.found:
        raise ApiError(404, "NOT_FOUND", "拾获记录不存在")
    if found.status not in (ItemStatus.pending, ItemStatus.reviewing):
        raise ApiError(409, "STATE_CONFLICT", "该拾获记录已关闭")
    lost = items.get(body.lost_item_id)
    if body.lost_item_id is not None:
        if lost is None or lost.direction != Direction.lost:
            raise ApiError(404, "NOT_FOUND", "寻物记录不存在")
        if lost.owner_user_id != user.id:
            raise ApiError(403, "FORBIDDEN", "只能关联本人的寻物记录")
        if lost.status not in (ItemStatus.searching, ItemStatus.reviewing):
            raise ApiError(409, "STATE_CONFLICT", "关联寻物记录已关闭")
    claim = Claim(
        found_item_id=found.id,
        lost_item_id=body.lost_item_id,
        applicant_user_id=user.id,
        status=ClaimStatus.pending,
        idempotency_key=body.idempotency_key,
    )
    try:
        db.add(claim)
        db.flush()
        for ev in body.evidence:
            db.add(ClaimEvidence(claim_id=claim.id, kind=ev.kind, content=ev.content))
        found.status = ItemStatus.reviewing
        if lost is not None:
            lost.status = ItemStatus.reviewing
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = db.query(Claim).filter_by(idempotency_key=body.idempotency_key).first()
        if existing is None:
            raise ApiError(409, "STATE_CONFLICT", "申请发生冲突，请重试") from None
        return replay(db, existing, body, user)
    db.refresh(claim)
    return claim


def editable_claim(db: Session, claim_id: uuid.UUID) -> tuple[Claim, dict]:
    serialize_claim_mutation(db)
    claim = db.query(Claim).filter_by(id=claim_id).with_for_update().populate_existing().first()
    if claim is None:
        raise ApiError(404, "NOT_FOUND", "认领不存在")
    siblings = db.query(Claim).filter(Claim.found_item_id == claim.found_item_id, Claim.status.in_(ACTIVE)).all()
    items = lock_items(db, [claim.found_item_id, claim.lost_item_id] + [s.lost_item_id for s in siblings])
    return claim, items


def review_claim(db: Session, user: User, claim_id: uuid.UUID, body: ReviewRequest) -> Claim:
    claim, items = editable_claim(db, claim_id)
    if claim.status != ClaimStatus.pending:
        raise ApiError(409, "STATE_CONFLICT", "认领已处理")
    found = items.get(claim.found_item_id)
    lost = items.get(claim.lost_item_id)
    if found is None or found.status != ItemStatus.reviewing:
        raise ApiError(409, "STATE_CONFLICT", "拾获记录已关闭或状态冲突")
    if body.approve:
        if lost is not None and (lost.owner_user_id != claim.applicant_user_id or lost.status != ItemStatus.reviewing):
            raise ApiError(409, "STATE_CONFLICT", "关联寻物记录状态或归属冲突")
        conflict = (
            db.query(Claim)
            .filter(
                Claim.id != claim.id, Claim.status == ClaimStatus.approved, Claim.found_item_id == claim.found_item_id
            )
            .first()
        )
        if conflict is not None:
            raise ApiError(409, "STATE_CONFLICT", "该物品已有通过核验的申请")
    claim.status = ClaimStatus.approved if body.approve else ClaimStatus.rejected
    claim.reviewer_user_id = user.id
    claim.reviewed_at = datetime.now(UTC)
    db.flush()
    if not body.approve:
        restore_unclaimed(db, claim.found_item_id)
        restore_unclaimed(db, claim.lost_item_id)
    db.commit()
    db.refresh(claim)
    return claim


def complete_claim(db: Session, user: User, claim_id: uuid.UUID) -> Claim:
    claim, items = editable_claim(db, claim_id)
    if claim.status != ClaimStatus.approved:
        raise ApiError(409, "STATE_CONFLICT", "认领未通过核验或已归还")
    lost = items.get(claim.lost_item_id)
    if lost is not None and (lost.owner_user_id != claim.applicant_user_id or lost.status != ItemStatus.reviewing):
        raise ApiError(409, "STATE_CONFLICT", "关联寻物记录状态或归属冲突")
    result = db.execute(
        update(Item)
        .where(Item.id == claim.found_item_id, Item.status == ItemStatus.reviewing)
        .values(status=ItemStatus.returned)
    )
    if result.rowcount != 1:
        db.rollback()
        raise ApiError(409, "STATE_CONFLICT", "物品已归还或状态冲突")
    if lost is not None:
        lost.status = ItemStatus.found
    claim.status = ClaimStatus.completed
    claim.completed_at = datetime.now(UTC)
    siblings = (
        db.query(Claim)
        .filter(Claim.found_item_id == claim.found_item_id, Claim.id != claim.id, Claim.status.in_(ACTIVE))
        .all()
    )
    for sibling in siblings:
        sibling.status = ClaimStatus.rejected
        sibling.reviewer_user_id = user.id
        sibling.reviewed_at = claim.completed_at
    db.flush()
    for sibling in siblings:
        restore_unclaimed(db, sibling.lost_item_id)
    db.commit()
    db.refresh(claim)
    return claim
