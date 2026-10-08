import os
import uuid
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, UploadFile, File, HTTPException, Query, Depends
from fastapi.responses import FileResponse

from database.connection import media_collection
from backend.utils.permissions import require_permission


router = APIRouter(
    prefix="/api/media",
    tags=["Media"]
)


UPLOAD_DIR = "uploads/media"

os.makedirs(
    UPLOAD_DIR,
    exist_ok=True
)


ALLOWED_EXTENSIONS = {
    "jpg",
    "jpeg",
    "png",
    "webp",
    "gif",
    "svg",
    "pdf",
    "doc",
    "docx",
    "xls",
    "xlsx",
    "csv",
    "psd"
}


def get_file_type(
    extension: str
):
    if extension in {
        "jpg",
        "jpeg",
        "png",
        "webp",
        "gif",
        "svg"
    }:
        return "image"

    if extension == "pdf":
        return "pdf"

    if extension in {
        "doc",
        "docx"
    }:
        return "document"

    if extension in {
        "xls",
        "xlsx",
        "csv"
    }:
        return "spreadsheet"

    return "other"


@router.post(
    "/upload",
    dependencies=[
        Depends(
            require_permission(
                "media.create"
            )
        )
    ]
)
async def upload_media(
    files: list[UploadFile] = File(...)
):

    uploaded = []

    for file in files:

        original_name = (
            file.filename
            or "file"
        )

        extension = (
            original_name
            .split(".")[-1]
            .lower()
        )

        if extension not in ALLOWED_EXTENSIONS:
            continue

        unique_name = (
            f"{uuid.uuid4().hex}."
            f"{extension}"
        )

        file_path = os.path.join(
            UPLOAD_DIR,
            unique_name
        )

        content = await file.read()

        with open(
            file_path,
            "wb"
        ) as output_file:
            output_file.write(
                content
            )

        media_data = {
            "file_name": unique_name,
            "original_name": original_name,
            "title": original_name,
            "alt_text": "",
            "description": "",
            "mime_type": file.content_type,
            "file_type": get_file_type(
                extension
            ),
            "extension": extension,
            "file_size": len(content),
            "url": (
                f"/uploads/media/"
                f"{unique_name}"
            ),
            "is_deleted": False,
            "created_at": datetime.now(
                timezone.utc
            ),
            "updated_at": datetime.now(
                timezone.utc
            )
        }

        result = (
            media_collection.insert_one(
                media_data
            )
        )

        media_data["_id"] = str(
            result.inserted_id
        )

        uploaded.append(
            media_data
        )

    return {
        "message": "Media uploaded successfully",
        "items": uploaded
    }


@router.get(
    "/",
    dependencies=[
        Depends(
            require_permission(
                "media.view"
            )
        )
    ]
)
async def get_media(
    search: str = "",
    file_type: str = "",
    page: int = 1,
    limit: int = 50
):

    skip = (
        page - 1
    ) * limit

    query = {
        "is_deleted": False
    }

    if search:
        query["$or"] = [
            {
                "original_name": {
                    "$regex": search,
                    "$options": "i"
                }
            },
            {
                "title": {
                    "$regex": search,
                    "$options": "i"
                }
            }
        ]

    if file_type:
        query["file_type"] = file_type

    total = (
        media_collection.count_documents(
            query
        )
    )

    items = list(
        media_collection
        .find(query)
        .sort(
            "created_at",
            -1
        )
        .skip(skip)
        .limit(limit)
    )

    for item in items:

        item["_id"] = str(
            item["_id"]
        )

    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit
    }


@router.post(
    "/bulk-delete",
    dependencies=[
        Depends(
            require_permission(
                "media.delete"
            )
        )
    ]
)
async def bulk_delete_media(
    media_ids: list[str]
):

    object_ids = []

    for media_id in media_ids:

        if ObjectId.is_valid(
            media_id
        ):
            object_ids.append(
                ObjectId(media_id)
            )

    if not object_ids:
        raise HTTPException(
            status_code=400,
            detail="No valid media IDs"
        )

    result = (
        media_collection.update_many(
            {
                "_id": {
                    "$in": object_ids
                }
            },
            {
                "$set": {
                    "is_deleted": True,
                    "updated_at": datetime.now(
                        timezone.utc
                    )
                }
            }
        )
    )

    return {
        "message": "Media moved to trash",
        "count": result.modified_count
    }


@router.get(
    "/trash",
    dependencies=[
        Depends(
            require_permission(
                "media.view"
            )
        )
    ]
)
async def get_media_trash(
    search: str = "",
    file_type: str = "",
    page: int = 1,
    limit: int = 50
):

    skip = (
        page - 1
    ) * limit

    query = {
        "is_deleted": True
    }

    if search:
        query["$or"] = [
            {
                "original_name": {
                    "$regex": search,
                    "$options": "i"
                }
            },
            {
                "title": {
                    "$regex": search,
                    "$options": "i"
                }
            }
        ]

    if file_type:
        query["file_type"] = file_type

    total = (
        media_collection.count_documents(
            query
        )
    )

    items = list(
        media_collection
        .find(query)
        .sort(
            "updated_at",
            -1
        )
        .skip(skip)
        .limit(limit)
    )

    for item in items:

        item["_id"] = str(
            item["_id"]
        )

    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit
    }


@router.post(
    "/bulk-restore",
    dependencies=[
        Depends(
            require_permission(
                "media.edit"
            )
        )
    ]
)
async def bulk_restore_media(
    media_ids: list[str]
):

    object_ids = []

    for media_id in media_ids:

        if ObjectId.is_valid(
            media_id
        ):
            object_ids.append(
                ObjectId(media_id)
            )

    if not object_ids:
        raise HTTPException(
            status_code=400,
            detail="No valid media IDs"
        )

    result = (
        media_collection.update_many(
            {
                "_id": {
                    "$in": object_ids
                },
                "is_deleted": True
            },
            {
                "$set": {
                    "is_deleted": False,
                    "updated_at": datetime.now(
                        timezone.utc
                    )
                }
            }
        )
    )

    return {
        "message": "Media restored successfully",
        "count": result.modified_count
    }


@router.post(
    "/bulk-permanent-delete",
    dependencies=[
        Depends(
            require_permission(
                "media.delete"
            )
        )
    ]
)
async def bulk_permanent_delete_media(
    media_ids: list[str]
):

    object_ids = []

    for media_id in media_ids:

        if ObjectId.is_valid(
            media_id
        ):
            object_ids.append(
                ObjectId(media_id)
            )

    if not object_ids:
        raise HTTPException(
            status_code=400,
            detail="No valid media IDs"
        )

    media_items = list(
        media_collection.find(
            {
                "_id": {
                    "$in": object_ids
                },
                "is_deleted": True
            }
        )
    )

    deleted_count = 0

    for media in media_items:

        file_name = media.get(
            "file_name"
        )

        if file_name:

            file_path = os.path.join(
                UPLOAD_DIR,
                file_name
            )

            if os.path.exists(
                file_path
            ):

                os.remove(
                    file_path
                )

        result = (
            media_collection.delete_one(
                {
                    "_id": media["_id"],
                    "is_deleted": True
                }
            )
        )

        deleted_count += (
            result.deleted_count
        )

    return {
        "message": "Media permanently deleted",
        "count": deleted_count
    }


@router.delete(
    "/empty-trash",
    dependencies=[
        Depends(
            require_permission(
                "media.delete"
            )
        )
    ]
)
async def empty_media_trash():

    media_items = list(
        media_collection.find(
            {
                "is_deleted": True
            }
        )
    )

    deleted_count = 0

    for media in media_items:

        file_name = media.get(
            "file_name"
        )

        if file_name:

            file_path = os.path.join(
                UPLOAD_DIR,
                file_name
            )

            if os.path.exists(
                file_path
            ):

                os.remove(
                    file_path
                )

        result = (
            media_collection.delete_one(
                {
                    "_id": media["_id"],
                    "is_deleted": True
                }
            )
        )

        deleted_count += (
            result.deleted_count
        )

    return {
        "message": "Media trash emptied successfully",
        "count": deleted_count
    }


@router.get(
    "/{media_id}",
    dependencies=[
        Depends(
            require_permission(
                "media.view"
            )
        )
    ]
)
async def get_media_by_id(
    media_id: str
):

    if not ObjectId.is_valid(
        media_id
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid media ID"
        )

    media = (
        media_collection.find_one(
            {
                "_id": ObjectId(
                    media_id
                ),
                "is_deleted": False
            }
        )
    )

    if not media:
        raise HTTPException(
            status_code=404,
            detail="Media not found"
        )

    media["_id"] = str(
        media["_id"]
    )

    return media


@router.put(
    "/{media_id}",
    dependencies=[
        Depends(
            require_permission(
                "media.edit"
            )
        )
    ]
)
async def update_media(
    media_id: str,
    title: str = "",
    alt_text: str = "",
    description: str = ""
):

    if not ObjectId.is_valid(
        media_id
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid media ID"
        )

    result = (
        media_collection.update_one(
            {
                "_id": ObjectId(
                    media_id
                ),
                "is_deleted": False
            },
            {
                "$set": {
                    "title": title,
                    "alt_text": alt_text,
                    "description": description,
                    "updated_at": datetime.now(
                        timezone.utc
                    )
                }
            }
        )
    )

    if result.matched_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Media not found"
        )

    return {
        "message": "Media updated successfully"
    }


@router.delete(
    "/{media_id}",
    dependencies=[
        Depends(
            require_permission(
                "media.delete"
            )
        )
    ]
)
async def delete_media(
    media_id: str
):

    if not ObjectId.is_valid(
        media_id
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid media ID"
        )

    result = (
        media_collection.update_one(
            {
                "_id": ObjectId(
                    media_id
                )
            },
            {
                "$set": {
                    "is_deleted": True,
                    "updated_at": datetime.now(
                        timezone.utc
                    )
                }
            }
        )
    )

    if result.matched_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Media not found"
        )

    return {
        "message": "Media moved to trash"
    }


@router.post(
    "/{media_id}/restore",
    dependencies=[
        Depends(
            require_permission(
                "media.edit"
            )
        )
    ]
)
async def restore_media(
    media_id: str
):

    if not ObjectId.is_valid(
        media_id
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid media ID"
        )

    result = (
        media_collection.update_one(
            {
                "_id": ObjectId(
                    media_id
                ),
                "is_deleted": True
            },
            {
                "$set": {
                    "is_deleted": False,
                    "updated_at": datetime.now(
                        timezone.utc
                    )
                }
            }
        )
    )

    if result.matched_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Media not found in trash"
        )

    return {
        "message": "Media restored successfully"
    }


@router.delete(
    "/{media_id}/permanent",
    dependencies=[
        Depends(
            require_permission(
                "media.delete"
            )
        )
    ]
)
async def permanent_delete_media(
    media_id: str
):

    if not ObjectId.is_valid(
        media_id
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid media ID"
        )

    media = (
        media_collection.find_one(
            {
                "_id": ObjectId(
                    media_id
                ),
                "is_deleted": True
            }
        )
    )

    if not media:
        raise HTTPException(
            status_code=404,
            detail="Media not found in trash"
        )

    file_name = media.get(
        "file_name"
    )

    if file_name:

        file_path = os.path.join(
            UPLOAD_DIR,
            file_name
        )

        if os.path.exists(
            file_path
        ):

            os.remove(
                file_path
            )

    result = (
        media_collection.delete_one(
            {
                "_id": ObjectId(
                    media_id
                ),
                "is_deleted": True
            }
        )
    )

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Media not found in trash"
        )

    return {
        "message": "Media permanently deleted"
    }