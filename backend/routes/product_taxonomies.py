import re
from datetime import datetime, timezone
from typing import Literal

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from backend.database.connection import product_taxonomies_collection
from backend.utils.permissions import require_permission

router = APIRouter(prefix="/api/product-taxonomies", tags=["Product taxonomies"])
TermType = Literal["categories", "tags", "attributes", "brands"]


class TermPayload(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    slug: str = Field(default="", max_length=150)
    description: str = Field(default="", max_length=2000)
    parent: str = Field(default="", max_length=120)
    options: list[str] = Field(default_factory=list, max_length=100)


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "term"


def _serialize(term: dict) -> dict:
    return {
        "id": str(term["_id"]),
        "type": term["type"],
        "name": term["name"],
        "slug": term["slug"],
        "description": term.get("description", ""),
        "parent": term.get("parent", ""),
        "options": term.get("options", []),
    }


@router.get("/{term_type}")
def list_terms(
    term_type: TermType,
    current_user=Depends(require_permission("products.view")),
):
    terms = product_taxonomies_collection.find(
        {"type": term_type, "is_deleted": {"$ne": True}}
    ).sort("name", 1)
    return {"terms": [_serialize(term) for term in terms]}


@router.post("/{term_type}")
def create_term(
    term_type: TermType,
    payload: TermPayload,
    current_user=Depends(require_permission("products.create")),
):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    slug = _slugify(payload.slug.strip() or name)
    if product_taxonomies_collection.find_one(
        {"type": term_type, "slug": slug, "is_deleted": {"$ne": True}}
    ):
        raise HTTPException(status_code=409, detail="A term with this slug already exists")

    term = {
        "type": term_type,
        "name": name,
        "slug": slug,
        "description": payload.description.strip(),
        "parent": payload.parent.strip(),
        "options": [option.strip() for option in payload.options if option.strip()],
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    result = product_taxonomies_collection.insert_one(term)
    term["_id"] = result.inserted_id
    return _serialize(term)


@router.put("/{term_type}/{term_id}")
def update_term(
    term_type: TermType,
    term_id: str,
    payload: TermPayload,
    current_user=Depends(require_permission("products.edit")),
):
    if not ObjectId.is_valid(term_id):
        raise HTTPException(status_code=400, detail="Invalid term ID")
    term_oid = ObjectId(term_id)
    existing = product_taxonomies_collection.find_one(
        {"_id": term_oid, "type": term_type, "is_deleted": {"$ne": True}}
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Term not found")

    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    slug = _slugify(payload.slug.strip() or name)
    duplicate = product_taxonomies_collection.find_one({
        "type": term_type,
        "slug": slug,
        "_id": {"$ne": term_oid},
        "is_deleted": {"$ne": True},
    })
    if duplicate:
        raise HTTPException(status_code=409, detail="A term with this slug already exists")

    updates = {
        "name": name,
        "slug": slug,
        "description": payload.description.strip(),
        "parent": payload.parent.strip(),
        "options": [option.strip() for option in payload.options if option.strip()],
        "updated_at": datetime.now(timezone.utc),
    }
    product_taxonomies_collection.update_one({"_id": term_oid}, {"$set": updates})
    return _serialize({**existing, **updates})


@router.delete("/{term_type}/{term_id}")
def delete_term(
    term_type: TermType,
    term_id: str,
    current_user=Depends(require_permission("products.delete")),
):
    if not ObjectId.is_valid(term_id):
        raise HTTPException(status_code=400, detail="Invalid term ID")
    result = product_taxonomies_collection.update_one(
        {"_id": ObjectId(term_id), "type": term_type, "is_deleted": {"$ne": True}},
        {"$set": {"is_deleted": True, "updated_at": datetime.now(timezone.utc)}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Term not found")
    return {"message": "Term moved to trash"}
