from datetime import datetime, timezone

from typing import Any, Literal

from bson import ObjectId

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query
)

from pydantic import BaseModel, Field

from backend.database.connection import (
    header_footer_collection,
    menus_collection,
    media_collection
)

from backend.utils.permissions import require_permission


router = APIRouter(
    prefix="/api/header-footer",
    tags=["Header Footer"]
)


class HeaderFooterElement(BaseModel):

    id: str

    type: str

    settings: dict[str, Any] = Field(
        default_factory=dict
    )

    children: list["HeaderFooterElement"] = Field(
        default_factory=list
    )


class HeaderFooterData(BaseModel):

    name: str

    template_type: Literal[
        "header",
        "footer"
    ]

    display: Literal[
        "global",
        "pages"
    ]

    page_ids: list[str] = Field(
        default_factory=list
    )

    priority: int = 10

    status: bool = True

    elements: list[
        HeaderFooterElement
    ] = Field(
        default_factory=list
    )


def serialize_template(
    document
):

    document["id"] = str(
        document["_id"]
    )

    del document["_id"]

    return document


def validate_template_id(
    template_id: str
):

    if not ObjectId.is_valid(
        template_id
    ):

        raise HTTPException(
            status_code=400,
            detail="Invalid template ID."
        )

    return ObjectId(
        template_id
    )


def validate_media_id(
    media_id: str
):

    if not ObjectId.is_valid(
        media_id
    ):

        raise HTTPException(
            status_code=400,
            detail="Invalid media ID."
        )

    media = media_collection.find_one(
        {
            "_id": ObjectId(media_id),
            "is_deleted": False
        }
    )

    if not media:

        raise HTTPException(
            status_code=404,
            detail="Media not found."
        )

    if media.get(
        "file_type"
    ) != "image":

        raise HTTPException(
            status_code=400,
            detail="Selected media must be an image."
        )

    return media


def validate_element_media(
    element: HeaderFooterElement
):

    media_id = element.settings.get(
        "mediaId"
    )

    if media_id:

        media = validate_media_id(
            media_id
        )

        element.settings[
            "src"
        ] = media.get(
            "url",
            element.settings.get(
                "src",
                ""
            )
        )

    for child in element.children:

        validate_element_media(
            child
        )


@router.get(
    "/menus"
)
def get_available_menus(
    current_user=Depends(
        require_permission(
            "design.view"
        )
    )
):

    menus = list(
        menus_collection.find(
            {},
            {
                "_id": 1,
                "name": 1,
                "items": 1
            }
        ).sort(
            "name",
            1
        )
    )


    result = []


    for menu in menus:

        result.append(
            {
                "id": str(
                    menu["_id"]
                ),
                "name": menu.get(
                    "name",
                    ""
                ),
                "items": menu.get(
                    "items",
                    []
                )
            }
        )


    return result


@router.get(
    "/resolve/{template_type}"
)
def resolve_template(
    template_type: str,
    page_id: str | None = Query(
        default=None
    ),
    current_user=Depends(
        require_permission(
            "design.view"
        )
    )
):

    if template_type not in [
        "header",
        "footer"
    ]:

        raise HTTPException(
            status_code=400,
            detail="Invalid template type."
        )


    templates = list(
        header_footer_collection.find(
            {
                "template_type":
                    template_type,
                "status": True
            }
        ).sort(
            [
                (
                    "priority",
                    -1
                ),
                (
                    "updated_at",
                    -1
                )
            ]
        )
    )


    if page_id:

        page_templates = [

            template

            for template in templates

            if template.get(
                "display"
            ) == "pages"

            and page_id in template.get(
                "page_ids",
                []
            )

        ]


        if page_templates:

            return serialize_template(
                page_templates[0]
            )


    global_templates = [

        template

        for template in templates

        if template.get(
            "display"
        ) == "global"

    ]


    if global_templates:

        return serialize_template(
            global_templates[0]
        )


    return None


@router.get("")
def get_templates(
    template_type: str | None = None,
    current_user=Depends(
        require_permission(
            "design.view"
        )
    )
):

    query = {}


    if template_type in [
        "header",
        "footer"
    ]:

        query[
            "template_type"
        ] = template_type


    templates = list(
        header_footer_collection.find(
            query
        ).sort(
            [
                (
                    "template_type",
                    1
                ),
                (
                    "updated_at",
                    -1
                )
            ]
        )
    )


    return [

        serialize_template(
            template
        )

        for template in templates

    ]


@router.get(
    "/{template_id}"
)
def get_template(
    template_id: str,
    current_user=Depends(
        require_permission(
            "design.view"
        )
    )
):

    object_id = validate_template_id(
        template_id
    )


    template = (
        header_footer_collection.find_one(
            {
                "_id": object_id
            }
        )
    )


    if not template:

        raise HTTPException(
            status_code=404,
            detail="Template not found."
        )


    return serialize_template(
        template
    )


@router.post("")
def create_template(
    data: HeaderFooterData,
    current_user=Depends(
        require_permission(
            "design.edit"
        )
    )
):

    if (
        data.display == "pages"
        and not data.page_ids
    ):

        raise HTTPException(
            status_code=400,
            detail="Please select at least one page."
        )


    if (
        data.display == "global"
    ):

        data.page_ids = []


    for element in data.elements:

        validate_element_media(
            element
        )


    now = datetime.now(
        timezone.utc
    )


    document = data.model_dump()


    document[
        "created_at"
    ] = now

    document[
        "updated_at"
    ] = now


    if (
        data.display == "global"
        and data.status
    ):

        header_footer_collection.update_many(
            {
                "template_type":
                    data.template_type,
                "display":
                    "global",
                "status": True
            },
            {
                "$set": {
                    "status": False,
                    "updated_at": now
                }
            }
        )


    result = (
        header_footer_collection.insert_one(
            document
        )
    )


    return {
        "message":
            "Template created successfully.",
        "id":
            str(
                result.inserted_id
            )
    }


@router.put(
    "/{template_id}"
)
def update_template(
    template_id: str,
    data: HeaderFooterData,
    current_user=Depends(
        require_permission(
            "design.edit"
        )
    )
):

    object_id = validate_template_id(
        template_id
    )


    existing = (
        header_footer_collection.find_one(
            {
                "_id": object_id
            }
        )
    )


    if not existing:

        raise HTTPException(
            status_code=404,
            detail="Template not found."
        )


    if (
        data.display == "pages"
        and not data.page_ids
    ):

        raise HTTPException(
            status_code=400,
            detail="Please select at least one page."
        )


    if (
        data.display == "global"
    ):

        data.page_ids = []


    for element in data.elements:

        validate_element_media(
            element
        )


    now = datetime.now(
        timezone.utc
    )


    document = data.model_dump()


    document[
        "updated_at"
    ] = now


    if (
        data.display == "global"
        and data.status
    ):

        header_footer_collection.update_many(
            {
                "_id": {
                    "$ne":
                        object_id
                },
                "template_type":
                    data.template_type,
                "display":
                    "global",
                "status": True
            },
            {
                "$set": {
                    "status": False,
                    "updated_at": now
                }
            }
        )


    header_footer_collection.update_one(
        {
            "_id":
                object_id
        },
        {
            "$set":
                document
        }
    )


    return {
        "message":
            "Template updated successfully."
    }


@router.delete(
    "/{template_id}"
)
def delete_template(
    template_id: str,
    current_user=Depends(
        require_permission(
            "design.edit"
        )
    )
):

    object_id = validate_template_id(
        template_id
    )


    result = (
        header_footer_collection.delete_one(
            {
                "_id":
                    object_id
            }
        )
    )


    if result.deleted_count == 0:

        raise HTTPException(
            status_code=404,
            detail="Template not found."
        )


    return {
        "message":
            "Template deleted successfully."
    }
