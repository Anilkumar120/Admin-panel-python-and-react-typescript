from fastapi import APIRouter, Form, HTTPException, Depends
from bson import ObjectId
from pydantic import BaseModel
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
    tags=["Settings"]
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

class SiteIdentityUpdate(BaseModel):
    logo_url: str = ""
    favicon_url: str = ""


class PaymentSettingsUpdate(BaseModel):
    enabled: bool = False
    mode: Literal["test", "live"] = "test"
    test_key_id: str = ""
    test_key_secret: str = ""
    live_key_id: str = ""
    live_key_secret: str = ""
    webhook_secret: str = ""
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from_email: str = ""
    admin_notification_email: str = ""


@router.get("/site-identity")
def get_site_identity(
    user=Depends(require_permission("settings.view"))
):
    settings = settings_collection.find_one({"type": "site_identity"}) or {}
    return {
        "logo_url": settings.get("logo_url", ""),
        "favicon_url": settings.get("favicon_url", ""),
    }


@router.put("/site-identity")
def update_site_identity(
    data: SiteIdentityUpdate,
    user=Depends(require_permission("settings.edit"))
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
    settings = settings_collection.find_one({"type": "site_identity"}) or {}
    return {
        "logo_url": settings.get("logo_url", ""),
        "favicon_url": settings.get("favicon_url", ""),
    }


@router.get("/reading")
def get_reading_settings(
    user=Depends(require_permission("settings.view"))
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
        "search_engine_visibility": settings.get("search_engine_visibility", False),
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
    user=Depends(require_permission("settings.edit"))
):
    if homepage_type not in ["latest_posts", "static"]:
        raise HTTPException(status_code=400, detail="Invalid homepage type")
    if not 1 <= posts_per_page <= 100 or not 1 <= feed_items <= 100:
        raise HTTPException(status_code=400, detail="Post and feed counts must be between 1 and 100")
    if feed_content not in ["full", "excerpt"]:
        raise HTTPException(status_code=400, detail="Invalid feed content option")

    if homepage_type == "static":
        if not ObjectId.is_valid(homepage_id):
            raise HTTPException(
                status_code=400,
                detail="Select a published page for the homepage",
            )

        # Accept content page
        content_page = content_collection.find_one({
            "_id": ObjectId(homepage_id),
            "post_type": "pages",
            "status": "published",
            "is_deleted": False,
        })

        # OR builder page
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


@router.get("/permalinks")
def get_permalink_settings(user=Depends(require_permission("settings.view"))):
    settings = settings_collection.find_one({"type": "permalinks"}) or {}
    return {
        key: settings.get(key, value)
        for key, value in DEFAULT_PERMALINK_SETTINGS.items()
    }


@router.get("/permalinks/public")
def get_public_permalink_settings():
    settings = settings_collection.find_one({"type": "permalinks"}) or {}
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
    allowed_structures = {"plain", "day_name", "month_name", "numeric", "post_name", "custom"}
    if structure not in allowed_structures:
        raise HTTPException(status_code=400, detail="Invalid permalink structure")

    custom_structure = str(data.get("custom_structure", "")).strip()
    if structure == "custom":
        if not custom_structure.startswith("/") or "%postname%" not in custom_structure:
            raise HTTPException(
                status_code=400,
                detail="Custom structure must start with / and include %postname%",
            )
        allowed_tokens = {
            "year", "monthnum", "day", "hour", "minute", "second",
            "post_id", "postname", "category", "author",
        }
        invalid_tokens = set(re.findall(r"%([^%]+)%", custom_structure)) - allowed_tokens
        if invalid_tokens:
            raise HTTPException(status_code=400, detail="Custom structure contains an unsupported token")

    values = {
        "type": "permalinks",
        "structure": structure,
        "custom_structure": custom_structure,
        "category_base": str(data.get("category_base", "")).strip().strip("/"),
        "tag_base": str(data.get("tag_base", "")).strip().strip("/"),
        "product_base": str(data.get("product_base", "products")).strip().strip("/") or "products",
        "updated_at": datetime.now(timezone.utc),
    }
    settings_collection.update_one(
        {"type": "permalinks"},
        {"$set": values},
        upsert=True,
    )
    return {"message": "Permalink settings updated successfully"}


@router.get("/payments")
def get_payment_settings(user=Depends(require_permission("settings.view"))):
    settings = settings_collection.find_one({"type": "payments"}) or {}
    return {
        "enabled": settings.get("enabled", False),
        "mode": settings.get("mode", "test"),
        "test_key_id": settings.get("test_key_id", ""),
        "test_key_secret_configured": bool(settings.get("test_key_secret_encrypted")),
        "live_key_id": settings.get("live_key_id", ""),
        "live_key_secret_configured": bool(settings.get("live_key_secret_encrypted")),
        "webhook_secret_configured": bool(settings.get("webhook_secret_encrypted")),
        "smtp_host": settings.get("smtp_host", ""),
        "smtp_port": settings.get("smtp_port", 587),
        "smtp_username": settings.get("smtp_username", ""),
        "smtp_password_configured": bool(settings.get("smtp_password_encrypted")),
        "smtp_from_email": settings.get("smtp_from_email", ""),
        "admin_notification_email": settings.get("admin_notification_email", ""),
    }


@router.put("/payments")
def update_payment_settings(
    data: PaymentSettingsUpdate,
    user=Depends(require_permission("settings.edit")),
):
    if not 1 <= data.smtp_port <= 65535:
        raise HTTPException(status_code=400, detail="SMTP port must be between 1 and 65535")
    if data.enabled:
        key_id = data.test_key_id if data.mode == "test" else data.live_key_id
        key_secret = data.test_key_secret if data.mode == "test" else data.live_key_secret
        existing = settings_collection.find_one({"type": "payments"}) or {}
        key_secret_present = bool(key_secret) or bool(
            existing.get(f"{data.mode}_key_secret_encrypted")
        )
        if not key_id or not key_secret_present:
            raise HTTPException(
                status_code=400,
                detail=f"Configure the Razorpay {data.mode} key ID and secret before enabling payments",
            )

    existing = settings_collection.find_one({"type": "payments"}) or {}
    values = {
        "type": "payments",
        "enabled": data.enabled,
        "mode": data.mode,
        "test_key_id": data.test_key_id.strip(),
        "live_key_id": data.live_key_id.strip(),
        "smtp_host": data.smtp_host.strip(),
        "smtp_port": data.smtp_port,
        "smtp_username": data.smtp_username.strip(),
        "smtp_from_email": data.smtp_from_email.strip(),
        "admin_notification_email": data.admin_notification_email.strip(),
        "updated_at": datetime.now(timezone.utc),
    }
    secret_fields = {
        "test_key_secret": data.test_key_secret,
        "live_key_secret": data.live_key_secret,
        "webhook_secret": data.webhook_secret,
        "smtp_password": data.smtp_password,
    }
    for field, secret in secret_fields.items():
        encrypted_field = f"{field}_encrypted"
        if secret:
            values[encrypted_field] = encrypt_secret(secret)
        elif encrypted_field in existing:
            values[encrypted_field] = existing[encrypted_field]

    settings_collection.update_one(
        {"type": "payments"},
        {"$set": values},
        upsert=True,
    )
    return {"message": "Payment settings saved successfully"}


@router.get("/payments/public")
def get_public_payment_settings():
    settings = settings_collection.find_one({"type": "payments"}) or {}
    mode = settings.get("mode", "test")
    key_id = settings.get(f"{mode}_key_id", "")
    secret_is_configured = bool(settings.get(f"{mode}_key_secret_encrypted"))
    return {
        "enabled": bool(settings.get("enabled") and key_id and secret_is_configured),
        "mode": mode,
        "key_id": key_id if settings.get("enabled") and secret_is_configured else "",
    }