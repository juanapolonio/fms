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
from app.services.order_workflow import (
    ACTIVE_KITCHEN_STATUSES,
    TERMINAL_ORDER_STATUSES,
    advance_fulfillment,
    advance_kitchen,
    calculate_totals,
    ensure_mutable,
    validate_operational_fields,
    validate_order_type,
)

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


def _menu_item_count(value: Any) -> int:
    try:
        count = int(value or 0)
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=422, detail="Number of dishes must be a whole number") from exc
    if count < 0 or count > 9999:
        raise HTTPException(status_code=422, detail="Number of dishes must be between 0 and 9,999")
    return count


def _metadata(order: Order) -> dict[str, Any]:
    return order.metadata_json if isinstance(order.metadata_json, dict) else {}


def _serialize_order(order: Order, items: list[OrderItem], payment: Payment | None, cancellation: Cancellation | None = None) -> dict[str, Any]:
    metadata = dict(_metadata(order))
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
        "server": metadata.get("server", "ARGO Floor Team"),
        "type": order_type,
        "status": status_value,
        "kitchenStatus": order.kitchen_status,
        "paymentStatus": payment.status if payment else order.payment_status,
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
        "pickupTime": metadata.get("pickupTime"),
        "address": metadata.get("address"),
        "rider": metadata.get("rider"),
        "notes": metadata.get("notes", ""),
        "cancellationStatus": cancellation.status if cancellation else None,
        "cancellationReason": cancellation.reason if cancellation else None,
    }


def _snapshot(db: Session, organization_id: UUID) -> dict[str, Any]:
    resource_keys = ("menus", "categories", "foodItems", "foodOptions", "discounts", "payments", "cancellations")
    resources = {resource: _resource_rows(resource, db, organization_id) for resource in resource_keys}
    orders = list(db.scalars(select(Order).where(Order.organization_id == organization_id).order_by(Order.created_at.desc())).all())
    order_ids = [order.id for order in orders]
    items_by_order: dict[UUID, list[OrderItem]] = {}
    if order_ids:
        for item in db.scalars(select(OrderItem).where(OrderItem.organization_id == organization_id, OrderItem.order_id.in_(order_ids))).all():
            items_by_order.setdefault(item.order_id, []).append(item)
    payments_by_order = {
        payment.order_id: payment
        for payment in db.scalars(select(Payment).where(Payment.organization_id == organization_id, Payment.order_id.in_(order_ids))).all()
    } if order_ids else {}
    cancellations_by_order = {
        cancellation.order_id: cancellation
        for cancellation in db.scalars(select(Cancellation).where(Cancellation.organization_id == organization_id, Cancellation.order_id.in_(order_ids))).all()
    } if order_ids else {}
    return {
        "resources": resources,
        "orders": [_serialize_order(order, items_by_order.get(order.id, []), payments_by_order.get(order.id), cancellations_by_order.get(order.id)) for order in orders],
    }


def _page(rows: list[dict[str, Any]], page: int, page_size: int) -> dict[str, Any]:
    total = len(rows)
    first = (page - 1) * page_size
    return {
        "items": rows[first:first + page_size],
        "total": total,
        "page": page,
        "pageSize": page_size,
        "pageCount": max(1, (total + page_size - 1) // page_size),
    }


def _sort_resource_rows(rows: list[dict[str, Any]], resource: str, sort: str) -> list[dict[str, Any]]:
    """Apply resource sorting without overriding database-backed recent order."""
    if sort == "recent" and resource not in {"payments", "cancellations"}:
        rows.sort(key=lambda row: str(row.get("id", "")), reverse=True)
    return rows


def _resource_rows(resource: str, db: Session, organization_id: UUID) -> list[dict[str, Any]]:
    """Serialize one resource at a time instead of rebuilding the whole app snapshot."""
    if resource == "menus":
        menu_rows = db.scalars(select(Menu).where(Menu.organization_id == organization_id).order_by(Menu.sort_order, Menu.name)).all()
        return [{"id": str(row.id), "name": row.name, "description": row.description or "", "items": row.item_count, "status": row.status, "order": row.sort_order} for row in menu_rows]
    if resource == "categories":
        category_rows = db.scalars(select(Category).where(Category.organization_id == organization_id).order_by(Category.name)).all()
        counts = {category_id: int(count) for category_id, count in db.execute(select(FoodItem.category_id, func.count(FoodItem.id)).where(FoodItem.organization_id == organization_id).group_by(FoodItem.category_id)).all()}
        return [{"id": str(row.id), "name": row.name, "description": row.description or "", "items": counts.get(row.id, 0), "status": row.status} for row in category_rows]
    if resource == "foodItems":
        categories = {row.id: row.name for row in db.scalars(select(Category).where(Category.organization_id == organization_id)).all()}
        food_item_rows = db.scalars(select(FoodItem).where(FoodItem.organization_id == organization_id).order_by(FoodItem.name)).all()
        return [{"id": str(row.id), "name": row.name, "category": categories.get(row.category_id, "Uncategorized"), "categoryId": str(row.category_id), "price": float(row.price), "status": row.status, "availability": row.availability, "rating": str((row.metadata_json or {}).get("rating", "4.7")), "description": row.description or ""} for row in food_item_rows]
    if resource == "foodOptions":
        food_option_rows = db.scalars(select(FoodOption).where(FoodOption.organization_id == organization_id).order_by(FoodOption.name)).all()
        return [{"id": str(row.id), "name": row.name, "description": row.description or "", "type": row.option_type, "choices": len(row.choices_json or []), "required": "Yes" if row.required else "No", "status": row.status, "items": row.items_using} for row in food_option_rows]
    if resource == "discounts":
        discount_rows = db.scalars(select(Discount).where(Discount.organization_id == organization_id).order_by(Discount.name)).all()
        return [{"id": str(row.id), "code": row.code, "name": row.name, "type": row.discount_type, "value": _money(row.value), "minimum": _money(row.minimum_order), "usage": f"{row.usage_count} / {row.usage_limit or '∞'}", "validity": (row.rules or {}).get("validity", "Always active"), "status": row.status} for row in discount_rows]
    if resource in {"payments", "cancellations"}:
        orders = {row.id: row for row in db.scalars(select(Order).where(Order.organization_id == organization_id)).all()}
        if resource == "payments":
            payment_rows = db.scalars(select(Payment).where(Payment.organization_id == organization_id).order_by(Payment.created_at.desc())).all()
            return [{"id": str(row.id), "transaction": f"#PAY-{str(row.id).split('-')[0].upper()}", "order": f"#{orders[row.order_id].order_number.lstrip('#')}" if row.order_id in orders else "—", "orderId": str(row.order_id), "customer": _metadata(orders[row.order_id]).get("customer", "ARGO Customer") if row.order_id in orders else "ARGO Customer", "method": row.method, "amount": _money(row.amount), "amountValue": float(row.amount), "status": row.status, "date": _date_label(row.created_at)} for row in payment_rows]
        cancellation_rows = db.scalars(select(Cancellation).where(Cancellation.organization_id == organization_id).order_by(Cancellation.id.desc())).all()
        return [{"id": str(row.id), "cancellationNumber": f"#CO-{str(row.id).split('-')[0].upper()}", "orderId": f"#{orders[row.order_id].order_number.lstrip('#')}" if row.order_id in orders else "—", "orderSourceId": str(row.order_id), "customer": _metadata(orders[row.order_id]).get("customer", "ARGO Customer") if row.order_id in orders else "ARGO Customer", "type": orders[row.order_id].order_type if row.order_id in orders else "—", "date": _date_label(orders[row.order_id].created_at) if row.order_id in orders else "—", "reason": row.reason, "status": row.status, "refund": _money(row.refund_amount), "refundValue": float(row.refund_amount), "paymentStatus": orders[row.order_id].payment_status if row.order_id in orders else "—"} for row in cancellation_rows]
    raise HTTPException(status_code=404, detail="Unknown resource")


def _resource_metrics(resource: str, rows: list[dict[str, Any]], db: Session, organization_id: UUID) -> list[list[str]]:
    paid_sales = db.scalar(select(func.coalesce(func.sum(Order.total), 0)).where(Order.organization_id == organization_id, Order.payment_status.not_in(["Pending", "Refunded"]))) or Decimal("0")
    discount_total = db.scalar(select(func.coalesce(func.sum(Order.discount_total), 0)).where(Order.organization_id == organization_id)) or Decimal("0")
    item_quantity = db.scalar(select(func.coalesce(func.sum(OrderItem.quantity), 0)).where(OrderItem.organization_id == organization_id)) or 0
    active = sum(row.get("status") == "Active" for row in rows)
    inactive = sum(row.get("status") == "Inactive" for row in rows)
    if resource == "payments":
        def amounts(status: str) -> Decimal:
            return sum((Decimal(str(row.get("amountValue", 0))) for row in rows if row.get("status") == status), Decimal("0"))

        return [[_money(sum(Decimal(str(row.get("amountValue", 0))) for row in rows)), "Total Payments"], [_money(amounts("Paid")), "Paid Amount"], [_money(amounts("Pending")), "Pending"], [_money(amounts("Refunded")), "Refunded"], [str(len(rows)), "Transactions"]]
    if resource == "cancellations":
        refunds = sum(Decimal(str(row.get("refundValue", 0))) for row in rows)
        return [[str(len(rows)), "Total Cancellations"], [str(sum(row.get("status") == "Pending Review" for row in rows)), "Pending Review"], [str(sum(row.get("status") == "Approved" for row in rows)), "Approved"], [str(sum(row.get("status") == "Refunded" for row in rows)), "Refunded"], [_money(refunds), "Total Refunded"]]
    if resource == "discounts":
        return [[str(len(rows)), "Total Discounts"], [str(active), "Active Discounts"], [str(sum(row.get("status") == "Scheduled" for row in rows)), "Scheduled"], [str(inactive), "Inactive"], [_money(discount_total), "Discount Given"]]
    if resource == "foodItems":
        return [[str(len(rows)), "Total Items"], [str(active), "Active Items"], [str(inactive), "Inactive Items"], [_money(paid_sales), "Total Sales"], ["4.7", "Average Rating"]]
    if resource == "foodOptions":
        return [[str(len(rows)), "Total Options"], [str(active), "Active Options"], [str(inactive), "Inactive Options"], [str(sum(int(row.get("choices", 0)) for row in rows)), "Total Choices"], [_money(paid_sales * Decimal("0.12")), "Option Sales"]]
    if resource == "categories":
        return [[str(len(rows)), "Total Categories"], [str(active), "Active Categories"], [str(inactive), "Inactive Categories"], [str(item_quantity), "Items Sold"], [_money(paid_sales), "Category Sales"]]
    return [[str(len(rows)), "Total Menus"], [str(active), "Active Menus"], [str(inactive), "Inactive Menus"], [str(item_quantity), "Items Sold"], [_money(paid_sales), "Menu Sales"]]


def _order_metrics(orders: list[Order], mode: str) -> list[list[str]]:
    scoped = orders
    if mode == "table":
        scoped = [order for order in orders if order.order_type == "Dine-in"]
    elif mode in {"takeout", "pickup", "delivery"}:
        scoped = [order for order in orders if order.order_type == mode.title()]
    elif mode == "kitchen":
        scoped = [order for order in orders if order.kitchen_status in ACTIVE_KITCHEN_STATUSES]

    def count(status: str, *, kitchen: bool = False) -> int:
        return sum((order.kitchen_status if kitchen else order.status) == status for order in scoped)

    amount = sum(order.total for order in scoped)
    if mode == "table":
        occupied = {_metadata(order).get("table") for order in scoped if order.status not in TERMINAL_ORDER_STATUSES and _metadata(order).get("table")}
        return [[str(len(occupied)), "Occupied Tables"], [str(count("Preparing")), "Preparing"], [str(count("Ready")), "Ready to Serve"], [str(count("Completed")), "Completed"], [_money(amount), "Table Sales"]]
    if mode == "takeout":
        return [[str(len(scoped)), "Takeout Orders"], [str(count("Ready for Pickup")), "Ready for Pickup"], [str(count("Preparing")), "Preparing"], [str(count("Completed")), "Completed"], [_money(amount), "Takeout Sales"]]
    if mode == "pickup":
        return [[str(len(scoped)), "Pickup Orders"], [str(count("Pending")), "Pending"], [str(count("Ready for Pickup")), "Ready for Pickup"], [str(count("Completed")), "Completed"], [str(count("Cancelled")), "Cancelled"]]
    if mode == "delivery":
        return [[str(len(scoped)), "Delivery Orders"], [str(count("Pending")), "Pending"], [str(count("Out for Delivery")), "Out for Delivery"], [str(count("Delivered")), "Delivered"], [str(count("Cancelled")), "Cancelled"]]
    if mode == "kitchen":
        return [[str(len(scoped)), "Kitchen Queue"], [str(count("Pending", kitchen=True)), "Pending"], [str(count("Preparing", kitchen=True)), "Preparing"], [str(count("Ready", kitchen=True)), "Ready"], [str(sum(order.kitchen_status == "Completed" for order in orders)), "Completed"]]
    completed = sum(order.status in {"Completed", "Delivered"} for order in scoped)
    return [[str(len(scoped)), "Total Orders"], [str(count("Preparing")), "Preparing"], [str(count("Out for Delivery")), "Out for Delivery"], [str(completed), "Completed"], [str(count("Cancelled")), "Cancelled"]]
@router.get("/health", response_model=HealthResponse, tags=["system"])
def health() -> HealthResponse:
    return HealthResponse(status="ok", service="fms-marketplace-api")


@router.get("/context", tags=["system"])
def context(current: RequestContext = Depends(get_request_context)) -> dict[str, Any]:
    return {"organization_id": str(current.organization_id), "user_id": str(current.user_id), "roles": current.roles}


@router.get("/snapshot", response_model=LiveSnapshot, tags=["marketplace"])
def snapshot(db: Session = Depends(get_db), current: RequestContext = Depends(get_request_context)) -> dict[str, Any]:
    return _snapshot(db, current.organization_id)


@router.get("/resources/{resource}", tags=["resources"])
def list_resource(
    resource: str,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    search: str | None = Query(default=None),
    status: str | None = Query(default=None),
    available_only: bool = Query(default=False),
    sort: str = Query(default="name"),
    db: Session = Depends(get_db),
    current: RequestContext = Depends(get_request_context),
) -> dict[str, Any]:
    rows = _resource_rows(resource, db, current.organization_id)
    query = (search or "").lower().strip()
    if query:
        rows = [row for row in rows if query in " ".join(str(value) for value in row.values()).lower()]
    if status:
        rows = [row for row in rows if row.get("status") == status]
    if available_only:
        rows = [row for row in rows if row.get("status") == "Active" and row.get("availability", "In Stock") == "In Stock"]
    _sort_resource_rows(rows, resource, sort)
    return {**_page(rows, page, page_size), "metrics": _resource_metrics(resource, _resource_rows(resource, db, current.organization_id), db, current.organization_id)}


@router.get("/menus", tags=["catalog"])
def list_menus(search: str | None = Query(default=None), db: Session = Depends(get_db), current: RequestContext = Depends(get_request_context)) -> list[dict[str, Any]]:
    rows = _resource_rows("menus", db, current.organization_id)
    return [row for row in rows if not search or search.lower() in f"{row['name']} {row['description']}".lower()]


@router.get("/food-items", tags=["catalog"])
def list_food_items(search: str | None = Query(default=None), db: Session = Depends(get_db), current: RequestContext = Depends(get_request_context)) -> list[dict[str, Any]]:
    rows = _resource_rows("foodItems", db, current.organization_id)
    return [row for row in rows if not search or search.lower() in f"{row['name']} {row['category']}".lower()]


@router.get("/orders", tags=["orders"])
def list_orders(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=500),
    mode: str = Query(default="customer"),
    status_filter: str | None = Query(default=None, alias="status"),
    order_type: str | None = Query(default=None),
    search: str | None = Query(default=None),
    date: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current: RequestContext = Depends(get_request_context),
) -> dict[str, Any]:
    orders = list(db.scalars(select(Order).where(Order.organization_id == current.organization_id).order_by(Order.created_at.desc())).all())
    if mode == "table":
        orders = [order for order in orders if order.order_type == "Dine-in"]
    elif mode in {"takeout", "pickup", "delivery"}:
        orders = [order for order in orders if order.order_type == mode.title()]
    elif mode == "kitchen":
        orders = [order for order in orders if order.kitchen_status in ACTIVE_KITCHEN_STATUSES]
    metrics = _order_metrics(list(db.scalars(select(Order).where(Order.organization_id == current.organization_id)).all()), mode)
    if status_filter:
        orders = [order for order in orders if (order.kitchen_status if mode == "kitchen" else order.status) == status_filter]
    if date:
        orders = [order for order in orders if order.created_at and order.created_at.astimezone(timezone.utc).date().isoformat() == date]
    if search:
        needle = search.lower()
        orders = [order for order in orders if needle in f"{order.order_number} {_metadata(order).get('customer', '')} {_metadata(order).get('table', '')}".lower()]
    total = len(orders)
    paged_orders = orders[(page - 1) * page_size:page * page_size]
    ids = [order.id for order in paged_orders]
    items_by_order: dict[UUID, list[OrderItem]] = {}
    for item in db.scalars(select(OrderItem).where(OrderItem.organization_id == current.organization_id, OrderItem.order_id.in_(ids))).all() if ids else []:
        items_by_order.setdefault(item.order_id, []).append(item)
    payments = {row.order_id: row for row in db.scalars(select(Payment).where(Payment.organization_id == current.organization_id, Payment.order_id.in_(ids))).all()} if ids else {}
    cancellations = {row.order_id: row for row in db.scalars(select(Cancellation).where(Cancellation.organization_id == current.organization_id, Cancellation.order_id.in_(ids))).all()} if ids else {}
    rows = [_serialize_order(order, items_by_order.get(order.id, []), payments.get(order.id), cancellations.get(order.id)) for order in paged_orders]
    return {
        "items": rows,
        "total": total,
        "page": page,
        "pageSize": page_size,
        "pageCount": max(1, (total + page_size - 1) // page_size),
        "metrics": metrics,
    }


@router.get("/reports", tags=["reports"])
def report_orders(db: Session = Depends(get_db), current: RequestContext = Depends(get_request_context)) -> dict[str, Any]:
    """Reports are loaded only on demand; operational screens never pay for this payload."""
    orders = list(db.scalars(select(Order).where(Order.organization_id == current.organization_id).order_by(Order.created_at.desc())).all())
    ids = [order.id for order in orders]
    items_by_order: dict[UUID, list[OrderItem]] = {}
    for item in db.scalars(select(OrderItem).where(OrderItem.organization_id == current.organization_id, OrderItem.order_id.in_(ids))).all() if ids else []:
        items_by_order.setdefault(item.order_id, []).append(item)
    payments = {row.order_id: row for row in db.scalars(select(Payment).where(Payment.organization_id == current.organization_id, Payment.order_id.in_(ids))).all()} if ids else {}
    cancellations = {row.order_id: row for row in db.scalars(select(Cancellation).where(Cancellation.organization_id == current.organization_id, Cancellation.order_id.in_(ids))).all()} if ids else {}
    return {"orders": [_serialize_order(order, items_by_order.get(order.id, []), payments.get(order.id), cancellations.get(order.id)) for order in orders]}


@router.post("/resources/{resource}", tags=["resources"])
def create_resource(resource: str, payload: dict[str, Any], db: Session = Depends(get_db), current: RequestContext = Depends(require_roles("Administrator"))) -> dict[str, Any]:
    row: Any
    if resource == "menus":
        row = Menu(organization_id=current.organization_id, name=str(payload.get("name", "New Menu")), description=payload.get("description"), status=str(payload.get("status", "Active")), sort_order=int(payload.get("order", 0)), item_count=_menu_item_count(payload.get("items", 0)))
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
    allowed = {"name", "description", "status", "sort_order", "order", "items", "price", "availability", "category", "code", "type", "value", "minimum", "required", "choices"}
    for key, value in payload.items():
        if key not in allowed:
            continue
        if resource == "menus" and key == "order":
            row.sort_order = int(value or 0)
        elif resource == "menus" and key == "items":
            row.item_count = _menu_item_count(value)
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
    requested_items = payload.get("items")
    if not isinstance(requested_items, list) or not requested_items:
        raise HTTPException(status_code=422, detail="Add at least one available dish to the order")
    merged_items: dict[UUID, int] = {}
    for item in requested_items:
        if not isinstance(item, dict):
            raise HTTPException(status_code=422, detail="Order items must include a dish and quantity")
        food_item_id = _uuid(item.get("foodItemId") or item.get("food_item_id"))
        quantity = int(item.get("quantity", 0) or 0)
        if quantity < 1 or quantity > 99:
            raise HTTPException(status_code=422, detail="Each dish quantity must be between 1 and 99")
        merged_items[food_item_id] = merged_items.get(food_item_id, 0) + quantity
    food_items = {row.id: row for row in db.scalars(select(FoodItem).where(FoodItem.organization_id == current.organization_id, FoodItem.id.in_(merged_items))).all()}
    if len(food_items) != len(merged_items):
        raise HTTPException(status_code=422, detail="One or more selected dishes no longer exist")
    unavailable = [row.name for row in food_items.values() if row.status != "Active" or row.availability != "In Stock"]
    if unavailable:
        raise HTTPException(status_code=422, detail=f"Unavailable dish: {unavailable[0]}")
    order_type = validate_order_type(payload.get("type", "Dine-in"))
    metadata = {key: payload.get(key) for key in ("customer", "contact", "address", "rider", "table", "guests", "pickupTime", "server", "notes") if payload.get(key) is not None}
    metadata["paymentMethod"] = str(payload.get("paymentMethod", "Cash"))
    validate_operational_fields(order_type, metadata)
    subtotal = sum((_decimal(food_items[food_item_id].price * quantity) for food_item_id, quantity in merged_items.items()), Decimal("0"))
    service_charge, delivery_fee, tax, total = calculate_totals(order_type, subtotal)
    order = Order(organization_id=current.organization_id, order_number=f"{order_type[:2].upper()}-{uuid4().hex[:8].upper()}", order_type=order_type, status="Pending", kitchen_status="Pending", payment_status="Pending", subtotal=subtotal, tax=tax, service_charge=service_charge, delivery_fee=delivery_fee, total=total, metadata_json=metadata)
    for food_item_id, quantity in merged_items.items():
        food_item = food_items[food_item_id]
        order.items.append(OrderItem(organization_id=current.organization_id, food_item_id=food_item.id, item_name_snapshot=food_item.name, unit_price_snapshot=food_item.price, quantity=quantity, line_total=_decimal(food_item.price * quantity), options_json=[]))
    db.add(order)
    try:
        db.flush()
        db.add(Payment(organization_id=current.organization_id, order_id=order.id, method=metadata["paymentMethod"], amount=total, status=order.payment_status))
        db.commit()
    except Exception:
        db.rollback()
        raise
    return {"ok": True, "id": str(order.id)}


@router.patch("/orders/{order_id}", tags=["orders"])
def update_order(order_id: str, payload: dict[str, Any], db: Session = Depends(get_db), current: RequestContext = Depends(require_roles("Administrator", "Cashier", "Kitchen Staff"))) -> dict[str, Any]:
    order = db.scalar(select(Order).where(Order.id == _uuid(order_id), Order.organization_id == current.organization_id))
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    ensure_mutable(order)
    if db.scalar(select(Cancellation).where(Cancellation.order_id == order.id, Cancellation.organization_id == current.organization_id, Cancellation.status == "Pending Review")):
        raise HTTPException(status_code=409, detail="Resolve the pending cancellation before editing this order")
    metadata = dict(_metadata(order))
    for key in ("customer", "contact", "address", "rider", "table", "guests", "pickupTime", "server", "notes"):
        if key in payload:
            metadata[key] = payload[key]
    if "paymentMethod" in payload:
        metadata["paymentMethod"] = payload["paymentMethod"]
        payment = db.scalar(select(Payment).where(Payment.order_id == order.id, Payment.organization_id == current.organization_id))
        if payment:
            payment.method = str(payload["paymentMethod"])
    if "type" in payload:
        requested_type = validate_order_type(payload["type"])
        if requested_type != order.order_type and (order.status != "Pending" or order.kitchen_status != "Pending"):
            raise HTTPException(status_code=409, detail="Order type can only change before kitchen preparation starts")
        order.order_type = requested_type
    if "status" in payload or "kitchenStatus" in payload:
        raise HTTPException(status_code=422, detail="Use the workflow actions to change order status")
    validate_operational_fields(order.order_type, metadata)
    service_charge, delivery_fee, tax, total = calculate_totals(order.order_type, order.subtotal, order.discount_total)
    order.service_charge = service_charge
    order.delivery_fee = delivery_fee
    order.tax = tax
    order.total = total
    payment = db.scalar(select(Payment).where(Payment.order_id == order.id, Payment.organization_id == current.organization_id))
    if payment:
        payment.amount = total
    order.metadata_json = metadata
    db.commit()
    return {"ok": True}


@router.post("/orders/{order_id}/advance", tags=["orders"])
def advance_order(order_id: str, payload: dict[str, Any], db: Session = Depends(get_db), current: RequestContext = Depends(require_roles("Administrator", "Cashier", "Kitchen Staff"))) -> dict[str, Any]:
    order = db.scalar(select(Order).where(Order.id == _uuid(order_id), Order.organization_id == current.organization_id))
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if db.scalar(select(Cancellation).where(Cancellation.order_id == order.id, Cancellation.organization_id == current.organization_id, Cancellation.status == "Pending Review")):
        raise HTTPException(status_code=409, detail="Resolve the pending cancellation before advancing this order")
    event = str(payload.get("event", ""))
    next_status = advance_kitchen(order) if event == "advance_kitchen" else advance_fulfillment(order) if event == "advance_fulfillment" else None
    if not next_status:
        raise HTTPException(status_code=422, detail="Unknown order workflow event")
    if order.status in {"Completed", "Delivered"}:
        order.payment_status = "Paid"
        payment = db.scalar(select(Payment).where(Payment.order_id == order.id, Payment.organization_id == current.organization_id))
        if payment:
            payment.status = "Paid"
    db.commit()
    return {"ok": True, "status": order.status, "kitchenStatus": order.kitchen_status, "paymentStatus": order.payment_status}


@router.post("/orders/{order_id}/cancel", tags=["orders"])
def cancel_order(order_id: str, payload: dict[str, Any] | None = None, db: Session = Depends(get_db), current: RequestContext = Depends(require_roles("Administrator", "Cashier"))) -> dict[str, Any]:
    order = db.scalar(select(Order).where(Order.id == _uuid(order_id), Order.organization_id == current.organization_id))
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status in TERMINAL_ORDER_STATUSES:
        raise HTTPException(status_code=409, detail=f"{order.status} orders cannot request cancellation")
    cancellation = db.scalar(select(Cancellation).where(Cancellation.order_id == order.id, Cancellation.organization_id == current.organization_id))
    if cancellation and cancellation.status == "Pending Review":
        raise HTTPException(status_code=409, detail="This order already has a pending cancellation")
    reason = str((payload or {}).get("reason", "")).strip()
    if len(reason) < 3:
        raise HTTPException(status_code=422, detail="Provide a cancellation reason")
    if cancellation:
        cancellation.reason = reason
        cancellation.status = "Pending Review"
        cancellation.refund_amount = Decimal("0")
    else:
        db.add(Cancellation(organization_id=current.organization_id, order_id=order.id, reason=reason, status="Pending Review", refund_amount=Decimal("0")))
    db.commit()
    return {"ok": True, "status": "Pending Review"}


@router.post("/orders/{order_id}/duplicate", tags=["orders"])
def duplicate_order(order_id: str, db: Session = Depends(get_db), current: RequestContext = Depends(require_roles("Administrator", "Cashier"))) -> dict[str, Any]:
    source = db.scalar(select(Order).where(Order.id == _uuid(order_id), Order.organization_id == current.organization_id))
    if not source:
        raise HTTPException(status_code=404, detail="Order not found")
    if source.order_type in {"Dine-in", "Pickup"}:
        raise HTTPException(status_code=409, detail="Create a new order so table or pickup scheduling can be assigned safely")
    metadata = dict(_metadata(source))
    metadata.pop("rider", None)
    clone = Order(organization_id=current.organization_id, order_number=f"{source.order_type[:2].upper()}-{uuid4().hex[:8].upper()}", order_type=source.order_type, status="Pending", kitchen_status="Pending", payment_status="Pending", subtotal=source.subtotal, discount_total=source.discount_total, service_charge=source.service_charge, tax=source.tax, delivery_fee=source.delivery_fee, total=source.total, metadata_json=metadata)
    clone.items = [OrderItem(organization_id=current.organization_id, food_item_id=item.food_item_id, item_name_snapshot=item.item_name_snapshot, unit_price_snapshot=item.unit_price_snapshot, quantity=item.quantity, line_total=item.line_total, options_json=item.options_json or []) for item in source.items]
    db.add(clone)
    db.flush()
    db.add(Payment(organization_id=current.organization_id, order_id=clone.id, method=str(_metadata(source).get("paymentMethod", "Cash")), amount=clone.total, status="Pending"))
    db.commit()
    return {"ok": True}


@router.post("/payments/{payment_id}/status", tags=["payments"])
def update_payment_status(payment_id: str, payload: dict[str, Any], db: Session = Depends(get_db), current: RequestContext = Depends(require_roles("Administrator", "Cashier"))) -> dict[str, Any]:
    payment = db.scalar(select(Payment).where(Payment.id == _uuid(payment_id), Payment.organization_id == current.organization_id))
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    status = str(payload.get("status", ""))
    if status not in {"Paid", "Failed"}:
        raise HTTPException(status_code=422, detail="Payment status must be Paid or Failed")
    if payment.status in {"Refunded", "Voided"}:
        raise HTTPException(status_code=409, detail=f"{payment.status} payments cannot be changed")
    order = db.scalar(select(Order).where(Order.id == payment.order_id, Order.organization_id == current.organization_id))
    payment.status = status
    if order:
        order.payment_status = status
    db.commit()
    return {"ok": True, "status": status}


@router.post("/cancellations/{cancellation_id}/resolve", tags=["cancellations"])
def resolve_cancellation(cancellation_id: str, payload: dict[str, Any], db: Session = Depends(get_db), current: RequestContext = Depends(require_roles("Administrator"))) -> dict[str, Any]:
    cancellation = db.scalar(select(Cancellation).where(Cancellation.id == _uuid(cancellation_id), Cancellation.organization_id == current.organization_id))
    if not cancellation:
        raise HTTPException(status_code=404, detail="Cancellation not found")
    if cancellation.status != "Pending Review":
        raise HTTPException(status_code=409, detail="This cancellation has already been resolved")
    decision = str(payload.get("decision", ""))
    if decision not in {"approve", "reject"}:
        raise HTTPException(status_code=422, detail="Decision must be approve or reject")
    if decision == "reject":
        cancellation.status = "Rejected"
        cancellation.notes = str(payload.get("notes", "Cancellation request rejected"))
        db.commit()
        return {"ok": True, "status": "Rejected"}
    order = db.scalar(select(Order).where(Order.id == cancellation.order_id, Order.organization_id == current.organization_id))
    if not order:
        raise HTTPException(status_code=404, detail="Linked order not found")
    payment = db.scalar(select(Payment).where(Payment.order_id == order.id, Payment.organization_id == current.organization_id))
    was_paid = bool(payment and payment.status == "Paid")
    cancellation.status = "Refunded" if was_paid else "Approved"
    cancellation.refund_amount = order.total if was_paid else Decimal("0")
    cancellation.notes = str(payload.get("notes", "Approved by ARGO administrator"))
    order.status = "Cancelled"
    order.kitchen_status = "Cancelled"
    order.payment_status = "Refunded" if was_paid else "Voided"
    if payment:
        payment.status = order.payment_status
    db.commit()
    return {"ok": True, "status": cancellation.status, "paymentStatus": order.payment_status}
