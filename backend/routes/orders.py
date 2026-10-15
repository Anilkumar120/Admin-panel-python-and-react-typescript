from datetime import datetime, timezone
from typing import Literal
import uuid

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from backend.database.connection import orders_collection, products_collection
from backend.utils.permissions import require_permission

router = APIRouter(prefix="/api", tags=["Orders"])


class CartLine(BaseModel):
    product_id: str
    quantity: int = Field(ge=1, le=100)


class CheckoutPayload(BaseModel):
    customer_name: str = Field(min_length=1, max_length=160)
    email: str = Field(min_length=3, max_length=320)
    phone: str = Field(min_length=5, max_length=40)
    address: str = Field(min_length=5, max_length=1000)
    payment_method: Literal["cash_on_delivery", "bank_transfer"]
    items: list[CartLine] = Field(min_length=1, max_length=100)


def _format_order(order: dict) -> dict:
    return {
        "id": str(order["_id"]),
        "order_number": order.get("order_number", ""),
        "customer_name": order.get("customer_name", ""),
        "email": order.get("email", ""),
        "phone": order.get("phone", ""),
        "address": order.get("address", ""),
        "items": order.get("items", []),
        "total": order.get("total", 0),
        "status": order.get("status", "pending"),
        "payment_method": order.get("payment_method", ""),
        "payment_status": order.get("payment_status", "pending"),
        "created_at": order.get("created_at"),
        "is_deleted": order.get("is_deleted", False),
    }


def _current_product_price(product: dict) -> float:
    regular_price = product.get("regular_price", product.get("price", 0))
    sale_price = product.get("sale_price")
    if sale_price is None:
        return round(float(regular_price or 0), 2)

    now = datetime.now(timezone.utc)
    for field, is_start in (("sale_start", True), ("sale_end", False)):
        raw_date = product.get(field)
        if not raw_date:
            continue
        try:
            boundary = datetime.fromisoformat(str(raw_date).replace("Z", "+00:00"))
        except ValueError:
            return round(float(regular_price or 0), 2)
        if boundary.tzinfo is None:
            boundary = boundary.replace(tzinfo=timezone.utc)
        if (is_start and now < boundary) or (not is_start and now > boundary):
            return round(float(regular_price or 0), 2)
    return round(float(sale_price), 2)


@router.post("/public/checkout")
def checkout(payload: CheckoutPayload):
    if "@" not in payload.email or "." not in payload.email.rsplit("@", 1)[-1]:
        raise HTTPException(status_code=400, detail="Enter a valid email address")
    if not payload.customer_name.strip() or not payload.phone.strip() or not payload.address.strip():
        raise HTTPException(status_code=400, detail="Customer name, phone, and address are required")
    quantities: dict[str, int] = {}
    for line in payload.items:
        if not ObjectId.is_valid(line.product_id):
            raise HTTPException(status_code=400, detail="Invalid product in cart")
        quantities[line.product_id] = quantities.get(line.product_id, 0) + line.quantity

    order_items = []
    stock_reserved: list[tuple[ObjectId, int]] = []
    total = 0.0
    try:
        for product_id, quantity in quantities.items():
            product_oid = ObjectId(product_id)
            product = products_collection.find_one({
                "_id": product_oid,
                "is_deleted": {"$ne": True},
                "$or": [{"status": "published"}, {"status": {"$exists": False}}],
                "visibility": {"$nin": ["hidden", "search"]},
                "catalog_visibility": {"$nin": ["hidden", "search"]},
            })
            if not product:
                raise HTTPException(status_code=400, detail="A product in your cart is no longer available")
            if product.get("product_type", "simple") != "simple":
                raise HTTPException(status_code=400, detail="Only simple products can be checked out right now")
            if product.get("stock_status") == "out_of_stock":
                raise HTTPException(status_code=409, detail=f"{product.get('name', 'Product')} is out of stock")

            try:
                price = _current_product_price(product)
            except (TypeError, ValueError) as error:
                raise HTTPException(status_code=400, detail="A product has an invalid price") from error
            if price < 0:
                raise HTTPException(status_code=400, detail="A product has an invalid price")

            if product.get("manage_stock", True):
                reserved = products_collection.update_one(
                    {"_id": product_oid, "quantity": {"$gte": quantity}},
                    {"$inc": {"quantity": -quantity}},
                )
                if not reserved.modified_count:
                    raise HTTPException(status_code=409, detail=f"Not enough stock for {product.get('name', 'product')}")
                stock_reserved.append((product_oid, quantity))
                current_stock = products_collection.find_one(
                    {"_id": product_oid},
                    {"quantity": 1},
                )
                if current_stock and current_stock.get("quantity", 0) <= 0:
                    products_collection.update_one(
                        {"_id": product_oid},
                        {"$set": {"stock_status": "out_of_stock"}},
                    )

            total += price * quantity
            order_items.append({
                "product_id": product_id,
                "name": product.get("name", ""),
                "sku": product.get("sku", ""),
                "quantity": quantity,
                "unit_price": price,
                "subtotal": round(price * quantity, 2),
                "image": product.get("image", ""),
                "manage_stock": product.get("manage_stock", True),
            })

        now = datetime.now(timezone.utc)
        order = {
            "order_number": f"ORD-{now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:8].upper()}",
            "customer_name": payload.customer_name.strip(),
            "email": payload.email.strip().lower(),
            "phone": payload.phone.strip(),
            "address": payload.address.strip(),
            "items": order_items,
            "total": round(total, 2),
            "status": "pending",
            "payment_method": payload.payment_method,
            "payment_status": "pending",
            "created_at": now,
            "updated_at": now,
            "is_deleted": False,
            "stock_released": False,
        }
        inserted = orders_collection.insert_one(order)
        order["_id"] = inserted.inserted_id
        return _format_order(order)
    except Exception:
        for product_oid, quantity in stock_reserved:
            products_collection.update_one(
                {"_id": product_oid},
                {
                    "$inc": {"quantity": quantity},
                    "$set": {"stock_status": "in_stock"},
                },
            )
        raise


@router.get("/orders")
def list_orders(
    trash: bool = Query(False),
    current_user=Depends(require_permission("orders.view")),
):
    orders = orders_collection.find({"is_deleted": trash}).sort("created_at", -1)
    return {"orders": [_format_order(order) for order in orders]}


@router.patch("/orders/{order_id}/status")
def update_order_status(
    order_id: str,
    status: Literal["pending", "processing", "on_hold", "completed", "cancelled", "refunded", "failed"],
    current_user=Depends(require_permission("orders.edit")),
):
    if not ObjectId.is_valid(order_id):
        raise HTTPException(status_code=400, detail="Invalid order ID")
    order = orders_collection.find_one(
        {"_id": ObjectId(order_id), "is_deleted": {"$ne": True}}
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.get("status") == "cancelled" and status != "cancelled":
        raise HTTPException(status_code=409, detail="Cancelled orders cannot be reopened")

    if status == "cancelled":
        release_claim = orders_collection.update_one(
            {"_id": order["_id"], "stock_released": {"$ne": True}},
            {"$set": {"stock_released": True}},
        )
    else:
        release_claim = None

    if release_claim and release_claim.modified_count:
        for item in order.get("items", []):
            if not item.get("manage_stock", True) or not ObjectId.is_valid(item.get("product_id", "")):
                continue
            products_collection.update_one(
                {"_id": ObjectId(item["product_id"])},
                {
                    "$inc": {"quantity": item.get("quantity", 0)},
                    "$set": {"stock_status": "in_stock"},
                },
            )
    orders_collection.update_one(
        {"_id": order["_id"]},
        {"$set": {"status": status, "updated_at": datetime.now(timezone.utc)}},
    )
    return {"message": "Order status updated"}


@router.delete("/orders/{order_id}")
def trash_order(
    order_id: str,
    current_user=Depends(require_permission("orders.delete")),
):
    if not ObjectId.is_valid(order_id):
        raise HTTPException(status_code=400, detail="Invalid order ID")
    result = orders_collection.update_one(
        {"_id": ObjectId(order_id), "is_deleted": {"$ne": True}},
        {"$set": {"is_deleted": True, "updated_at": datetime.now(timezone.utc)}},
    )
    if not result.matched_count:
        raise HTTPException(status_code=404, detail="Order not found")
    return {"message": "Order moved to trash"}


@router.post("/orders/{order_id}/restore")
def restore_order(
    order_id: str,
    current_user=Depends(require_permission("orders.edit")),
):
    if not ObjectId.is_valid(order_id):
        raise HTTPException(status_code=400, detail="Invalid order ID")
    result = orders_collection.update_one(
        {"_id": ObjectId(order_id), "is_deleted": True},
        {"$set": {"is_deleted": False, "updated_at": datetime.now(timezone.utc)}},
    )
    if not result.matched_count:
        raise HTTPException(status_code=404, detail="Trashed order not found")
    return {"message": "Order restored"}
