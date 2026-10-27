from fastapi import APIRouter, HTTPException, Depends, Query
from bson import ObjectId
from datetime import datetime, timezone
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict

from backend.database.connection import (
    pages_collection,
    global_styles_collection,
    content_collection,
)
from backend.utils.permissions import require_permission

router = APIRouter(
    prefix="/api/page-builder",
    tags=["Page Builder"]
)


def now():
    return datetime.now(timezone.utc)


# ============ PYDANTIC MODELS ============

class BoxSpacing(BaseModel):
    model_config = ConfigDict(extra="allow")
    top: float = 0
    right: float = 0
    bottom: float = 0
    left: float = 0


class DimensionValue(BaseModel):
    model_config = ConfigDict(extra="allow")
    value: float = 0
    unit: str = "px"


class ResponsiveStyle(BaseModel):
    model_config = ConfigDict(extra="allow")
    width: Optional[DimensionValue] = None
    height: Optional[DimensionValue] = None
    minWidth: Optional[DimensionValue] = None
    maxWidth: Optional[DimensionValue] = None
    minHeight: Optional[DimensionValue] = None
    maxHeight: Optional[DimensionValue] = None
    padding: Optional[BoxSpacing] = None
    margin: Optional[BoxSpacing] = None
    gap: Optional[float] = None
    fontSize: Optional[float] = None
    display: Optional[str] = None
    hide: Optional[bool] = False
    flexDirection: Optional[str] = None
    flexWrap: Optional[str] = None
    justifyContent: Optional[str] = None
    alignItems: Optional[str] = None
    alignContent: Optional[str] = None
    gridColumns: Optional[int] = None
    gridRows: Optional[int] = None
    gridTemplateColumns: Optional[str] = None
    gridTemplateRows: Optional[str] = None
    gridColumnGap: Optional[float] = None
    gridRowGap: Optional[float] = None
    textAlign: Optional[str] = None
    backgroundColor: Optional[str] = None
    color: Optional[str] = None
    borderRadius: Optional[float] = None


class WidgetStyle(BaseModel):
    model_config = ConfigDict(extra="allow")
    backgroundColor: Optional[str] = None
    backgroundImage: Optional[str] = None
    backgroundSize: Optional[str] = None
    backgroundPosition: Optional[str] = None
    backgroundRepeat: Optional[str] = None
    backgroundAttachment: Optional[str] = None
    backgroundGradient: Optional[str] = None
    backgroundClip: Optional[str] = None
    overlayColor: Optional[str] = None
    overlayOpacity: Optional[float] = None
    color: Optional[str] = None
    fontSize: Optional[float] = None
    fontFamily: Optional[str] = None
    fontWeight: Optional[int] = None
    fontStyle: Optional[str] = None
    lineHeight: Optional[float] = None
    letterSpacing: Optional[float] = None
    wordSpacing: Optional[float] = None
    textAlign: Optional[str] = None
    textTransform: Optional[str] = None
    textDecoration: Optional[str] = None
    textShadow: Optional[str] = None
    width: Optional[str] = None
    height: Optional[str] = None
    minWidth: Optional[str] = None
    maxWidth: Optional[str] = None
    minHeight: Optional[str] = None
    maxHeight: Optional[str] = None
    aspectRatio: Optional[str] = None
    padding: Optional[BoxSpacing] = None
    margin: Optional[BoxSpacing] = None
    gap: Optional[float] = None
    display: Optional[str] = None
    flexDirection: Optional[str] = None
    flexWrap: Optional[str] = None
    flexGrow: Optional[float] = None
    flexShrink: Optional[float] = None
    flexBasis: Optional[str] = None
    alignSelf: Optional[str] = None
    order: Optional[int] = None
    justifyContent: Optional[str] = None
    alignItems: Optional[str] = None
    alignContent: Optional[str] = None
    gridColumns: Optional[int] = None
    gridRows: Optional[int] = None
    gridColumnGap: Optional[float] = None
    gridRowGap: Optional[float] = None
    gridTemplateColumns: Optional[str] = None
    gridTemplateRows: Optional[str] = None
    gridAutoFlow: Optional[str] = None
    gridColumn: Optional[str] = None
    gridRow: Optional[str] = None
    borderColor: Optional[str] = None
    borderWidth: Optional[float] = None
    borderStyle: Optional[str] = None
    borderRadius: Optional[float] = None
    borderTopWidth: Optional[float] = None
    borderRightWidth: Optional[float] = None
    borderBottomWidth: Optional[float] = None
    borderLeftWidth: Optional[float] = None
    borderTopColor: Optional[str] = None
    borderRightColor: Optional[str] = None
    borderBottomColor: Optional[str] = None
    borderLeftColor: Optional[str] = None
    borderTopLeftRadius: Optional[float] = None
    borderTopRightRadius: Optional[float] = None
    borderBottomLeftRadius: Optional[float] = None
    borderBottomRightRadius: Optional[float] = None
    boxShadow: Optional[str] = None
    opacity: Optional[float] = None
    zIndex: Optional[int] = None
    position: Optional[str] = None
    top: Optional[str] = None
    right: Optional[str] = None
    bottom: Optional[str] = None
    left: Optional[str] = None
    overflow: Optional[str] = None
    cursor: Optional[str] = None
    pointerEvents: Optional[str] = None
    transitionDuration: Optional[float] = None
    hoverBackgroundColor: Optional[str] = None
    hoverColor: Optional[str] = None
    hoverBorderColor: Optional[str] = None
    hoverBorderRadius: Optional[float] = None
    hoverBoxShadow: Optional[str] = None
    hoverScale: Optional[float] = None
    hoverOpacity: Optional[float] = None
    transform: Optional[dict] = None
    animation: Optional[str] = None
    animationDuration: Optional[float] = None
    responsive: Optional[dict] = None
    htmlTag: Optional[str] = None
    ariaLabel: Optional[str] = None
    customClasses: Optional[str] = None


class MediaItem(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: str
    url: str
    type: str = "image"
    alt: Optional[str] = None
    title: Optional[str] = None
    caption: Optional[str] = None
    mimeType: Optional[str] = None
    width: Optional[float] = None
    height: Optional[float] = None


class WidgetItem(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: str
    title: str
    content: Optional[str] = None
    image: Optional[str] = None
    icon: Optional[str] = None
    link: Optional[dict] = None


class LinkSettings(BaseModel):
    model_config = ConfigDict(extra="allow")
    url: Optional[str] = None
    target: Optional[str] = "_self"
    rel: Optional[str] = None
    noFollow: Optional[bool] = False


class WidgetSettings(BaseModel):
    model_config = ConfigDict(extra="allow")
    columns: Optional[int] = None
    customClasses: Optional[str] = None
    htmlTag: Optional[str] = None
    autoplay: Optional[bool] = None
    autoplaySpeed: Optional[float] = None
    showArrows: Optional[bool] = None
    showDots: Optional[bool] = None
    infiniteLoop: Optional[bool] = None
    pauseOnHover: Optional[bool] = None
    imageIds: Optional[List[str]] = None
    images: Optional[List[MediaItem]] = None
    queryType: Optional[str] = None
    categoryIds: Optional[List[str]] = None
    tagIds: Optional[List[str]] = None
    postIds: Optional[List[str]] = None
    postsPerPage: Optional[int] = None
    orderBy: Optional[str] = None
    order: Optional[str] = None
    showImage: Optional[bool] = None
    showTitle: Optional[bool] = None
    showExcerpt: Optional[bool] = None
    showDate: Optional[bool] = None
    showAuthor: Optional[bool] = None
    submitText: Optional[str] = None
    successMessage: Optional[str] = None
    imageSize: Optional[str] = None
    imageFit: Optional[str] = None
    altText: Optional[str] = None


class PageWidget(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: str
    type: str
    label: str
    content: Optional[str] = None
    url: Optional[str] = None
    children: Optional[List["PageWidget"]] = None
    style: Optional[WidgetStyle] = None
    settings: Optional[WidgetSettings] = None
    items: Optional[List[WidgetItem]] = None
    media: Optional[List[MediaItem]] = None
    link: Optional[LinkSettings] = None
    accessibility: Optional[dict] = None
    advanced: Optional[dict] = None
    globalStyle: Optional[dict] = None


class GlobalColor(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: str
    name: str
    value: str


class GlobalFont(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: str
    name: str
    family: str
    size: Optional[float] = None
    weight: Optional[int] = None


class BuilderGlobals(BaseModel):
    model_config = ConfigDict(extra="allow")
    colors: Optional[List[GlobalColor]] = None
    fonts: Optional[List[GlobalFont]] = None
    containerWidth: Optional[float] = 1200
    defaultFontFamily: Optional[str] = "Arial, sans-serif"
    defaultFontSize: Optional[float] = 16
    defaultLineHeight: Optional[float] = 1.5


class CreatePageData(BaseModel):
    model_config = ConfigDict(extra="allow")
    title: str
    slug: str
    layout: List[PageWidget] = []
    status: str = "draft"
    globals: Optional[BuilderGlobals] = None
    content_id: Optional[str] = None
    post_type: Optional[str] = None
    show_title: Optional[bool] = True


class UpdatePageData(BaseModel):
    model_config = ConfigDict(extra="allow")
    title: Optional[str] = None
    slug: Optional[str] = None
    layout: Optional[List[PageWidget]] = None
    status: Optional[str] = None
    globals: Optional[BuilderGlobals] = None
    show_title: Optional[bool] = None


PageWidget.model_rebuild()


# ============ HELPERS ============

def page_response(page):
    return {
        "id": str(page["_id"]),
        "title": page.get("title", ""),
        "slug": page.get("slug", ""),
        "layout": page.get("layout", []),
        "status": page.get("status", "draft"),
        "globals": page.get("globals", {}),
        "content_id": page.get("content_id", ""),
        "post_type": page.get("post_type", ""),
        "template_type": page.get("template_type", "page"),
        "conditions": page.get("conditions", {}),
        "show_title": page.get("show_title", True),
        "created_at": page.get("created_at"),
        "updated_at": page.get("updated_at"),
    }


def extract_html_from_layout(layout):
    parts = []

    def process_widget(widget):
        if not isinstance(widget, dict):
            return
        wtype = widget.get("type", "")

        if wtype == "heading":
            parts.append(f"<h2>{widget.get('content', '')}</h2>")
        elif wtype == "text":
            parts.append(f"<p>{widget.get('content', '')}</p>")
        elif wtype == "html":
            parts.append(widget.get("content", ""))
        elif wtype == "button":
            parts.append(
                f"<p><a href='{widget.get('url', '#')}'>{widget.get('content', '')}</a></p>"
            )
        elif wtype in ["container", "section", "column", "grid"]:
            for child in widget.get("children", []):
                process_widget(child)

    for widget in layout:
        process_widget(widget)

    return "\n".join([p for p in parts if p])


# ============ ROUTES ============

@router.get("")
def get_pages(
    status: Optional[str] = Query(None),
    post_type: Optional[str] = Query(None),
    user=Depends(require_permission("page_builder.view")),
):
    query = {}
    if status:
        query["status"] = status
    if post_type:
        query["post_type"] = post_type

    pages = pages_collection.find(query).sort("updated_at", -1)
    return [page_response(page) for page in pages]


@router.get("/public/{slug}")
def get_public_page(slug: str):
    page = pages_collection.find_one({"slug": slug, "status": "published"})

    if not page:
        raise HTTPException(status_code=404, detail="Page not found")

    return page_response(page)


# ============ CONTENT → BUILDER SYNC ============

@router.post("/from-content/{content_id}")
def convert_content_to_builder(
    content_id: str,
    user=Depends(require_permission("page_builder.create")),
):
    if not ObjectId.is_valid(content_id):
        raise HTTPException(status_code=400, detail="Invalid content ID")

    content_item = content_collection.find_one(
        {"_id": ObjectId(content_id), "is_deleted": False}
    )

    if not content_item:
        raise HTTPException(status_code=404, detail="Content not found")

    existing_builder = pages_collection.find_one({"content_id": content_id})

    if existing_builder:
        return {
            "message": "Builder page already exists",
            "id": str(existing_builder["_id"]),
            "existing": True,
        }

    base_slug = content_item.get("slug", "")
    if not base_slug:
        base_slug = f"page-{int(datetime.now().timestamp() * 1000)}"

    existing_by_slug = pages_collection.find_one({
        "slug": base_slug,
        "template_type": {"$in": ["page", None]},
        "$or": [
            {"post_type": content_item.get("post_type", "")},
            {"post_type": {"$in": ["", None]}},
        ],
    })
    if existing_by_slug:
        pages_collection.update_one(
            {"_id": existing_by_slug["_id"]},
            {
                "$set": {
                    "content_id": content_id,
                    "post_type": content_item.get("post_type", ""),
                    "updated_at": now(),
                }
            },
        )
        return {
            "message": "Existing builder page linked to content",
            "id": str(existing_by_slug["_id"]),
            "existing": True,
        }

    layout = []
    timestamp = int(datetime.now().timestamp() * 1000)

    if content_item.get("title"):
        layout.append(
            {
                "id": f"heading-{timestamp}",
                "type": "heading",
                "label": "Heading",
                "content": content_item["title"],
                "style": {
                    "color": "#1a1a2e",
                    "fontSize": 36,
                    "fontWeight": 700,
                    "textAlign": "left",
                    "margin": {"top": 8, "right": 0, "bottom": 16, "left": 0},
                    "padding": {"top": 0, "right": 0, "bottom": 0, "left": 0},
                },
            }
        )

    if content_item.get("featured_image"):
        layout.append(
            {
                "id": f"image-{timestamp + 1}",
                "type": "image",
                "label": "Image",
                "url": content_item["featured_image"],
                "style": {
                    "width": "100%",
                    "borderRadius": 8,
                    "margin": {"top": 8, "right": 0, "bottom": 16, "left": 0},
                },
            }
        )

    if content_item.get("content"):
        layout.append(
            {
                "id": f"html-{timestamp + 2}",
                "type": "html",
                "label": "HTML",
                "content": content_item["content"],
                "style": {
                    "margin": {"top": 8, "right": 0, "bottom": 8, "left": 0},
                },
            }
        )

    builder_page = {
        "title": content_item.get("title", ""),
        "slug": base_slug,
        "layout": layout,
        "status": content_item.get("status", "draft"),
        "content_id": content_id,
        "post_type": content_item.get("post_type", ""),
        "globals": {},
        "template_type": "page",
        "conditions": {},
        "show_title": True,
        "created_at": now(),
        "updated_at": now(),
    }

    result = pages_collection.insert_one(builder_page)

    return {
        "message": "Content converted to builder page",
        "id": str(result.inserted_id),
        "existing": False,
        "slug": base_slug,
    }


@router.post("/{page_id}/link-content")
def link_builder_to_content(
    page_id: str,
    data: dict,
    user=Depends(require_permission("page_builder.edit")),
):
    if not ObjectId.is_valid(page_id):
        raise HTTPException(status_code=400, detail="Invalid page ID")

    content_id = data.get("content_id", "")

    pages_collection.update_one(
        {"_id": ObjectId(page_id)},
        {
            "$set": {
                "content_id": content_id,
                "post_type": data.get("post_type", ""),
                "updated_at": now(),
            }
        },
    )

    return {"message": "Linked successfully"}


# ============ CRUD ============

@router.get("/{page_id}")
def get_page(
    page_id: str,
    user=Depends(require_permission("page_builder.view")),
):
    if not ObjectId.is_valid(page_id):
        raise HTTPException(status_code=400, detail="Invalid page ID")

    page = pages_collection.find_one({"_id": ObjectId(page_id)})

    if not page:
        raise HTTPException(status_code=404, detail="Page not found")

    return page_response(page)


@router.post("")
def create_page(
    data: CreatePageData,
    user=Depends(require_permission("page_builder.create")),
):
    title = data.title.strip()
    slug = data.slug.strip().lower()

    if not title:
        raise HTTPException(status_code=400, detail="Page title is required")

    if not slug:
        raise HTTPException(status_code=400, detail="Page slug is required")

    if data.status not in ["draft", "published"]:
        raise HTTPException(status_code=400, detail="Invalid page status")

    existing = pages_collection.find_one({
        "slug": slug,
        "template_type": {"$in": ["page", None]},
        "$or": [
            {"post_type": data.post_type or ""},
            {"post_type": {"$in": ["", None]}},
        ],
    })
    if existing:
        update_data = {
            "title": title,
            "slug": slug,
            "layout": [w.model_dump() for w in data.layout],
            "status": data.status,
            "globals": data.globals.model_dump() if data.globals else {},
            "show_title": data.show_title if data.show_title is not None else True,
            "updated_at": now(),
        }
        if data.content_id:
            update_data["content_id"] = data.content_id
        if data.post_type:
            update_data["post_type"] = data.post_type
        pages_collection.update_one(
            {"_id": existing["_id"]},
            {"$set": update_data},
        )
        return {
            "message": "Existing builder page updated successfully",
            "id": str(existing["_id"]),
            "slug": slug,
            "updated": True,
        }

    page = {
        "title": title,
        "slug": slug,
        "layout": [w.model_dump() for w in data.layout],
        "status": data.status,
        "globals": data.globals.model_dump() if data.globals else {},
        "content_id": data.content_id or "",
        "post_type": data.post_type or "",
        "template_type": "page",
        "conditions": {},
        "show_title": data.show_title if data.show_title is not None else True,
        "created_at": now(),
        "updated_at": now(),
    }

    result = pages_collection.insert_one(page)

    return {
        "message": "Page created successfully",
        "id": str(result.inserted_id),
        "slug": slug,
    }


@router.put("/{page_id}")
def update_page(
    page_id: str,
    data: UpdatePageData,
    user=Depends(require_permission("page_builder.edit")),
):
    if not ObjectId.is_valid(page_id):
        raise HTTPException(status_code=400, detail="Invalid page ID")

    page = pages_collection.find_one({"_id": ObjectId(page_id)})
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")

    update_data = {"updated_at": now()}
    target_page = page

    if data.title is not None:
        title = data.title.strip()
        if not title:
            raise HTTPException(status_code=400, detail="Page title is required")
        update_data["title"] = title

    if data.slug is not None:
        slug = data.slug.strip().lower()
        if not slug:
            raise HTTPException(status_code=400, detail="Page slug is required")

        existing = pages_collection.find_one({
            "slug": slug,
            "template_type": {"$in": ["page", None]},
            "_id": {"$ne": ObjectId(page_id)},
            "$or": [
                {"post_type": page.get("post_type", "")},
                {"post_type": {"$in": ["", None]}},
            ],
        })

        if existing:
            target_page = existing
            if not target_page.get("content_id") and page.get("content_id"):
                update_data["content_id"] = page["content_id"]
            if not target_page.get("post_type") and page.get("post_type"):
                update_data["post_type"] = page["post_type"]

        update_data["slug"] = slug

    if data.layout is not None:
        update_data["layout"] = [w.model_dump() for w in data.layout]

    if data.status is not None:
        if data.status not in ["draft", "published"]:
            raise HTTPException(status_code=400, detail="Invalid page status")
        update_data["status"] = data.status

    if data.globals is not None:
        update_data["globals"] = data.globals.model_dump()

    if data.show_title is not None:
        update_data["show_title"] = data.show_title

    pages_collection.update_one(
        {"_id": target_page["_id"]},
        {"$set": update_data},
    )

    # Sync back to content
    content_id = target_page.get("content_id") or page.get("content_id", "")
    if content_id and ObjectId.is_valid(content_id):
        sync_data = {"updated_at": now()}

        if "title" in update_data:
            sync_data["title"] = update_data["title"]
        if "slug" in update_data:
            sync_data["slug"] = update_data["slug"]
        if "status" in update_data:
            sync_data["status"] = update_data["status"]
        if "layout" in update_data:
            html_content = extract_html_from_layout(update_data["layout"])
            if html_content:
                sync_data["content"] = html_content

        content_collection.update_one(
            {"_id": ObjectId(content_id)},
            {"$set": sync_data},
        )

    return {
        "message": "Page updated successfully",
        "id": str(target_page["_id"]),
        "slug": update_data.get("slug", page.get("slug")),
    }


@router.patch("/{page_id}/autosave")
def autosave_page(
    page_id: str,
    data: UpdatePageData,
    user=Depends(require_permission("page_builder.edit")),
):
    if not ObjectId.is_valid(page_id):
        raise HTTPException(status_code=400, detail="Invalid page ID")

    update_data = {"updated_at": now()}

    if data.title is not None:
        update_data["title"] = data.title.strip()
    if data.layout is not None:
        update_data["layout"] = [w.model_dump() for w in data.layout]
    if data.globals is not None:
        update_data["globals"] = data.globals.model_dump()

    pages_collection.update_one(
        {"_id": ObjectId(page_id)},
        {"$set": update_data},
    )

    return {"message": "Autosaved", "timestamp": now()}


@router.delete("/{page_id}")
def delete_page(
    page_id: str,
    user=Depends(require_permission("page_builder.delete")),
):
    if not ObjectId.is_valid(page_id):
        raise HTTPException(status_code=400, detail="Invalid page ID")

    result = pages_collection.delete_one({"_id": ObjectId(page_id)})

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Page not found")

    return {"message": "Page deleted successfully"}


@router.post("/{page_id}/duplicate")
def duplicate_page(
    page_id: str,
    user=Depends(require_permission("page_builder.create")),
):
    if not ObjectId.is_valid(page_id):
        raise HTTPException(status_code=400, detail="Invalid page ID")

    page = pages_collection.find_one({"_id": ObjectId(page_id)})
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")

    new_slug = f"{page['slug']}-copy"
    counter = 1
    while pages_collection.find_one({"slug": new_slug}):
        new_slug = f"{page['slug']}-copy-{counter}"
        counter += 1

    new_page = {
        "title": f"{page['title']} (Copy)",
        "slug": new_slug,
        "layout": page.get("layout", []),
        "status": "draft",
        "globals": page.get("globals", {}),
        "content_id": "",
        "post_type": page.get("post_type", ""),
        "template_type": page.get("template_type", "page"),
        "conditions": page.get("conditions", {}),
        "show_title": page.get("show_title", True),
        "created_at": now(),
        "updated_at": now(),
    }

    result = pages_collection.insert_one(new_page)

    return {
        "message": "Page duplicated successfully",
        "id": str(result.inserted_id),
        "slug": new_slug,
    }


# ============ GLOBAL STYLES ============

@router.get("/globals/styles")
def get_global_styles(user=Depends(require_permission("page_builder.view"))):
    styles = global_styles_collection.find_one({"type": "global"})
    if not styles:
        return {"colors": [], "fonts": [], "containerWidth": 1140}
    styles["_id"] = str(styles["_id"])
    return styles


@router.put("/globals/styles")
def update_global_styles(
    data: dict,
    user=Depends(require_permission("page_builder.edit")),
):
    global_styles_collection.update_one(
        {"type": "global"},
        {"$set": {**data, "updated_at": now()}},
        upsert=True,
    )
    return {"message": "Global styles updated"}