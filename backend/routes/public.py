
from fastapi import APIRouter, HTTPException, Query
from bson import ObjectId
from datetime import datetime, timezone
from typing import Optional

from backend.database.connection import (
    db,
    media_collection,
    pages_collection,
    content_collection,
    products_collection,
    post_types_collection,
    settings_collection,
    menus_collection,
)

router = APIRouter(
    prefix="/api/public",
    tags=["Public Content"],
)

post_types_collection = db["post_types"]
taxonomies_collection = db["taxonomies"]


# ============ MEDIA ============

def get_media_url(media_id):
    if not media_id or not ObjectId.is_valid(str(media_id)):
        return ""

    media = media_collection.find_one({
        "_id": ObjectId(str(media_id)),
        "is_deleted": {"$ne": True},
    })

    return media.get("url", "") if media else ""


# ============ CONTENT FORMATTER ============

def format_content_item(item, permalink_settings=None):
    if permalink_settings is None:
        permalink_settings = (
            settings_collection.find_one({"type": "permalinks"}) or {}
        )

    structure = permalink_settings.get("structure", "post_name")
    slug = item.get("slug", "")
    post_type = item.get("post_type", "")

    if post_type == "posts":
        created = item.get("created_at")

        if not isinstance(created, datetime):
            try:
                created = datetime.fromisoformat(
                    str(created).replace("Z", "+00:00")
                )
            except (TypeError, ValueError):
                created = None

        if structure == "plain":
            permalink = f"/?p={item.get('_id', '')}"

        elif structure == "day_name" and created:
            permalink = f"/{created:%Y/%m/%d}/{slug}/"

        elif structure == "month_name" and created:
            permalink = f"/{created:%Y/%m}/{slug}/"

        elif structure == "numeric":
            permalink = f"/archives/{item.get('_id', '')}"

        elif structure == "custom":
            permalink = str(
                permalink_settings.get(
                    "custom_structure",
                    "/%postname%/",
                )
            )

            tokens = {
                "%year%": f"{created:%Y}" if created else "",
                "%monthnum%": f"{created:%m}" if created else "",
                "%day%": f"{created:%d}" if created else "",
                "%hour%": f"{created:%H}" if created else "",
                "%minute%": f"{created:%M}" if created else "",
                "%second%": f"{created:%S}" if created else "",
                "%post_id%": str(item.get("_id", "")),
                "%postname%": slug,
                "%category%": (item.get("categories") or [""])[0],
                "%author%": str(item.get("author_slug", "author")),
            }

            for token, value in tokens.items():
                permalink = permalink.replace(token, str(value))

        else:
            permalink = f"/{slug}/"

    elif post_type == "pages":
        permalink = f"/{slug}/"

    else:
        permalink = f"/{post_type}/{slug}/"

    content = item.get("content", "") or ""

    return {
        "id": str(item["_id"]),
        "post_type": post_type,
        "title": item.get("title", ""),
        "slug": slug,
        "permalink": permalink,
        "content": content,
        "excerpt": content[:200] + "..." if len(content) > 200 else content,
        "status": item.get("status", "draft"),
        "featured_image": (
            get_media_url(item.get("featured_image_id", ""))
            or item.get("featured_image", "")
        ),
        "parent_id": item.get("parent_id"),
        "categories": item.get("categories", []),
        "tags": item.get("tags", []),
        "fields": item.get("fields", {}),
        "seo": item.get("seo", {}),
        "author_id": item.get("author_id", ""),
        "created_at": item.get("created_at"),
        "updated_at": item.get("updated_at"),
    }


# ============ PRODUCT FORMATTER ============

def format_public_product(product, permalink_settings=None):
    image_url = (
        product.get("image", "")
        or product.get("featured_image", "")
    )

    media_id = product.get("media_id", "")

    if media_id and ObjectId.is_valid(str(media_id)):
        media = media_collection.find_one({
            "_id": ObjectId(str(media_id)),
            "is_deleted": {"$ne": True},
        })

        if media:
            image_url = media.get("url", "") or image_url

    description = (
        product.get("description", "")
        or product.get("content", "")
        or ""
    )

    regular_price = product.get(
        "regular_price",
        product.get("price", 0),
    )
    sale_price = product.get("sale_price")
    sale_active = sale_price is not None
    current_time = datetime.now(timezone.utc)

    for field, is_start in (
        ("sale_start", True),
        ("sale_end", False),
    ):
        raw_date = product.get(field)

        if not raw_date:
            continue

        try:
            boundary = datetime.fromisoformat(
                str(raw_date).replace("Z", "+00:00")
            )
        except (TypeError, ValueError):
            sale_active = False
            break

        if boundary.tzinfo is None:
            boundary = boundary.replace(tzinfo=timezone.utc)

        if (
            (is_start and current_time < boundary)
            or (not is_start and current_time > boundary)
        ):
            sale_active = False
            break

    # Resolve product gallery images.
    gallery = []

    for entry in product.get("gallery", []) or []:
        if not isinstance(entry, dict):
            continue

        gallery_media_id = entry.get("media_id", "")
        gallery_url = entry.get("url", "")

        if (
            gallery_media_id
            and ObjectId.is_valid(str(gallery_media_id))
        ):
            gallery_media = media_collection.find_one({
                "_id": ObjectId(str(gallery_media_id)),
                "is_deleted": {"$ne": True},
            })

            if gallery_media:
                gallery_url = (
                    gallery_media.get("url", "")
                    or gallery_url
                )

        if gallery_url:
            gallery.append({
                "media_id": gallery_media_id,
                "url": gallery_url,
                "alt": entry.get("alt", ""),
            })

    if permalink_settings is None:
        permalink_settings = (
            settings_collection.find_one({"type": "permalinks"}) or {}
        )

    product_base = (
        permalink_settings.get("product_base") or "products"
    ).strip("/")

    product_slug = product.get("slug") or str(product["_id"])

    return {
        "id": str(product["_id"]),
        "post_type": "products",
        "title": product.get("name", "") or product.get("title", ""),
        "name": product.get("name", "") or product.get("title", ""),
        "slug": product_slug,
        "permalink": f"/{product_base}/{product_slug}/",
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
        "categories": (
            [product.get("category", "")]
            if product.get("category")
            else []
        ),
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


# ============ TEMPLATE MATCHING ============

def _find_matching_template(
    template_type: str,
    url_path: str,
    post_type: str,
    slug: str,
    specific_id: str = "",
):
    from backend.routes.header_footer import (
        build_page_context,
        template_matches,
    )

    ctx = build_page_context(url_path, post_type, slug)

    if specific_id:
        ctx["specific_id"] = str(specific_id)
        ctx["content_id"] = str(specific_id)

    templates = list(
        pages_collection.find({
            "template_type": template_type,
            "status": "published",
        }).sort("conditions.priority", -1)
    )

    best = None
    best_priority = -999999

    for template in templates:
        try:
            if not template_matches(template, ctx):
                continue

            priority = (
                (template.get("conditions") or {}).get("priority", 0)
                or 0
            )

            try:
                priority = int(priority)
            except (TypeError, ValueError):
                priority = 0

            if best is None or priority > best_priority:
                best = template
                best_priority = priority

        except Exception as exc:
            print("TEMPLATE MATCH ERROR:", exc)

    if best is None:
        best = next(
            (
                template
                for template in templates
                if template.get("is_default")
            ),
            None,
        )

    if best is None:
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
        "$or": [
            {"status": "published"},
            {"status": {"$exists": False}},
        ],
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

    products = list(
        products_collection.find(query).sort(sort_field).limit(limit)
    )

    permalink_settings = (
        settings_collection.find_one({"type": "permalinks"}) or {}
    )

    return {
        "products": [
            format_public_product(product, permalink_settings)
            for product in products
        ]
    }


@router.get("/products/{product_id}/related")
def get_related_products(
    product_id: str,
    limit: int = Query(4, ge=1, le=20),
):
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
        "$or": [
            {"status": "published"},
            {"status": {"$exists": False}},
        ],
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

    permalink_settings = (
        settings_collection.find_one({"type": "permalinks"}) or {}
    )

    return {
        "products": [
            format_public_product(product, permalink_settings)
            for product in related
        ]
    }


# ============ PUBLIC MENUS ============

@router.get("/menus/{menu_id}")
def get_public_menu(menu_id: str):
    if not ObjectId.is_valid(menu_id):
        raise HTTPException(status_code=400, detail="Invalid menu ID")

    menu = menus_collection.find_one({"_id": ObjectId(menu_id)})

    if not menu:
        raise HTTPException(status_code=404, detail="Menu not found")

    return {
        "id": str(menu["_id"]),
        "name": menu.get("name", ""),
        "items": menu.get("items", []),
    }


# ============ PERMALINK RESOLVER ============

@router.get("/resolve")
def resolve_permalink(
    slug: str = Query(""),
    post_type: Optional[str] = Query(None),
    url_path: Optional[str] = Query(None),
    post_id: Optional[str] = Query(None),
):
    url_path = url_path or ""
    path_parts = [part for part in url_path.split("/") if part]

    if not slug and path_parts:
        slug = path_parts[-1]

    if (
        not post_id
        and path_parts
        and path_parts[0] == "archives"
        and ObjectId.is_valid(path_parts[-1])
    ):
        post_id = path_parts[-1]

    # Resolve numeric/archive post IDs.
    if post_id and ObjectId.is_valid(post_id):
        item = content_collection.find_one({
            "_id": ObjectId(post_id),
            "status": "published",
            "is_deleted": False,
        })

        if item:
            return format_content_item(item)

    if not slug:
        raise HTTPException(status_code=400, detail="Slug required")

    permalink_settings = (
        settings_collection.find_one({"type": "permalinks"}) or {}
    )

    product_base = (
        permalink_settings.get("product_base") or "products"
    ).strip("/")

    # Determine content type from the URL.
    if path_parts and (
        path_parts[0] == product_base
        or path_parts[0] in {"product", "products"}
    ):
        post_type = "products"

    elif path_parts and path_parts[0] in {"blog", "posts"}:
        post_type = "posts"

    elif path_parts and path_parts[0].isdigit():
        post_type = "posts"

    # 1. Resolve products first when the URL explicitly identifies a product.
    # This prevents a same-slug builder page from shadowing a product.
    product = None

    if not post_type or post_type in ("product", "products"):
        product_query = {
            "slug": slug,
            "is_deleted": {"$ne": True},
            "$or": [
                {"status": "published"},
                {"status": {"$exists": False}},
            ],
        }

        product = products_collection.find_one(product_query)

        if product is None and ObjectId.is_valid(slug):
            product = products_collection.find_one({
                "_id": ObjectId(slug),
                "is_deleted": {"$ne": True},
                "$or": [
                    {"status": "published"},
                    {"status": {"$exists": False}},
                ],
            })

    if product:
        formatted = format_public_product(
            product,
            permalink_settings,
        )

        try:
            product_slug = (
                product.get("slug") or str(product["_id"])
            )

            # Use the configured product URL base instead of hardcoding
            # /products/, so custom product permalinks work on Vercel too.
            product_path = f"/{product_base}/{product_slug}/"

            template = _find_matching_template(
                template_type="single_product",
                url_path=product_path,
                post_type="products",
                slug=product_slug,
                specific_id=str(product["_id"]),
            )

            if template:
                formatted["template"] = template

        except Exception as exc:
            # A template error must not prevent the product response.
            print("PRODUCT TPL ERROR:", exc)

        return formatted

    # 2. Builder page
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

    if builder and builder.get("template_type") in ("page", None):
        return {
            "type": "builder",
            "id": str(builder["_id"]),
            "slug": builder.get("slug", ""),
            "title": builder.get("title", ""),
            "layout": builder.get("layout", []),
            "globals": builder.get("globals", {}),
            "show_title": builder.get("show_title", True),
        }

    # 3. Content items: pages, posts, and custom post types.
    query = {
        "slug": slug,
        "status": "published",
        "is_deleted": False,
    }

    if post_type and post_type not in {"product", "products"}:
        query["post_type"] = post_type

    item = content_collection.find_one(query)

    if not item and (not post_type or url_path):
        item = content_collection.find_one({
            "slug": slug,
            "status": "published",
            "is_deleted": False,
        })

    if item:
        formatted = format_content_item(item)

        item_type = item.get("post_type", "")
        template_type = (
            "single_post"
            if item_type == "posts"
            else "single_page"
        )

        try:
            template = _find_matching_template(
                template_type=template_type,
                url_path=f"/{item_type}/{item.get('slug', '')}/",
                post_type=item_type,
                slug=item.get("slug", ""),
                specific_id=str(item["_id"]),
            )

            if template:
                formatted["template"] = template

        except Exception as exc:
            print("POST TPL ERROR:", exc)

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

    return {
        "pages": [format_content_item(page) for page in pages]
    }


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
    limit: Optional[int] = Query(None, ge=1, le=100),
    category: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
):
    if limit is None:
        reading_settings = (
            settings_collection.find_one({"type": "reading"}) or {}
        )
        limit = int(reading_settings.get("posts_per_page", 10))

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

    permalink_settings = (
        settings_collection.find_one({"type": "permalinks"}) or {}
    )

    return {
        "posts": [
            format_content_item(post, permalink_settings)
            for post in posts
        ],
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
        template = _find_matching_template(
            template_type="single_post",
            url_path=f"/posts/{post.get('slug', '')}/",
            post_type="posts",
            slug=post.get("slug", ""),
            specific_id=str(post["_id"]),
        )

        if template:
            formatted["template"] = template

    except Exception as exc:
        print("SINGLE POST TPL ERROR:", exc)

    return formatted


@router.get("/posts/{slug}/related")
def get_related_posts(
    slug: str,
    limit: int = Query(3, ge=1, le=10),
):
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
        used = [item["_id"] for item in related] + [post["_id"]]

        more = list(content_collection.find({
            "post_type": "posts",
            "_id": {"$nin": used},
            "status": "published",
        }).limit(limit - len(related)))

        related.extend(more)

    return {
        "posts": [format_content_item(item) for item in related]
    }


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
        content_collection.find(query)
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
    )

    return {
        "items": [format_content_item(item) for item in items],
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
            "$or": [
                {"status": "published"},
                {"status": {"$exists": False}},
            ],
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
            "items": [format_public_product(item) for item in items],
            "total": total,
            "page": page,
            "pages": (total + limit - 1) // limit,
        }

    query = {
        "post_type": post_type,
        "status": "published",
        "is_deleted": False,
    }

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
        "items": [format_content_item(item) for item in items],
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit,
    }


# ============ PUBLIC HEADER / FOOTER ============

def _get_active_template(template_type, url_path, post_type, slug):
    try:
        from backend.routes.header_footer import (
            build_page_context,
            template_matches,
        )
    except Exception as exc:
        print("HEADER/FOOTER IMPORT ERROR:", exc)
        return {"template": None}

    ctx = build_page_context(url_path, post_type, slug)

    templates = list(
        pages_collection.find({
            "template_type": template_type,
            "status": "published",
        }).sort("conditions.priority", -1)
    )

    if not templates:
        return {"template": None, "context": ctx}

    best = None
    best_priority = -999999

    for template in templates:
        try:
            if not template_matches(template, ctx):
                continue

            priority = (
                (template.get("conditions") or {}).get("priority", 0)
                or 0
            )

            try:
                priority = int(priority)
            except (TypeError, ValueError):
                priority = 0

            if best is None or priority > best_priority:
                best = template
                best_priority = priority

        except Exception as exc:
            print("HEADER/FOOTER MATCH ERROR:", exc)

    if best is None:
        best = next(
            (
                template
                for template in templates
                if template.get("is_default")
            ),
            templates[0] if templates else None,
        )

    if best is None:
        return {"template": None, "context": ctx}

    return {
        "template": {
            "id": str(best["_id"]),
            "title": best.get("title", ""),
            "layout": best.get("layout", []),
            "globals": best.get("globals", {}),
            "template_type": template_type,
            "conditions": best.get("conditions", {}),
        },
        "context": ctx,
    }


@router.get("/header")
def get_public_header(
    url_path: str = Query("/"),
    post_type: Optional[str] = Query(None),
    slug: Optional[str] = Query(None),
):
    return _get_active_template(
        "header",
        url_path,
        post_type,
        slug,
    )


@router.get("/footer")
def get_public_footer(
    url_path: str = Query("/"),
    post_type: Optional[str] = Query(None),
    slug: Optional[str] = Query(None),
):
    return _get_active_template(
        "footer",
        url_path,
        post_type,
        slug,
    )


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
                "id": str(category["_id"]),
                "name": category.get("name", ""),
                "slug": category.get("slug", ""),
                "parent_id": category.get("parent_id"),
            }
            for category in categories
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
                "id": str(tag["_id"]),
                "name": tag.get("name", ""),
                "slug": tag.get("slug", ""),
            }
            for tag in tags
        ]
    }
