from pydantic import TypeAdapter

from app.config import get_settings
from app.core.security import hash_password
from app.database import Base, SessionLocal, engine
from app.models import Layer, Role, User
from app.schemas.validation import Password

_LAYER_SPECS = [
    {"name": "室外示意图", "image_path": "outdoor.jpg", "width": 1280, "height": 2276},
    {"name": "楼1F", "image_path": None, "width": 1280, "height": 900},
    {"name": "楼2F", "image_path": None, "width": 1280, "height": 900},
]


def seed() -> None:
    Base.metadata.create_all(engine)
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

        for spec in _LAYER_SPECS:
            layer = db.query(Layer).filter(Layer.name == spec["name"]).first()
            if layer is None:
                layer = Layer(name=spec["name"], version="1")
                db.add(layer)
            layer.image_path = spec["image_path"]
            layer.width = spec["width"]
            layer.height = spec["height"]

        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    seed()
    print("seed done")
