from app.core.security import hash_password
from app.database import SessionLocal
from app.models import Role, StaffStatus, User


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def register_student(client, username: str) -> str:
    r = client.post(
        "/api/v1/auth/register",
        json={"username": username, "password": "secret123", "display_name": username},
    )
    assert r.status_code == 200
    return r.json()["token"]


def register_staff_applicant(client, username: str, staff_no: str = "T2026001") -> str:
    r = client.post(
        "/api/v1/auth/register",
        json={
            "username": username,
            "password": "secret123",
            "display_name": username,
            "role": "staff",
            "staff_no": staff_no,
            "department": "后勤处",
        },
    )
    assert r.status_code == 200
    return r.json()["token"]


def create_admin(username: str = "admin1") -> None:
    db = SessionLocal()
    db.add(
        User(
            username=username,
            password_hash=hash_password("admin123"),
            role=Role.admin,
            display_name=username,
            staff_status=StaffStatus.approved,
        )
    )
    db.commit()
    db.close()


def admin_login(client) -> str:
    r = client.post("/api/v1/auth/login", json={"username": "admin1", "password": "admin123"})
    assert r.status_code == 200
    return r.json()["token"]


def apply_staff(client, token: str, staff_no: str = "T2026002") -> None:
    r = client.post(
        "/api/v1/me/staff-application",
        json={"staff_no": staff_no, "department": "图书馆"},
        headers=auth(token),
    )
    assert r.status_code == 200


def test_staff_register_creates_pending_application_with_student_role(client):
    token = register_staff_applicant(client, "applier")
    r = client.get("/api/v1/auth/me", headers=auth(token))
    assert r.status_code == 200
    body = r.json()
    assert body["role"] == "student"
    assert body["staff_status"] == "pending"
    assert body["staff_no"] == "T2026001"
    assert body["department"] == "后勤处"


def test_staff_register_without_staff_no_is_rejected(client):
    r = client.post(
        "/api/v1/auth/register",
        json={"username": "nostaffno", "password": "secret123", "display_name": "X", "role": "staff"},
    )
    assert r.status_code == 400


def test_self_register_cannot_become_admin(client):
    r = client.post(
        "/api/v1/auth/register",
        json={"username": "badadmin", "password": "secret123", "display_name": "X", "role": "admin"},
    )
    assert r.status_code == 400


def test_pending_staff_has_no_staff_permission_before_approval(client):
    token = register_staff_applicant(client, "pendingstaff")
    r = client.get("/api/v1/claims", headers=auth(token))
    assert r.status_code == 403


def test_admin_approve_promotes_to_staff(client):
    create_admin()
    token = register_staff_applicant(client, "tobeapproved")
    r = client.get("/api/v1/auth/me", headers=auth(token))
    user_id = r.json()["id"]

    admin_token = admin_login(client)
    r = client.post(f"/api/v1/admin/staff-applications/{user_id}/approve", headers=auth(admin_token))
    assert r.status_code == 200
    assert r.json()["role"] == "staff"
    assert r.json()["staff_status"] == "approved"

    r = client.get("/api/v1/auth/me", headers=auth(token))
    assert r.json()["role"] == "staff"


def test_admin_reject_records_reason_and_keeps_student_role(client):
    create_admin()
    token = register_staff_applicant(client, "tobcrejected")
    user_id = client.get("/api/v1/auth/me", headers=auth(token)).json()["id"]

    admin_token = admin_login(client)
    r = client.post(f"/api/v1/admin/staff-applications/{user_id}/approve", headers=auth(admin_token))
    assert r.status_code == 200

    r = client.post(f"/api/v1/admin/staff-applications/{user_id}/approve", headers=auth(admin_token))
    assert r.status_code == 409

    token2 = register_staff_applicant(client, "tobcrejected2")
    user_id2 = client.get("/api/v1/auth/me", headers=auth(token2)).json()["id"]
    r = client.post(
        f"/api/v1/admin/staff-applications/{user_id2}/reject",
        json={"reason": "工号无法核实"},
        headers=auth(admin_token),
    )
    assert r.status_code == 200
    assert r.json()["staff_status"] == "rejected"
    assert r.json()["role"] == "student"
    assert r.json()["staff_reject_reason"] == "工号无法核实"


def test_reject_requires_non_empty_reason(client):
    create_admin()
    token = register_staff_applicant(client, "emptyreject")
    user_id = client.get("/api/v1/auth/me", headers=auth(token)).json()["id"]
    admin_token = admin_login(client)
    r = client.post(
        f"/api/v1/admin/staff-applications/{user_id}/reject",
        json={"reason": "   "},
        headers=auth(admin_token),
    )
    assert r.status_code == 400


def test_student_cannot_review_staff_application(client):
    create_admin()
    token = register_staff_applicant(client, "applicant2")
    user_id = client.get("/api/v1/auth/me", headers=auth(token)).json()["id"]
    student_token = register_student(client, "plainstudent")
    r = client.post(f"/api/v1/admin/staff-applications/{user_id}/approve", headers=auth(student_token))
    assert r.status_code == 403
    r = client.get("/api/v1/admin/staff-applications", headers=auth(student_token))
    assert r.status_code == 403


def test_duplicate_application_conflicts(client):
    token = register_staff_applicant(client, "duplicate")
    r = client.post(
        "/api/v1/me/staff-application",
        json={"staff_no": "T2026999", "department": "食堂"},
        headers=auth(token),
    )
    assert r.status_code == 409


def test_invalid_staff_no_is_rejected(client):
    token = register_student(client, "badno")
    r = client.post(
        "/api/v1/me/staff-application",
        json={"staff_no": "T-1"},
        headers=auth(token),
    )
    assert r.status_code == 400


def test_admin_lists_pending_applications(client):
    create_admin()
    register_staff_applicant(client, "listedapplier")
    admin_token = admin_login(client)
    r = client.get("/api/v1/admin/staff-applications", headers=auth(admin_token))
    assert r.status_code == 200
    assert r.json()["total"] == 1
    assert r.json()["items"][0]["staff_status"] == "pending"


def test_rejected_application_can_be_resubmitted(client):
    create_admin()
    token = register_staff_applicant(client, "resubmitter")
    user_id = client.get("/api/v1/auth/me", headers=auth(token)).json()["id"]

    admin_token = admin_login(client)
    r = client.post(
        f"/api/v1/admin/staff-applications/{user_id}/reject",
        json={"reason": "工号无法核实"},
        headers=auth(admin_token),
    )
    assert r.status_code == 200

    r = client.post(
        "/api/v1/me/staff-application",
        json={"staff_no": "T2026003", "department": "保卫处"},
        headers=auth(token),
    )
    assert r.status_code == 200
    body = r.json()
    assert body["role"] == "student"
    assert body["staff_status"] == "pending"
    assert body["staff_reject_reason"] is None
    assert body["staff_no"] == "T2026003"
    assert body["department"] == "保卫处"

    r = client.get("/api/v1/auth/me", headers=auth(token))
    assert r.json()["staff_status"] == "pending"
    assert r.json()["staff_reject_reason"] is None

    r = client.get("/api/v1/admin/staff-applications", headers=auth(admin_token))
    assert r.json()["total"] == 1
    assert r.json()["items"][0]["staff_no"] == "T2026003"
