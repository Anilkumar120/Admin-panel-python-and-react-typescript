from fastapi import APIRouter, Form, HTTPException, Depends
from bson import ObjectId
from pydantic import BaseModel

from backend.database.connection import (
    content_collection,
    settings_collection,
    pages_collection,
)

from backend.utils.permissions import require_permission


router = APIRouter(
    prefix="/api/settings",
    tags=["Settings"]
)


DEFAULT_SETTINGS = {
    "homepage_type": "latest_posts",
    "homepage_id": "",
    "posts_page_id": "",
    "search_engine_visibility": False,
}

class SiteIdentityUpdate(BaseModel):
    logo_url: str = ""
    favicon_url: str = ""


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
        "search_engine_visibility": settings.get("search_engine_visibility", False),
    }


@router.put("/reading")
def update_reading_settings(
    homepage_type: str = Form(...),
    homepage_id: str = Form(""),
    posts_page_id: str = Form(""),
    search_engine_visibility: bool = Form(False),
    user=Depends(require_permission("settings.edit"))
):
    if homepage_type not in ["latest_posts", "static"]:
        raise HTTPException(status_code=400, detail="Invalid homepage type")

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
                "search_engine_visibility": search_engine_visibility,
            }
        },
        upsert=True,
    )

    return {"message": "Reading settings updated successfully"}