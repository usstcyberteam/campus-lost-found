import os
import secrets

import pytest
from sqlalchemy.engine import make_url

test_url = os.environ.get("TEST_DATABASE_URL", "sqlite:///./test_pytest.db")
if os.environ.get("TEST_DATABASE_URL") and not (make_url(test_url).database or "").endswith("_test"):
    raise RuntimeError("TEST_DATABASE_URL 必须指向以 _test 结尾的专用测试数据库；测试会清空其表")
os.environ["DATABASE_URL"] = test_url
os.environ["JWT_SECRET"] = secrets.token_urlsafe(48)

from fastapi.testclient import TestClient  # noqa: E402

from app import models  # noqa: E402,F401
from app.database import Base, engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(autouse=True)
def clean_db():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield


@pytest.fixture(autouse=True)
def disable_model(monkeypatch):
    """测试默认禁用真实模型：隔离外部依赖，避免 .env 配置了可用模型时测试行为不确定。

    需要"模型可用"的测试在函数内用 monkeypatch 显式覆盖（如 tests.test_ai_draft.configure_model）。
    """
    from app.services import model_client

    monkeypatch.setattr(model_client.settings, "model_disabled", True)


@pytest.fixture
def client():
    return TestClient(app)
