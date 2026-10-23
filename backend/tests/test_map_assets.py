import uuid
from datetime import datetime

from app.core.security import hash_password
from app.database import SessionLocal
from app.models import Building, Item, Layer, Role, SimulatedPoint, User
from app.models.enums import Direction, ItemStatus, LayerKind
from app.services import building_service


def _session():
    return SessionLocal()


def _owner(db, username: str | None = None) -> User:
    user = User(
        username=username or f"fixture_{uuid.uuid4().hex[:8]}",
        password_hash=hash_password("secret123"),
        role=Role.student,
        display_name="夹具用户",
    )
    db.add(user)
    db.flush()
    return user


def _demo_item(db, owner: User, building: Building) -> Item:
    item = Item(
        direction=Direction.lost,
        category="雨伞",
        title="旧演示帖",
        status=ItemStatus.searching,
        owner_user_id=owner.id,
        building_id=building.id,
        is_demo=True,
    )
    db.add(item)
    return item


def test_convert_normal_buildings(map_asset):
    converted, warnings = building_service.convert_buildings(map_asset)
    by_code = {row.code: row for row in converted}
    assert set(by_code) == {"T1", "T2", "DUP-f003", "DUP-f004", "b005"}

    teaching = by_code["T1"]
    assert teaching.name == "测试教学楼"
    assert teaching.category == "教学楼"
    assert teaching.floors == 3
    assert teaching.draw_order == 1
    assert teaching.entrance_node == 2
    assert len(teaching.click_region) == 4
    assert teaching.label_position == {"x": 0.175, "y": 0.16}
    assert len(teaching.iso_hit_area) == 4
    assert teaching.iso_label_position == {"x": 0.195, "y": 0.18}

    canteen = by_code["T2"]
    assert canteen.name == "测试食堂"
    assert canteen.category == "食堂"
    assert canteen.draw_order == 9
    assert all("已跳过" not in warning for warning in warnings)


def test_convert_empty_code_and_unnamed(map_asset):
    converted, warnings = building_service.convert_buildings(map_asset)
    by_code = {row.code: row for row in converted}

    assert "b005" in by_code
    assert by_code["b005"].name == "测试天桥"
    assert by_code["DUP-f004"].name == "未命名建筑"
    assert any("编号为空" in warning for warning in warnings)


def test_convert_unknown_category(map_asset):
    converted, warnings = building_service.convert_buildings(map_asset)
    by_code = {row.code: row for row in converted}

    assert by_code["DUP-f004"].category == "其他"
    assert any("DUP-f004" in warning and "unknown" in warning for warning in warnings)


def test_convert_duplicate_codes(map_asset):
    converted, warnings = building_service.convert_buildings(map_asset)
    codes = {row.code for row in converted}

    assert {"DUP-f003", "DUP-f004"} <= codes
    assert sum(1 for warning in warnings if "重复" in warning) == 1


def test_convert_missing_geometry(map_asset):
    converted, warnings = building_service.convert_buildings(map_asset)
    by_code = {row.code: row for row in converted}

    unnamed = by_code["DUP-f004"]
    assert unnamed.click_region is None
    assert unnamed.label_position is None
    assert any("DUP-f004" in warning and "缺少平面标签" in warning for warning in warnings)

    bridge = by_code["b005"]
    assert bridge.label_position == {"x": 0.75, "y": 0.13}


def test_import_floors_creates_placeholders(seeded_map, map_floors_path):
    asset, _ = seeded_map
    db = _session()
    try:
        building = db.query(Building).filter(Building.code == "T1").one()
        floors = (
            db.query(Layer)
            .filter(Layer.kind == LayerKind.floor, Layer.building_id == building.id)
            .order_by(Layer.floor)
            .all()
        )
        assert [layer.floor for layer in floors] == [1, 2, 3]
        assert floors[0].name == "测试教学楼 1F"
        assert floors[0].image_path is None
        assert floors[0].rooms == [{"name": "自习室", "x": 0.3, "y": 0.4}]

        again = building_service.import_floors(db, asset, building_service.load_floor_specs(map_floors_path))
        assert again.created == 0
        assert again.updated == 3
        assert db.query(Layer).filter(Layer.kind == LayerKind.floor).count() == 3
    finally:
        db.close()


def test_import_buildings_is_idempotent(map_asset):
    db = _session()
    try:
        first = building_service.import_buildings(db, map_asset)
        assert (first.created, first.updated, first.deleted, first.skipped) == (5, 0, 0, 0)

        second = building_service.import_buildings(db, map_asset)
        assert (second.created, second.updated, second.deleted, second.skipped) == (0, 5, 0, 0)
        assert db.query(Building).count() == 5
    finally:
        db.close()


def test_import_removes_obsolete_building_with_demo_item(map_asset):
    db = _session()
    try:
        owner = _owner(db)
        old = Building(code="OLD1", name="旧楼", category="其他", floors=1, draw_order=0)
        db.add(old)
        db.flush()
        _demo_item(db, owner, old)
        db.commit()
    finally:
        db.close()

    db = _session()
    try:
        result = building_service.import_buildings(db, map_asset)
        assert result.deleted == 1
        assert db.query(Building).filter(Building.code == "OLD1").first() is None
        assert db.query(Item).count() == 0
    finally:
        db.close()


def test_import_keeps_building_with_user_item(map_asset):
    db = _session()
    try:
        owner = _owner(db)
        old = Building(code="OLD1", name="旧楼", category="其他", floors=1, draw_order=0)
        db.add(old)
        db.flush()
        db.add(
            Item(
                direction=Direction.lost,
                category="雨伞",
                title="用户帖",
                status=ItemStatus.searching,
                owner_user_id=owner.id,
                building_id=old.id,
                is_demo=False,
            )
        )
        db.commit()
    finally:
        db.close()

    db = _session()
    try:
        result = building_service.import_buildings(db, map_asset)
        assert result.deleted == 0
        assert db.query(Building).filter(Building.code == "OLD1").first() is not None
        assert any("OLD1" in warning and "非演示引用" in warning for warning in result.warnings)
    finally:
        db.close()


def test_sync_layers_writes_iso_transform(map_asset):
    db = _session()
    try:
        building_service.sync_layers(db, map_asset)
        iso = db.query(Layer).filter(Layer.kind == LayerKind.iso).one()
        flat = db.query(Layer).filter(Layer.kind == LayerKind.flat).one()

        assert iso.transform == [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0]]
        assert flat.transform is None
    finally:
        db.close()


def test_sync_layers_and_points_is_idempotent(seeded_map, map_roads_path):
    asset, _ = seeded_map
    db = _session()
    try:
        flat = db.query(Layer).filter(Layer.kind == LayerKind.flat).one()
        iso = db.query(Layer).filter(Layer.kind == LayerKind.iso).one()
        layer_count = db.query(Layer).count()
        point_count = db.query(SimulatedPoint).count()
        assert layer_count == 5
        assert point_count == 1

        layers = building_service.sync_layers(db, asset)
        points = building_service.sync_points(db, asset, map_roads_path)
        assert layers.created == 0
        assert layers.updated == 2
        assert layers.removed == 0
        assert points.removed == 0

        assert db.query(Layer).count() == layer_count
        assert db.query(SimulatedPoint).count() == point_count
        assert db.query(Layer).filter(Layer.kind == LayerKind.flat).one().id == flat.id
        assert db.query(Layer).filter(Layer.kind == LayerKind.iso).one().id == iso.id
    finally:
        db.close()


def test_sync_layers_reuses_existing_flat(map_asset):
    db = _session()
    try:
        legacy = Layer(
            name="校园 2.5D 底图",
            kind=LayerKind.flat,
            image_path="old.jpg",
            width=10,
            height=10,
        )
        db.add(legacy)
        db.commit()
        legacy_id = legacy.id

        result = building_service.sync_layers(db, map_asset)
        assert result.created == 1
        assert result.removed == 0

        flats = db.query(Layer).filter(Layer.kind == LayerKind.flat).all()
        assert len(flats) == 1
        flat = flats[0]
        assert flat.id == legacy_id
        assert flat.name == building_service.FLAT_LAYER_NAME
        assert flat.image_path == "test_flat.webp"
        assert (flat.width, flat.height) == (800, 600)
        assert flat.scale_calibrated is True
        assert float(flat.pixels_per_meter) == 2.0
    finally:
        db.close()


def test_sync_layers_removes_unreferenced_duplicate(map_asset):
    db = _session()
    try:
        earliest = Layer(
            name="旧室外平面图",
            kind=LayerKind.flat,
            width=100,
            height=100,
            created_at=datetime(2026, 1, 1, 8, 0, 0),
        )
        later = Layer(
            name="重复室外平面图",
            kind=LayerKind.flat,
            width=200,
            height=200,
            created_at=datetime(2026, 1, 2, 8, 0, 0),
        )
        db.add_all([earliest, later])
        db.commit()
        earliest_id = earliest.id

        result = building_service.sync_layers(db, map_asset)
        assert result.removed == 1
        flats = db.query(Layer).filter(Layer.kind == LayerKind.flat).all()
        assert len(flats) == 1
        assert flats[0].id == earliest_id
    finally:
        db.close()


def test_sync_layers_keeps_referenced_duplicate(map_asset):
    db = _session()
    try:
        earliest = Layer(
            name="旧室外平面图",
            kind=LayerKind.flat,
            width=100,
            height=100,
            created_at=datetime(2026, 1, 1, 8, 0, 0),
        )
        later = Layer(
            name="被引用的室外平面图",
            kind=LayerKind.flat,
            width=200,
            height=200,
            created_at=datetime(2026, 1, 2, 8, 0, 0),
        )
        db.add_all([earliest, later])
        db.flush()
        db.add(
            SimulatedPoint(
                layer_id=later.id,
                label="手工求助点",
                norm_x=0.5,
                norm_y=0.5,
            )
        )
        db.commit()
        earliest_id = earliest.id
        later_id = later.id

        result = building_service.sync_layers(db, map_asset)
        assert result.removed == 0
        assert db.query(Layer).filter(Layer.kind == LayerKind.flat).count() == 2
        assert any(str(later_id) in warning and "被引用的室外平面图" in warning for warning in result.warnings)
        assert building_service.get_map_meta(db)["flat_layer_id"] == earliest_id
    finally:
        db.close()
