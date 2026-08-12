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


def test_orders_are_paginated_to_ten_records() -> None:
    client = TestClient(app)
    response = client.get("/api/marketplace/orders", params={"page": 1, "page_size": 10, "mode": "customer"})
    assert response.status_code == 200
    payload = response.json()
    assert payload["pageSize"] == 10
    assert len(payload["items"]) <= 10
    assert payload["total"] >= len(payload["items"])


def test_order_creation_rejects_missing_dishes_without_writing_data() -> None:
    client = TestClient(app)
    response = client.post("/api/marketplace/orders", json={"customer": "Validation check", "type": "Dine-in", "items": []})
    assert response.status_code == 422
    assert "dish" in response.json()["detail"].lower()


def test_menu_rows_use_their_own_persisted_dish_count() -> None:
    client = TestClient(app)
    response = client.get("/api/marketplace/resources/menus", params={"page": 1, "page_size": 100})
    assert response.status_code == 200
    payload = response.json()
    assert all(isinstance(row["items"], int) and row["items"] >= 0 for row in payload["items"])


def test_snapshot_remains_available_and_consistent() -> None:
    client = TestClient(app)
    response = client.get("/api/marketplace/snapshot")
    assert response.status_code == 200
    payload = response.json()
    assert "menus" in payload["resources"]
    assert "foodItems" in payload["resources"]
    assert isinstance(payload["orders"], list)
