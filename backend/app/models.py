import uuid
from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Status(StrEnum):
    ACTIVE = "Active"
    INACTIVE = "Inactive"


class OrderStatus(StrEnum):
    PENDING = "Pending"
    PREPARING = "Preparing"
    READY = "Ready"
    READY_FOR_PICKUP = "Ready for Pickup"
    OUT_FOR_DELIVERY = "Out for Delivery"
    DELIVERED = "Delivered"
    COMPLETED = "Completed"
    CANCELLED = "Cancelled"


class Menu(Base):
    __tablename__ = "menus"
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    image_url: Mapped[str | None] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(30), default=Status.ACTIVE, nullable=False)
    sort_order: Mapped[int] = mapped_column(default=0, nullable=False)
    item_count: Mapped[int] = mapped_column(default=0, server_default="0", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Category(Base):
    __tablename__ = "categories"
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    image_url: Mapped[str | None] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(30), default=Status.ACTIVE, nullable=False)


class FoodItem(Base):
    __tablename__ = "food_items"
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), index=True, nullable=False)
    category_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("categories.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    status: Mapped[str] = mapped_column(String(30), default=Status.ACTIVE, nullable=False)
    availability: Mapped[str] = mapped_column(String(30), default="In Stock", nullable=False)
    metadata_json: Mapped[dict] = mapped_column("metadata", JSONB, default=dict, nullable=False)


class FoodOption(Base):
    __tablename__ = "food_options"
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    option_type: Mapped[str] = mapped_column(String(30), nullable=False)
    choices_json: Mapped[list] = mapped_column("choices", JSONB, default=list, nullable=False)
    required: Mapped[bool] = mapped_column(default=False, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default=Status.ACTIVE, nullable=False)
    items_using: Mapped[int] = mapped_column(default=0, nullable=False)


class Order(Base):
    __tablename__ = "orders"
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), index=True, nullable=False)
    customer_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), nullable=True)
    order_number: Mapped[str] = mapped_column(String(40), unique=True, nullable=False)
    order_type: Mapped[str] = mapped_column(String(30), nullable=False)
    status: Mapped[str] = mapped_column(String(40), default=OrderStatus.PENDING, nullable=False)
    kitchen_status: Mapped[str] = mapped_column(String(40), default=OrderStatus.PENDING, nullable=False)
    payment_status: Mapped[str] = mapped_column(String(30), default="Pending", nullable=False)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    discount_total: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    service_charge: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    tax: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    delivery_fee: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    total: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    metadata_json: Mapped[dict] = mapped_column("metadata", JSONB, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    items: Mapped[list["OrderItem"]] = relationship(back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), index=True, nullable=False)
    order_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("orders.id"), nullable=False)
    food_item_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("food_items.id"), nullable=False)
    item_name_snapshot: Mapped[str] = mapped_column(String(160), nullable=False)
    unit_price_snapshot: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    quantity: Mapped[int] = mapped_column(nullable=False)
    line_total: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    options_json: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    order: Mapped[Order] = relationship(back_populates="items")


class Payment(Base):
    __tablename__ = "payments"
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), index=True, nullable=False)
    order_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("orders.id"), nullable=False)
    method: Mapped[str] = mapped_column(String(40), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="Pending", nullable=False)
    provider_reference: Mapped[str | None] = mapped_column(String(160), unique=True)
    provider_payload: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Discount(Base):
    __tablename__ = "discounts"
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), index=True, nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    discount_type: Mapped[str] = mapped_column(String(30), nullable=False)
    value: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    minimum_order: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    usage_limit: Mapped[int | None] = mapped_column(nullable=True)
    usage_count: Mapped[int] = mapped_column(default=0, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default=Status.ACTIVE, nullable=False)
    rules: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)


class Cancellation(Base):
    __tablename__ = "cancellations"
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), index=True, nullable=False)
    order_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("orders.id"), nullable=False)
    reason: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="Pending Review", nullable=False)
    refund_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
