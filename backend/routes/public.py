from fastapi import APIRouter, HTTPException, Query
from bson import ObjectId
from typing import Optional, List

from backend.database.connection import (
    db,
    media_collection,
    pages_collection,
)

router = APIRouter(
    prefix="/api/public",
    tags=["Public Content"]
)

content_collection = db["content"]
post_types_collection = db["post_types"]
taxonomies_collection = db["taxonomies"]


def get_media_url(media_id):
    if not media_id or not ObjectId.is_valid(media_id):
        return ""
    media = media_collection.find_one({"_id": ObjectId(media_id)})
    return media.get("url", "") if media else ""


def format_content_item(item):
    return {
        "id": str(item["_id"]),
        "post_type": item.get("post_type", ""),
        "title": item.get("title", ""),
        "slug": item.get("slug", ""),
        "content": item.get("content", ""),
        "excerpt": (item.get("content", "")[:200] + "...") if len(item.get("content", "")) > 200 else item.get("content", ""),
        "status": item.get("status", "draft"),
        "featured_image": get_media_url(item.get("featured_image_id", "")) or item.get("featured_image", ""),
        "parent_id": item.get("parent_id"),
        "categories": item.get("categories", []),
        "tags": item.get("tags", []),
        "fields": item.get("fields", {}),
        "seo": item.get("seo", {}),
        "author_id": item.get("author_id", ""),
        "created_at": item.get("created_at"),
        "updated_at": item.get("updated_at"),
    }


# ============ PUBLIC POST TYPES ============
@router.get("/post-types")
def get_public_post_types():
    post_types = list(
        post_types_collection.find({
            "is_deleted": False,
            "is_active": True,
        }).sort("name", 1)
    )

    return {
        "post_types": [
            {
                "id": str(pt["_id"]),
                "name": pt.get("name", ""),
                "slug": pt.get("slug", ""),
                "icon": pt.get("icon", "📄"),
                "features": pt.get("features", {}),
            }
            for pt in post_types
        ]
    }


# ============ PUBLIC PAGES ============
@router.get("/pages")
def get_public_pages():
    pages = list(
        content_collection.find({
            "post_type": "pages",
            "status": "published",
            "is_deleted": False,
        }).sort("title", 1)
    )

    return {"pages": [format_content_item(p) for p in pages]}


@router.get("/pages/{slug}")
def get_public_page_by_slug(slug: str):
    page = content_collection.find_one({
        "post_type": "pages",
        "slug": slug,
        "status": "published",
        "is_deleted": False,
    })

    if not page:
        raise HTTPException(status_code=404, detail="Page not found")

    return format_content_item(page)


# ============ PUBLIC POSTS ============
@router.get("/posts")
def get_public_posts(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    category: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
):
    query = {
        "post_type": "posts",
        "status": "published",
        "is_deleted": False,
    }

    if category:
        query["categories"] = category

    if tag:
        query["tags"] = tag

    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"content": {"$regex": search, "$options": "i"}},
        ]

    total = content_collection.count_documents(query)
    skip = (page - 1) * limit

    posts = list(
        content_collection.find(query)
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
    )

    return {
        "posts": [format_content_item(p) for p in posts],
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit,
    }


@router.get("/posts/{slug}")
def get_public_post_by_slug(slug: str):
    post = content_collection.find_one({
        "post_type": "posts",
        "slug": slug,
        "status": "published",
        "is_deleted": False,
    })

    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    return format_content_item(post)


# ============ PUBLIC CUSTOM POST TYPE ITEMS ============
@router.get("/items/{post_type_slug}")
def get_public_items(
    post_type_slug: str,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
):
    query = {
        "post_type": post_type_slug,
        "status": "published",
        "is_deleted": False,
    }

    total = content_collection.count_documents(query)
    skip = (page - 1) * limit

    items = list(
        content_collection.find(query)
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
    )

    return {
        "items": [format_content_item(i) for i in items],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.get("/items/{post_type_slug}/{slug}")
def get_public_item_by_slug(post_type_slug: str, slug: str):
    item = content_collection.find_one({
        "post_type": post_type_slug,
        "slug": slug,
        "status": "published",
        "is_deleted": False,
    })

    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    return format_content_item(item)


# ============ PUBLIC PAGE BUILDER PAGES ============
@router.get("/builder-pages")
def get_public_builder_pages():
    pages = list(
        pages_collection.find({
            "status": "published",
        }).sort("updated_at", -1)
    )

    return {
        "pages": [
            {
                "id": str(p["_id"]),
                "title": p.get("title", ""),
                "slug": p.get("slug", ""),
                "status": p.get("status", "draft"),
                "updated_at": p.get("updated_at"),
            }
            for p in pages
        ]
    }


@router.get("/builder-pages/{slug}")
def get_public_builder_page(slug: str):
    page = pages_collection.find_one({
        "slug": slug,
        "status": "published",
    })

    if not page:
        raise HTTPException(status_code=404, detail="Page not found")

    return {
        "id": str(page["_id"]),
        "title": page.get("title", ""),
        "slug": page.get("slug", ""),
        "layout": page.get("layout", []),
        "globals": page.get("globals", {}),
        "status": page.get("status", "draft"),
        "show_title": page.get("show_title", True),
        "created_at": page.get("created_at"),
        "updated_at": page.get("updated_at"),
    }


# ============ PUBLIC TAXONOMIES ============
@router.get("/taxonomies/{post_type_slug}/categories")
def get_public_categories(post_type_slug: str):
    categories = list(
        taxonomies_collection.find({
            "post_type_slug": post_type_slug,
            "type": "category",
            "is_deleted": False,
        }).sort("name", 1)
    )

    return {
        "categories": [
            {
                "id": str(c["_id"]),
                "name": c.get("name", ""),
                "slug": c.get("slug", ""),
                "parent_id": c.get("parent_id"),
            }
            for c in categories
        ]
    }


@router.get("/taxonomies/{post_type_slug}/tags")
def get_public_tags(post_type_slug: str):
    tags = list(
        taxonomies_collection.find({
            "post_type_slug": post_type_slug,
            "type": "tag",
            "is_deleted": False,
        }).sort("name", 1)
    )

    return {
        "tags": [
            {
                "id": str(t["_id"]),
                "name": t.get("name", ""),
                "slug": t.get("slug", ""),
            }
            for t in tags
        ]
    }