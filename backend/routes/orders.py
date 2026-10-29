from datetime import datetime, timezone
from typing import Literal
import uuid
import base64
import hashlib
import hmac
import json
import logging
import smtplib
import html
import os
from urllib.parse import urlencode
from urllib.parse import urljoin
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


class RefundPayload(BaseModel):
    amount: float | None = Field(default=None, gt=0)
    reason: str = Field(default="Customer refund", max_length=250)


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


def _send_order_notifications(order: dict, event: str = "order_received"):
    """Send order status email and optional Twilio SMS/WhatsApp notifications.

    Payment credentials are never returned to the frontend. Notifications are best-effort:
    provider outages do not roll back a valid order/payment update.
    """
    settings = settings_collection.find_one({"type": "payments"}) or {}
    order_number = str(order.get("order_number", ""))
    status_labels = {
        "order_received": "Order received",
        "payment_success": "Payment successful",
        "payment_failed": "Payment failed",
        "order_cancelled": "Order cancelled",
        "order_refunded": "Order marked refunded",
    }
    subject = f"{status_labels.get(event, 'Order update')}: {order_number}"
    items = order.get("items", [])
    lines = "\n".join(
        f"- {item.get('name', 'Product')} x {item.get('quantity', 1)} — INR {float(item.get('subtotal', 0) or 0):.2f}"
        for item in items
    ) or "No item details available"
    plain = (
        f"{status_labels.get(event, 'Order update')}\n\n"
        f"Order: {order_number}\nCustomer: {order.get('customer_name', '')}\n"
        f"Email: {order.get('email', '')}\nPhone: {order.get('phone', '')}\n"
        f"Address: {order.get('address', '')}\n\nItems:\n{lines}\n\n"
        f"Total: INR {float(order.get('total', 0) or 0):.2f}\n"
        f"Order status: {order.get('status', 'pending')}\n"
        f"Payment method: {order.get('payment_method', '')}\n"
        f"Payment status: {order.get('payment_status', 'pending')}"
    )

    # Email to customer and admin using one message with Bcc to avoid leaking addresses.
    try:
        if settings.get("smtp_host") and settings.get("smtp_from_email"):
            customer_email = str(order.get("email", "")).strip()
            admin_email = str(settings.get("admin_notification_email", "")).strip()
            if customer_email or admin_email:
                message = EmailMessage()
                message["Subject"] = subject
                message["From"] = settings["smtp_from_email"]
                message["To"] = customer_email or admin_email
                if admin_email and admin_email.lower() != customer_email.lower():
                    message["Bcc"] = admin_email
                message.set_content(plain)
                public_base = os.getenv("PUBLIC_BASE_URL", os.getenv("FRONTEND_URL", "")).strip().rstrip("/")
                raw_logo_url = str(settings.get("store_logo_url", "")).strip()
                if raw_logo_url and not raw_logo_url.lower().startswith(("http://", "https://")) and public_base:
                    raw_logo_url = urljoin(public_base + "/", raw_logo_url.lstrip("/"))
                logo_url = html.escape(raw_logo_url, quote=True)
                store_name = html.escape(str(settings.get("store_name", "Store")))
                safe_order = html.escape(order_number)
                item_html = "".join(
                    "<tr>"
                    + (f'<td style="padding:8px;border-bottom:1px solid #eee"><img src="{html.escape((str(item.get("image", "")).strip() if str(item.get("image", "")).lower().startswith(("http://", "https://")) else urljoin(public_base + "/", str(item.get("image", "")).lstrip("/")) if public_base else str(item.get("image", ""))), quote=True)}" alt="" width="56" style="object-fit:contain;max-height:56px"></td>' if item.get("image") else '<td style="padding:8px;border-bottom:1px solid #eee"></td>')
                    + f'<td style="padding:8px;border-bottom:1px solid #eee">{html.escape(str(item.get("name", "Product")))} × {int(item.get("quantity", 1) or 1)}</td>'
                    + f'<td style="padding:8px;border-bottom:1px solid #eee;text-align:right">₹{float(item.get("subtotal", 0) or 0):.2f}</td></tr>'
                    for item in items
                )
                logo_html = f'<img src="{logo_url}" alt="{store_name}" style="max-width:180px;max-height:70px">' if logo_url else f'<h2>{store_name}</h2>'
                html_body = f"""<!doctype html><html><body style="font-family:Arial,sans-serif;color:#222;line-height:1.5"><div style="max-width:680px;margin:auto;padding:20px">{logo_html}<h2>{html.escape(status_labels.get(event, "Order update"))}</h2><p>Order <strong>{safe_order}</strong></p><table style="width:100%;border-collapse:collapse"><thead><tr><th></th><th style="text-align:left">Product</th><th style="text-align:right">Subtotal</th></tr></thead><tbody>{item_html}</tbody></table><h3 style="text-align:right">Total: ₹{float(order.get("total", 0) or 0):.2f}</h3><p><strong>Payment:</strong> {html.escape(str(order.get("payment_method", "")))} — {html.escape(str(order.get("payment_status", "pending")))}</p><p><strong>Order status:</strong> {html.escape(str(order.get("status", "pending")))}</p><p><strong>Customer:</strong> {html.escape(str(order.get("customer_name", "")))}<br><strong>Phone:</strong> {html.escape(str(order.get("phone", "")))}<br><strong>Address:</strong> {html.escape(str(order.get("address", "")))}</p></div></body></html>"""
                message.add_alternative(html_body, subtype="html")
                with smtplib.SMTP(settings["smtp_host"], int(settings.get("smtp_port", 587)), timeout=15) as smtp:
                    smtp.starttls()
                    username = settings.get("smtp_username", "")
                    encrypted_password = settings.get("smtp_password_encrypted")
                    if username and encrypted_password:
                        smtp.login(username, decrypt_secret(encrypted_password))
                    smtp.send_message(message)
    except (OSError, smtplib.SMTPException, RuntimeError, ValueError, TypeError, PyMongoError):
        logging.exception("Order notification email could not be sent")

    # Twilio SMS and WhatsApp are optional; configure account SID/token and sender in admin settings.
    try:
        sms_enabled = bool(settings.get("sms_enabled"))
        whatsapp_enabled = bool(settings.get("whatsapp_enabled"))
        sid = str(settings.get("twilio_account_sid", "")).strip()
        token_encrypted = settings.get("twilio_auth_token_encrypted")
        phone = str(order.get("phone", "")).strip()
        if phone and sid and token_encrypted and (sms_enabled or whatsapp_enabled):
            token = decrypt_secret(token_encrypted)
            from urllib.request import Request, urlopen
            import base64
            auth = base64.b64encode(f"{sid}:{token}".encode()).decode("ascii")
            body_text = f"{status_labels.get(event, 'Order update')}: {order_number}. Total INR {float(order.get('total', 0) or 0):.2f}. Order: {order.get('status', 'pending')}; payment: {order.get('payment_status', 'pending')}."
            targets = []
            if sms_enabled and settings.get("twilio_from_number"):
                targets.append((phone, str(settings["twilio_from_number"])))
            if whatsapp_enabled and settings.get("twilio_whatsapp_from"):
                to_number = phone if phone.startswith("whatsapp:") else f"whatsapp:{phone}"
                from_number = str(settings["twilio_whatsapp_from"])
                if not from_number.startswith("whatsapp:"):
                    from_number = f"whatsapp:{from_number}"
                targets.append((to_number, from_number))
            for to_number, from_number in targets:
                payload = urlencode({"To": to_number, "From": from_number, "Body": body_text}).encode()
                request = Request(
                    f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json",
                    data=payload,
                    headers={"Authorization": f"Basic {auth}", "Content-Type": "application/x-www-form-urlencoded"},
                    method="POST",
                )
                with urlopen(request, timeout=12) as response:
                    response.read()
    except Exception:
        logging.exception("SMS/WhatsApp order notification could not be sent")


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
        _send_order_notifications(order, "payment_success")
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
            order["payment_status"] = "failed"
            order["status"] = "failed"
            _release_order_stock(order)
            _send_order_notifications(order, "payment_failed")
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
            order["payment_status"] = "failed"
            order["status"] = "failed"
            _release_order_stock(order)
            _send_order_notifications(order, "payment_failed")
    return {"received": True}


@router.post("/orders/{order_id}/refund")
def refund_order(
    order_id: str,
    payload: RefundPayload,
    current_user=Depends(require_permission("orders.edit")),
):
    """Issue a real Razorpay refund, then update order state and notify recipients."""
    if not ObjectId.is_valid(order_id):
        raise HTTPException(status_code=400, detail="Invalid order ID")
    order = orders_collection.find_one({"_id": ObjectId(order_id), "is_deleted": {"$ne": True}})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.get("payment_method") != "razorpay" or not order.get("razorpay_payment_id"):
        raise HTTPException(status_code=400, detail="Only captured Razorpay payments can be refunded through this endpoint")
    if order.get("payment_status") == "refunded":
        raise HTTPException(status_code=409, detail="This order is already marked refunded")
    _, _, key_id, key_secret = _payment_credentials()
    refund_payload = {"notes": {"order_number": str(order.get("order_number", "")), "reason": payload.reason}}
    if payload.amount is not None:
        if payload.amount > float(order.get("total", 0) or 0):
            raise HTTPException(status_code=400, detail="Refund amount cannot exceed the order total")
        refund_payload["amount"] = int(round(payload.amount * 100))
    gateway_refund = _razorpay_request(f"payments/{order['razorpay_payment_id']}/refund", key_id, key_secret, refund_payload)
    now = datetime.now(timezone.utc)
    full_refund = payload.amount is None or round(payload.amount, 2) >= round(float(order.get("total", 0) or 0), 2)
    update = {
        "refund_id": gateway_refund.get("id", ""),
        "refund_amount": round(float(gateway_refund.get("amount", 0) or 0) / 100, 2),
        "updated_at": now,
        "status": "refunded" if full_refund else order.get("status", "processing"),
        "payment_status": "refunded" if full_refund else "partially_refunded",
    }
    orders_collection.update_one({"_id": order["_id"]}, {"$set": update})
    order.update(update)
    _send_order_notifications(order, "order_refunded")
    return {"message": "Refund request accepted by Razorpay", "refund_id": update["refund_id"], "refund_amount": update["refund_amount"], "payment_status": update["payment_status"]}


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
    update_values = {"status": status, "updated_at": datetime.now(timezone.utc)}
    if status == "refunded":
        update_values["payment_status"] = "refunded"
    elif status == "cancelled" and order.get("payment_status") == "pending":
        update_values["payment_status"] = "failed"
    orders_collection.update_one({"_id": order["_id"]}, {"$set": update_values})
    order.update(update_values)
    if status == "cancelled":
        _send_order_notifications(order, "order_cancelled")
    elif status == "refunded":
        _send_order_notifications(order, "order_refunded")
    elif status == "failed":
        _send_order_notifications(order, "payment_failed")
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
