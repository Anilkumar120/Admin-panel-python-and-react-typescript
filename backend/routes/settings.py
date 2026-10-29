
from fastapi import APIRouter, Form, HTTPException, Depends
from bson import ObjectId
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from typing import Literal
import re

from backend.database.connection import (
    content_collection,
    settings_collection,
    pages_collection,
)

from backend.utils.permissions import require_permission
from backend.utils.secure_settings import encrypt_secret


router = APIRouter(
    prefix="/api/settings",
    tags=["Settings"],
)


DEFAULT_SETTINGS = {
    "homepage_type": "latest_posts",
    "homepage_id": "",
    "posts_page_id": "",
    "posts_per_page": 10,
    "feed_items": 10,
    "feed_content": "excerpt",
    "search_engine_visibility": False,
}

DEFAULT_PERMALINK_SETTINGS = {
    "structure": "post_name",
    "custom_structure": "/%category%/%postname%/",
    "category_base": "",
    "tag_base": "",
    "product_base": "products",
}


# ---------------------------------------------------------
# DEFAULT PAYMENT CONFIGURATION
# ---------------------------------------------------------

DEFAULT_PAYMENT_METHODS = {
    "cards": True,
    "upi": True,
    "net_banking": True,
    "wallets": True,
    "cod": True,
    "bank_transfer": True,
    "international_cards": False,
}

DEFAULT_BANK_UPI = {
    "upi_enabled": False,
    "upi_id": "",
    "upi_account_name": "",
    "bank_transfer_enabled": False,
    "account_holder_name": "",
    "bank_name": "",
    "account_number": "",
    "ifsc_code": "",
    "branch_name": "",
    "payment_instructions": (
        "Complete the payment and provide your transaction reference "
        "for verification."
    ),
}


# ---------------------------------------------------------
# REQUEST MODELS
# ---------------------------------------------------------

class SiteIdentityUpdate(BaseModel):
    logo_url: str = ""
    favicon_url: str = ""


class GatewaySettingsUpdate(BaseModel):
    enabled: bool = False
    mode: Literal["test", "live"] = "test"

    test_key_id: str = ""
    test_key_secret: str = ""

    live_key_id: str = ""
    live_key_secret: str = ""

    # These flags are informational only. The server determines
    # whether secrets are configured from its stored encrypted values.
    test_key_secret_configured: bool = False
    live_key_secret_configured: bool = False


class PaymentMethodsUpdate(BaseModel):
    cards: bool = True
    upi: bool = True
    net_banking: bool = True
    wallets: bool = True
    cod: bool = True
    bank_transfer: bool = True
    international_cards: bool = False


class BankUpiSettingsUpdate(BaseModel):
    upi_enabled: bool = False
    upi_id: str = ""
    upi_account_name: str = ""

    bank_transfer_enabled: bool = False
    account_holder_name: str = ""
    bank_name: str = ""
    account_number: str = ""
    ifsc_code: str = ""
    branch_name: str = ""

    payment_instructions: str = (
        "Complete the payment and provide your transaction reference "
        "for verification."
    )


class PaymentSettingsUpdate(BaseModel):
    # Legacy Razorpay-compatible fields
    enabled: bool = False
    mode: Literal["test", "live"] = "test"

    test_key_id: str = ""
    test_key_secret: str = ""

    live_key_id: str = ""
    live_key_secret: str = ""

    webhook_secret: str = ""

    # Existing email settings
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from_email: str = ""
    admin_notification_email: str = ""

    # Existing store settings
    store_name: str = "Store"
    store_logo_url: str = ""
    business_name: str = ""
    currency: str = "INR"

    # Existing notification settings
    sms_enabled: bool = False
    whatsapp_enabled: bool = False
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_from_number: str = ""
    twilio_whatsapp_from: str = ""

    # New nested gateway configuration
    razorpay: GatewaySettingsUpdate = Field(
        default_factory=GatewaySettingsUpdate
    )
    stripe: GatewaySettingsUpdate = Field(
        default_factory=GatewaySettingsUpdate
    )
    paypal: GatewaySettingsUpdate = Field(
        default_factory=GatewaySettingsUpdate
    )

    # New checkout method configuration
    methods: PaymentMethodsUpdate = Field(
        default_factory=PaymentMethodsUpdate
    )

    # New manual UPI and bank-transfer configuration
    bank_upi: BankUpiSettingsUpdate = Field(
        default_factory=BankUpiSettingsUpdate
    )


# ---------------------------------------------------------
# HELPERS
# ---------------------------------------------------------

def _fields_set(model):
    """Support Pydantic v1 and v2."""
    return getattr(
        model,
        "model_fields_set",
        getattr(model, "__fields_set__", set()),
    )


def _gateway_secret_fields(gateway_name: str):
    """
    Razorpay retains the original encrypted field names so existing
    Razorpay integrations can continue using them.
    Stripe and PayPal use gateway-specific encrypted field names.
    """
    prefix = "" if gateway_name == "razorpay" else f"{gateway_name}_"

    return {
        "test_key_secret": f"{prefix}test_key_secret_encrypted",
        "live_key_secret": f"{prefix}live_key_secret_encrypted",
    }


def _gateway_public_settings(
    settings: dict,
    gateway_name: str,
    fallback: dict | None = None,
):
    fallback = fallback or {}

    secret_fields = _gateway_secret_fields(gateway_name)

    test_secret_configured = bool(
        settings.get(secret_fields["test_key_secret"])
    )
    live_secret_configured = bool(
        settings.get(secret_fields["live_key_secret"])
    )

    return {
        "enabled": bool(
            settings.get(
                f"{gateway_name}_enabled",
                settings.get("enabled", False)
                if gateway_name == "razorpay"
                else fallback.get("enabled", False),
            )
        ),
        "mode": settings.get(
            f"{gateway_name}_mode",
            settings.get("mode", "test")
            if gateway_name == "razorpay"
            else fallback.get("mode", "test"),
        ),
        "test_key_id": settings.get(
            f"{gateway_name}_test_key_id",
            settings.get("test_key_id", "")
            if gateway_name == "razorpay"
            else fallback.get("test_key_id", ""),
        ),
        "test_key_secret": "",
        "test_key_secret_configured": test_secret_configured,
        "live_key_id": settings.get(
            f"{gateway_name}_live_key_id",
            settings.get("live_key_id", "")
            if gateway_name == "razorpay"
            else fallback.get("live_key_id", ""),
        ),
        "live_key_secret": "",
        "live_key_secret_configured": live_secret_configured,
    }


def _stored_gateway_secret(settings: dict, gateway_name: str, field: str):
    secret_fields = _gateway_secret_fields(gateway_name)
    return settings.get(secret_fields[field])


# ---------------------------------------------------------
# SITE IDENTITY
# ---------------------------------------------------------

@router.get("/site-identity")
def get_site_identity(
    user=Depends(require_permission("settings.view")),
):
    settings = settings_collection.find_one(
        {"type": "site_identity"}
    ) or {}

    return {
        "logo_url": settings.get("logo_url", ""),
        "favicon_url": settings.get("favicon_url", ""),
    }


@router.put("/site-identity")
def update_site_identity(
    data: SiteIdentityUpdate,
    user=Depends(require_permission("settings.edit")),
):
    settings_collection.update_one(
        {"type": "site_identity"},
        {
            "$set": {
                "type": "site_identity",
                "logo_url": data.logo_url,
                "favicon_url": data.favicon_url,
            }
        },
        upsert=True,
    )

    return {"message": "Site identity updated successfully"}


@router.get("/site-identity/public")
def get_public_site_identity():
    settings = settings_collection.find_one(
        {"type": "site_identity"}
    ) or {}

    return {
        "logo_url": settings.get("logo_url", ""),
        "favicon_url": settings.get("favicon_url", ""),
    }


# ---------------------------------------------------------
# READING SETTINGS
# ---------------------------------------------------------

@router.get("/reading")
def get_reading_settings(
    user=Depends(require_permission("settings.view")),
):
    settings = settings_collection.find_one({"type": "reading"})

    if not settings:
        settings_collection.insert_one({
            "type": "reading",
            **DEFAULT_SETTINGS,
        })
        return DEFAULT_SETTINGS

    return {
        "homepage_type": settings.get("homepage_type", "latest_posts"),
        "homepage_id": settings.get("homepage_id", ""),
        "posts_page_id": settings.get("posts_page_id", ""),
        "posts_per_page": settings.get("posts_per_page", 10),
        "feed_items": settings.get("feed_items", 10),
        "feed_content": settings.get("feed_content", "excerpt"),
        "search_engine_visibility": settings.get(
            "search_engine_visibility", False
        ),
    }


@router.get("/reading/public")
def get_public_reading_settings():
    settings = settings_collection.find_one({"type": "reading"}) or {}

    return {
        "search_engine_visibility": bool(
            settings.get("search_engine_visibility", False)
        ),
        "posts_per_page": settings.get("posts_per_page", 10),
        "feed_items": settings.get("feed_items", 10),
        "feed_content": settings.get("feed_content", "excerpt"),
    }


@router.put("/reading")
def update_reading_settings(
    homepage_type: str = Form(...),
    homepage_id: str = Form(""),
    posts_page_id: str = Form(""),
    posts_per_page: int = Form(10),
    feed_items: int = Form(10),
    feed_content: str = Form("excerpt"),
    search_engine_visibility: bool = Form(False),
    user=Depends(require_permission("settings.edit")),
):
    if homepage_type not in ["latest_posts", "static"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid homepage type",
        )

    if not 1 <= posts_per_page <= 100 or not 1 <= feed_items <= 100:
        raise HTTPException(
            status_code=400,
            detail="Post and feed counts must be between 1 and 100",
        )

    if feed_content not in ["full", "excerpt"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid feed content option",
        )

    if homepage_type == "static":
        if not ObjectId.is_valid(homepage_id):
            raise HTTPException(
                status_code=400,
                detail="Select a published page for the homepage",
            )

        content_page = content_collection.find_one({
            "_id": ObjectId(homepage_id),
            "post_type": "pages",
            "status": "published",
            "is_deleted": False,
        })

        builder_page = None

        if not content_page:
            builder_page = pages_collection.find_one({
                "_id": ObjectId(homepage_id),
                "status": "published",
            })

        if not content_page and not builder_page:
            raise HTTPException(
                status_code=400,
                detail="Homepage must be a published page",
            )

    settings_collection.update_one(
        {"type": "reading"},
        {
            "$set": {
                "type": "reading",
                "homepage_type": homepage_type,
                "homepage_id": homepage_id,
                "posts_page_id": posts_page_id,
                "posts_per_page": posts_per_page,
                "feed_items": feed_items,
                "feed_content": feed_content,
                "search_engine_visibility": search_engine_visibility,
            }
        },
        upsert=True,
    )

    return {"message": "Reading settings updated successfully"}


# ---------------------------------------------------------
# PERMALINK SETTINGS
# ---------------------------------------------------------

@router.get("/permalinks")
def get_permalink_settings(
    user=Depends(require_permission("settings.view")),
):
    settings = settings_collection.find_one(
        {"type": "permalinks"}
    ) or {}

    return {
        key: settings.get(key, value)
        for key, value in DEFAULT_PERMALINK_SETTINGS.items()
    }


@router.get("/permalinks/public")
def get_public_permalink_settings():
    settings = settings_collection.find_one(
        {"type": "permalinks"}
    ) or {}

    return {
        key: settings.get(key, value)
        for key, value in DEFAULT_PERMALINK_SETTINGS.items()
    }


@router.put("/permalinks")
def update_permalink_settings(
    data: dict,
    user=Depends(require_permission("settings.edit")),
):
    structure = data.get("structure", "post_name")

    allowed_structures = {
        "plain",
        "day_name",
        "month_name",
        "numeric",
        "post_name",
        "custom",
    }

    if structure not in allowed_structures:
        raise HTTPException(
            status_code=400,
            detail="Invalid permalink structure",
        )

    custom_structure = str(
        data.get("custom_structure", "")
    ).strip()

    if structure == "custom":
        if (
            not custom_structure.startswith("/")
            or "%postname%" not in custom_structure
        ):
            raise HTTPException(
                status_code=400,
                detail=(
                    "Custom structure must start with / "
                    "and include %postname%"
                ),
            )

        allowed_tokens = {
            "year",
            "monthnum",
            "day",
            "hour",
            "minute",
            "second",
            "post_id",
            "postname",
            "category",
            "author",
        }

        invalid_tokens = (
            set(re.findall(r"%([^%]+)%", custom_structure))
            - allowed_tokens
        )

        if invalid_tokens:
            raise HTTPException(
                status_code=400,
                detail="Custom structure contains an unsupported token",
            )

    values = {
        "type": "permalinks",
        "structure": structure,
        "custom_structure": custom_structure,
        "category_base": str(
            data.get("category_base", "")
        ).strip().strip("/"),
        "tag_base": str(
            data.get("tag_base", "")
        ).strip().strip("/"),
        "product_base": str(
            data.get("product_base", "products")
        ).strip().strip("/") or "products",
        "updated_at": datetime.now(timezone.utc),
    }

    settings_collection.update_one(
        {"type": "permalinks"},
        {"$set": values},
        upsert=True,
    )

    return {"message": "Permalink settings updated successfully"}


# ---------------------------------------------------------
# PAYMENT SETTINGS - ADMIN GET
# ---------------------------------------------------------

@router.get("/payments")
def get_payment_settings(
    user=Depends(require_permission("settings.view")),
):
    settings = settings_collection.find_one(
        {"type": "payments"}
    ) or {}

    razorpay = _gateway_public_settings(settings, "razorpay")
    stripe = _gateway_public_settings(settings, "stripe")
    paypal = _gateway_public_settings(settings, "paypal")

    stored_methods = settings.get("methods") or {}
    methods = {
        key: stored_methods.get(key, default)
        for key, default in DEFAULT_PAYMENT_METHODS.items()
    }

    stored_bank_upi = settings.get("bank_upi") or {}
    bank_upi = {
        key: stored_bank_upi.get(key, default)
        for key, default in DEFAULT_BANK_UPI.items()
    }

    return {
        # Legacy Razorpay-compatible fields
        "enabled": razorpay["enabled"],
        "mode": razorpay["mode"],
        "test_key_id": razorpay["test_key_id"],
        "test_key_secret_configured": (
            razorpay["test_key_secret_configured"]
        ),
        "live_key_id": razorpay["live_key_id"],
        "live_key_secret_configured": (
            razorpay["live_key_secret_configured"]
        ),
        "webhook_secret_configured": bool(
            settings.get("webhook_secret_encrypted")
        ),

        # New nested gateway format
        "razorpay": razorpay,
        "stripe": stripe,
        "paypal": paypal,

        # Checkout methods and manual payment details
        "methods": methods,
        "bank_upi": bank_upi,

        # Existing email settings
        "smtp_host": settings.get("smtp_host", ""),
        "smtp_port": settings.get("smtp_port", 587),
        "smtp_username": settings.get("smtp_username", ""),
        "smtp_password_configured": bool(
            settings.get("smtp_password_encrypted")
        ),
        "smtp_from_email": settings.get("smtp_from_email", ""),
        "admin_notification_email": settings.get(
            "admin_notification_email", ""
        ),

        # Existing store settings
        "store_name": settings.get("store_name", "Store"),
        "store_logo_url": settings.get("store_logo_url", ""),
        "business_name": settings.get(
            "business_name",
            settings.get("store_name", ""),
        ),
        "currency": settings.get("currency", "INR"),

        # Existing notification settings
        "sms_enabled": bool(settings.get("sms_enabled", False)),
        "whatsapp_enabled": bool(
            settings.get("whatsapp_enabled", False)
        ),
        "twilio_account_sid": settings.get(
            "twilio_account_sid", ""
        ),
        "twilio_from_number": settings.get(
            "twilio_from_number", ""
        ),
        "twilio_whatsapp_from": settings.get(
            "twilio_whatsapp_from", ""
        ),
        "twilio_auth_token_configured": bool(
            settings.get("twilio_auth_token_encrypted")
        ),
    }


# ---------------------------------------------------------
# PAYMENT SETTINGS - ADMIN UPDATE
# ---------------------------------------------------------

@router.put("/payments")
def update_payment_settings(
    data: PaymentSettingsUpdate,
    user=Depends(require_permission("settings.edit")),
):
    if not 1 <= data.smtp_port <= 65535:
        raise HTTPException(
            status_code=400,
            detail="SMTP port must be between 1 and 65535",
        )

    existing = settings_collection.find_one(
        {"type": "payments"}
    ) or {}

    supplied_fields = _fields_set(data)

    # If the new nested Razorpay object was sent, it takes precedence.
    # Otherwise retain compatibility with the old flat API payload.
    if "razorpay" in supplied_fields:
        razorpay_enabled = data.razorpay.enabled
        razorpay_mode = data.razorpay.mode
        razorpay_test_key_id = data.razorpay.test_key_id.strip()
        razorpay_live_key_id = data.razorpay.live_key_id.strip()
        razorpay_test_secret = data.razorpay.test_key_secret
        razorpay_live_secret = data.razorpay.live_key_secret
    else:
        razorpay_enabled = data.enabled
        razorpay_mode = data.mode
        razorpay_test_key_id = data.test_key_id.strip()
        razorpay_live_key_id = data.live_key_id.strip()
        razorpay_test_secret = data.test_key_secret
        razorpay_live_secret = data.live_key_secret

    active_key_id = (
        razorpay_test_key_id
        if razorpay_mode == "test"
        else razorpay_live_key_id
    )

    active_secret = (
        razorpay_test_secret
        if razorpay_mode == "test"
        else razorpay_live_secret
    )

    active_secret_field = (
        "test_key_secret_encrypted"
        if razorpay_mode == "test"
        else "live_key_secret_encrypted"
    )

    if razorpay_enabled:
        secret_is_configured = bool(
            active_secret
            or existing.get(active_secret_field)
        )

        if not active_key_id or not secret_is_configured:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Configure the Razorpay {razorpay_mode} "
                    "key ID and secret before enabling payments"
                ),
            )

    values = {
        "type": "payments",

        # Legacy fields remain available to existing integrations.
        "enabled": razorpay_enabled,
        "mode": razorpay_mode,
        "test_key_id": razorpay_test_key_id,
        "live_key_id": razorpay_live_key_id,

        # Store and currency
        "store_name": (
            data.business_name.strip()
            or data.store_name.strip()
            or "Store"
        ),
        "business_name": (
            data.business_name.strip()
            or data.store_name.strip()
            or "Store"
        ),
        "currency": data.currency.strip().upper() or "INR",
        "store_logo_url": data.store_logo_url.strip(),

        # Email
        "smtp_host": data.smtp_host.strip(),
        "smtp_port": data.smtp_port,
        "smtp_username": data.smtp_username.strip(),
        "smtp_from_email": data.smtp_from_email.strip(),
        "admin_notification_email": (
            data.admin_notification_email.strip()
        ),

        # Notifications
        "sms_enabled": data.sms_enabled,
        "whatsapp_enabled": data.whatsapp_enabled,
        "twilio_account_sid": data.twilio_account_sid.strip(),
        "twilio_from_number": data.twilio_from_number.strip(),
        "twilio_whatsapp_from": data.twilio_whatsapp_from.strip(),

        # New gateway values
        "razorpay_enabled": razorpay_enabled,
        "razorpay_mode": razorpay_mode,
        "razorpay_test_key_id": razorpay_test_key_id,
        "razorpay_live_key_id": razorpay_live_key_id,

        "stripe_enabled": data.stripe.enabled,
        "stripe_mode": data.stripe.mode,
        "stripe_test_key_id": data.stripe.test_key_id.strip(),
        "stripe_live_key_id": data.stripe.live_key_id.strip(),

        "paypal_enabled": data.paypal.enabled,
        "paypal_mode": data.paypal.mode,
        "paypal_test_key_id": data.paypal.test_key_id.strip(),
        "paypal_live_key_id": data.paypal.live_key_id.strip(),

        "methods": data.methods.model_dump()
        if hasattr(data.methods, "model_dump")
        else data.methods.dict(),

        "bank_upi": (
            data.bank_upi.model_dump()
            if hasattr(data.bank_upi, "model_dump")
            else data.bank_upi.dict()
        ),

        "updated_at": datetime.now(timezone.utc),
    }

    # Preserve previously stored secrets when incoming secret fields
    # are blank. Never return decrypted secrets through the GET route.
    secret_fields = {
        "test_key_secret": razorpay_test_secret,
        "live_key_secret": razorpay_live_secret,
        "webhook_secret": data.webhook_secret,
        "smtp_password": data.smtp_password,
        "twilio_auth_token": data.twilio_auth_token,
    }

    for field, secret in secret_fields.items():
        encrypted_field = f"{field}_encrypted"

        if secret:
            values[encrypted_field] = encrypt_secret(secret)
        elif encrypted_field in existing:
            values[encrypted_field] = existing[encrypted_field]

    # Encrypt Stripe and PayPal secrets separately.
    nested_gateways = {
        "stripe": data.stripe,
        "paypal": data.paypal,
    }

    for gateway_name, gateway in nested_gateways.items():
        secret_fields_for_gateway = _gateway_secret_fields(
            gateway_name
        )

        for source_field, encrypted_field in (
            secret_fields_for_gateway.items()
        ):
            secret = getattr(gateway, source_field, "")

            if secret:
                values[encrypted_field] = encrypt_secret(secret)
            elif encrypted_field in existing:
                values[encrypted_field] = existing[encrypted_field]

    settings_collection.update_one(
        {"type": "payments"},
        {"$set": values},
        upsert=True,
    )

    return {
        "message": "Payment settings saved successfully"
    }


# ---------------------------------------------------------
# PUBLIC PAYMENT SETTINGS
# ---------------------------------------------------------

@router.get("/payments/public")
def get_public_payment_settings():
    """
    Returns public checkout configuration only.
    Gateway secrets, SMTP credentials and notification tokens
    are never included in this response.

    Manual bank and UPI details are returned only when enabled.
    """

    settings = settings_collection.find_one(
        {"type": "payments"}
    ) or {}

    mode = settings.get("mode", "test")
    key_id = settings.get(f"{mode}_key_id", "")
    secret_is_configured = bool(
        settings.get(f"{mode}_key_secret_encrypted")
    )

    stored_methods = settings.get("methods") or {}

    methods = {
        key: stored_methods.get(key, default)
        for key, default in DEFAULT_PAYMENT_METHODS.items()
    }

    stored_bank_upi = settings.get("bank_upi") or {}

    upi_enabled = bool(stored_bank_upi.get("upi_enabled", False))
    bank_enabled = bool(
        stored_bank_upi.get("bank_transfer_enabled", False)
    )

    # Do not expose manual payment details when that option is disabled.
    public_bank_upi = {
        "upi_enabled": upi_enabled,
        "upi_id": (
            stored_bank_upi.get("upi_id", "")
            if upi_enabled else ""
        ),
        "upi_account_name": (
            stored_bank_upi.get("upi_account_name", "")
            if upi_enabled else ""
        ),
        "bank_transfer_enabled": bank_enabled,
        "account_holder_name": (
            stored_bank_upi.get("account_holder_name", "")
            if bank_enabled else ""
        ),
        "bank_name": (
            stored_bank_upi.get("bank_name", "")
            if bank_enabled else ""
        ),
        "account_number": (
            stored_bank_upi.get("account_number", "")
            if bank_enabled else ""
        ),
        "ifsc_code": (
            stored_bank_upi.get("ifsc_code", "")
            if bank_enabled else ""
        ),
        "branch_name": (
            stored_bank_upi.get("branch_name", "")
            if bank_enabled else ""
        ),
        "payment_instructions": (
            stored_bank_upi.get(
                "payment_instructions",
                DEFAULT_BANK_UPI["payment_instructions"],
            )
        ),
    }

    return {
        "enabled": bool(
            settings.get("enabled")
            and key_id
            and secret_is_configured
        ),
        "mode": mode,
        "key_id": (
            key_id
            if settings.get("enabled") and secret_is_configured
            else ""
        ),
        "business_name": settings.get(
            "business_name",
            settings.get("store_name", "Store"),
        ),
        "currency": settings.get("currency", "INR"),
        "methods": methods,
        "bank_upi": public_bank_upi,
    }
