from fastapi import APIRouter, Form, HTTPException, Depends
from bson import ObjectId

from database.connection import content_collection, settings_collection

from backend.utils.permissions import require_permission


router = APIRouter(
    prefix="/api/settings",
    tags=["Settings"]
)


DEFAULT_SETTINGS = {
    "homepage_type": "latest_posts",
    "homepage_id": "",
    "posts_page_id": "",
    "search_engine_visibility": False
}


@router.get(
    "/reading"
)
def get_reading_settings(
    user=Depends(
        require_permission(
            "settings.view"
        )
    )
):

    settings = settings_collection.find_one(
        {
            "type": "reading"
        }
    )


    if not settings:

        settings_collection.insert_one(
            {
                "type": "reading",
                **DEFAULT_SETTINGS
            }
        )

        return DEFAULT_SETTINGS


    return {
        "homepage_type": settings.get(
            "homepage_type",
            "latest_posts"
        ),
        "homepage_id": settings.get(
            "homepage_id",
            ""
        ),
        "posts_page_id": settings.get(
            "posts_page_id",
            ""
        ),
        "search_engine_visibility": settings.get(
            "search_engine_visibility",
            False
        )
    }


@router.put(
    "/reading"
)
def update_reading_settings(
    homepage_type: str = Form(...),
    homepage_id: str = Form(""),
    posts_page_id: str = Form(""),
    search_engine_visibility: bool = Form(False),
    user=Depends(
        require_permission(
            "settings.edit"
        )
    )
):

    if homepage_type not in [
        "latest_posts",
        "static"
    ]:

        raise HTTPException(
            status_code=400,
            detail="Invalid homepage type"
        )

    if homepage_type == "static":

        if not ObjectId.is_valid(homepage_id):

            raise HTTPException(
                status_code=400,
                detail="Select a published page for the homepage"
            )

        homepage = content_collection.find_one(
            {
                "_id": ObjectId(homepage_id),
                "post_type": "pages",
                "status": "published",
                "is_deleted": False
            }
        )

        if not homepage:

            raise HTTPException(
                status_code=400,
                detail="Homepage must be a published page"
            )


    settings_collection.update_one(
        {
            "type": "reading"
        },
        {
            "$set": {
                "type": "reading",
                "homepage_type": homepage_type,
                "homepage_id": homepage_id,
                "posts_page_id": posts_page_id,
                "search_engine_visibility":
                    search_engine_visibility
            }
        },
        upsert=True
    )


    return {
        "message": "Reading settings updated successfully"
    }