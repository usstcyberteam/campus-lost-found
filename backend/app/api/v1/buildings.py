import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models import User
from app.schemas.building import BuildingOut
from app.schemas.common import Page
from app.services import building_service

router = APIRouter(tags=["buildings"])


@router.get("", response_model=Page[BuildingOut])
def list_buildings(
    category: str | None = None,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    items, total = building_service.list_buildings(db, category, limit, offset)
    return Page(items=items, total=total, limit=limit, offset=offset)


@router.get("/{building_id}", response_model=BuildingOut)
def get_building(building_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return building_service.get_building(db, building_id)
