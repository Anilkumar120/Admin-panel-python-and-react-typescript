from datetime import datetime, timezone
from typing import Literal
import uuid
import base64
import hashlib
import hmac
import json
import logging
import smtplib
from email.message import EmailMessage
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, Request as FastAPIRequest
from pydantic import BaseModel, Field
from pymongo.errors import PyMongoError

from backend.database.connection import orders_collection, products_collection, settings_collection
from backend.utils.permissions import require_permission
from backend.utils.secure_settings import decrypt_secret

router = APIRouter(prefix="/api", tags=["Orders"])


class CartLine(BaseModel):
    product_id: str
    quantity: int = Field(ge=1, le=100)


class CheckoutPayload(BaseModel):
    customer_name: str = Field(min_length=1, max_length=160)
    email: str = Field(min_length=3, max_length=320)
    phone: str = Field(min_length=5, max_length=40)
    address: str = Field(min_length=5, max_length=1000)
    payment_method: Literal["cash_on_delivery", "bank_transfer", "razorpay"]
    items: list[CartLine] = Field(min_length=1, max_length=100)


class RazorpayVerification(BaseModel):
    order_id: str
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


class CustomerDetailsUpdate(BaseModel):
    customer_name: str = Field(min_length=1, max_length=160)
    email: str = Field(min_length=3, max_length=320)
    phone: str = Field(min_length=5, max_length=40)
    address: str = Field(min_length=5, max_length=1000)


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
        "razorpay_order_id": order.get("razorpay_order_id", ""),
    }


def _payment_credentials():
    settings = settings_collection.find_one({"type": "payments"}) or {}
    mode = settings.get("mode", "test")
    if not settings.get("enabled"):
        raise HTTPException(status_code=400, detail="Online payments are not enabled")
    key_id = settings.get(f"{mode}_key_id", "")
    encrypted_secret = settings.get(f"{mode}_key_secret_encrypted")
    if not key_id or not encrypted_secret:
        raise HTTPException(status_code=400, detail=f"Razorpay {mode} credentials are incomplete")
    return settings, mode, key_id, decrypt_secret(encrypted_secret)


def _razorpay_request(path: str, key_id: str, key_secret: str, payload: dict):
    credentials = base64.b64encode(f"{key_id}:{key_secret}".encode()).decode("ascii")
    request = Request(
        f"https://api.razorpay.com/v1/{path.lstrip('/')}",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Basic {credentials}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=15) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        logging.error("Razorpay API rejected a request: HTTP %s", error.code)
        raise HTTPException(status_code=502, detail="Razorpay could not create the payment order") from error
    except (URLError, TimeoutError) as error:
        logging.exception("Razorpay API request failed")
        raise HTTPException(status_code=502, detail="Razorpay is temporarily unavailable") from error


def _send_order_notifications(order: dict):
    try:
        settings = settings_collection.find_one({"type": "payments"}) or {}
        if not settings.get("smtp_host") or not settings.get("smtp_from_email"):
            return
        customer_email = order.get("email", "")
        admin_email = settings.get("admin_notification_email", "")
        recipients = list(dict.fromkeys(email for email in [customer_email, admin_email] if email))
        if not recipients:
            return

        message = EmailMessage()
        message["Subject"] = f"Order {order.get('order_number', '')} received"
        message["From"] = settings["smtp_from_email"]
        message["To"] = customer_email or admin_email
        if admin_email and admin_email != customer_email:
            message["Bcc"] = admin_email
        message.set_content(
            f"Order {order.get('order_number', '')} has been received.\n"
            f"Customer: {order.get('customer_name', '')}\n"
            f"Email: {order.get('email', '')}\n"
            f"Phone: {order.get('phone', '')}\n"
            f"Address: {order.get('address', '')}\n"
            f"Total: INR {order.get('total', 0):.2f}\n"
            f"Payment: {order.get('payment_method', '')} ({order.get('payment_status', '')})"
        )
        with smtplib.SMTP(settings["smtp_host"], int(settings.get("smtp_port", 587)), timeout=15) as smtp:
            smtp.starttls()
            username = settings.get("smtp_username", "")
            encrypted_password = settings.get("smtp_password_encrypted")
            if username and encrypted_password:
                smtp.login(username, decrypt_secret(encrypted_password))
            smtp.send_message(message)
    except (
        OSError,
        smtplib.SMTPException,
        RuntimeError,
        ValueError,
        TypeError,
        PyMongoError,
    ):
        logging.exception("Order notification email could not be sent")


def _release_order_stock(order: dict):
    claimed = orders_collection.update_one(
        {"_id": order["_id"], "stock_released": {"$ne": True}},
        {"$set": {"stock_released": True, "updated_at": datetime.now(timezone.utc)}},
    )
    if not claimed.modified_count:
        return
    for item in order.get("items", []):
        if not item.get("manage_stock", True):
            continue
        product_id = item.get("product_id", "")
        if not ObjectId.is_valid(product_id):
            continue
        products_collection.update_one(
            {"_id": ObjectId(product_id)},
            {
                "$inc": {"quantity": int(item.get("quantity", 0))},
                "$set": {"stock_status": "in_stock"},
            },
        )


def _mark_payment_paid(order: dict, payment_id: str):
    result = orders_collection.update_one(
        {
            "_id": order["_id"],
            "payment_status": "pending",
            "status": {"$nin": ["cancelled", "failed"]},
            "stock_released": {"$ne": True},
        },
        {
            "$set": {
                "payment_status": "paid",
                "status": "processing",
                "razorpay_payment_id": payment_id,
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )
    if result.modified_count:
        order["payment_status"] = "paid"
        order["status"] = "processing"
        order["razorpay_payment_id"] = payment_id
        _send_order_notifications(order)
    return result.modified_count > 0


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
        razorpay_order = None
        razorpay_checkout = None
        if payload.payment_method == "razorpay":
            payment_settings, mode, key_id, key_secret = _payment_credentials()
            razorpay_order = _razorpay_request(
                "orders",
                key_id,
                key_secret,
                {
                    "amount": int(round(total * 100)),
                    "currency": "INR",
                    "receipt": f"ORD-{now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:8].upper()}",
                },
            )
            razorpay_checkout = {
                "key_id": key_id,
                "mode": mode,
                "name": payment_settings.get("store_name", "Store"),
            }
        order = {
            "order_number": (
                razorpay_order.get("receipt")
                if razorpay_order
                else f"ORD-{now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:8].upper()}"
            ),
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
        if razorpay_order:
            order["razorpay_order_id"] = razorpay_order["id"]
        inserted = orders_collection.insert_one(order)
        order["_id"] = inserted.inserted_id
        if payload.payment_method == "razorpay":
            return {
                **_format_order(order),
                "razorpay": {
                    "key_id": razorpay_checkout["key_id"],
                    "order_id": razorpay_order["id"],
                    "amount": razorpay_order["amount"],
                    "currency": razorpay_order.get("currency", "INR"),
                    "name": razorpay_checkout["name"],
                    "mode": razorpay_checkout["mode"],
                },
            }
        _send_order_notifications(order)
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


@router.get("/public/orders/lookup")
def lookup_order(
    order_number: str = Query(..., min_length=8, max_length=40),
    email: str = Query(..., min_length=3, max_length=320),
):
    order = orders_collection.find_one({
        "order_number": order_number.strip(),
        "email": email.strip().lower(),
        "is_deleted": {"$ne": True},
    })
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return {
        "order_number": order.get("order_number", ""),
        "items": order.get("items", []),
        "total": order.get("total", 0),
        "status": order.get("status", "pending"),
        "payment_status": order.get("payment_status", "pending"),
    }


@router.post("/public/payments/verify")
def verify_razorpay_payment(payload: RazorpayVerification):
    if not ObjectId.is_valid(payload.order_id):
        raise HTTPException(status_code=400, detail="Invalid order")
    order = orders_collection.find_one({
        "_id": ObjectId(payload.order_id),
        "razorpay_order_id": payload.razorpay_order_id,
        "payment_method": "razorpay",
    })
    if not order:
        raise HTTPException(status_code=404, detail="Payment order not found")
    _, _, _, key_secret = _payment_credentials()
    expected = hmac.new(
        key_secret.encode("utf-8"),
        f"{payload.razorpay_order_id}|{payload.razorpay_payment_id}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected, payload.razorpay_signature):
        raise HTTPException(status_code=400, detail="Payment signature verification failed")
    _mark_payment_paid(order, payload.razorpay_payment_id)
    updated = orders_collection.find_one({"_id": order["_id"]})
    return _format_order(updated)


@router.post("/public/payments/fail/{order_id}")
def fail_razorpay_payment(order_id: str):
    if not ObjectId.is_valid(order_id):
        raise HTTPException(status_code=400, detail="Invalid order")
    order = orders_collection.find_one({
        "_id": ObjectId(order_id),
        "payment_method": "razorpay",
        "payment_status": "pending",
    })
    if order:
        result = orders_collection.update_one(
            {"_id": order["_id"], "payment_status": "pending"},
            {"$set": {"payment_status": "failed", "status": "failed"}},
        )
        if result.modified_count:
            _release_order_stock(order)
    return {"message": "Payment failure recorded"}


@router.post("/public/payments/webhook")
async def razorpay_webhook(request: FastAPIRequest):
    settings = settings_collection.find_one({"type": "payments"}) or {}
    encrypted_secret = settings.get("webhook_secret_encrypted")
    if not encrypted_secret:
        raise HTTPException(status_code=503, detail="Razorpay webhook secret is not configured")
    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")
    expected = hmac.new(
        decrypt_secret(encrypted_secret).encode("utf-8"),
        body,
        hashlib.sha256,
    ).hexdigest()
    if not signature or not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=400, detail="Invalid webhook signature")
    try:
        event = json.loads(body)
    except json.JSONDecodeError as error:
        raise HTTPException(status_code=400, detail="Invalid webhook payload") from error
    payment = (event.get("payload") or {}).get("payment", {}).get("entity", {})
    gateway_order_id = payment.get("order_id")
    if not gateway_order_id:
        gateway_order_id = (
            (event.get("payload") or {}).get("order", {}).get("entity", {}).get("id")
        )
    order = orders_collection.find_one({"razorpay_order_id": gateway_order_id}) if gateway_order_id else None
    if not order:
        return {"received": True}
    if event.get("event") in {"payment.captured", "order.paid"}:
        _mark_payment_paid(order, payment.get("id", ""))
    elif event.get("event") in {"payment.failed", "order.cancelled"}:
        result = orders_collection.update_one(
            {"_id": order["_id"], "payment_status": "pending"},
            {"$set": {"payment_status": "failed", "status": "failed"}},
        )
        if result.modified_count:
            _release_order_stock(order)
    return {"received": True}


@router.get("/orders")
def list_orders(
    trash: bool = Query(False),
    current_user=Depends(require_permission("orders.view")),
):
    orders = orders_collection.find({"is_deleted": trash}).sort("created_at", -1)
    return {"orders": [_format_order(order) for order in orders]}


@router.put("/orders/{order_id}/customer")
def update_order_customer(
    order_id: str,
    data: CustomerDetailsUpdate,
    current_user=Depends(require_permission("orders.edit")),
):
    if not ObjectId.is_valid(order_id):
        raise HTTPException(status_code=400, detail="Invalid order ID")
    if "@" not in data.email or "." not in data.email.rsplit("@", 1)[-1]:
        raise HTTPException(status_code=400, detail="Enter a valid email address")
    customer = {
        "customer_name": data.customer_name.strip(),
        "email": data.email.strip().lower(),
        "phone": data.phone.strip(),
        "address": data.address.strip(),
    }
    if not all(customer.values()):
        raise HTTPException(status_code=400, detail="Customer details cannot be empty")
    result = orders_collection.update_one(
        {"_id": ObjectId(order_id), "is_deleted": {"$ne": True}},
        {"$set": {**customer, "updated_at": datetime.now(timezone.utc)}},
    )
    if not result.matched_count:
        raise HTTPException(status_code=404, detail="Order not found")
    return _format_order(orders_collection.find_one({"_id": ObjectId(order_id)}))


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
        if order.get("payment_method") == "razorpay" and order.get("payment_status") == "pending":
            orders_collection.update_one(
                {"_id": order["_id"], "payment_status": "pending"},
                {"$set": {"payment_status": "failed"}},
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
