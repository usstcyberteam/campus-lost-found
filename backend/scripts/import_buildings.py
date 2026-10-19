import sys
from pathlib import Path

# 直接以脚本方式运行时，把 backend 加入模块搜索路径
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import SessionLocal  # noqa: E402
from app.services import building_service  # noqa: E402


def main() -> None:
    db = SessionLocal()
    try:
        created, updated = building_service.import_buildings(db, building_service.load_config())
    finally:
        db.close()
    print(f"buildings imported: created={created} updated={updated}")


if __name__ == "__main__":
    main()
