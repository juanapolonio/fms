from decimal import Decimal

import pytest
from fastapi import HTTPException

from app.models import Order
from app.services.order_workflow import advance_fulfillment, advance_kitchen, calculate_totals, validate_operational_fields


def order(order_type: str, *, status: str = "Pending", kitchen_status: str = "Pending", rider: str | None = None) -> Order:
    return Order(
        order_number="TEST-ORDER",
        order_type=order_type,
        status=status,
        kitchen_status=kitchen_status,
        payment_status="Pending",
        metadata_json={"customer": "ARGO Test Customer", "rider": rider},
    )


@pytest.mark.parametrize(
    ("order_type", "metadata"),
    [
        ("Dine-in", {"customer": "ARGO User", "table": "Table 1", "guests": 2}),
        ("Takeout", {"customer": "ARGO User", "contact": "0917 000 0000"}),
        ("Pickup", {"customer": "ARGO User", "contact": "0917 000 0000", "pickupTime": "11:30 AM"}),
        ("Delivery", {"customer": "ARGO User", "contact": "0917 000 0000", "address": "123 ARGO Avenue"}),
    ],
)
def test_operational_fields_accept_valid_order_types(order_type: str, metadata: dict[str, object]) -> None:
    validate_operational_fields(order_type, metadata)


def test_dine_in_requires_table_and_guest_count() -> None:
    with pytest.raises(HTTPException) as error:
        validate_operational_fields("Dine-in", {"customer": "ARGO User"})
    assert error.value.status_code == 422
    assert "table" in error.value.detail
    assert "guests" in error.value.detail


@pytest.mark.parametrize(
    ("order_type", "ready_status"),
    [("Dine-in", "Ready"), ("Takeout", "Ready for Pickup"), ("Pickup", "Ready for Pickup"), ("Delivery", "Ready for Dispatch")],
)
def test_kitchen_has_one_authoritative_progression(order_type: str, ready_status: str) -> None:
    row = order(order_type)
    assert advance_kitchen(row) == "Preparing"
    assert row.status == "Preparing"
    assert advance_kitchen(row) == "Ready"
    assert row.status == ready_status


def test_fulfillment_cannot_skip_kitchen_readiness() -> None:
    with pytest.raises(HTTPException) as error:
        advance_fulfillment(order("Takeout"))
    assert error.value.status_code == 409


def test_delivery_requires_rider_then_dispatches_and_delivers() -> None:
    row = order("Delivery", status="Ready for Dispatch", kitchen_status="Ready")
    with pytest.raises(HTTPException):
        advance_fulfillment(row)
    row.metadata_json["rider"] = "ARGO Rider 2"
    assert advance_fulfillment(row) == "Out for Delivery"
    assert row.kitchen_status == "Completed"
    assert advance_fulfillment(row) == "Delivered"


def test_calculated_totals_keep_charges_consistent() -> None:
    service, delivery, tax, total = calculate_totals("Dine-in", Decimal("100.00"))
    assert (service, delivery, tax, total) == (Decimal("5.00"), Decimal("0"), Decimal("12.00"), Decimal("117.00"))
    service, delivery, tax, total = calculate_totals("Delivery", Decimal("100.00"))
    assert (service, delivery, tax, total) == (Decimal("0"), Decimal("49.00"), Decimal("12.00"), Decimal("161.00"))
