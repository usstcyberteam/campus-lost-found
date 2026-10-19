from pydantic import TypeAdapter

from app.config import get_settings
from app.core.security import hash_password
from app.database import SessionLocal
from app.models import Building, Layer, Role, SimulatedPoint, User
from app.models.enums import SimulatedPointKind
from app.schemas.validation import Password
from app.services import building_service

_LAYER_SPECS = [
    {"name": "校园 2.5D 底图", "image_path": "campus-2.5d.jpg", "width": 1280, "height": 2276},
    {"name": "综合楼 1F", "image_path": None, "width": 1280, "height": 900, "building_code": "B05", "floor": 1},
    {"name": "综合楼 2F", "image_path": None, "width": 1280, "height": 900, "building_code": "B05", "floor": 2},
    {"name": "图书馆 1F", "image_path": None, "width": 1280, "height": 900, "building_code": "B02", "floor": 1},
]

# v1.0 图层名升级为 v2.0 名称，避免重复执行 seed 后出现两套图层
_LEGACY_LAYER_NAMES = {"室外示意图": "校园 2.5D 底图", "楼1F": "综合楼 1F", "楼2F": "综合楼 2F"}

_POINT_SPECS = [
    {
        "layer": "校园 2.5D 底图",
        "label": "保卫处",
        "kind": SimulatedPointKind.help_point,
        "is_public": True,
        "norm_x": 0.18,
        "norm_y": 0.72,
        "description": "24 小时值班，可协助查询监控与登记失物",
    },
    {
        "layer": "校园 2.5D 底图",
        "label": "校园服务台",
        "kind": SimulatedPointKind.help_point,
        "is_public": True,
        "norm_x": 0.52,
        "norm_y": 0.55,
        "description": "提供咨询与失物登记指引",
    },
    {
        "layer": "校园 2.5D 底图",
        "label": "失物招领处",
        "kind": SimulatedPointKind.help_point,
        "is_public": True,
        "norm_x": 0.42,
        "norm_y": 0.38,
        "description": "集中保管拾获物品，可凭有效证件认领",
    },
    {
        "layer": "校园 2.5D 底图",
        "label": "主门监控（模拟）",
        "kind": SimulatedPointKind.monitor_point,
        "is_public": False,
        "norm_x": 0.12,
        "norm_y": 0.5,
        "description": "模拟监控点位，仅工作人员可见",
    },
    {
        "layer": "校园 2.5D 底图",
        "label": "图书馆入口监控（模拟）",
        "kind": SimulatedPointKind.monitor_point,
        "is_public": False,
        "norm_x": 0.46,
        "norm_y": 0.62,
        "description": "模拟监控点位，仅工作人员可见",
    },
    {
        "layer": "校园 2.5D 底图",
        "label": "食堂走廊监控（模拟）",
        "kind": SimulatedPointKind.monitor_point,
        "is_public": False,
        "norm_x": 0.68,
        "norm_y": 0.34,
        "description": "模拟监控点位，仅工作人员可见",
    },
]


def seed() -> None:

    db = SessionLocal()
    try:
        if db.query(User).filter(User.username == "admin").first() is None:
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

        building_service.import_buildings(db, building_service.load_config())

        for legacy_name, name in _LEGACY_LAYER_NAMES.items():
            legacy = db.query(Layer).filter(Layer.name == legacy_name).first()
            if legacy is not None and db.query(Layer).filter(Layer.name == name).first() is None:
                legacy.name = name

        for spec in _LAYER_SPECS:
            layer = db.query(Layer).filter(Layer.name == spec["name"]).first()
            if layer is None:
                layer = Layer(name=spec["name"], version="1")
                db.add(layer)
            layer.image_path = spec["image_path"]
            layer.width = spec["width"]
            layer.height = spec["height"]
            layer.floor = spec.get("floor")
            building_code = spec.get("building_code")
            building = db.query(Building).filter(Building.code == building_code).first() if building_code else None
            layer.building_id = building.id if building is not None else None

        db.flush()
        for spec in _POINT_SPECS:
            layer = db.query(Layer).filter(Layer.name == spec["layer"]).first()
            if layer is None:
                continue
            point = (
                db.query(SimulatedPoint)
                .filter(SimulatedPoint.layer_id == layer.id, SimulatedPoint.label == spec["label"])
                .first()
            )
            if point is None:
                point = SimulatedPoint(layer_id=layer.id, label=spec["label"])
                db.add(point)
            point.kind = spec["kind"]
            point.is_public = spec["is_public"]
            point.norm_x = spec["norm_x"]
            point.norm_y = spec["norm_y"]
            point.is_simulated = True
            point.description = spec["description"]

        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    seed()
    print("seed done")
