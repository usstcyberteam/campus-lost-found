import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import SessionLocal  # noqa: E402
from app.models import Building, Layer  # noqa: E402
from app.models.enums import LayerKind  # noqa: E402
from app.services import building_service  # noqa: E402
from scripts.seed_demo import DemoResult, seed_demo  # noqa: E402

BACKEND_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_BUILDINGS = BACKEND_ROOT / "app" / "data" / "campus_buildings.json"
DEFAULT_FLOORS = BACKEND_ROOT / "app" / "data" / "campus_floors.json"
DEFAULT_ROADS = BACKEND_ROOT / "app" / "data" / "campus_roads.json"


def _print_warnings(warnings: list[str]) -> None:
    for warning in warnings:
        print(f"WARN {warning}")


def _print_floor_state(state: building_service.FloorAssetState) -> None:
    if state == "missing":
        print(building_service.FLOOR_ASSET_MISSING)
    elif state == "empty":
        print(building_service.FLOOR_ASSET_EMPTY)


def print_import_report(
    result: building_service.MapImportResult,
    demo: DemoResult | None = None,
    *,
    include_demo: bool = True,
) -> None:
    print(
        f"[1/5] buildings: created={result.buildings.created} updated={result.buildings.updated} "
        f"deleted={result.buildings.deleted} skipped={result.buildings.skipped} total={result.buildings_total}"
    )
    print(
        f"[2/5] floors: created={result.floors.created} updated={result.floors.updated} "
        f"skipped={result.floors.skipped} total={result.floors_total}"
    )
    _print_floor_state(result.floors_state)
    print(
        f"[3/5] layers: created={result.layers.created} updated={result.layers.updated} "
        f"removed={result.layers.removed} total={result.layers_total}"
    )
    print(
        f"[4/5] points: created={result.points.created} updated={result.points.updated} "
        f"removed={result.points.removed} total={result.points_total}"
    )
    if include_demo:
        if demo is None:
            raise ValueError("缺少演示数据结果")
        print(
            f"[5/5] demo: removed={demo.removed} created={demo.created} lost={demo.lost} "
            f"found={demo.found} total={demo.created}"
        )
    _print_warnings(result.warnings)
    if demo is not None:
        _print_warnings(demo.warnings)


def _building_counts(db, asset) -> tuple[int, int]:
    converted, _ = building_service.convert_buildings(asset)
    existing = {code for (code,) in db.query(Building.code).all()}
    created = sum(1 for data in converted if data.code not in existing)
    return created, len(converted) - created


def _floor_counts(db, specs) -> tuple[int, int]:
    existing = {(row.building_id, row.floor) for row in db.query(Layer).filter(Layer.kind == LayerKind.floor).all()}
    by_code = {code: layer_id for code, layer_id in db.query(Building.code, Building.id).all()}
    created = 0
    total = 0
    for spec in building_service._placeholder_specs(specs):
        layer_id = by_code.get(spec.building_code)
        if layer_id is None:
            continue
        total += 1
        if (layer_id, spec.floor) not in existing:
            created += 1
    return created, total - created


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="导入校园地图建筑、楼层、图层、点位与演示数据")
    parser.add_argument("--buildings", type=Path, default=DEFAULT_BUILDINGS)
    parser.add_argument("--floors", type=Path, default=DEFAULT_FLOORS)
    parser.add_argument("--roads", type=Path, default=DEFAULT_ROADS)
    parser.add_argument("--dry-run", action="store_true", help="只打印将写入的条数，不修改数据库")
    parser.add_argument("--prune-buildings", action="store_true", help="删除素材中不存在的既有建筑")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    try:
        inputs = building_service.load_map_inputs(args.buildings, args.floors)
    except (ValueError, OSError) as exc:
        print(f"ERROR {exc}")
        return 2
    db = SessionLocal()
    try:
        if args.dry_run:
            created, updated = _building_counts(db, inputs.asset)
            floor_created, floor_updated = _floor_counts(db, inputs.floor_specs)
            print(f"[1/5] buildings: created={created} updated={updated} total={db.query(Building).count()}")
            print(f"[2/5] floors: created={floor_created} updated={floor_updated} total={db.query(Layer).count()}")
            _print_floor_state(inputs.floor_state)
            _print_warnings(inputs.warnings)
            return 0
        result = building_service.import_map_data(
            db,
            inputs,
            roads_path=args.roads,
            prune=args.prune_buildings,
        )
        demo = seed_demo(db, asset=inputs.asset)
        print_import_report(result, demo)
        return 0
    except Exception as exc:  # 任一步骤失败都要指出失败原因并以非零状态退出
        db.rollback()
        print(f"ERROR 素材导入失败：{exc}")
        return 1
    finally:
        db.close()


def building_main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="导入校园地图建筑素材")
    parser.add_argument("--buildings", type=Path, default=DEFAULT_BUILDINGS)
    parser.add_argument("--floors", type=Path, default=DEFAULT_FLOORS)
    parser.add_argument("--dry-run", action="store_true", help="只打印将写入的条数，不修改数据库")
    parser.add_argument("--prune-buildings", action="store_true", help="删除素材中不存在的既有建筑")
    args = parser.parse_args(argv)
    try:
        inputs = building_service.load_map_inputs(args.buildings, args.floors)
    except (ValueError, OSError) as exc:
        print(f"ERROR {exc}")
        return 2
    db = SessionLocal()
    try:
        if args.dry_run:
            created, updated = _building_counts(db, inputs.asset)
            print(f"buildings: created={created} updated={updated} pruned=0")
            _print_warnings(inputs.warnings)
            return 0
        result = building_service.import_buildings(db, inputs.asset, prune=args.prune_buildings)
        print(f"buildings: created={result.created} updated={result.updated} pruned={result.deleted}")
        _print_warnings([*inputs.warnings, *result.warnings])
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
