import pytest

from app.database import SessionLocal
from app.models import Candidate, Role
from app.services import model
from tests.test_acceptance import auth, create_user, login, register


def item(client, token, direction="found", title="雨伞"):
    r = client.post(
        "/api/v1/items", headers=auth(token), json={"direction": direction, "category": "雨伞", "title": title}
    )
    assert r.status_code == 200, r.text
    return r.json()["id"]


def claim_body(found_id, key, lost_id=None, content="伞柄有划痕"):
    return {
        "found_item_id": found_id,
        "lost_item_id": lost_id,
        "idempotency_key": key,
        "evidence": [{"kind": "text", "content": content}],
    }


def staff_token(client, name="staff"):
    create_user(name, "staff123", Role.staff)
    return login(client, name, "staff123")


def test_cannot_link_foreign_or_closed_lost_record(client):
    owner, other = register(client, "owner"), register(client, "other")
    lost, found = item(client, owner, "lost"), item(client, other)
    r = client.post("/api/v1/claims", headers=auth(other), json=claim_body(found, "foreign", lost))
    assert r.status_code == 403
    assert client.get(f"/api/v1/items/{lost}", headers=auth(owner)).json()["status"] == "searching"


def test_idempotency_is_scoped_to_identity_and_content(client):
    owner, other = register(client, "owner"), register(client, "other")
    found = item(client, other)
    body = claim_body(found, "shared-key")
    first = client.post("/api/v1/claims", headers=auth(owner), json=body)
    assert first.status_code == 200
    assert client.post("/api/v1/claims", headers=auth(owner), json=body).json()["id"] == first.json()["id"]
    foreign = client.post("/api/v1/claims", headers=auth(other), json=body)
    assert foreign.status_code == 409
    assert "id" not in foreign.json()
    changed = client.post(
        "/api/v1/claims", headers=auth(owner), json=claim_body(found, "shared-key", content="不同特征")
    )
    assert changed.status_code == 409


def test_rejecting_competitor_preserves_approved_return(client):
    owner, other, staff = register(client, "owner"), register(client, "other"), staff_token(client)
    found = item(client, other)
    a = client.post("/api/v1/claims", headers=auth(owner), json=claim_body(found, "a")).json()["id"]
    b = client.post("/api/v1/claims", headers=auth(other), json=claim_body(found, "b")).json()["id"]
    assert client.post(f"/api/v1/claims/{a}/review", headers=auth(staff), json={"approve": True}).status_code == 200
    assert client.post(f"/api/v1/claims/{b}/review", headers=auth(staff), json={"approve": True}).status_code == 409
    assert client.post(f"/api/v1/claims/{b}/review", headers=auth(staff), json={"approve": False}).status_code == 200
    assert client.get(f"/api/v1/items/{found}", headers=auth(owner)).json()["status"] == "reviewing"
    assert client.post(f"/api/v1/claims/{a}/complete", headers=auth(staff)).status_code == 200


def test_return_closes_competitors_and_restores_their_lost_record(client):
    owner, other, staff = register(client, "owner"), register(client, "other"), staff_token(client)
    found = item(client, other)
    lost_a, lost_b = item(client, owner, "lost"), item(client, other, "lost")
    a = client.post("/api/v1/claims", headers=auth(owner), json=claim_body(found, "a", lost_a)).json()["id"]
    b = client.post("/api/v1/claims", headers=auth(other), json=claim_body(found, "b", lost_b)).json()["id"]
    client.post(f"/api/v1/claims/{a}/review", headers=auth(staff), json={"approve": True})
    assert client.post(f"/api/v1/claims/{a}/complete", headers=auth(staff)).status_code == 200
    assert client.get(f"/api/v1/claims/{b}", headers=auth(other)).json()["status"] == "rejected"
    assert client.get(f"/api/v1/items/{lost_b}", headers=auth(other)).json()["status"] == "searching"
    assert client.get(f"/api/v1/items/{lost_a}", headers=auth(owner)).json()["status"] == "found"
    assert (
        client.post(
            "/api/v1/claims", headers=auth(owner), json=claim_body(item(client, other), "closed", lost_a)
        ).status_code
        == 409
    )


def test_staff_evidence_access_is_restricted(client):
    owner, other, staff = register(client, "owner"), register(client, "other"), staff_token(client)
    found = item(client, other)
    claim_id = client.post("/api/v1/claims", headers=auth(owner), json=claim_body(found, "private")).json()["id"]
    assert client.get("/api/v1/claims", headers=auth(other)).status_code == 403
    assert client.get(f"/api/v1/claims/{claim_id}", headers=auth(other)).status_code == 403
    assert client.get(f"/api/v1/claims/{claim_id}", headers=auth(owner)).status_code == 200
    detail = client.get(f"/api/v1/claims/{claim_id}", headers=auth(staff))
    assert detail.json()["evidence"][0]["content"] == "伞柄有划痕"
    assert len(client.get("/api/v1/claims?status=pending", headers=auth(staff)).json()) == 1
    assert "evidence" not in client.get(f"/api/v1/items/{found}", headers=auth(other)).json()


@pytest.mark.parametrize("password", ["x" * 80, "汉" * 25])
def test_long_password_returns_validation_not_500(client, password):
    r = client.post("/api/v1/auth/register", json={"username": "longpw", "password": password, "display_name": "用户"})
    assert r.status_code == 400
    assert "password" not in str(r.json().get("details", [])) or password not in str(r.json())
    assert client.post("/api/v1/auth/login", json={"username": "longpw", "password": password}).status_code == 400


def test_utf8_password_boundary_and_staff_password_validation(client):
    password = "汉" * 24
    r = client.post(
        "/api/v1/auth/register", json={"username": "boundary", "password": password, "display_name": "用户"}
    )
    assert r.status_code == 200
    assert login(client, "boundary", password)
    create_user("admin", "secret123", Role.admin)
    token = login(client, "admin", "secret123")
    assert (
        client.post(
            "/api/v1/admin/staff",
            headers=auth(token),
            json={"username": "newstaff", "display_name": "人员", "password": "x" * 80},
        ).status_code
        == 400
    )
    assert (
        client.post(
            "/api/v1/admin/staff", headers=auth(token), json={"username": "newstaff", "display_name": "人员"}
        ).status_code
        == 400
    )


def test_blank_fields_and_evidence_are_rejected(client):
    token = register(client, "owner")
    for fields in [
        {"category": " ", "title": "有效标题"},
        {"category": "雨伞", "title": " "},
        {"category": "雨伞", "title": "x" * 129},
    ]:
        assert (
            client.post("/api/v1/items", headers=auth(token), json={"direction": "lost", **fields}).status_code == 400
        )
    found = item(client, token)
    assert (
        client.post("/api/v1/claims", headers=auth(token), json=claim_body(found, "blank", content="   ")).status_code
        == 400
    )


def test_candidate_get_is_read_only_and_ownership_is_explicit(client):
    owner, other = register(client, "owner"), register(client, "other")
    lost = item(client, owner, "lost")
    item(client, other)
    assert client.get(f"/api/v1/items/{lost}", headers=auth(owner)).json()["is_owner"] is True
    assert client.get(f"/api/v1/items/{lost}", headers=auth(other)).json()["is_owner"] is False
    for _ in range(3):
        assert len(client.get(f"/api/v1/items/{lost}/candidates", headers=auth(owner)).json()) == 1
    with SessionLocal() as db:
        assert db.query(Candidate).count() == 0


def test_unimplemented_adapter_never_claims_model_call(monkeypatch):
    monkeypatch.setattr(model.settings, "model_disabled", False)
    monkeypatch.setattr(model.settings, "model_api_key", "test-placeholder")
    result = model.extract_features("蓝伞")
    assert result["source"] == "manual"
    assert result["degraded"] is True


def test_ticket_assign_conflict_and_feedback_permissions(client):
    owner = register(client, "owner")
    a, b = staff_token(client, "staffa"), staff_token(client, "staffb")
    lost = item(client, owner, "lost")
    ticket = client.post("/api/v1/tickets", headers=auth(owner), json={"item_id": lost}).json()["id"]
    assert client.post(f"/api/v1/tickets/{ticket}/assign", headers=auth(a)).status_code == 200
    assert client.post(f"/api/v1/tickets/{ticket}/assign", headers=auth(b)).status_code == 409
    assert (
        client.post(f"/api/v1/tickets/{ticket}/feedback", headers=auth(b), json={"result": "完成"}).status_code == 403
    )


@pytest.mark.skipif(
    SessionLocal.kw["bind"].dialect.name != "postgresql", reason="requires dedicated PostgreSQL test database"
)
def test_postgres_concurrent_claim_review_return_and_ticket_assignment(client):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier

    owner, other, staff = register(client, "owner"), register(client, "other"), staff_token(client)
    found = item(client, other)
    a = client.post("/api/v1/claims", headers=auth(owner), json=claim_body(found, "a")).json()["id"]
    b = client.post("/api/v1/claims", headers=auth(other), json=claim_body(found, "b")).json()["id"]

    def parallel(function, values):
        gate = Barrier(2)

        def run(value):
            gate.wait(timeout=10)
            return function(value)

        with ThreadPoolExecutor(max_workers=2) as pool:
            return list(pool.map(run, values))

    results = parallel(
        lambda c: client.post(f"/api/v1/claims/{c}/review", headers=auth(staff), json={"approve": True}).status_code,
        [a, b],
    )
    assert sorted(results) == [200, 409]
    winner = [a, b][results.index(200)]
    results = parallel(
        lambda _: client.post(f"/api/v1/claims/{winner}/complete", headers=auth(staff)).status_code, [0, 1]
    )
    assert sorted(results) == [200, 409]
    lost = item(client, owner, "lost")
    ticket = client.post("/api/v1/tickets", headers=auth(owner), json={"item_id": lost}).json()["id"]
    staff2 = staff_token(client, "staff2")
    results = parallel(
        lambda t: client.post(f"/api/v1/tickets/{ticket}/assign", headers=auth(t)).status_code, [staff, staff2]
    )
    assert sorted(results) == [200, 409]
