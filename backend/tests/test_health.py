from datetime import datetime

from fastapi.testclient import TestClient

from app.api.routes import _sort_resource_rows
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


def test_recent_payment_rows_keep_database_creation_order() -> None:
    rows = [
        {"id": "fff", "createdAt": "2026-08-14T09:00:00+00:00"},
        {"id": "001", "createdAt": "2026-08-13T09:00:00+00:00"},
    ]

    assert [row["id"] for row in _sort_resource_rows(rows, "payments", "recent")] == ["fff", "001"]


def test_operational_pages_are_limited_and_recent_payments_have_timestamps() -> None:
    client = TestClient(app)
    payments = client.get("/api/marketplace/resources/payments", params={"page": 1, "page_size": 10, "sort": "recent"})
    cancellations = client.get("/api/marketplace/resources/cancellations", params={"page": 1, "page_size": 10, "sort": "recent"})

    assert payments.status_code == 200
    assert cancellations.status_code == 200
    payment_rows = payments.json()["items"]
    assert len(payment_rows) <= 10
    assert len(cancellations.json()["items"]) <= 10
    timestamps = [datetime.fromisoformat(row["createdAt"]) for row in payment_rows if row["createdAt"]]
    assert timestamps == sorted(timestamps, reverse=True)


def test_catalog_metrics_remain_organization_wide_when_rows_are_filtered() -> None:
    client = TestClient(app)
    all_menus = client.get("/api/marketplace/resources/menus", params={"page": 1, "page_size": 10})
    filtered_menus = client.get("/api/marketplace/resources/menus", params={"page": 1, "page_size": 10, "search": "unlikely-filter-value"})

    assert all_menus.status_code == 200
    assert filtered_menus.status_code == 200
    assert all_menus.json()["metrics"] == filtered_menus.json()["metrics"]


def test_snapshot_remains_available_and_consistent() -> None:
    client = TestClient(app)
    response = client.get("/api/marketplace/snapshot")
    assert response.status_code == 200
    payload = response.json()
    assert "menus" in payload["resources"]
    assert "foodItems" in payload["resources"]
    assert isinstance(payload["orders"], list)
