from pydantic import TypeAdapter

from app.config import get_settings
from app.core.security import hash_password
from app.database import SessionLocal
from app.models import Role, User
from app.schemas.validation import Password
from app.services import building_service
from scripts.import_map_assets import print_import_report


def _ensure_admin(db) -> None:
    if db.query(User).filter(User.username == "admin").first() is not None:
        return
    admin_password = get_settings().admin_password
    if not admin_password:
        raise RuntimeError("首次初始化须配置 ADMIN_PASSWORD")
    admin_password = TypeAdapter(Password).validate_python(admin_password)
    db.add(
        User(
            username="admin",
            password_hash=hash_password(admin_password),
            role=Role.admin,
            display_name="管理员",
        )
    )


def seed() -> None:
    db = SessionLocal()
    try:
        _ensure_admin(db)
        db.commit()
        try:
            inputs = building_service.load_map_inputs()
        except ValueError as exc:
            print(f"WARN 建筑素材读取失败：{exc}，跳过图层、建筑、楼层与点位初始化")
            return
        # 初始化只准备管理员与地图基础数据，演示数据由 import_map_assets.py 生成
        result = building_service.import_map_data(db, inputs)
        print_import_report(result, include_demo=False)
    finally:
        db.close()


if __name__ == "__main__":
    seed()
    print("seed done")
