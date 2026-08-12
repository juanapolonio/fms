"""Idempotently add realistic starter records to the configured ARGO organization."""

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.models import Cancellation, Category, Discount, FoodItem, FoodOption, Menu, Order, OrderItem, Payment

ORG_ID = UUID(get_settings().argo_dev_organization_id)

CATEGORIES = [
    ("Burgers", "Handcrafted burgers with premium ingredients."),
    ("Pizzas", "Stone-baked pizzas prepared to order."),
    ("Chicken", "Crispy chicken meals and sharing plates."),
    ("Snacks", "Quick bites and sides for any occasion."),
    ("Drinks", "Refreshing cold drinks, coffee, and tea."),
    ("Desserts", "Sweet finishes for every meal."),
]
ITEMS = [
    ("Cheese Burger", "Burgers", 250, "Juicy grilled beef patty with cheese and house sauce.", "4.8"),
    ("Pepperoni Pizza", "Pizzas", 380, "Stone-baked pizza with pepperoni and mozzarella.", "4.7"),
    ("Fried Chicken", "Chicken", 220, "Crispy chicken served with house gravy.", "4.6"),
    ("French Fries", "Snacks", 90, "Seasoned golden fries with a crunchy finish.", "4.5"),
    ("Milk Tea", "Drinks", 120, "Creamy black tea with brown sugar pearls.", "4.6"),
    ("Carbonara Pasta", "Pasta", 320, "Creamy carbonara with bacon and parmesan.", "4.7"),
    ("Caesar Salad", "Snacks", 180, "Crisp romaine with parmesan and Caesar dressing.", "4.4"),
    ("Chocolate Cake", "Desserts", 150, "Rich chocolate cake with dark ganache.", "4.3"),
    ("Iced Coffee", "Drinks", 110, "Cold brew coffee with fresh milk.", "4.5"),
    ("Garlic Bread", "Snacks", 80, "Toasted bread with roasted garlic butter.", "4.2"),
]
CUSTOMERS = [
    ("Juan Dela Cruz", "0917 123 4567"), ("Maria Santos", "0928 765 4321"),
    ("Anne Garcia", "0905 345 6789"), ("Mark Villanueva", "0906 555 6789"),
    ("Ricky Tan", "0999 888 7777"), ("Liza Reyes", "0945 111 2222"),
    ("Carlo Mendoza", "0916 222 3333"), ("Paula Lim", "0922 444 5555"),
    ("James Reyes", "0908 111 2222"), ("Bea Lim", "0932 111 2222"),
]
METHODS = ["Cash", "GCash", "Card", "PayMaya"]
ADDRESSES = ["123 Rizal St., Makati City", "456 Bonifacio Ave., Taguig City", "789 Tomas Morato St., Quezon City"]


def seed() -> None:
    with SessionLocal() as db:
        if db.scalar(select(Menu.id).where(Menu.organization_id == ORG_ID).limit(1)):
            print("ARGO organization already has data; seed skipped.")
            return

        categories: dict[str, Category] = {}
        for name, description in CATEGORIES:
            category = Category(organization_id=ORG_ID, name=name, description=description, status="Active")
            db.add(category)
            categories[name] = category
        db.flush()

        foods: list[FoodItem] = []
        for name, category_name, price, description, rating in ITEMS:
            category = categories.get(category_name) or categories["Snacks"]
            food = FoodItem(organization_id=ORG_ID, category_id=category.id, name=name, description=description, price=Decimal(str(price)), status="Inactive" if name == "Chocolate Cake" else "Active", availability="Out of Stock" if name == "Chocolate Cake" else "In Stock", metadata_json={"rating": rating})
            db.add(food)
            foods.append(food)

        menus = [
            ("Main Menu", "Our core ARGO Marketplace menu", 1),
            ("Breakfast Menu", "Breakfast favorites and morning drinks", 2),
            ("Pizza Menu", "All stone-baked pizza selections", 3),
            ("Beverage Menu", "Refreshing drinks and coffee", 4),
            ("Dessert Menu", "Sweet treats to finish your meal", 5),
            ("Value Meals", "Best-value combinations", 6),
        ]
        for name, description, sort_order in menus:
            db.add(Menu(organization_id=ORG_ID, name=name, description=description, sort_order=sort_order, status="Inactive" if name == "Value Meals" else "Active"))

        options = [
            ("Extra Cheese", "Add cheese to your item", "Single Choice", ["Regular Cheese", "Extra Cheese"], False, 24),
            ("Size", "Choose the size of your item", "Single Choice", ["Small", "Medium", "Large"], True, 38),
            ("Crust Type", "Select your preferred crust", "Single Choice", ["Original", "Thin", "Stuffed"], True, 12),
            ("Add Toppings", "Add more toppings to your item", "Multiple Choice", ["Mushroom", "Onion", "Bacon", "Olives", "Corn", "Jalapeño", "Tomato", "Extra Cheese"], False, 28),
            ("Sauce", "Choose your sauce", "Single Choice", ["Classic", "Spicy", "Garlic", "BBQ"], True, 18),
        ]
        for name, description, option_type, choices, required, items_using in options:
            db.add(FoodOption(organization_id=ORG_ID, name=name, description=description, option_type=option_type, choices_json=choices, required=required, status="Active", items_using=items_using))

        discounts = [
            ("WELCOME10", "Welcome 10% Off", "Percentage", Decimal("10"), Decimal("300"), 120, 200, "Aug 1 – Aug 31, 2026"),
            ("SAVE20", "Save 20%", "Percentage", Decimal("20"), Decimal("500"), 85, 150, "Aug 1 – Aug 15, 2026"),
            ("FREESHIP", "Free Delivery", "Free Shipping", Decimal("0"), Decimal("400"), 210, 300, "Aug 1 – Aug 31, 2026"),
            ("SUMMER15", "Summer Special", "Percentage", Decimal("15"), Decimal("400"), 45, 100, "Aug 15 – Sep 15, 2026"),
        ]
        for code, name, discount_type, value, minimum, usage_count, usage_limit, validity in discounts:
            db.add(Discount(organization_id=ORG_ID, code=code, name=name, discount_type=discount_type, value=value, minimum_order=minimum, usage_count=usage_count, usage_limit=usage_limit, status="Scheduled" if code == "SUMMER15" else "Active", rules={"validity": validity}))
        db.flush()

        now = datetime.now(timezone.utc).replace(microsecond=0)
        statuses = {
            "Dine-in": ["Preparing", "Ready", "Completed", "Completed", "Cancelled"],
            "Takeout": ["Preparing", "Ready for Pickup", "Completed", "Completed", "Cancelled"],
            "Pickup": ["Pending", "Preparing", "Ready for Pickup", "Completed", "Cancelled"],
            "Delivery": ["Pending", "Preparing", "Ready for Dispatch", "Out for Delivery", "Delivered", "Cancelled"],
        }
        order_types = list(statuses)
        for index in range(72):
            order_type = order_types[index % len(order_types)]
            order_status = statuses[order_type][index % len(statuses[order_type])]
            first = foods[index % len(foods)]
            second = foods[(index * 3 + 1) % len(foods)]
            quantity = 2 if index % 3 == 0 else 1
            subtotal = Decimal(first.price) * quantity
            if index % 2 == 0 and second.id != first.id:
                subtotal += Decimal(second.price)
            discount = min(Decimal("100"), (subtotal * Decimal("0.10")).quantize(Decimal("0.01"))) if index % 9 == 0 else Decimal("0")
            service_charge = ((subtotal - discount) * Decimal("0.05")).quantize(Decimal("0.01")) if order_type == "Dine-in" else Decimal("0")
            tax = ((subtotal - discount) * Decimal("0.12")).quantize(Decimal("0.01"))
            delivery_fee = Decimal("49") if order_type == "Delivery" else Decimal("0")
            total = subtotal - discount + service_charge + tax + delivery_fee
            customer, contact = CUSTOMERS[index % len(CUSTOMERS)]
            created_at = now - timedelta(days=index // 3, hours=index % 12)
            payment_status = "Refunded" if order_status == "Cancelled" else "Paid" if order_status in {"Completed", "Delivered"} else "Pending" if index % 7 == 0 else "Paid"
            metadata = {"customer": customer, "contact": contact, "paymentMethod": METHODS[index % len(METHODS)], "table": f"Table {1 + index % 12}" if order_type == "Dine-in" else None, "guests": 2 + index % 5 if order_type == "Dine-in" else None, "server": "ARGO Floor Team" if order_type == "Dine-in" else None, "pickupTime": created_at.strftime("%H:%M") if order_type == "Pickup" else None, "address": ADDRESSES[index % len(ADDRESSES)] if order_type == "Delivery" else None, "rider": ["Miguel Santos", "Carlo Reyes", "No rider assigned"][index % 3] if order_type == "Delivery" else None, "notes": "Please include extra ketchup and napkins." if index % 6 == 0 else ""}
            kitchen_status = "Completed" if order_status in {"Completed", "Delivered", "Out for Delivery"} else "Ready" if order_status in {"Ready", "Ready for Pickup", "Ready for Dispatch"} else order_status
            order = Order(organization_id=ORG_ID, order_number=f"{order_type[:2].upper()}-{140 + index:05d}", order_type=order_type, status=order_status, kitchen_status=kitchen_status, payment_status=payment_status, subtotal=subtotal, discount_total=discount, service_charge=service_charge, tax=tax, delivery_fee=delivery_fee, total=total, metadata_json=metadata, created_at=created_at)
            db.add(order)
            db.flush()
            db.add(OrderItem(organization_id=ORG_ID, order_id=order.id, food_item_id=first.id, item_name_snapshot=first.name, unit_price_snapshot=first.price, quantity=quantity, line_total=Decimal(first.price) * quantity, options_json=[]))
            if index % 2 == 0 and second.id != first.id:
                db.add(OrderItem(organization_id=ORG_ID, order_id=order.id, food_item_id=second.id, item_name_snapshot=second.name, unit_price_snapshot=second.price, quantity=1, line_total=second.price, options_json=[]))
            db.add(Payment(organization_id=ORG_ID, order_id=order.id, method=metadata["paymentMethod"], amount=total, status=payment_status, created_at=created_at))
            if order_status == "Cancelled":
                db.add(Cancellation(organization_id=ORG_ID, order_id=order.id, reason=["Changed my mind", "Delivery taking too long", "Order placed by mistake", "Address changed"][index % 4], status="Refunded", refund_amount=total))
        db.commit()
        print("Seeded ARGO marketplace data: 6 menus, 6 categories, 10 food items, 5 options, 4 discounts, 72 orders.")


if __name__ == "__main__":
    seed()
