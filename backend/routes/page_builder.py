
from fastapi import (
    APIRouter,
    HTTPException,
    Depends
)

from bson import ObjectId

from datetime import datetime, timezone

from backend.database.connection import pages_collection

from backend.utils.permissions import require_permission


router = APIRouter(
    prefix="/api/page-builder",
    tags=["Page Builder"]
)


def now():

    return datetime.now(
        timezone.utc
    )


def page_response(page):

    return {
        "id": str(
            page["_id"]
        ),
        "title": page.get(
            "title",
            ""
        ),
        "slug": page.get(
            "slug",
            ""
        ),
        "layout": page.get(
            "layout",
            []
        ),
        "status": page.get(
            "status",
            "draft"
        ),
        "created_at": page.get(
            "created_at"
        ),
        "updated_at": page.get(
            "updated_at"
        )
    }


@router.get("")
def get_pages(

    user=Depends(
        require_permission(
            "page_builder.view"
        )
    )

):

    pages = pages_collection.find().sort(
        "updated_at",
        -1
    )

    return [
        page_response(
            page
        )
        for page in pages
    ]


@router.get(
    "/public/{slug}"
)
def get_public_page(

    slug: str

):

    page = pages_collection.find_one(
        {
            "slug": slug,
            "status": "published"
        }
    )

    if not page:

        raise HTTPException(
            status_code=404,
            detail="Page not found"
        )

    return page_response(
        page
    )


@router.get(
    "/{page_id}"
)
def get_page(

    page_id: str,

    user=Depends(
        require_permission(
            "page_builder.view"
        )
    )

):

    if not ObjectId.is_valid(
        page_id
    ):

        raise HTTPException(
            status_code=400,
            detail="Invalid page ID"
        )

    page = pages_collection.find_one(
        {
            "_id": ObjectId(
                page_id
            )
        }
    )

    if not page:

        raise HTTPException(
            status_code=404,
            detail="Page not found"
        )

    return page_response(
        page
    )


@router.post("")
def create_page(

    data: dict,

    user=Depends(
        require_permission(
            "page_builder.create"
        )
    )

):

    title = data.get(
        "title",
        ""
    ).strip()

    slug = data.get(
        "slug",
        ""
    ).strip().lower()

    layout = data.get(
        "layout",
        []
    )

    status = data.get(
        "status",
        "draft"
    )

    if not title:

        raise HTTPException(
            status_code=400,
            detail="Page title is required"
        )

    if not slug:

        raise HTTPException(
            status_code=400,
            detail="Page slug is required"
        )

    if not isinstance(
        layout,
        list
    ):

        raise HTTPException(
            status_code=400,
            detail="Layout must be a list"
        )

    if status not in [
        "draft",
        "published"
    ]:

        status = "draft"

    existing_page = pages_collection.find_one(
        {
            "slug": slug
        }
    )

    if existing_page:

        raise HTTPException(
            status_code=400,
            detail="This page slug already exists"
        )

    page = {

        "title": title,

        "slug": slug,

        "layout": layout,

        "status": status,

        "created_at": now(),

        "updated_at": now()

    }

    result = pages_collection.insert_one(
        page
    )

    return {
        "message": "Page created successfully",
        "id": str(
            result.inserted_id
        )
    }


@router.put(
    "/{page_id}"
)
def update_page(

    page_id: str,

    data: dict,

    user=Depends(
        require_permission(
            "page_builder.edit"
        )
    )

):

    if not ObjectId.is_valid(
        page_id
    ):

        raise HTTPException(
            status_code=400,
            detail="Invalid page ID"
        )

    page = pages_collection.find_one(
        {
            "_id": ObjectId(
                page_id
            )
        }
    )

    if not page:

        raise HTTPException(
            status_code=404,
            detail="Page not found"
        )

    title = data.get(
        "title",
        page.get(
            "title",
            ""
        )
    ).strip()

    slug = data.get(
        "slug",
        page.get(
            "slug",
            ""
        )
    ).strip().lower()

    layout = data.get(
        "layout",
        page.get(
            "layout",
            []
        )
    )

    status = data.get(
        "status",
        page.get(
            "status",
            "draft"
        )
    )

    if not title:

        raise HTTPException(
            status_code=400,
            detail="Page title is required"
        )

    if not slug:

        raise HTTPException(
            status_code=400,
            detail="Page slug is required"
        )

    if not isinstance(
        layout,
        list
    ):

        raise HTTPException(
            status_code=400,
            detail="Layout must be a list"
        )

    if status not in [
        "draft",
        "published"
    ]:

        raise HTTPException(
            status_code=400,
            detail="Invalid page status"
        )

    existing_page = pages_collection.find_one(
        {
            "slug": slug,
            "_id": {
                "$ne": ObjectId(
                    page_id
                )
            }
        }
    )

    if existing_page:

        raise HTTPException(
            status_code=400,
            detail="This page slug already exists"
        )

    pages_collection.update_one(

        {
            "_id": ObjectId(
                page_id
            )
        },

        {
            "$set": {

                "title": title,

                "slug": slug,

                "layout": layout,

                "status": status,

                "updated_at": now()

            }
        }

    )

    return {
        "message": "Page updated successfully"
    }


@router.delete(
    "/{page_id}"
)
def delete_page(

    page_id: str,

    user=Depends(
        require_permission(
            "page_builder.delete"
        )
    )

):

    if not ObjectId.is_valid(
        page_id
    ):

        raise HTTPException(
            status_code=400,
            detail="Invalid page ID"
        )

    result = pages_collection.delete_one(
        {
            "_id": ObjectId(
                page_id
            )
        }
    )

    if result.deleted_count == 0:

        raise HTTPException(
            status_code=404,
            detail="Page not found"
        )

    return {
        "message": "Page deleted successfully"
    }