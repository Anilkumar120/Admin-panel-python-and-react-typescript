
from fastapi import APIRouter, HTTPException, Depends, Query
from bson import ObjectId
from datetime import datetime, timezone
from typing import Optional, List
from pydantic import BaseModel, ConfigDict

from backend.database.connection import (
    pages_collection,
    content_collection,
    products_collection,
    post_types_collection,
    taxonomies_collection,
)
from backend.utils.permissions import require_permission

router = APIRouter(
    prefix="/api/header-footer",
    tags=["Header/Footer Builder"]
)

TEMPLATE_TYPES = {
    "header", "footer", "single_product", "single_post", "single_page",
    "archive", "search_results", "loop_item", "error_404", "shop", "cart",
    "checkout", "my_account", "order_received",
}


def now():
    return datetime.now(timezone.utc)


# ============ PYDANTIC MODELS ============

class TemplateConditions(BaseModel):
    model_config = ConfigDict(extra="allow")
    include: Optional[List[str]] = []
    exclude: Optional[List[str]] = []
    specific_pages: Optional[List[str]] = []
    specific_posts: Optional[List[str]] = []
    specific_products: Optional[List[str]] = []
    specific_items: Optional[List[str]] = []
    post_types: Optional[List[str]] = []
    singles: Optional[List[str]] = []
    archives: Optional[List[str]] = []
    taxonomies: Optional[List[str]] = []
    priority: Optional[int] = 0


class SaveTemplateData(BaseModel):
    model_config = ConfigDict(extra="allow")
    title: str
    slug: str
    layout: List[dict] = []
    status: str = "draft"
    globals: Optional[dict] = None
    template_type: str
    conditions: Optional[TemplateConditions] = None
    is_default: Optional[bool] = False


# ============ CONTEXT BUILDER ============

def build_page_context(url_path, post_type=None, slug=None):
    url_path = str(url_path or "/").split("?", 1)[0]
    normalized_path = url_path.rstrip("/") or "/"

    ctx = {
        "url": url_path,
        "post_type": post_type or "",
        "slug": slug or "",
        "is_singular": bool(slug),
        "is_archive": False,
        "is_home": False,
        "is_front_page": False,
        "is_404": False,
        "is_search": False,
        "is_blog": False,
        "content_id": None,
        "specific_id": "",
        "taxonomy": None,
    }

    if normalized_path in ["/", "/home"]:
        ctx["is_home"] = True
        ctx["is_front_page"] = True

    if normalized_path == "/blog" or normalized_path.startswith("/blog/"):
        ctx["is_blog"] = True
        if normalized_path == "/blog":
            ctx["is_archive"] = True

    if "404" in normalized_path:
        ctx["is_404"] = True

    if normalized_path.startswith("/search"):
        ctx["is_search"] = True

    # Product paths. Keep an explicitly supplied product post_type.
    if (
        normalized_path == "/products"
        or normalized_path.startswith("/products/")
        or post_type in ("product", "products")
    ):
        ctx["post_type"] = "products"
        if normalized_path == "/products":
            ctx["is_archive"] = True
            ctx["is_singular"] = False
        elif slug:
            ctx["is_singular"] = True

    if (
        normalized_path.startswith("/product-category")
        or normalized_path.startswith("/product_cat")
    ):
        ctx["is_archive"] = True
        ctx["taxonomy"] = "product_cat"

    # Do not let a custom post type overwrite a product context.
    if ctx["post_type"] not in ("product", "products"):
        for pt in post_types_collection.find({
            "is_active": True,
            "is_deleted": False,
        }):
            pt_slug = pt.get("slug", "")
            if not pt_slug:
                continue

            if normalized_path == f"/{pt_slug}" or normalized_path.startswith(f"/{pt_slug}/"):
                ctx["post_type"] = pt_slug

                if normalized_path == f"/{pt_slug}":
                    ctx["is_archive"] = True
                    ctx["is_singular"] = False
                else:
                    ctx["is_singular"] = True
                break

    if slug:
        item = None
        normalized_type = post_type or ctx.get("post_type", "")

        if normalized_type in ("product", "products"):
            item = products_collection.find_one({
                "slug": slug,
                "is_deleted": {"$ne": True},
            })
            if not item and ObjectId.is_valid(str(slug)):
                item = products_collection.find_one({
                    "_id": ObjectId(str(slug)),
                    "is_deleted": {"$ne": True},
                })

        elif normalized_type in ("pages", "page", "posts", "post"):
            lookup_type = (
                "pages" if normalized_type == "page"
                else "posts" if normalized_type == "post"
                else normalized_type
            )
            item = content_collection.find_one({
                "slug": slug,
                "post_type": lookup_type,
            })

        else:
            item = content_collection.find_one({
                "slug": slug,
                "post_type": normalized_type,
            })

            if not item:
                item = content_collection.find_one({"slug": slug})

        if item:
            item_id = str(item["_id"])
            ctx["content_id"] = item_id
            ctx["specific_id"] = item_id

    return ctx


# ============ CONDITION MATCHING ============

def condition_matches(condition, ctx):
    if not isinstance(condition, str) or not condition:
        return False

    post_type = ctx.get("post_type", "")

    if condition == "entire_site":
        return True

    if condition == "home":
        return ctx.get("is_home", False)

    if condition == "front_page":
        return ctx.get("is_front_page", False)

    if condition == "blog":
        return ctx.get("is_blog", False)

    if condition == "404":
        return ctx.get("is_404", False)

    if condition == "search":
        return ctx.get("is_search", False)

    if condition.startswith("post_type:"):
        target_type = condition.split(":", 1)[1]
        if target_type == "product":
            target_type = "products"
        if target_type == "post":
            target_type = "posts"
        if target_type == "page":
            target_type = "pages"
        return post_type == target_type

    if condition == "pages":
        return post_type in ("pages", "page")

    if condition == "posts":
        return post_type in ("posts", "post")

    if condition in ("products", "product"):
        return post_type in ("products", "product")

    if condition.startswith("single:"):
        target_type = condition.split(":", 1)[1]
        if target_type == "product":
            target_type = "products"
        if target_type == "post":
            target_type = "posts"
        if target_type == "page":
            target_type = "pages"

        return (
            ctx.get("is_singular", False)
            and post_type == target_type
        )

    if condition.startswith("archive:"):
        target_type = condition.split(":", 1)[1]
        if target_type == "product":
            target_type = "products"
        if target_type == "post":
            target_type = "posts"
        if target_type == "page":
            target_type = "pages"

        return (
            ctx.get("is_archive", False)
            and post_type == target_type
        )

    if condition.startswith("taxonomy:"):
        return ctx.get("taxonomy") == condition.split(":", 1)[1]

    return False


def template_matches(template, ctx):
    conditions = template.get("conditions", {}) or {}

    include = conditions.get("include", []) or []
    exclude = conditions.get("exclude", []) or []

    specific_pages = [str(v) for v in (conditions.get("specific_pages", []) or [])]
    specific_posts = [str(v) for v in (conditions.get("specific_posts", []) or [])]
    specific_products = [str(v) for v in (conditions.get("specific_products", []) or [])]
    specific_items = [str(v) for v in (conditions.get("specific_items", []) or [])]

    post_types = conditions.get("post_types", []) or []
    singles = conditions.get("singles", []) or []
    archives = conditions.get("archives", []) or []
    taxonomies = conditions.get("taxonomies", []) or []

    # Apply exclusions to every kind of match, not only include conditions.
    for exclusion in exclude:
        if condition_matches(exclusion, ctx):
            return False

    # Match an explicitly selected page, post, product, or custom item.
    match_ids = {
        str(value)
        for value in (
            ctx.get("specific_id"),
            ctx.get("content_id"),
        )
        if value not in (None, "")
    }

    selected_ids = (
        specific_pages
        + specific_posts
        + specific_products
        + specific_items
    )

    if match_ids.intersection(selected_ids):
        return True

    current_type = ctx.get("post_type", "")

    # Match configured post types.
    normalized_post_types = [
        "products" if value == "product"
        else "posts" if value == "post"
        else "pages" if value == "page"
        else value
        for value in post_types
    ]

    if current_type in normalized_post_types:
        return True

    normalized_singles = [
        "products" if value == "product"
        else "posts" if value == "post"
        else "pages" if value == "page"
        else value
        for value in singles
    ]

    if ctx.get("is_singular") and current_type in normalized_singles:
        return True

    normalized_archives = [
        "products" if value == "product"
        else "posts" if value == "post"
        else "pages" if value == "page"
        else value
        for value in archives
    ]

    if ctx.get("is_archive") and current_type in normalized_archives:
        return True

    if ctx.get("taxonomy") in taxonomies:
        return True

    # Match the include conditions when no direct selector matched.
    for condition in include:
        if condition_matches(condition, ctx):
            return True

    return False


# ============ ADMIN ROUTES ============

@router.get("/list/{template_type}")
def list_templates(template_type: str, user=Depends(require_permission("page_builder.view"))):
    if template_type not in TEMPLATE_TYPES:
        raise HTTPException(status_code=400, detail="Invalid template type")

    templates = list(
        pages_collection.find({"template_type": template_type}).sort("updated_at", -1)
    )

    return {
        "templates": [
            {
                "id": str(t["_id"]),
                "title": t.get("title", ""),
                "slug": t.get("slug", ""),
                "status": t.get("status", "draft"),
                "template_type": t.get("template_type", template_type),
                "conditions": t.get("conditions", {}),
                "is_default": t.get("is_default", False),
                "updated_at": t.get("updated_at"),
                "created_at": t.get("created_at"),
            }
            for t in templates
        ]
    }


@router.get("/sources/all")
def get_all_sources(user=Depends(require_permission("page_builder.view"))):
    result = {
        "pages": [],
        "posts": [],
        "products": [],
        "custom_post_types": [],
        "custom_items": {},
        "categories": [],
        "tags": [],
    }

    for p in content_collection.find({
        "post_type": "pages",
        "is_deleted": False,
    }).sort("title", 1):
        result["pages"].append({
            "id": str(p["_id"]),
            "label": p.get("title", ""),
            "slug": p.get("slug", ""),
        })

    for p in content_collection.find({
        "post_type": "posts",
        "is_deleted": False,
    }).sort("title", 1):
        result["posts"].append({
            "id": str(p["_id"]),
            "label": p.get("title", ""),
            "slug": p.get("slug", ""),
        })

    for p in products_collection.find({
        "is_deleted": {"$ne": True},
    }).sort("name", 1):
        result["products"].append({
            "id": str(p["_id"]),
            "label": p.get("name", ""),
            "slug": p.get("slug", ""),
        })

    for pt in post_types_collection.find({
        "is_builtin": False,
        "is_deleted": False,
        "is_active": True,
    }):
        pt_slug = pt.get("slug", "")
        result["custom_post_types"].append({
            "id": str(pt["_id"]),
            "label": pt.get("name", ""),
            "slug": pt_slug,
        })

        items = []
        for item in content_collection.find({
            "post_type": pt_slug,
            "is_deleted": False,
        }).sort("title", 1):
            items.append({
                "id": str(item["_id"]),
                "label": item.get("title", ""),
                "slug": item.get("slug", ""),
            })

        result["custom_items"][pt_slug] = items

    for c in taxonomies_collection.find({
        "type": "category",
        "is_deleted": False,
    }).sort("name", 1):
        result["categories"].append({
            "id": str(c["_id"]),
            "label": c.get("name", ""),
            "slug": c.get("slug", ""),
        })

    for t in taxonomies_collection.find({
        "type": "tag",
        "is_deleted": False,
    }).sort("name", 1):
        result["tags"].append({
            "id": str(t["_id"]),
            "label": t.get("name", ""),
            "slug": t.get("slug", ""),
        })

    return result


@router.get("/{template_id}")
def get_template(template_id: str, user=Depends(require_permission("page_builder.view"))):
    if not ObjectId.is_valid(template_id):
        raise HTTPException(status_code=400, detail="Invalid ID")

    template = pages_collection.find_one({"_id": ObjectId(template_id)})
    if not template:
        raise HTTPException(status_code=404, detail="Not found")

    return {
        "id": str(template["_id"]),
        "title": template.get("title", ""),
        "slug": template.get("slug", ""),
        "layout": template.get("layout", []),
        "status": template.get("status", "draft"),
        "globals": template.get("globals", {}),
        "template_type": template.get("template_type", "header"),
        "conditions": template.get("conditions", {}),
        "is_default": template.get("is_default", False),
        "created_at": template.get("created_at"),
        "updated_at": template.get("updated_at"),
    }


@router.post("")
def create_template(data: SaveTemplateData, user=Depends(require_permission("page_builder.create"))):
    if data.template_type not in TEMPLATE_TYPES:
        raise HTTPException(status_code=400, detail="Invalid type")

    title = data.title.strip()
    slug = data.slug.strip().lower()

    if not title or not slug:
        raise HTTPException(status_code=400, detail="Title and slug required")

    if data.is_default:
        pages_collection.update_many(
            {
                "template_type": data.template_type,
                "is_default": True,
            },
            {"$set": {"is_default": False}},
        )

    template = {
        "title": title,
        "slug": slug,
        "layout": data.layout,
        "status": data.status,
        "globals": data.globals or {},
        "template_type": data.template_type,
        "conditions": data.conditions.model_dump() if data.conditions else {},
        "is_default": data.is_default or False,
        "created_at": now(),
        "updated_at": now(),
    }

    result = pages_collection.insert_one(template)
    return {
        "message": "Created",
        "id": str(result.inserted_id),
        "slug": slug,
    }


@router.put("/{template_id}")
def update_template(template_id: str, data: SaveTemplateData, user=Depends(require_permission("page_builder.edit"))):
    if not ObjectId.is_valid(template_id):
        raise HTTPException(status_code=400, detail="Invalid ID")

    if data.template_type not in TEMPLATE_TYPES:
        raise HTTPException(status_code=400, detail="Invalid type")

    if not pages_collection.find_one({"_id": ObjectId(template_id)}):
        raise HTTPException(status_code=404, detail="Not found")

    if data.is_default:
        pages_collection.update_many(
            {
                "template_type": data.template_type,
                "is_default": True,
                "_id": {"$ne": ObjectId(template_id)},
            },
            {"$set": {"is_default": False}},
        )

    pages_collection.update_one(
        {"_id": ObjectId(template_id)},
        {
            "$set": {
                "title": data.title.strip(),
                "slug": data.slug.strip().lower(),
                "layout": data.layout,
                "status": data.status,
                "globals": data.globals or {},
                "template_type": data.template_type,
                "conditions": data.conditions.model_dump() if data.conditions else {},
                "is_default": data.is_default or False,
                "updated_at": now(),
            }
        },
    )

    return {"message": "Updated"}


@router.delete("/{template_id}")
def delete_template(template_id: str, user=Depends(require_permission("page_builder.delete"))):
    if not ObjectId.is_valid(template_id):
        raise HTTPException(status_code=400, detail="Invalid ID")

    result = pages_collection.delete_one({"_id": ObjectId(template_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")

    return {"message": "Deleted"}


@router.post("/{template_id}/duplicate")
def duplicate_template(template_id: str, user=Depends(require_permission("page_builder.create"))):
    if not ObjectId.is_valid(template_id):
        raise HTTPException(status_code=400, detail="Invalid ID")

    template = pages_collection.find_one({"_id": ObjectId(template_id)})
    if not template:
        raise HTTPException(status_code=404, detail="Not found")

    original_slug = template.get("slug", "template")
    new_slug = f"{original_slug}-copy"
    index = 1

    while pages_collection.find_one({"slug": new_slug}):
        new_slug = f"{original_slug}-copy-{index}"
        index += 1

    new_template = {
        "title": f"{template.get('title', '')} (Copy)",
        "slug": new_slug,
        "layout": template.get("layout", []),
        "status": "draft",
        "globals": template.get("globals", {}),
        "template_type": template.get("template_type", "header"),
        "conditions": template.get("conditions", {}),
        "is_default": False,
        "created_at": now(),
        "updated_at": now(),
    }

    result = pages_collection.insert_one(new_template)
    return {
        "message": "Duplicated",
        "id": str(result.inserted_id),
        "slug": new_slug,
    }


# ============ PUBLIC (NO AUTH) ============

@router.get("/active/{template_type}")
def get_active_template(
    template_type: str,
    url_path: str = Query("/"),
    post_type: Optional[str] = Query(None),
    slug: Optional[str] = Query(None),
    specific_id: Optional[str] = Query(None),
):
    if template_type not in TEMPLATE_TYPES:
        raise HTTPException(status_code=400, detail="Invalid type")

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

    if not templates:
        return {"template": None, "context": ctx}

    best = None
    best_priority = -999999

    for template in templates:
        if template_matches(template, ctx):
            priority = (template.get("conditions") or {}).get("priority", 0)
            try:
                priority = int(priority or 0)
            except (TypeError, ValueError):
                priority = 0

            if best is None or priority > best_priority:
                best_priority = priority
                best = template

    if best is None:
        best = next(
            (template for template in templates if template.get("is_default")),
            None,
        )

    if best is None and template_type in ("header", "footer"):
        best = templates[0]

    if best is None:
        return {"template": None, "context": ctx}

    return {
        "template": {
            "id": str(best["_id"]),
            "title": best.get("title", ""),
            "slug": best.get("slug", ""),
            "layout": best.get("layout", []),
            "globals": best.get("globals", {}),
            "template_type": template_type,
            "conditions": best.get("conditions", {}),
        },
        "context": ctx,
    }
