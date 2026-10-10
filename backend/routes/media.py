
import os
import uuid
from datetime import datetime, timezone

from bson import ObjectId
from gridfs import GridFSBucket
from gridfs.errors import NoFile
from fastapi import (
    APIRouter,
    UploadFile,
    File,
    HTTPException,
    Depends,
)
from fastapi.responses import StreamingResponse

from backend.database.connection import media_collection
from backend.utils.permissions import require_permission


router = APIRouter(
    prefix="/api/media",
    tags=["Media"],
)


# Project paths
PROJECT_ROOT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..")
)

# Retained only for compatibility with previously uploaded local files.
UPLOAD_DIR = os.path.join(
    PROJECT_ROOT,
    "uploads",
    "media",
)


# MongoDB GridFS storage for persistent media files.
# Creates media_files.files and media_files.chunks collections.
media_bucket = GridFSBucket(
    media_collection.database,
    bucket_name="media_files",
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
    "psd",
}


def get_file_type(extension: str) -> str:
    if extension in {
        "jpg",
        "jpeg",
        "png",
        "webp",
        "gif",
        "svg",
    }:
        return "image"

    if extension == "pdf":
        return "pdf"

    if extension in {"doc", "docx"}:
        return "document"

    if extension in {"xls", "xlsx", "csv"}:
        return "spreadsheet"

    return "other"


def delete_media_file(media: dict) -> None:
    """
    Delete a GridFS file, or a legacy local file.
    """

    gridfs_id = media.get("gridfs_id")

    if gridfs_id:
        try:
            media_bucket.delete(
                ObjectId(str(gridfs_id))
            )
        except NoFile:
            pass

        return

    # Compatibility with records created before GridFS.
    file_name = media.get("file_name")

    if file_name:
        file_path = os.path.abspath(
            os.path.join(UPLOAD_DIR, file_name)
        )

        # Prevent paths outside the upload directory.
        if (
            os.path.commonpath([UPLOAD_DIR, file_path])
            == os.path.abspath(UPLOAD_DIR)
            and os.path.isfile(file_path)
        ):
            os.remove(file_path)


def serialize_media(media: dict) -> dict:
    """
    Convert MongoDB ObjectId fields to strings for JSON.
    """

    media["_id"] = str(media["_id"])

    if media.get("gridfs_id"):
        media["gridfs_id"] = str(media["gridfs_id"])

    return media


def stream_gridfs_file(file_stream):
    """
    Stream a file in chunks instead of loading it all into memory.
    """

    try:
        while True:
            chunk = file_stream.read(1024 * 1024)

            if not chunk:
                break

            yield chunk
    finally:
        file_stream.close()


# --------------------------------------------------
# UPLOAD MEDIA
# POST /api/media/upload
# --------------------------------------------------

@router.post(
    "/upload",
    dependencies=[
        Depends(require_permission("media.create"))
    ],
)
async def upload_media(
    files: list[UploadFile] = File(...),
):
    uploaded = []

    for file in files:
        original_name = (
            os.path.basename(file.filename or "file")
        )

        if "." not in original_name:
            await file.close()
            raise HTTPException(
                status_code=400,
                detail=f"File extension is missing: {original_name}",
            )

        extension = original_name.rsplit(".", 1)[-1].lower()

        if extension not in ALLOWED_EXTENSIONS:
            await file.close()
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {extension}",
            )

        unique_name = (
            f"{uuid.uuid4().hex}.{extension}"
        )

        content = await file.read()
        await file.close()

        if not content:
            raise HTTPException(
                status_code=400,
                detail=f"File is empty: {original_name}",
            )

        gridfs_id = None

        try:
            # Save file content in MongoDB GridFS.
            gridfs_id = media_bucket.upload_from_stream(
                unique_name,
                content,
                metadata={
                    "contentType": (
                        file.content_type
                        or "application/octet-stream"
                    ),
                    "original_name": original_name,
                },
            )

            now = datetime.now(timezone.utc)

            media_data = {
                "file_name": unique_name,
                "original_name": original_name,
                "title": original_name,
                "alt_text": "",
                "description": "",
                "mime_type": (
                    file.content_type
                    or "application/octet-stream"
                ),
                "file_type": get_file_type(extension),
                "extension": extension,
                "file_size": len(content),
                "gridfs_id": gridfs_id,
                "url": f"/api/media/file/{gridfs_id}",
                "is_deleted": False,
                "created_at": now,
                "updated_at": now,
            }

            result = media_collection.insert_one(
                media_data
            )

            media_data["_id"] = str(
                result.inserted_id
            )
            media_data["gridfs_id"] = str(
                gridfs_id
            )

            uploaded.append(media_data)

        except Exception:
            # Avoid leaving an orphaned GridFS file if
            # saving its metadata fails.
            if gridfs_id is not None:
                try:
                    media_bucket.delete(gridfs_id)
                except Exception:
                    pass

            raise HTTPException(
                status_code=500,
                detail="Media upload failed. Check the backend runtime logs.",
            )

    return {
        "message": "Media uploaded successfully",
        "items": uploaded,
    }


# --------------------------------------------------
# SERVE MEDIA FILE
# GET /api/media/file/{file_id}
# --------------------------------------------------

@router.get("/file/{file_id}")
async def get_media_file(file_id: str):
    """
    File URLs are directly accessible to browser image elements.
    Access control for uploading and managing media remains enforced
    by the corresponding management endpoints.
    """

    if not ObjectId.is_valid(file_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid file ID",
        )

    try:
        file_stream = media_bucket.open_download_stream(
            ObjectId(file_id)
        )
    except NoFile:
        raise HTTPException(
            status_code=404,
            detail="File not found",
        )
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Unable to read media file",
        )

    metadata = file_stream.metadata or {}

    content_type = metadata.get(
        "contentType",
        "application/octet-stream",
    )

    headers = {
        "Content-Disposition": (
            f'inline; filename="{file_stream.filename}"'
        ),
        "X-Content-Type-Options": "nosniff",
    }

    return StreamingResponse(
        stream_gridfs_file(file_stream),
        media_type=content_type,
        headers=headers,
    )


# --------------------------------------------------
# GET MEDIA LIST
# GET /api/media/
# --------------------------------------------------

@router.get(
    "/",
    dependencies=[
        Depends(require_permission("media.view"))
    ],
)
async def get_media(
    search: str = "",
    file_type: str = "",
    page: int = 1,
    limit: int = 50,
):
    if page < 1 or limit < 1:
        raise HTTPException(
            status_code=400,
            detail="Page and limit must be positive",
        )

    limit = min(limit, 100)
    skip = (page - 1) * limit

    query = {"is_deleted": False}

    if search:
        query["$or"] = [
            {
                "original_name": {
                    "$regex": search,
                    "$options": "i",
                }
            },
            {
                "title": {
                    "$regex": search,
                    "$options": "i",
                }
            },
        ]

    if file_type:
        query["file_type"] = file_type

    total = media_collection.count_documents(query)

    items = list(
        media_collection.find(query)
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
    )

    return {
        "items": [
            serialize_media(item)
            for item in items
        ],
        "total": total,
        "page": page,
        "limit": limit,
    }


# --------------------------------------------------
# BULK MOVE TO TRASH
# POST /api/media/bulk-delete
# --------------------------------------------------

@router.post(
    "/bulk-delete",
    dependencies=[
        Depends(require_permission("media.delete"))
    ],
)
async def bulk_delete_media(
    media_ids: list[str],
):
    object_ids = [
        ObjectId(media_id)
        for media_id in media_ids
        if ObjectId.is_valid(media_id)
    ]

    if not object_ids:
        raise HTTPException(
            status_code=400,
            detail="No valid media IDs",
        )

    result = media_collection.update_many(
        {"_id": {"$in": object_ids}},
        {
            "$set": {
                "is_deleted": True,
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )

    return {
        "message": "Media moved to trash",
        "count": result.modified_count,
    }


# --------------------------------------------------
# GET TRASH
# GET /api/media/trash
# --------------------------------------------------

@router.get(
    "/trash",
    dependencies=[
        Depends(require_permission("media.view"))
    ],
)
async def get_media_trash(
    search: str = "",
    file_type: str = "",
    page: int = 1,
    limit: int = 50,
):
    if page < 1 or limit < 1:
        raise HTTPException(
            status_code=400,
            detail="Page and limit must be positive",
        )

    limit = min(limit, 100)
    skip = (page - 1) * limit

    query = {"is_deleted": True}

    if search:
        query["$or"] = [
            {
                "original_name": {
                    "$regex": search,
                    "$options": "i",
                }
            },
            {
                "title": {
                    "$regex": search,
                    "$options": "i",
                }
            },
        ]

    if file_type:
        query["file_type"] = file_type

    total = media_collection.count_documents(query)

    items = list(
        media_collection.find(query)
        .sort("updated_at", -1)
        .skip(skip)
        .limit(limit)
    )

    return {
        "items": [
            serialize_media(item)
            for item in items
        ],
        "total": total,
        "page": page,
        "limit": limit,
    }


# --------------------------------------------------
# BULK RESTORE
# POST /api/media/bulk-restore
# --------------------------------------------------

@router.post(
    "/bulk-restore",
    dependencies=[
        Depends(require_permission("media.edit"))
    ],
)
async def bulk_restore_media(
    media_ids: list[str],
):
    object_ids = [
        ObjectId(media_id)
        for media_id in media_ids
        if ObjectId.is_valid(media_id)
    ]

    if not object_ids:
        raise HTTPException(
            status_code=400,
            detail="No valid media IDs",
        )

    result = media_collection.update_many(
        {
            "_id": {"$in": object_ids},
            "is_deleted": True,
        },
        {
            "$set": {
                "is_deleted": False,
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )

    return {
        "message": "Media restored successfully",
        "count": result.modified_count,
    }


# --------------------------------------------------
# BULK PERMANENT DELETE
# POST /api/media/bulk-permanent-delete
# --------------------------------------------------

@router.post(
    "/bulk-permanent-delete",
    dependencies=[
        Depends(require_permission("media.delete"))
    ],
)
async def bulk_permanent_delete_media(
    media_ids: list[str],
):
    object_ids = [
        ObjectId(media_id)
        for media_id in media_ids
        if ObjectId.is_valid(media_id)
    ]

    if not object_ids:
        raise HTTPException(
            status_code=400,
            detail="No valid media IDs",
        )

    media_items = list(
        media_collection.find(
            {
                "_id": {"$in": object_ids},
                "is_deleted": True,
            }
        )
    )

    deleted_count = 0

    for media in media_items:
        delete_media_file(media)

        result = media_collection.delete_one(
            {
                "_id": media["_id"],
                "is_deleted": True,
            }
        )

        deleted_count += result.deleted_count

    return {
        "message": "Media permanently deleted",
        "count": deleted_count,
    }


# --------------------------------------------------
# EMPTY TRASH
# DELETE /api/media/empty-trash
# --------------------------------------------------

@router.delete(
    "/empty-trash",
    dependencies=[
        Depends(require_permission("media.delete"))
    ],
)
async def empty_media_trash():
    media_items = list(
        media_collection.find(
            {"is_deleted": True}
        )
    )

    deleted_count = 0

    for media in media_items:
        delete_media_file(media)

        result = media_collection.delete_one(
            {
                "_id": media["_id"],
                "is_deleted": True,
            }
        )

        deleted_count += result.deleted_count

    return {
        "message": "Media trash emptied successfully",
        "count": deleted_count,
    }


# --------------------------------------------------
# GET MEDIA BY ID
# GET /api/media/{media_id}
# --------------------------------------------------

@router.get(
    "/{media_id}",
    dependencies=[
        Depends(require_permission("media.view"))
    ],
)
async def get_media_by_id(
    media_id: str,
):
    if not ObjectId.is_valid(media_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid media ID",
        )

    media = media_collection.find_one(
        {
            "_id": ObjectId(media_id),
            "is_deleted": False,
        }
    )

    if not media:
        raise HTTPException(
            status_code=404,
            detail="Media not found",
        )

    return serialize_media(media)


# --------------------------------------------------
# UPDATE MEDIA DETAILS
# PUT /api/media/{media_id}
# --------------------------------------------------

@router.put(
    "/{media_id}",
    dependencies=[
        Depends(require_permission("media.edit"))
    ],
)
async def update_media(
    media_id: str,
    title: str = "",
    alt_text: str = "",
    description: str = "",
):
    if not ObjectId.is_valid(media_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid media ID",
        )

    result = media_collection.update_one(
        {
            "_id": ObjectId(media_id),
            "is_deleted": False,
        },
        {
            "$set": {
                "title": title,
                "alt_text": alt_text,
                "description": description,
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )

    if result.matched_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Media not found",
        )

    return {
        "message": "Media updated successfully"
    }


# --------------------------------------------------
# MOVE SINGLE ITEM TO TRASH
# DELETE /api/media/{media_id}
# --------------------------------------------------

@router.delete(
    "/{media_id}",
    dependencies=[
        Depends(require_permission("media.delete"))
    ],
)
async def delete_media(
    media_id: str,
):
    if not ObjectId.is_valid(media_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid media ID",
        )

    result = media_collection.update_one(
        {
            "_id": ObjectId(media_id),
            "is_deleted": False,
        },
        {
            "$set": {
                "is_deleted": True,
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )

    if result.matched_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Media not found",
        )

    return {
        "message": "Media moved to trash"
    }


# --------------------------------------------------
# RESTORE SINGLE ITEM
# POST /api/media/{media_id}/restore
# --------------------------------------------------

@router.post(
    "/{media_id}/restore",
    dependencies=[
        Depends(require_permission("media.edit"))
    ],
)
async def restore_media(
    media_id: str,
):
    if not ObjectId.is_valid(media_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid media ID",
        )

    result = media_collection.update_one(
        {
            "_id": ObjectId(media_id),
            "is_deleted": True,
        },
        {
            "$set": {
                "is_deleted": False,
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )

    if result.matched_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Media not found in trash",
        )

    return {
        "message": "Media restored successfully"
    }


# --------------------------------------------------
# PERMANENTLY DELETE SINGLE ITEM
# DELETE /api/media/{media_id}/permanent
# --------------------------------------------------

@router.delete(
    "/{media_id}/permanent",
    dependencies=[
        Depends(require_permission("media.delete"))
    ],
)
async def permanent_delete_media(
    media_id: str,
):
    if not ObjectId.is_valid(media_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid media ID",
        )

    media = media_collection.find_one(
        {
            "_id": ObjectId(media_id),
            "is_deleted": True,
        }
    )

    if not media:
        raise HTTPException(
            status_code=404,
            detail="Media not found in trash",
        )

    delete_media_file(media)

    result = media_collection.delete_one(
        {
            "_id": ObjectId(media_id),
            "is_deleted": True,
        }
    )

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Media not found in trash",
        )

    return {
        "message": "Media permanently deleted"
    }
