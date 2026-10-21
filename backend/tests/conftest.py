import os
import secrets
from pathlib import Path

import pytest
from sqlalchemy.engine import make_url

test_url = os.environ.get("TEST_DATABASE_URL", "sqlite:///./test_pytest.db")
if os.environ.get("TEST_DATABASE_URL") and not (make_url(test_url).database or "").endswith("_test"):
    raise RuntimeError("TEST_DATABASE_URL 必须指向以 _test 结尾的专用测试数据库；测试会清空其表")
os.environ["DATABASE_URL"] = test_url
os.environ["JWT_SECRET"] = secrets.token_urlsafe(48)

from fastapi.testclient import TestClient  # noqa: E402

from app import models  # noqa: E402,F401
from app.database import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.services import building_service  # noqa: E402

FIXTURE_DIR = Path(__file__).resolve().parent / "fixtures"


@pytest.fixture(autouse=True)
def clean_db():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def map_asset_path() -> Path:
    return FIXTURE_DIR / "map_asset.json"


@pytest.fixture
def map_floors_path() -> Path:
    return FIXTURE_DIR / "map_floors.json"


@pytest.fixture
def map_roads_path() -> Path:
    return FIXTURE_DIR / "map_roads.json"


@pytest.fixture
def map_asset(map_asset_path: Path) -> building_service.MapAsset:
    return building_service.load_asset(map_asset_path)


@pytest.fixture
def import_map(map_asset: building_service.MapAsset) -> building_service.BuildingImportResult:
    db = SessionLocal()
    try:
        result = building_service.import_buildings(db, map_asset)
    finally:
        db.close()
    assert isinstance(result, building_service.BuildingImportResult)
    return result


@pytest.fixture
def seeded_map(
    import_map: building_service.BuildingImportResult,
    map_asset: building_service.MapAsset,
    map_floors_path: Path,
    map_roads_path: Path,
):
    db = SessionLocal()
    try:
        floors = building_service.import_floors(db, map_asset, building_service.load_floor_specs(map_floors_path))
        layers = building_service.sync_layers(db, map_asset)
        points = building_service.sync_points(db, map_asset, map_roads_path)
        db.commit()
    finally:
        db.close()
    assert isinstance(floors, building_service.FloorImportResult)
    assert isinstance(layers, building_service.LayerSyncResult)
    assert isinstance(points, building_service.PointSyncResult)
    return map_asset, import_map
