from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import RequestContext, get_request_context, require_roles
from app.db.session import get_db
from app.models import Cancellation, Category, Discount, FoodItem, FoodOption, Menu, Order, OrderItem, Payment
from app.schemas import HealthResponse, LiveSnapshot

router = APIRouter()


def _decimal(value: Any) -> Decimal:
    return Decimal(str(value or 0)).quantize(Decimal("0.01"))


def _money(value: Any) -> str:
    return f"₱{_decimal(value):,.2f}"


def _date_label(value: datetime | None) -> str:
    if not value:
        return "—"
    return value.astimezone(timezone.utc).strftime("%b %d, %Y · %I:%M %p")


def _uuid(value: Any) -> UUID:
    try:
        return UUID(str(value))
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Invalid record ID") from exc


def _metadata(order: Order) -> dict[str, Any]:
    return order.metadata_json if isinstance(order.metadata_json, dict) else {}


def _serialize_order(order: Order, items: list[OrderItem], payment: Payment | None) -> dict[str, Any]:
    metadata = _metadata(order)
    order_type = order.order_type
    item_rows = [
        {
            "id": str(item.food_item_id),
            "name": item.item_name_snapshot,
            "price": float(item.unit_price_snapshot),
            "quantity": item.quantity,
        }
        for item in items
    ]
    status_value = order.status
    return {
        "id": str(order.id),
        "orderNumber": f"#{order.order_number.lstrip('#')}",
        "customer": metadata.get("customer", "ARGO Customer"),
        "contact": metadata.get("contact", "—"),
        "type": order_type,
        "status": status_value,
        "kitchenStatus": order.kitchen_status,
        "paymentStatus": order.payment_status,
        "paymentMethod": payment.method if payment else metadata.get("paymentMethod", "Cash"),
        "subtotal": float(order.subtotal),
        "discount": float(order.discount_total),
        "serviceCharge": float(order.service_charge),
        "tax": float(order.tax),
        "deliveryFee": float(order.delivery_fee),
        "total": float(order.total),
        "items": item_rows,
        "itemCount": sum(item.quantity for item in items),
        "itemSummary": ", ".join(item.item_name_snapshot for item in items),
        "date": order.created_at.astimezone(timezone.utc).date().isoformat() if order.created_at else "",
        "createdAt": order.created_at.isoformat() if order.created_at else "",
        "time": order.created_at.astimezone(timezone.utc).strftime("%I:%M %p") if order.created_at else "—",
        "table": metadata.get("table"),
        "guests": metadata.get("guests"),
        "address": metadata.get("address"),
        "rider": metadata.get("rider"),
        "notes": metadata.get("notes", ""),
    }


def _snapshot(db: Session, organization_id: UUID) -> dict[str, Any]:
    categories = list(db.scalars(select(Category).where(Category.organization_id == organization_id).order_by(Category.name)).all())
    category_names = {category.id: category.name for category in categories}
    item_counts: dict[UUID, int] = {
        category_id: int(count)
        for category_id, count in db.execute(
            select(FoodItem.category_id, func.count(FoodItem.id))
            .where(FoodItem.organization_id == organization_id)
            .group_by(FoodItem.category_id)
        ).all()
    }
    menus = list(db.scalars(select(Menu).where(Menu.organization_id == organization_id).order_by(Menu.sort_order, Menu.name)).all())
    food_items = list(db.scalars(select(FoodItem).where(FoodItem.organization_id == organization_id).order_by(FoodItem.name)).all())
    options = list(db.scalars(select(FoodOption).where(FoodOption.organization_id == organization_id).order_by(FoodOption.name)).all())
    discounts = list(db.scalars(select(Discount).where(Discount.organization_id == organization_id).order_by(Discount.name)).all())
    orders = list(db.scalars(select(Order).where(Order.organization_id == organization_id).order_by(Order.created_at.desc())).all())
    order_ids = [order.id for order in orders]
    order_items = list(db.scalars(select(OrderItem).where(OrderItem.organization_id == organization_id, OrderItem.order_id.in_(order_ids))).all()) if order_ids else []
    payments = list(db.scalars(select(Payment).where(Payment.organization_id == organization_id).order_by(Payment.created_at.desc())).all())
    cancellations = list(db.scalars(select(Cancellation).where(Cancellation.organization_id == organization_id).order_by(Cancellation.id.desc())).all())
    items_by_order: dict[UUID, list[OrderItem]] = {}
    for item in order_items:
        items_by_order.setdefault(item.order_id, []).append(item)
    payments_by_order = {payment.order_id: payment for payment in payments}
    orders_by_id = {order.id: order for order in orders}

    serialized_orders = [_serialize_order(order, items_by_order.get(order.id, []), payments_by_order.get(order.id)) for order in orders]
    serialized_payments = [
        {
            "id": f"#{payment.id}",
            "order": f"#{orders_by_id[payment.order_id].order_number.lstrip('#')}" if payment.order_id in orders_by_id else "—",
            "orderId": str(payment.order_id),
            "customer": _metadata(orders_by_id[payment.order_id]).get("customer", "ARGO Customer") if payment.order_id in orders_by_id else "ARGO Customer",
            "method": payment.method,
            "amount": _money(payment.amount),
            "amountValue": float(payment.amount),
            "status": payment.status,
            "date": _date_label(payment.created_at),
        }
        for payment in payments
    ]
    serialized_cancellations = [
        {
            "id": f"#CO-{str(cancellation.id).split('-')[0].upper()}",
            "orderId": f"#{orders_by_id[cancellation.order_id].order_number.lstrip('#')}" if cancellation.order_id in orders_by_id else "—",
            "customer": _metadata(orders_by_id[cancellation.order_id]).get("customer", "ARGO Customer") if cancellation.order_id in orders_by_id else "ARGO Customer",
            "type": orders_by_id[cancellation.order_id].order_type if cancellation.order_id in orders_by_id else "—",
            "date": _date_label(orders_by_id[cancellation.order_id].created_at) if cancellation.order_id in orders_by_id else "—",
            "reason": cancellation.reason,
            "status": cancellation.status,
            "refund": _money(cancellation.refund_amount),
            "refundValue": float(cancellation.refund_amount),
        }
        for cancellation in cancellations
    ]

    return {
        "resources": {
            "menus": [{"id": str(row.id), "name": row.name, "description": row.description or "", "items": len(food_items), "status": row.status, "order": row.sort_order} for row in menus],
            "categories": [{"id": str(row.id), "name": row.name, "description": row.description or "", "items": int(item_counts.get(row.id, 0)), "status": row.status} for row in categories],
            "foodItems": [{"id": str(row.id), "name": row.name, "category": category_names.get(row.category_id, "Uncategorized"), "categoryId": str(row.category_id), "price": float(row.price), "status": row.status, "availability": row.availability, "rating": str((row.metadata_json or {}).get("rating", "4.7")), "description": row.description or ""} for row in food_items],
            "foodOptions": [{"id": str(row.id), "name": row.name, "description": row.description or "", "type": row.option_type, "choices": len(row.choices_json or []), "required": "Yes" if row.required else "No", "status": row.status, "items": row.items_using} for row in options],
            "discounts": [{"id": str(row.id), "code": row.code, "name": row.name, "type": row.discount_type, "value": _money(row.value), "minimum": _money(row.minimum_order), "usage": f"{row.usage_count} / {row.usage_limit or '∞'}", "validity": (row.rules or {}).get("validity", "Always active"), "status": row.status} for row in discounts],
            "payments": serialized_payments,
            "cancellations": serialized_cancellations,
        },
        "orders": serialized_orders,
    }


@router.get("/health", response_model=HealthResponse, tags=["system"])
def health() -> HealthResponse:
    return HealthResponse(status="ok", service="fms-marketplace-api")


@router.get("/context", tags=["system"])
def context(current: RequestContext = Depends(get_request_context)) -> dict[str, Any]:
    return {"organization_id": str(current.organization_id), "user_id": str(current.user_id), "roles": current.roles}


@router.get("/snapshot", response_model=LiveSnapshot, tags=["marketplace"])
def snapshot(db: Session = Depends(get_db), current: RequestContext = Depends(get_request_context)) -> dict[str, Any]:
    return _snapshot(db, current.organization_id)


@router.get("/menus", tags=["catalog"])
def list_menus(search: str | None = Query(default=None), db: Session = Depends(get_db), current: RequestContext = Depends(get_request_context)) -> list[dict[str, Any]]:
    rows = _snapshot(db, current.organization_id)["resources"]["menus"]
    return [row for row in rows if not search or search.lower() in f"{row['name']} {row['description']}".lower()]


@router.get("/food-items", tags=["catalog"])
def list_food_items(search: str | None = Query(default=None), db: Session = Depends(get_db), current: RequestContext = Depends(get_request_context)) -> list[dict[str, Any]]:
    rows = _snapshot(db, current.organization_id)["resources"]["foodItems"]
    return [row for row in rows if not search or search.lower() in f"{row['name']} {row['category']}".lower()]


@router.get("/orders", tags=["orders"])
def list_orders(status_filter: str | None = Query(default=None, alias="status"), order_type: str | None = Query(default=None), db: Session = Depends(get_db), current: RequestContext = Depends(get_request_context)) -> list[dict[str, Any]]:
    rows = _snapshot(db, current.organization_id)["orders"]
    return [row for row in rows if (not status_filter or row["status"] == status_filter) and (not order_type or row["type"] == order_type)]


@router.post("/resources/{resource}", tags=["resources"])
def create_resource(resource: str, payload: dict[str, Any], db: Session = Depends(get_db), current: RequestContext = Depends(require_roles("Administrator"))) -> dict[str, Any]:
    row: Any
    if resource == "menus":
        row = Menu(organization_id=current.organization_id, name=str(payload.get("name", "New Menu")), description=payload.get("description"), status=str(payload.get("status", "Active")), sort_order=int(payload.get("order", 0)))
        db.add(row)
    elif resource == "categories":
        row = Category(organization_id=current.organization_id, name=str(payload.get("name", "New Category")), description=payload.get("description"), status=str(payload.get("status", "Active")))
        db.add(row)
    elif resource == "foodItems":
        category = db.scalar(select(Category).where(Category.organization_id == current.organization_id, Category.name == str(payload.get("category", "Burgers"))))
        if not category:
            raise HTTPException(status_code=400, detail="Category not found")
        row = FoodItem(organization_id=current.organization_id, category_id=category.id, name=str(payload.get("name", "New Food Item")), description=payload.get("description"), price=_decimal(payload.get("price", 0)), status=str(payload.get("status", "Active")), availability=str(payload.get("availability", "In Stock")), metadata_json={"rating": str(payload.get("rating", "4.7"))})
        db.add(row)
    elif resource == "foodOptions":
        choice_count = max(0, int(payload.get("choices", 0) or 0))
        row = FoodOption(organization_id=current.organization_id, name=str(payload.get("name", "New Option")), description=payload.get("description"), option_type=str(payload.get("type", "Single Choice")), choices_json=[f"Choice {i + 1}" for i in range(choice_count)], required=str(payload.get("required", "No")) == "Yes", status=str(payload.get("status", "Active")), items_using=0)
        db.add(row)
    elif resource == "discounts":
        row = Discount(organization_id=current.organization_id, code=str(payload.get("code", "NEWCODE")).upper(), name=str(payload.get("name", "New Discount")), discount_type=str(payload.get("type", "Percentage")), value=_decimal(payload.get("value", 0)), minimum_order=_decimal(payload.get("minimum", 0)), status=str(payload.get("status", "Active")), rules={"validity": payload.get("validity", "Always active")})
        db.add(row)
    else:
        raise HTTPException(status_code=400, detail="This resource is read-only")
    db.commit()
    return {"ok": True}


@router.patch("/resources/{resource}/{record_id}", tags=["resources"])
def update_resource(resource: str, record_id: str, payload: dict[str, Any], db: Session = Depends(get_db), current: RequestContext = Depends(require_roles("Administrator"))) -> dict[str, Any]:
    row_id = _uuid(record_id)
    model_map: dict[str, Any] = {"menus": Menu, "categories": Category, "foodItems": FoodItem, "foodOptions": FoodOption, "discounts": Discount}
    model = model_map.get(resource)
    if not model:
        raise HTTPException(status_code=400, detail="This resource is read-only")
    row = db.scalar(select(model).where(model.id == row_id, model.organization_id == current.organization_id))
    if not row:
        raise HTTPException(status_code=404, detail="Record not found")
    allowed = {"name", "description", "status", "sort_order", "order", "price", "availability", "category", "code", "type", "value", "minimum", "required", "choices"}
    for key, value in payload.items():
        if key not in allowed:
            continue
        if resource == "menus" and key == "order":
            row.sort_order = int(value or 0)
        elif resource == "foodItems" and key == "category":
            category = db.scalar(select(Category).where(Category.organization_id == current.organization_id, Category.name == str(value)))
            if category:
                row.category_id = category.id
        elif resource == "foodItems" and key == "price":
            row.price = _decimal(value)
        elif resource == "discounts" and key == "minimum":
            row.minimum_order = _decimal(value)
        elif resource == "discounts" and key == "value":
            row.value = _decimal(value)
        elif resource == "foodOptions" and key == "choices":
            row.choices_json = [f"Choice {i + 1}" for i in range(max(0, int(value or 0)))]
        elif resource == "foodOptions" and key == "type":
            row.option_type = str(value)
        elif resource == "foodOptions" and key == "required":
            row.required = str(value) == "Yes"
        elif resource == "discounts" and key == "type":
            row.discount_type = str(value)
        elif hasattr(row, key):
            setattr(row, key, value)
    db.commit()
    return {"ok": True}


@router.delete("/resources/{resource}/{record_id}", tags=["resources"])
def delete_resource(resource: str, record_id: str, db: Session = Depends(get_db), current: RequestContext = Depends(require_roles("Administrator"))) -> dict[str, Any]:
    model_map: dict[str, Any] = {"menus": Menu, "categories": Category, "foodItems": FoodItem, "foodOptions": FoodOption, "discounts": Discount}
    model = model_map.get(resource)
    if not model:
        raise HTTPException(status_code=400, detail="This resource is read-only")
    row_id = _uuid(record_id)
    row = db.scalar(select(model).where(model.id == row_id, model.organization_id == current.organization_id))
    if not row:
        raise HTTPException(status_code=404, detail="Record not found")
    db.delete(row)
    db.commit()
    return {"ok": True}


@router.post("/orders", tags=["orders"])
def create_order(payload: dict[str, Any], db: Session = Depends(get_db), current: RequestContext = Depends(require_roles("Administrator", "Cashier"))) -> dict[str, Any]:
    food_item = db.scalar(select(FoodItem).where(FoodItem.organization_id == current.organization_id, FoodItem.status == "Active").order_by(FoodItem.name))
    if not food_item:
        raise HTTPException(status_code=400, detail="Create an active food item before creating an order")
    order_type = str(payload.get("type", "Dine-in"))
    metadata = {key: payload.get(key) for key in ("customer", "contact", "address", "rider", "table", "guests", "notes") if payload.get(key) is not None}
    metadata["paymentMethod"] = str(payload.get("paymentMethod", "Cash"))
    quantity = 1
    subtotal = _decimal(food_item.price * quantity)
    service_charge = _decimal(subtotal * Decimal("0.05")) if order_type == "Dine-in" else Decimal("0")
    delivery_fee = Decimal("49.00") if order_type == "Delivery" else Decimal("0")
    tax = _decimal(subtotal * Decimal("0.12"))
    total = subtotal + service_charge + delivery_fee + tax
    requested_status = str(payload.get("status", "Pending"))
    order = Order(organization_id=current.organization_id, order_number=f"{order_type[:2].upper()}-{uuid4().hex[:8].upper()}", order_type=order_type, status=requested_status, kitchen_status=requested_status, payment_status="Paid" if requested_status in {"Completed", "Delivered"} else "Pending", subtotal=subtotal, tax=tax, service_charge=service_charge, delivery_fee=delivery_fee, total=total, metadata_json=metadata)
    order.items.append(OrderItem(organization_id=current.organization_id, food_item_id=food_item.id, item_name_snapshot=food_item.name, unit_price_snapshot=food_item.price, quantity=quantity, line_total=food_item.price, options_json=[]))
    db.add(order)
    db.flush()
    db.add(Payment(organization_id=current.organization_id, order_id=order.id, method=metadata["paymentMethod"], amount=total, status=order.payment_status))
    db.commit()
    return {"ok": True, "id": str(order.id)}


@router.patch("/orders/{order_id}", tags=["orders"])
def update_order(order_id: str, payload: dict[str, Any], db: Session = Depends(get_db), current: RequestContext = Depends(require_roles("Administrator", "Cashier", "Kitchen Staff"))) -> dict[str, Any]:
    order = db.scalar(select(Order).where(Order.id == _uuid(order_id), Order.organization_id == current.organization_id))
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    metadata = _metadata(order)
    for key in ("customer", "contact", "address", "rider", "table", "guests", "notes"):
        if key in payload:
            metadata[key] = payload[key]
    if "paymentMethod" in payload:
        metadata["paymentMethod"] = payload["paymentMethod"]
        payment = db.scalar(select(Payment).where(Payment.order_id == order.id, Payment.organization_id == current.organization_id))
        if payment:
            payment.method = str(payload["paymentMethod"])
    if "type" in payload:
        order.order_type = str(payload["type"])
    if "status" in payload:
        order.status = str(payload["status"])
    if "kitchenStatus" in payload:
        order.kitchen_status = str(payload["kitchenStatus"])
    order.metadata_json = metadata
    db.commit()
    return {"ok": True}


@router.post("/orders/{order_id}/advance", tags=["orders"])
def advance_order(order_id: str, payload: dict[str, Any], db: Session = Depends(get_db), current: RequestContext = Depends(require_roles("Administrator", "Cashier", "Kitchen Staff"))) -> dict[str, Any]:
    order = db.scalar(select(Order).where(Order.id == _uuid(order_id), Order.organization_id == current.organization_id))
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    next_status = str(payload.get("status", "Preparing"))
    order.status = next_status
    order.kitchen_status = next_status
    if next_status in {"Completed", "Delivered"}:
        order.payment_status = "Paid"
    db.commit()
    return {"ok": True}


@router.post("/orders/{order_id}/cancel", tags=["orders"])
def cancel_order(order_id: str, payload: dict[str, Any] | None = None, db: Session = Depends(get_db), current: RequestContext = Depends(require_roles("Administrator", "Cashier"))) -> dict[str, Any]:
    order = db.scalar(select(Order).where(Order.id == _uuid(order_id), Order.organization_id == current.organization_id))
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    order.status = "Cancelled"
    order.kitchen_status = "Cancelled"
    order.payment_status = "Refunded"
    payment = db.scalar(select(Payment).where(Payment.order_id == order.id, Payment.organization_id == current.organization_id))
    if payment:
        payment.status = "Refunded"
    cancellation = db.scalar(select(Cancellation).where(Cancellation.order_id == order.id, Cancellation.organization_id == current.organization_id))
    if not cancellation:
        cancellation = Cancellation(organization_id=current.organization_id, order_id=order.id, reason=str((payload or {}).get("reason", "Changed my mind")), status="Refunded", refund_amount=order.total)
        db.add(cancellation)
    db.commit()
    return {"ok": True}


@router.post("/orders/{order_id}/duplicate", tags=["orders"])
def duplicate_order(order_id: str, db: Session = Depends(get_db), current: RequestContext = Depends(require_roles("Administrator", "Cashier"))) -> dict[str, Any]:
    source = db.scalar(select(Order).where(Order.id == _uuid(order_id), Order.organization_id == current.organization_id))
    if not source:
        raise HTTPException(status_code=404, detail="Order not found")
    clone = Order(organization_id=current.organization_id, order_number=f"ORD-{uuid4().hex[:8].upper()}", order_type=source.order_type, status="Pending", kitchen_status="Pending", payment_status="Pending", subtotal=source.subtotal, discount_total=source.discount_total, service_charge=source.service_charge, tax=source.tax, delivery_fee=source.delivery_fee, total=source.total, metadata_json=dict(_metadata(source)))
    clone.items = [OrderItem(organization_id=current.organization_id, food_item_id=item.food_item_id, item_name_snapshot=item.item_name_snapshot, unit_price_snapshot=item.unit_price_snapshot, quantity=item.quantity, line_total=item.line_total, options_json=item.options_json or []) for item in source.items]
    db.add(clone)
    db.flush()
    db.add(Payment(organization_id=current.organization_id, order_id=clone.id, method=str(_metadata(source).get("paymentMethod", "Cash")), amount=clone.total, status="Pending"))
    db.commit()
    return {"ok": True}
