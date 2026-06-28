import os

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost/test")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-that-is-long-enough-32chars")

from app.main import app

client = TestClient(app)


def test_health_returns_200():
    response = client.get("/api/health")
    assert response.status_code == 200


def test_health_returns_ok_status():
    response = client.get("/api/health")
    assert response.json() == {"status": "ok"}


def test_health_content_type_is_json():
    response = client.get("/api/health")
    assert "application/json" in response.headers["content-type"]


def test_unknown_route_returns_404():
    response = client.get("/api/nonexistent")
    assert response.status_code == 404
