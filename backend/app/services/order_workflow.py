from decimal import Decimal
from typing import Any

from fastapi import HTTPException

from app.models import Order


ORDER_TYPES = {"Dine-in", "Takeout", "Pickup", "Delivery"}
TERMINAL_ORDER_STATUSES = {"Completed", "Delivered", "Cancelled"}
ACTIVE_KITCHEN_STATUSES = {"Pending", "Preparing", "Ready"}
READY_STATUS_BY_TYPE = {
    "Dine-in": "Ready",
    "Takeout": "Ready for Pickup",
    "Pickup": "Ready for Pickup",
    "Delivery": "Ready for Dispatch",
}


def validate_order_type(value: Any) -> str:
    order_type = str(value or "")
    if order_type not in ORDER_TYPES:
        raise HTTPException(status_code=422, detail="Order type must be Dine-in, Takeout, Pickup, or Delivery")
    return order_type


def validate_operational_fields(order_type: str, metadata: dict[str, Any]) -> None:
    missing: list[str] = []
    if not str(metadata.get("customer") or "").strip():
        missing.append("customer")
    if order_type == "Dine-in":
        if not str(metadata.get("table") or "").strip():
            missing.append("table")
        try:
            guests = int(metadata.get("guests") or 0)
        except (TypeError, ValueError):
            guests = 0
        if guests < 1 or guests > 30:
            missing.append("guests between 1 and 30")
        else:
            metadata["guests"] = guests
        metadata.setdefault("server", "ARGO Floor Team")
    elif order_type == "Pickup":
        if not str(metadata.get("contact") or "").strip():
            missing.append("contact")
        if not str(metadata.get("pickupTime") or "").strip():
            missing.append("pickup time")
    elif order_type == "Delivery":
        if not str(metadata.get("contact") or "").strip():
            missing.append("contact")
        if not str(metadata.get("address") or "").strip():
            missing.append("delivery address")
    if missing:
        raise HTTPException(status_code=422, detail=f"Complete required order fields: {', '.join(missing)}")


def ensure_mutable(order: Order) -> None:
    if order.status in TERMINAL_ORDER_STATUSES:
        raise HTTPException(status_code=409, detail=f"{order.status} orders can no longer be edited")


def advance_kitchen(order: Order) -> str:
    ensure_mutable(order)
    if order.kitchen_status == "Pending":
        order.kitchen_status = "Preparing"
        order.status = "Preparing"
    elif order.kitchen_status == "Preparing":
        order.kitchen_status = "Ready"
        order.status = READY_STATUS_BY_TYPE[order.order_type]
    elif order.kitchen_status == "Ready":
        raise HTTPException(status_code=409, detail="This ticket is ready and awaiting fulfillment")
    else:
        raise HTTPException(status_code=409, detail="This ticket is no longer active in the kitchen")
    return order.kitchen_status


def advance_fulfillment(order: Order) -> str:
    ensure_mutable(order)
    ready_status = READY_STATUS_BY_TYPE[order.order_type]
    if order.status != ready_status and not (order.order_type == "Delivery" and order.status == "Out for Delivery"):
        raise HTTPException(status_code=409, detail="Kitchen preparation must be ready before fulfillment can advance")
    if order.order_type == "Delivery":
        if order.status == "Ready for Dispatch":
            metadata = order.metadata_json if isinstance(order.metadata_json, dict) else {}
            if not str(metadata.get("rider") or "").strip() or metadata.get("rider") == "No rider assigned":
                raise HTTPException(status_code=422, detail="Assign a rider before dispatching this delivery")
            order.status = "Out for Delivery"
            order.kitchen_status = "Completed"
        else:
            order.status = "Delivered"
            order.kitchen_status = "Completed"
    else:
        order.status = "Completed"
        order.kitchen_status = "Completed"
    return order.status


def calculate_totals(order_type: str, subtotal: Decimal, discount: Decimal = Decimal("0")) -> tuple[Decimal, Decimal, Decimal, Decimal]:
    taxable = max(Decimal("0"), subtotal - discount)
    service_charge = (taxable * Decimal("0.05")).quantize(Decimal("0.01")) if order_type == "Dine-in" else Decimal("0")
    delivery_fee = Decimal("49.00") if order_type == "Delivery" else Decimal("0")
    tax = (taxable * Decimal("0.12")).quantize(Decimal("0.01"))
    return service_charge, delivery_fee, tax, taxable + service_charge + delivery_fee + tax
