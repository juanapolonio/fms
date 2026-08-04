from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class APIModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class HealthResponse(BaseModel):
    status: str
    service: str


class MenuCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    description: str | None = None
    status: str = "Active"
    sort_order: int = 0


class MenuResponse(APIModel):
    id: UUID
    organization_id: UUID
    name: str
    description: str | None
    status: str
    sort_order: int


class FoodItemCreate(BaseModel):
    category_id: UUID
    name: str = Field(min_length=1, max_length=160)
    description: str | None = None
    price: Decimal = Field(ge=0)
    status: str = "Active"
    availability: str = "In Stock"


class FoodItemResponse(APIModel):
    id: UUID
    organization_id: UUID
    category_id: UUID
    name: str
    description: str | None
    price: Decimal
    status: str
    availability: str


class OrderItemCreate(BaseModel):
    food_item_id: UUID
    quantity: int = Field(gt=0)
    options: list[dict] = Field(default_factory=list)


class OrderCreate(BaseModel):
    order_type: str
    items: list[OrderItemCreate] = Field(min_length=1)
    discount_code: str | None = None
    metadata: dict = Field(default_factory=dict)


class OrderResponse(APIModel):
    id: UUID
    organization_id: UUID
    order_number: str
    order_type: str
    status: str
    kitchen_status: str
    payment_status: str
    subtotal: Decimal
    discount_total: Decimal
    service_charge: Decimal
    tax: Decimal
    delivery_fee: Decimal
    total: Decimal
