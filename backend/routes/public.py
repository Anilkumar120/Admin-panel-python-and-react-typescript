from fastapi import APIRouter, HTTPException, Query
from bson import ObjectId
from datetime import datetime, timezone
from typing import Optional, List

from backend.database.connection import (
    db,
    media_collection,
    pages_collection,
    content_collection,
    products_collection,
    post_types_collection,
    settings_collection,
)

router = APIRouter(
    prefix="/api/public",
    tags=["Public Content"]
)

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
        "excerpt": (
            item.get("content", "")[:200] + "..."
            if len(item.get("content", "")) > 200
            else item.get("content", "")
        ),
        "status": item.get("status", "draft"),
        "featured_image": get_media_url(item.get("featured_image_id", ""))
        or item.get("featured_image", ""),
        "parent_id": item.get("parent_id"),
        "categories": item.get("categories", []),
        "tags": item.get("tags", []),
        "fields": item.get("fields", {}),
        "seo": item.get("seo", {}),
        "author_id": item.get("author_id", ""),
        "created_at": item.get("created_at"),
        "updated_at": item.get("updated_at"),
    }


def format_public_product(product):
    image_url = product.get("image", "") or product.get("featured_image", "")
    media_id = product.get("media_id", "")
    if media_id and ObjectId.is_valid(media_id):
        media = media_collection.find_one({
            "_id": ObjectId(media_id),
            "is_deleted": {"$ne": True},
        })
        if media:
            image_url = media.get("url", "") or image_url

    description = product.get("description", "") or product.get("content", "")
    regular_price = product.get("regular_price", product.get("price", 0))
    sale_price = product.get("sale_price")
    sale_active = sale_price is not None
    now = datetime.now(timezone.utc)
    for field, is_start in (("sale_start", True), ("sale_end", False)):
        raw_date = product.get(field)
        if not raw_date:
            continue
        try:
            boundary = datetime.fromisoformat(str(raw_date).replace("Z", "+00:00"))
        except ValueError:
            sale_active = False
            break
        if boundary.tzinfo is None:
            boundary = boundary.replace(tzinfo=timezone.utc)
        if (is_start and now < boundary) or (not is_start and now > boundary):
            sale_active = False
            break

    # Resolve gallery
    gallery = []
    for entry in product.get("gallery", []) or []:
        if not isinstance(entry, dict):
            continue
        g_media_id = entry.get("media_id", "")
        g_url = entry.get("url", "")
        if g_media_id and ObjectId.is_valid(g_media_id):
            g_media = media_collection.find_one({
                "_id": ObjectId(g_media_id),
                "is_deleted": {"$ne": True},
            })
            if g_media:
                g_url = g_media.get("url", "") or g_url
        if g_url:
            gallery.append({
                "media_id": g_media_id,
                "url": g_url,
                "alt": entry.get("alt", ""),
            })

    return {
        "id": str(product["_id"]),
        "post_type": "products",
        "title": product.get("name", "") or product.get("title", ""),
        "name": product.get("name", "") or product.get("title", ""),
        "slug": product.get("slug", "") or str(product["_id"]),
        "content": description,
        "description": description,
        "short_description": product.get("short_description", ""),
        "excerpt": product.get("short_description", "") or description[:200],
        "featured_image": image_url,
        "image": image_url,
        "gallery": gallery,
        "price": sale_price if sale_active else regular_price,
        "regular_price": regular_price,
        "sale_price": sale_price,
        "quantity": product.get("quantity", 0),
        "manage_stock": product.get("manage_stock", True),
        "stock_status": product.get(
            "stock_status",
            "in_stock" if product.get("quantity", 0) > 0 else "out_of_stock",
        ),
        "category": product.get("category", ""),
        "categories": [product.get("category", "")] if product.get("category") else [],
        "tags": product.get("tags", []),
        "brand": product.get("brand", ""),
        "sku": product.get("sku", ""),
        "barcode": product.get("barcode", ""),
        "weight": product.get("weight", 0),
        "dimensions": product.get("dimensions", {}),
        "attributes": product.get("attributes", []),
        "variations": product.get("variations", []),
        "status": product.get("status", "published"),
        "menu_order": product.get("menu_order", 0),
    }


# ============ HOMEPAGE RESOLVER ============

@router.get("/homepage")
def get_homepage():
    settings = settings_collection.find_one({"type": "reading"}) or {}
    homepage_type = settings.get("homepage_type", "latest_posts")
    homepage_id = settings.get("homepage_id", "")

    if homepage_type == "static" and homepage_id and ObjectId.is_valid(homepage_id):
        page = content_collection.find_one({
            "_id": ObjectId(homepage_id),
            "status": "published",
            "is_deleted": False,
        })
        if page:
            raw_slug = page.get("slug", "")
            normalized_slug = "" if raw_slug in ["home", "index"] else raw_slug
            return {
                "type": "page",
                "id": str(page["_id"]),
                "slug": normalized_slug,
                "title": page.get("title", ""),
                "post_type": page.get("post_type", "pages"),
            }

        builder_page = pages_collection.find_one({
            "_id": ObjectId(homepage_id),
            "status": "published",
        })
        if builder_page:
            raw_slug = builder_page.get("slug", "")
            normalized_slug = "" if raw_slug in ["home", "index"] else raw_slug
            return {
                "type": "builder",
                "id": str(builder_page["_id"]),
                "slug": normalized_slug,
                "title": builder_page.get("title", ""),
            }

    return {"type": "latest_posts", "slug": ""}


# ============ HOMEPAGE FULL DATA ============

@router.get("/homepage-full")
def get_homepage_full():
    settings = settings_collection.find_one({"type": "reading"}) or {}
    homepage_type = settings.get("homepage_type", "latest_posts")
    homepage_id = settings.get("homepage_id", "")

    if homepage_type == "static" and homepage_id and ObjectId.is_valid(homepage_id):
        page = content_collection.find_one({
            "_id": ObjectId(homepage_id),
            "status": "published",
            "is_deleted": False,
        })
        if page:
            builder_page = pages_collection.find_one({
                "slug": page.get("slug", ""),
                "status": "published",
                "template_type": {"$in": ["page", None]},
            })
            if builder_page:
                return {
                    "id": str(builder_page["_id"]),
                    "title": builder_page.get("title", ""),
                    "slug": builder_page.get("slug", ""),
                    "layout": builder_page.get("layout", []),
                    "globals": builder_page.get("globals", {}),
                    "show_title": builder_page.get("show_title", True),
                    "source_type": "builder",
                }
            formatted = format_content_item(page)
            formatted["source_type"] = "content"
            return formatted

        builder_page = pages_collection.find_one({
            "_id": ObjectId(homepage_id),
            "status": "published",
        })
        if builder_page:
            return {
                "id": str(builder_page["_id"]),
                "title": builder_page.get("title", ""),
                "slug": builder_page.get("slug", ""),
                "layout": builder_page.get("layout", []),
                "globals": builder_page.get("globals", {}),
                "show_title": builder_page.get("show_title", True),
                "source_type": "builder",
            }

    return {"source_type": "latest_posts"}


# ============ PUBLIC PRODUCTS ============

@router.get("/products")
def get_public_products(
    limit: int = Query(12, ge=1, le=100),
    category: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    sort: Optional[str] = Query(None),
):
    query = {
        "is_deleted": {"$ne": True},
        "$or": [{"status": "published"}, {"status": {"$exists": False}}],
        "visibility": {"$nin": ["hidden", "search"]},
        "catalog_visibility": {"$nin": ["hidden", "search"]},
    }
    if category:
        query["category"] = category
    if tag:
        query["tags"] = tag

    sort_field = [("name", 1)]
    if sort == "recent":
        sort_field = [("_id", -1)]
    elif sort == "price_low":
        sort_field = [("price", 1)]
    elif sort == "price_high":
        sort_field = [("price", -1)]

    products = list(products_collection.find(query).sort(sort_field).limit(limit))
    return {"products": [format_public_product(product) for product in products]}


@router.get("/products/{product_id}/related")
def get_related_products(product_id: str, limit: int = Query(4, ge=1, le=20)):
    if not ObjectId.is_valid(product_id):
        raise HTTPException(status_code=400, detail="Invalid product ID")

    product = products_collection.find_one({
        "_id": ObjectId(product_id),
        "is_deleted": {"$ne": True},
    })
    if not product:
        return {"products": []}

    base = {
        "_id": {"$ne": ObjectId(product_id)},
        "is_deleted": {"$ne": True},
        "$or": [{"status": "published"}, {"status": {"$exists": False}}],
    }

    query = base
    if product.get("category"):
        query = {**base, "category": product.get("category")}

    related = list(products_collection.find(query).limit(limit))
    if len(related) < limit:
        used_ids = [r["_id"] for r in related] + [ObjectId(product_id)]
        more = list(products_collection.find({
            **base,
            "_id": {"$nin": used_ids},
        }).limit(limit - len(related)))
        related.extend(more)

    return {"products": [format_public_product(p) for p in related]}


# ============ PERMALINK RESOLVER ============

def _find_matching_template(template_type: str, url_path: str, post_type: str, slug: str, specific_id: str = ""):
    try:
        from backend.routes.header_footer import build_page_context, template_matches
    except Exception:
        return None

    ctx = build_page_context(url_path, post_type, slug)
    if specific_id:
        ctx["specific_id"] = specific_id
        ctx["content_id"] = specific_id

    templates = list(pages_collection.find({
        "template_type": template_type,
        "status": "published",
    }).sort("conditions.priority", -1))

    if not templates:
        return None

    best = None
    best_priority = -999999
    for t in templates:
        try:
            if template_matches(t, ctx):
                p = (t.get("conditions") or {}).get("priority", 0)
                if p > best_priority:
                    best_priority = p
                    best = t
        except Exception:
            continue

    if not best:
        best = next((t for t in templates if t.get("is_default")), None)

    if not best:
        return None

    return {
        "id": str(best["_id"]),
        "title": best.get("title", ""),
        "slug": best.get("slug", ""),
        "layout": best.get("layout", []),
        "globals": best.get("globals", {}),
        "template_type": template_type,
        "conditions": best.get("conditions", {}),
    }


@router.get("/resolve")
def resolve_permalink(
    slug: str = Query(...),
    post_type: Optional[str] = Query(None),
):
    if not slug:
        raise HTTPException(status_code=400, detail="Slug required")

    # 1. Builder page
    builder = pages_collection.find_one({
        "slug": slug,
        "status": "published",
        "template_type": {"$in": ["page", None]},
    })
    if not builder:
        builder = pages_collection.find_one({
            "slug": slug,
            "status": "published",
        })

    if builder and (builder.get("template_type") in ["page", None]):
        return {
            "type": "builder",
            "id": str(builder["_id"]),
            "slug": builder.get("slug", ""),
            "title": builder.get("title", ""),
            "layout": builder.get("layout", []),
            "globals": builder.get("globals", {}),
            "show_title": builder.get("show_title", True),
        }

    # 2. Content items
    query = {"slug": slug, "status": "published", "is_deleted": False}
    if post_type:
        query["post_type"] = post_type

    item = content_collection.find_one(query)
    if item:
        formatted = format_content_item(item)
        t_type = "single_post" if item.get("post_type") == "posts" else "single_page"
        try:
            tpl = _find_matching_template(
                t_type,
                f"/{item.get('post_type', '')}/{item.get('slug', '')}",
                item.get("post_type", ""),
                item.get("slug", ""),
                specific_id=str(item["_id"]),
            )
            if tpl:
                formatted["template"] = tpl
        except Exception as e:
            print("POST TPL ERROR:", e)
        return formatted

    # 3. Products
    product = None
    if not post_type or post_type in ["products", "product"]:
        product = products_collection.find_one({
            "slug": slug,
            "is_deleted": {"$ne": True},
            "$or": [{"status": "published"}, {"status": {"$exists": False}}],
        })
        if product is None and ObjectId.is_valid(slug):
            product = products_collection.find_one({
                "_id": ObjectId(slug),
                "is_deleted": {"$ne": True},
                "$or": [{"status": "published"}, {"status": {"$exists": False}}],
            })

    if product:
        formatted = format_public_product(product)
        try:
            tpl = _find_matching_template(
                "single_product",
                f"/products/{product.get('slug', '')}",
                "products",
                product.get("slug", ""),
                specific_id=str(product["_id"]),
            )
            if tpl:
                formatted["template"] = tpl
        except Exception as e:
            print("PRODUCT TPL ERROR:", e)
        return formatted

    raise HTTPException(status_code=404, detail="Content not found")


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
    query = {"post_type": "posts", "status": "published", "is_deleted": False}
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
        content_collection.find(query).sort("created_at", -1).skip(skip).limit(limit)
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

    formatted = format_content_item(post)
    try:
        tpl = _find_matching_template(
            "single_post",
            f"/posts/{post.get('slug', '')}",
            "posts",
            post.get("slug", ""),
            specific_id=str(post["_id"]),
        )
        if tpl:
            formatted["template"] = tpl
    except Exception as e:
        print("SINGLE POST TPL ERROR:", e)
    return formatted


@router.get("/posts/{slug}/related")
def get_related_posts(slug: str, limit: int = Query(3, ge=1, le=10)):
    post = content_collection.find_one({
        "post_type": "posts",
        "slug": slug,
        "status": "published",
    })
    if not post:
        return {"posts": []}

    related = list(content_collection.find({
        "post_type": "posts",
        "_id": {"$ne": post["_id"]},
        "categories": {"$in": post.get("categories", [])},
        "status": "published",
    }).limit(limit))

    if len(related) < limit:
        used = [r["_id"] for r in related] + [post["_id"]]
        more = list(content_collection.find({
            "post_type": "posts",
            "_id": {"$nin": used},
            "status": "published",
        }).limit(limit - len(related)))
        related.extend(more)

    return {"posts": [format_content_item(p) for p in related]}


# ============ PUBLIC CUSTOM ITEMS ============

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
        content_collection.find(query).sort("created_at", -1).skip(skip).limit(limit)
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


# ============ ARCHIVE LISTING ============

@router.get("/archive/{post_type}")
def archive_listing(
    post_type: str,
    page: int = Query(1, ge=1),
    limit: int = Query(12, ge=1, le=100),
    category: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
):
    if post_type in ("products", "product"):
        query = {
            "is_deleted": {"$ne": True},
            "$or": [{"status": "published"}, {"status": {"$exists": False}}],
        }
        if category:
            query["category"] = category
        if tag:
            query["tags"] = tag

        total = products_collection.count_documents(query)
        items = list(
            products_collection.find(query)
            .skip((page - 1) * limit)
            .limit(limit)
        )
        return {
            "items": [format_public_product(p) for p in items],
            "total": total,
            "page": page,
            "pages": (total + limit - 1) // limit,
        }

    query = {"post_type": post_type, "status": "published", "is_deleted": False}
    if category:
        query["categories"] = category
    if tag:
        query["tags"] = tag

    total = content_collection.count_documents(query)
    items = list(
        content_collection.find(query)
        .sort("created_at", -1)
        .skip((page - 1) * limit)
        .limit(limit)
    )
    return {
        "items": [format_content_item(i) for i in items],
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit,
    }


# ============ PUBLIC HEADER/FOOTER ============

def _get_active_template(template_type, url_path, post_type, slug):
    try:
        from backend.routes.header_footer import build_page_context, template_matches
    except Exception:
        return {"template": None}

    ctx = build_page_context(url_path, post_type, slug)

    templates = list(pages_collection.find({
        "template_type": template_type,
        "status": "published",
    }).sort("conditions.priority", -1))

    if not templates:
        return {"template": None}

    best = None
    best_priority = -999999

    for t in templates:
        try:
            if template_matches(t, ctx):
                p = (t.get("conditions") or {}).get("priority", 0)
                if p > best_priority:
                    best_priority = p
                    best = t
        except Exception:
            continue

    if not best:
        best = next((t for t in templates if t.get("is_default")), templates[0] if templates else None)

    if not best:
        return {"template": None}

    return {
        "template": {
            "id": str(best["_id"]),
            "title": best.get("title", ""),
            "layout": best.get("layout", []),
            "globals": best.get("globals", {}),
            "template_type": template_type,
        },
        "context": ctx,
    }


@router.get("/header")
def get_public_header(
    url_path: str = Query("/"),
    post_type: Optional[str] = Query(None),
    slug: Optional[str] = Query(None),
):
    return _get_active_template("header", url_path, post_type, slug)


@router.get("/footer")
def get_public_footer(
    url_path: str = Query("/"),
    post_type: Optional[str] = Query(None),
    slug: Optional[str] = Query(None),
):
    return _get_active_template("footer", url_path, post_type, slug)


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