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
    "archive", "search_results", "loop_item", "error_404",
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
        "taxonomy": None,
    }

    if url_path in ["/", "/home", ""]:
        ctx["is_home"] = True
        ctx["is_front_page"] = True

    if url_path.startswith("/blog"):
        ctx["is_blog"] = True
        if url_path in ["/blog", "/blog/"]:
            ctx["is_archive"] = True

    if "404" in url_path:
        ctx["is_404"] = True

    if url_path.startswith("/search") or "?s=" in url_path:
        ctx["is_search"] = True

    if url_path.startswith("/products"):
        ctx["post_type"] = "products"
        if url_path in ["/products", "/products/"]:
            ctx["is_archive"] = True
        else:
            ctx["is_singular"] = True

    if url_path.startswith("/product-category") or url_path.startswith("/product_cat"):
        ctx["is_archive"] = True
        ctx["taxonomy"] = "product_cat"

    for pt in post_types_collection.find({"is_active": True, "is_deleted": False}):
        pt_slug = pt.get("slug", "")
        if pt_slug and url_path.startswith(f"/{pt_slug}"):
            ctx["post_type"] = pt_slug
            if url_path in [f"/{pt_slug}", f"/{pt_slug}/"]:
                ctx["is_archive"] = True
            else:
                ctx["is_singular"] = True
            break

    if slug:
        item = None
        if post_type == "products":
            item = products_collection.find_one({"slug": slug})
        elif post_type in ["pages", "posts"]:
            item = content_collection.find_one({"slug": slug, "post_type": post_type})
        else:
            item = content_collection.find_one({"slug": slug, "post_type": post_type or ""})

        if not item and post_type != "products":
            item = content_collection.find_one({"slug": slug})

        if item:
            ctx["content_id"] = str(item["_id"])

    return ctx


# ============ CONDITION MATCHING ============

def condition_matches(condition, ctx):
    if not condition:
        return False
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
        return ctx.get("post_type") == condition.split(":", 1)[1]
    if condition == "pages":
        return ctx.get("post_type") in ["pages", "page"]
    if condition == "posts":
        return ctx.get("post_type") in ["posts", "post"]
    if condition == "products":
        return ctx.get("post_type") == "products"
    if condition.startswith("single:"):
        return ctx.get("is_singular") and ctx.get("post_type") == condition.split(":", 1)[1]
    if condition.startswith("archive:"):
        return ctx.get("is_archive") and ctx.get("post_type") == condition.split(":", 1)[1]
    if condition.startswith("taxonomy:"):
        return ctx.get("taxonomy") == condition.split(":", 1)[1]
    return False


def template_matches(template, ctx):
    c = template.get("conditions", {})
    include = c.get("include", [])
    exclude = c.get("exclude", [])
    specific_pages = c.get("specific_pages", [])
    specific_posts = c.get("specific_posts", [])
    specific_products = c.get("specific_products", [])
    specific_items = c.get("specific_items", [])
    post_types = c.get("post_types", [])
    singles = c.get("singles", [])
    archives = c.get("archives", [])
    taxonomies = c.get("taxonomies", [])

    content_id = ctx.get("content_id")
    if content_id:
        if content_id in specific_pages:
            return True
        if content_id in specific_posts:
            return True
        if content_id in specific_products:
            return True
        if content_id in specific_items:
            return True

    if post_types and ctx.get("post_type") in post_types:
        return True
    if singles and ctx.get("is_singular") and ctx.get("post_type") in singles:
        return True
    if archives and ctx.get("is_archive") and ctx.get("post_type") in archives:
        return True
    if taxonomies and ctx.get("taxonomy") in taxonomies:
        return True

    if not include:
        return False

    for cond in include:
        if condition_matches(cond, ctx):
            for exc in exclude:
                if condition_matches(exc, ctx):
                    return False
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
        "pages": [], "posts": [], "products": [],
        "custom_post_types": [], "custom_items": {},
        "categories": [], "tags": [],
    }

    for p in content_collection.find({"post_type": "pages", "is_deleted": False}).sort("title", 1):
        result["pages"].append({"id": str(p["_id"]), "label": p.get("title", ""), "slug": p.get("slug", "")})

    for p in content_collection.find({"post_type": "posts", "is_deleted": False}).sort("title", 1):
        result["posts"].append({"id": str(p["_id"]), "label": p.get("title", ""), "slug": p.get("slug", "")})

    for p in products_collection.find({"is_deleted": {"$ne": True}}).sort("name", 1):
        result["products"].append({"id": str(p["_id"]), "label": p.get("name", ""), "slug": p.get("slug", "")})

    for pt in post_types_collection.find({"is_builtin": False, "is_deleted": False, "is_active": True}):
        pt_slug = pt.get("slug", "")
        result["custom_post_types"].append({"id": str(pt["_id"]), "label": pt.get("name", ""), "slug": pt_slug})
        items = []
        for item in content_collection.find({"post_type": pt_slug, "is_deleted": False}).sort("title", 1):
            items.append({"id": str(item["_id"]), "label": item.get("title", ""), "slug": item.get("slug", "")})
        result["custom_items"][pt_slug] = items

    for c in taxonomies_collection.find({"type": "category", "is_deleted": False}).sort("name", 1):
        result["categories"].append({"id": str(c["_id"]), "label": c.get("name", ""), "slug": c.get("slug", "")})

    for t in taxonomies_collection.find({"type": "tag", "is_deleted": False}).sort("name", 1):
        result["tags"].append({"id": str(t["_id"]), "label": t.get("name", ""), "slug": t.get("slug", "")})

    return result


@router.get("/{template_id}")
def get_template(template_id: str, user=Depends(require_permission("page_builder.view"))):
    if not ObjectId.is_valid(template_id):
        raise HTTPException(status_code=400, detail="Invalid ID")

    t = pages_collection.find_one({"_id": ObjectId(template_id)})
    if not t:
        raise HTTPException(status_code=404, detail="Not found")

    return {
        "id": str(t["_id"]),
        "title": t.get("title", ""),
        "slug": t.get("slug", ""),
        "layout": t.get("layout", []),
        "status": t.get("status", "draft"),
        "globals": t.get("globals", {}),
        "template_type": t.get("template_type", "header"),
        "conditions": t.get("conditions", {}),
        "is_default": t.get("is_default", False),
        "created_at": t.get("created_at"),
        "updated_at": t.get("updated_at"),
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
            {"template_type": data.template_type, "is_default": True},
            {"$set": {"is_default": False}},
        )

    template = {
        "title": title, "slug": slug, "layout": data.layout,
        "status": data.status, "globals": data.globals or {},
        "template_type": data.template_type,
        "conditions": data.conditions.model_dump() if data.conditions else {},
        "is_default": data.is_default or False,
        "created_at": now(), "updated_at": now(),
    }

    r = pages_collection.insert_one(template)
    return {"message": "Created", "id": str(r.inserted_id), "slug": slug}


@router.put("/{template_id}")
def update_template(template_id: str, data: SaveTemplateData, user=Depends(require_permission("page_builder.edit"))):
    if not ObjectId.is_valid(template_id):
        raise HTTPException(status_code=400, detail="Invalid ID")
    if data.template_type not in TEMPLATE_TYPES:
        raise HTTPException(status_code=400, detail="Invalid type")

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
        {"$set": {
            "title": data.title.strip(),
            "slug": data.slug.strip().lower(),
            "layout": data.layout,
            "status": data.status,
            "globals": data.globals or {},
            "template_type": data.template_type,
            "conditions": data.conditions.model_dump() if data.conditions else {},
            "is_default": data.is_default or False,
            "updated_at": now(),
        }},
    )
    return {"message": "Updated"}


@router.delete("/{template_id}")
def delete_template(template_id: str, user=Depends(require_permission("page_builder.delete"))):
    if not ObjectId.is_valid(template_id):
        raise HTTPException(status_code=400, detail="Invalid ID")
    r = pages_collection.delete_one({"_id": ObjectId(template_id)})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"message": "Deleted"}


@router.post("/{template_id}/duplicate")
def duplicate_template(template_id: str, user=Depends(require_permission("page_builder.create"))):
    if not ObjectId.is_valid(template_id):
        raise HTTPException(status_code=400, detail="Invalid ID")

    t = pages_collection.find_one({"_id": ObjectId(template_id)})
    if not t:
        raise HTTPException(status_code=404, detail="Not found")

    new_slug = f"{t['slug']}-copy"
    i = 1
    while pages_collection.find_one({"slug": new_slug}):
        new_slug = f"{t['slug']}-copy-{i}"
        i += 1

    new_template = {
        "title": f"{t['title']} (Copy)", "slug": new_slug,
        "layout": t.get("layout", []), "status": "draft",
        "globals": t.get("globals", {}),
        "template_type": t.get("template_type", "header"),
        "conditions": t.get("conditions", {}),
        "is_default": False,
        "created_at": now(), "updated_at": now(),
    }
    r = pages_collection.insert_one(new_template)
    return {"message": "Duplicated", "id": str(r.inserted_id), "slug": new_slug}


# ============ PUBLIC (no auth) ============

@router.get("/active/{template_type}")
def get_active_template(
    template_type: str,
    url_path: str = Query("/"),
    post_type: Optional[str] = Query(None),
    slug: Optional[str] = Query(None),
):
    if template_type not in TEMPLATE_TYPES:
        raise HTTPException(status_code=400, detail="Invalid type")

    ctx = build_page_context(url_path, post_type, slug)

    templates = list(pages_collection.find({
        "template_type": template_type,
        "status": "published",
    }).sort("conditions.priority", -1))

    if not templates:
        return {"template": None, "context": ctx}

    best = None
    best_priority = -999999
    for t in templates:
        if template_matches(t, ctx):
            p = t.get("conditions", {}).get("priority", 0)
            if p > best_priority:
                best_priority = p
                best = t

    if not best:
        best = next((t for t in templates if t.get("is_default")), None)
        if best is None and template_type in ["header", "footer"]:
            best = templates[0] if templates else None

    if not best:
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