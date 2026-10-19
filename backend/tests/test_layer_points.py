import uuid

from app.database import SessionLocal
from app.models import Layer, Role, SimulatedPoint
from app.models.enums import SimulatedPointKind
from tests.test_acceptance import auth, create_user, login, register


def seed_layer_with_points() -> str:
    db = SessionLocal()
    try:
        layer = Layer(name="测试室外图层", width=1000, height=1000)
        db.add(layer)
        db.flush()
        db.add_all(
            [
                SimulatedPoint(
                    layer_id=layer.id,
                    label="保卫处",
                    norm_x=0.2,
                    norm_y=0.3,
                    kind=SimulatedPointKind.help_point,
                    is_public=True,
                    is_simulated=True,
                ),
                SimulatedPoint(
                    layer_id=layer.id,
                    label="主门监控（模拟）",
                    norm_x=0.5,
                    norm_y=0.5,
                    kind=SimulatedPointKind.monitor_point,
                    is_public=False,
                    is_simulated=True,
                ),
            ]
        )
        db.commit()
        return str(layer.id)
    finally:
        db.close()


def test_layer_points_require_login_and_existing_layer(client):
    layer_id = seed_layer_with_points()

    assert client.get(f"/api/v1/layers/{layer_id}/points").status_code == 401

    token = register(client, "point_viewer")
    missing = client.get(f"/api/v1/layers/{uuid.uuid4()}/points", headers=auth(token))
    assert missing.status_code == 404


def test_student_sees_help_points_only(client):
    layer_id = seed_layer_with_points()
    token = register(client, "point_student")

    response = client.get(f"/api/v1/layers/{layer_id}/points", headers=auth(token))
    assert response.status_code == 200
    body = response.json()
    assert body["has_monitor"] is False
    assert [point["label"] for point in body["points"]] == ["保卫处"]
    assert body["points"][0]["kind"] == "help_point"
    assert body["points"][0]["is_public"] is True


def test_staff_sees_monitor_points(client):
    layer_id = seed_layer_with_points()
    create_user("point_staff", "staff123", Role.staff)
    token = login(client, "point_staff", "staff123")

    response = client.get(f"/api/v1/layers/{layer_id}/points", headers=auth(token))
    assert response.status_code == 200
    body = response.json()
    assert body["has_monitor"] is True
    assert {point["kind"] for point in body["points"]} == {"help_point", "monitor_point"}
    monitor = next(point for point in body["points"] if point["kind"] == "monitor_point")
    assert monitor["is_simulated"] is True
    assert monitor["is_public"] is False
