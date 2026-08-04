from fastapi.testclient import TestClient

from app.main import app


def test_health() -> None:
    client = TestClient(app)
    response = client.get("/api/marketplace/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_context_has_local_argo_context_without_login_route() -> None:
    client = TestClient(app)
    response = client.get("/api/marketplace/context")
    assert response.status_code == 200
    assert response.json()["organization_id"]
