from decimal import Decimal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import RequestContext, get_request_context, require_roles
from app.db.session import get_db
from app.models import Category, FoodItem, Menu, Order, OrderItem
from app.schemas import FoodItemCreate, FoodItemResponse, HealthResponse, MenuCreate, MenuResponse, OrderCreate, OrderResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse, tags=["system"])
def health() -> HealthResponse:
    return HealthResponse(status="ok", service="fms-marketplace-api")


@router.get("/context", tags=["system"])
def context(current: RequestContext = Depends(get_request_context)) -> dict:
    return {"organization_id": str(current.organization_id), "user_id": str(current.user_id), "roles": current.roles}


@router.get("/menus", response_model=list[MenuResponse], tags=["catalog"])
def list_menus(search: str | None = Query(default=None), db: Session = Depends(get_db), current: RequestContext = Depends(get_request_context)) -> list[Menu]:
    statement = select(Menu).where(Menu.organization_id == current.organization_id)
    if search:
        statement = statement.where(Menu.name.ilike(f"%{search}%"))
    return list(db.scalars(statement.order_by(Menu.sort_order, Menu.name)).all())


@router.post("/menus", response_model=MenuResponse, status_code=status.HTTP_201_CREATED, tags=["catalog"])
def create_menu(payload: MenuCreate, db: Session = Depends(get_db), current: RequestContext = Depends(require_roles("Administrator"))) -> Menu:
    menu = Menu(organization_id=current.organization_id, **payload.model_dump())
    db.add(menu)
    db.commit()
    db.refresh(menu)
    return menu


@router.get("/food-items", response_model=list[FoodItemResponse], tags=["catalog"])
def list_food_items(search: str | None = Query(default=None), category_id: UUID | None = Query(default=None), db: Session = Depends(get_db), current: RequestContext = Depends(get_request_context)) -> list[FoodItem]:
    statement = select(FoodItem).where(FoodItem.organization_id == current.organization_id)
    if search:
        statement = statement.where(FoodItem.name.ilike(f"%{search}%"))
    if category_id:
        statement = statement.where(FoodItem.category_id == category_id)
    return list(db.scalars(statement.order_by(FoodItem.name)).all())


@router.post("/food-items", response_model=FoodItemResponse, status_code=status.HTTP_201_CREATED, tags=["catalog"])
def create_food_item(payload: FoodItemCreate, db: Session = Depends(get_db), current: RequestContext = Depends(require_roles("Administrator"))) -> FoodItem:
    category = db.scalar(select(Category).where(Category.id == payload.category_id, Category.organization_id == current.organization_id))
    if not category:
        raise HTTPException(status_code=400, detail="Category does not belong to this organization")
    item = FoodItem(organization_id=current.organization_id, **payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get("/orders", response_model=list[OrderResponse], tags=["orders"])
def list_orders(status_filter: str | None = Query(default=None, alias="status"), order_type: str | None = Query(default=None), db: Session = Depends(get_db), current: RequestContext = Depends(get_request_context)) -> list[Order]:
    statement = select(Order).where(Order.organization_id == current.organization_id)
    if status_filter:
        statement = statement.where(Order.status == status_filter)
    if order_type:
        statement = statement.where(Order.order_type == order_type)
    return list(db.scalars(statement.order_by(Order.created_at.desc())).all())


@router.post("/orders", response_model=OrderResponse, status_code=status.HTTP_201_CREATED, tags=["orders"])
def create_order(payload: OrderCreate, db: Session = Depends(get_db), current: RequestContext = Depends(get_request_context)) -> Order:
    food_ids = [item.food_item_id for item in payload.items]
    food_items = list(db.scalars(select(FoodItem).where(FoodItem.id.in_(food_ids), FoodItem.organization_id == current.organization_id)).all())
    by_id = {item.id: item for item in food_items}
    if len(by_id) != len(set(food_ids)) or any(item.availability != "In Stock" or item.status != "Active" for item in by_id.values()):
        raise HTTPException(status_code=400, detail="One or more food items are unavailable")
    order = Order(organization_id=current.organization_id, order_number=f"ORD-{uuid4().hex[:8].upper()}", order_type=payload.order_type, metadata_json=payload.metadata)
    subtotal = Decimal("0")
    for requested in payload.items:
        item = by_id[requested.food_item_id]
        line_total = item.price * requested.quantity
        subtotal += line_total
        order.items.append(OrderItem(organization_id=current.organization_id, food_item_id=item.id, item_name_snapshot=item.name, unit_price_snapshot=item.price, quantity=requested.quantity, line_total=line_total, options_json=requested.options))
    order.subtotal = subtotal
    order.service_charge = (subtotal * Decimal("0.05")).quantize(Decimal("0.01")) if payload.order_type == "Dine-in" else Decimal("0")
    order.delivery_fee = Decimal("50.00") if payload.order_type == "Delivery" else Decimal("0")
    order.total = order.subtotal + order.service_charge + order.delivery_fee
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


@router.patch("/orders/{order_id}/status", response_model=OrderResponse, tags=["orders"])
def update_order_status(order_id: UUID, status_value: str = Query(alias="status"), db: Session = Depends(get_db), current: RequestContext = Depends(require_roles("Administrator", "Cashier", "Kitchen Staff"))) -> Order:
    order = db.scalar(select(Order).where(Order.id == order_id, Order.organization_id == current.organization_id))
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    order.status = status_value
    if "Kitchen Staff" in current.roles:
        order.kitchen_status = status_value
    db.commit()
    db.refresh(order)
    return order
