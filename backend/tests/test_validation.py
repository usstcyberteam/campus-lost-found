import uuid

from app.database import SessionLocal
from app.models import ItemFeature, Layer, Role
from tests.test_acceptance import auth, create_user, login, register


def create_layer(name: str | None = None) -> str:
    db = SessionLocal()
    layer = Layer(name=name or f"layer-{uuid.uuid4().hex}", version="1", width=100, height=100)
    db.add(layer)
    db.commit()
    db.refresh(layer)
    layer_id = str(layer.id)
    db.close()
    return layer_id


def item(client, token, direction="found", title="雨伞"):
    r = client.post(
        "/api/v1/items", headers=auth(token), json={"direction": direction, "category": "雨伞", "title": title}
    )
    assert r.status_code == 200, r.text
    return r.json()["id"]


def staff_token(client, name="staff"):
    create_user(name, "staff123", Role.staff)
    return login(client, name, "staff123")


def admin_token(client, name="admin"):
    create_user(name, "secret123", Role.admin)
    return login(client, name, "secret123")


# 1. 坐标范围
def test_map_anchor_coordinate_out_of_range_returns_400(client):
    token = register(client, "owner")
    item_id = item(client, token)
    layer_id = create_layer()
    for coord in [{"norm_x": 1.5, "norm_y": 0.5}, {"norm_x": 0.5, "norm_y": -0.1}]:
        r = client.post(
            f"/api/v1/items/{item_id}/map-anchor", headers=auth(token), json={"layer_id": layer_id, **coord}
        )
        assert r.status_code == 400


def test_simulated_point_coordinate_out_of_range_returns_400(client):
    token = staff_token(client)
    layer_id = create_layer()
    r = client.post(
        f"/api/v1/layers/{layer_id}/simulated-points",
        headers=auth(token),
        json={"label": "点", "norm_x": 1.5, "norm_y": 0.5},
    )
    assert r.status_code == 400


# 2. 长度上限
def test_item_description_and_precise_location_length_limits(client):
    token = register(client, "owner")
    assert (
        client.post(
            "/api/v1/items",
            headers=auth(token),
            json={"direction": "found", "category": "书", "title": "书", "description": "x" * 2001},
        ).status_code
        == 400
    )
    assert (
        client.post(
            "/api/v1/items",
            headers=auth(token),
            json={"direction": "found", "category": "书", "title": "书", "precise_location": "x" * 201},
        ).status_code
        == 400
    )
    assert (
        client.post(
            "/api/v1/items",
            headers=auth(token),
            json={
                "direction": "found",
                "category": "书",
                "title": "书",
                "description": "x" * 2000,
                "precise_location": "x" * 200,
            },
        ).status_code
        == 200
    )


def test_contact_length_limit_on_register_and_staff(client):
    assert (
        client.post(
            "/api/v1/auth/register",
            json={"username": "contact1", "password": "secret123", "display_name": "用户", "contact": "x" * 101},
        ).status_code
        == 400
    )
    admin = admin_token(client)
    assert (
        client.post(
            "/api/v1/admin/staff",
            headers=auth(admin),
            json={"username": "newstaff", "display_name": "人员", "password": "secret123", "contact": "x" * 101},
        ).status_code
        == 400
    )


def test_simulated_point_label_and_description_length_limits(client):
    token = staff_token(client)
    layer_id = create_layer()
    assert (
        client.post(
            f"/api/v1/layers/{layer_id}/simulated-points",
            headers=auth(token),
            json={"label": "", "norm_x": 0.5, "norm_y": 0.5},
        ).status_code
        == 400
    )
    assert (
        client.post(
            f"/api/v1/layers/{layer_id}/simulated-points",
            headers=auth(token),
            json={"label": "x" * 65, "norm_x": 0.5, "norm_y": 0.5},
        ).status_code
        == 400
    )
    assert (
        client.post(
            f"/api/v1/layers/{layer_id}/simulated-points",
            headers=auth(token),
            json={"label": "点", "norm_x": 0.5, "norm_y": 0.5, "description": "x" * 501},
        ).status_code
        == 400
    )


def test_review_reason_length_limit(client):
    owner, other = register(client, "owner"), register(client, "other")
    found = item(client, other)
    claim_id = client.post(
        "/api/v1/claims",
        headers=auth(owner),
        json={"found_item_id": found, "evidence": [{"kind": "text", "content": "划痕"}], "idempotency_key": "k1"},
    ).json()["id"]
    staff = staff_token(client)
    r = client.post(
        f"/api/v1/claims/{claim_id}/review", headers=auth(staff), json={"approve": False, "reason": "x" * 501}
    )
    assert r.status_code == 400


# 3. pixels_per_meter > 0
def test_calibrate_non_positive_pixels_per_meter_returns_400(client):
    admin = admin_token(client)
    layer_id = create_layer()
    for ppm in [0, -1]:
        r = client.post(f"/api/v1/layers/{layer_id}/calibrate", headers=auth(admin), json={"pixels_per_meter": ppm})
        assert r.status_code == 400


# 4. 路线几何
def test_route_polyline_geometry_validation(client):
    token = register(client, "owner")
    item_id = item(client, token)
    layer_id = create_layer()
    # 少于 2 个点
    r = client.post(
        f"/api/v1/items/{item_id}/route",
        headers=auth(token),
        json={"kind": "polyline", "layer_id": layer_id, "geometry": {"points": [{"x": 0.1, "y": 0.1}]}},
    )
    assert r.status_code == 400
    # 坐标越界
    r = client.post(
        f"/api/v1/items/{item_id}/route",
        headers=auth(token),
        json={
            "kind": "polyline",
            "layer_id": layer_id,
            "geometry": {"points": [{"x": 0.1, "y": 0.1}, {"x": 1.5, "y": 0.2}]},
        },
    )
    assert r.status_code == 400
    # 结构不符（传了 circle 结构）
    r = client.post(
        f"/api/v1/items/{item_id}/route",
        headers=auth(token),
        json={"kind": "polyline", "layer_id": layer_id, "geometry": {"center": {"x": 0.5, "y": 0.5}, "radius": 0.2}},
    )
    assert r.status_code == 400
    # 正常创建
    r = client.post(
        f"/api/v1/items/{item_id}/route",
        headers=auth(token),
        json={
            "kind": "polyline",
            "layer_id": layer_id,
            "geometry": {"points": [{"x": 0.1, "y": 0.1}, {"x": 0.2, "y": 0.2}]},
        },
    )
    assert r.status_code == 200


def test_route_circle_geometry_validation(client):
    token = register(client, "owner")
    item_id = item(client, token)
    layer_id = create_layer()
    for radius in [0, 1.5]:
        r = client.post(
            f"/api/v1/items/{item_id}/route",
            headers=auth(token),
            json={
                "kind": "circle",
                "layer_id": layer_id,
                "geometry": {"center": {"x": 0.5, "y": 0.5}, "radius": radius},
            },
        )
        assert r.status_code == 400
    # 结构不符（传了 polyline 结构）
    r = client.post(
        f"/api/v1/items/{item_id}/route",
        headers=auth(token),
        json={
            "kind": "circle",
            "layer_id": layer_id,
            "geometry": {"points": [{"x": 0.1, "y": 0.1}, {"x": 0.2, "y": 0.2}]},
        },
    )
    assert r.status_code == 400


# 5. 引用存在性
def test_simulated_point_missing_layer_returns_404(client):
    token = staff_token(client)
    missing = str(uuid.uuid4())
    r = client.post(
        f"/api/v1/layers/{missing}/simulated-points",
        headers=auth(token),
        json={"label": "点", "norm_x": 0.5, "norm_y": 0.5},
    )
    assert r.status_code == 404


def test_map_anchor_missing_layer_returns_404(client):
    token = register(client, "owner")
    item_id = item(client, token)
    missing = str(uuid.uuid4())
    r = client.post(
        f"/api/v1/items/{item_id}/map-anchor",
        headers=auth(token),
        json={"layer_id": missing, "norm_x": 0.5, "norm_y": 0.5},
    )
    assert r.status_code == 404


def test_route_missing_layer_returns_404(client):
    token = register(client, "owner")
    item_id = item(client, token)
    missing = str(uuid.uuid4())
    r = client.post(
        f"/api/v1/items/{item_id}/route",
        headers=auth(token),
        json={
            "kind": "polyline",
            "layer_id": missing,
            "geometry": {"points": [{"x": 0.1, "y": 0.1}, {"x": 0.2, "y": 0.2}]},
        },
    )
    assert r.status_code == 404


# 6. 特征提取接口
def test_extract_uses_request_body_and_length_limit(client):
    token = register(client, "owner")
    item_id = item(client, token)
    r = client.post(f"/api/v1/items/{item_id}/extract", headers=auth(token), json={"text": "蓝伞"})
    assert r.status_code == 200
    assert r.json()["extracted_text"] == "蓝伞"
    r = client.post(f"/api/v1/items/{item_id}/extract", headers=auth(token), json={"text": "x" * 2001})
    assert r.status_code == 400


def test_extract_repeat_updates_existing_unconfirmed_feature(client):
    token = register(client, "owner")
    item_id = item(client, token)
    assert (
        client.post(f"/api/v1/items/{item_id}/extract", headers=auth(token), json={"text": "第一次"}).status_code == 200
    )
    assert (
        client.post(f"/api/v1/items/{item_id}/extract", headers=auth(token), json={"text": "第二次"}).status_code == 200
    )
    with SessionLocal() as db:
        features = db.query(ItemFeature).filter(ItemFeature.item_id == uuid.UUID(item_id)).all()
        assert len(features) == 1
        assert features[0].extracted_text == "第二次"


# 7. 角色一致
def test_admin_can_review_and_complete_claim(client):
    owner, other = register(client, "owner"), register(client, "other")
    admin = admin_token(client)
    found = item(client, other)
    claim_id = client.post(
        "/api/v1/claims",
        headers=auth(owner),
        json={"found_item_id": found, "evidence": [{"kind": "text", "content": "划痕"}], "idempotency_key": "k1"},
    ).json()["id"]
    assert client.get("/api/v1/claims", headers=auth(admin)).status_code == 200
    assert (
        client.post(f"/api/v1/claims/{claim_id}/review", headers=auth(admin), json={"approve": True}).status_code == 200
    )
    assert client.post(f"/api/v1/claims/{claim_id}/complete", headers=auth(admin)).status_code == 200


def test_admin_can_assign_and_feedback_ticket(client):
    owner = register(client, "owner")
    admin = admin_token(client)
    lost = item(client, owner, "lost")
    ticket_id = client.post("/api/v1/tickets", headers=auth(owner), json={"item_id": lost}).json()["id"]
    assert client.post(f"/api/v1/tickets/{ticket_id}/assign", headers=auth(admin)).status_code == 200
    assert (
        client.post(f"/api/v1/tickets/{ticket_id}/feedback", headers=auth(admin), json={"result": "完成"}).status_code
        == 200
    )


def test_admin_can_list_simulated_points(client):
    admin = admin_token(client)
    layer_id = create_layer()
    assert client.get(f"/api/v1/layers/{layer_id}/simulated-points", headers=auth(admin)).status_code == 200


# 8. 拒绝理由
def test_review_reason_saved_and_returned(client):
    owner, other = register(client, "owner"), register(client, "other")
    staff = staff_token(client)
    found = item(client, other)
    claim_id = client.post(
        "/api/v1/claims",
        headers=auth(owner),
        json={"found_item_id": found, "evidence": [{"kind": "text", "content": "划痕"}], "idempotency_key": "k1"},
    ).json()["id"]
    r = client.post(
        f"/api/v1/claims/{claim_id}/review", headers=auth(staff), json={"approve": False, "reason": "证据不足"}
    )
    assert r.status_code == 200
    detail = client.get(f"/api/v1/claims/{claim_id}", headers=auth(staff))
    assert detail.json()["review_reason"] == "证据不足"
