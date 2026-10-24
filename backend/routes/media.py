
import os
import uuid
import ipaddress
import socket
from datetime import datetime, timezone
from urllib.parse import urljoin, urlparse

import httpx
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
from pydantic import BaseModel, HttpUrl

from backend.database.connection import media_collection
from backend.utils.permissions import require_permission


router = APIRouter(
    prefix="/api/media",
    tags=["Media"],
)


# --------------------------------------------------
# CONFIGURATION
# --------------------------------------------------

PROJECT_ROOT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..")
)

UPLOAD_DIR = os.path.join(
    PROJECT_ROOT,
    "uploads",
    "media",
)

media_bucket = GridFSBucket(
    media_collection.database,
    bucket_name="media_files",
)

MAX_REMOTE_IMAGE_SIZE = 10 * 1024 * 1024
MAX_IMAGE_REDIRECTS = 5

REMOTE_IMAGE_TIMEOUT = httpx.Timeout(
    timeout=60.0,
    connect=10.0,
    read=60.0,
    write=20.0,
    pool=10.0,
)

ALLOWED_EXTENSIONS = {
    "jpg", "jpeg", "png", "webp", "gif", "svg",
    "pdf", "doc", "docx", "xls", "xlsx", "csv", "psd",
}

REMOTE_IMAGE_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/avif": "avif",
}


# --------------------------------------------------
# REQUEST MODELS
# --------------------------------------------------

class ImportMediaRequest(BaseModel):
    url: HttpUrl


# --------------------------------------------------
# HELPERS
# --------------------------------------------------

def get_file_type(extension: str) -> str:
    if extension in {
        "jpg", "jpeg", "png", "webp", "gif", "svg", "avif"
    }:
        return "image"

    if extension == "pdf":
        return "pdf"

    if extension in {"doc", "docx"}:
        return "document"

    if extension in {"xls", "xlsx", "csv"}:
        return "spreadsheet"

    return "other"


def serialize_media(media: dict) -> dict:
    media["_id"] = str(media["_id"])

    if media.get("gridfs_id"):
        media["gridfs_id"] = str(media["gridfs_id"])

    return media


def stream_gridfs_file(file_stream):
    try:
        while True:
            chunk = file_stream.read(1024 * 1024)

            if not chunk:
                break

            yield chunk
    finally:
        file_stream.close()


def delete_media_file(media: dict) -> None:
    gridfs_id = media.get("gridfs_id")

    if gridfs_id:
        try:
            media_bucket.delete(ObjectId(str(gridfs_id)))
        except NoFile:
            pass

        return

    file_name = media.get("file_name")

    if file_name:
        upload_root = os.path.abspath(UPLOAD_DIR)
        file_path = os.path.abspath(
            os.path.join(upload_root, file_name)
        )

        if (
            os.path.commonpath([upload_root, file_path]) == upload_root
            and os.path.isfile(file_path)
        ):
            os.remove(file_path)


def validate_remote_url(url: str) -> str:
    """Allow only public HTTP/HTTPS destinations."""

    parsed = urlparse(url)

    if (
        parsed.scheme not in {"http", "https"}
        or not parsed.hostname
        or parsed.username
        or parsed.password
    ):
        raise HTTPException(
            status_code=400,
            detail="A valid public HTTP/HTTPS image URL is required",
        )

    hostname = parsed.hostname

    try:
        port = parsed.port or (
            443 if parsed.scheme == "https" else 80
        )

        addresses = socket.getaddrinfo(
            hostname,
            port,
            type=socket.SOCK_STREAM,
        )

        if not addresses:
            raise ValueError("No IP addresses found")

        for address in addresses:
            ip = ipaddress.ip_address(address[4][0])

            if not ip.is_global:
                raise ValueError("Non-public IP address")

    except Exception:
        raise HTTPException(
            status_code=400,
            detail=(
                "Image URL must point to a publicly accessible server"
            ),
        )

    return url


def detect_image_extension(content: bytes) -> str | None:
    """Detect supported image formats from binary signatures."""

    if content.startswith(b"\xff\xd8\xff"):
        return "jpg"

    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"

    if content.startswith((b"GIF87a", b"GIF89a")):
        return "gif"

    if (
        len(content) >= 12
        and content[:4] == b"RIFF"
        and content[8:12] == b"WEBP"
    ):
        return "webp"

    if (
        len(content) >= 12
        and content[4:8] == b"ftyp"
        and content[8:12] in (b"avif", b"avis")
    ):
        return "avif"

    return None


# --------------------------------------------------
# UPLOAD MEDIA
# POST /api/media/upload
# --------------------------------------------------

@router.post(
    "/upload",
    dependencies=[Depends(require_permission("media.upload"))],
)
async def upload_media(files: list[UploadFile] = File(...)):
    uploaded = []

    for file in files:
        original_name = os.path.basename(file.filename or "file")

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

        unique_name = f"{uuid.uuid4().hex}.{extension}"

        try:
            content = await file.read()
        finally:
            await file.close()

        if not content:
            raise HTTPException(
                status_code=400,
                detail=f"File is empty: {original_name}",
            )

        gridfs_id = None

        try:
            mime_type = (
                file.content_type or "application/octet-stream"
            )

            gridfs_id = media_bucket.upload_from_stream(
                unique_name,
                content,
                metadata={
                    "contentType": mime_type,
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
                "mime_type": mime_type,
                "file_type": get_file_type(extension),
                "extension": extension,
                "file_size": len(content),
                "gridfs_id": gridfs_id,
                "url": f"/api/media/file/{gridfs_id}",
                "is_deleted": False,
                "created_at": now,
                "updated_at": now,
            }

            result = media_collection.insert_one(media_data)

            media_data["_id"] = str(result.inserted_id)
            media_data["gridfs_id"] = str(gridfs_id)

            uploaded.append(media_data)

        except Exception:
            if gridfs_id is not None:
                try:
                    media_bucket.delete(gridfs_id)
                except Exception:
                    pass

            raise HTTPException(
                status_code=500,
                detail="Media upload failed. Check backend logs.",
            )

    return {
        "message": "Media uploaded successfully",
        "items": uploaded,
    }


# --------------------------------------------------
# IMPORT REMOTE IMAGE
# POST /api/media/import-url
# --------------------------------------------------

@router.post(
    "/import-url",
    dependencies=[Depends(require_permission("media.upload"))],
)
async def import_media_from_url(payload: ImportMediaRequest):
    url = validate_remote_url(str(payload.url))

    content = bytearray()
    final_url = url

    try:
        async with httpx.AsyncClient(
            timeout=REMOTE_IMAGE_TIMEOUT,
            follow_redirects=False,
            trust_env=False,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (compatible; ProductImageImporter/1.0)"
                ),
                "Accept": (
                    "image/avif,image/webp,image/png,"
                    "image/jpeg,image/gif,*/*"
                ),
            },
        ) as client:

            for redirect_count in range(MAX_IMAGE_REDIRECTS + 1):
                # Validate each destination before making a request.
                final_url = validate_remote_url(final_url)

                async with client.stream(
                    "GET",
                    final_url,
                ) as response:

                    if response.is_redirect:
                        if redirect_count >= MAX_IMAGE_REDIRECTS:
                            raise HTTPException(
                                status_code=400,
                                detail="Too many image redirects",
                            )

                        location = response.headers.get("location")

                        if not location:
                            raise HTTPException(
                                status_code=400,
                                detail="Image redirect has no destination",
                            )

                        final_url = urljoin(final_url, location)
                        continue

                    if response.status_code >= 400:
                        raise HTTPException(
                            status_code=502,
                            detail=(
                                "Remote image server returned HTTP "
                                f"{response.status_code}"
                            ),
                        )

                    content_length = response.headers.get(
                        "content-length"
                    )

                    if content_length:
                        try:
                            if int(content_length) > MAX_REMOTE_IMAGE_SIZE:
                                raise HTTPException(
                                    status_code=413,
                                    detail=(
                                        "Image exceeds the 10 MB size limit"
                                    ),
                                )
                        except ValueError:
                            pass

                    async for chunk in response.aiter_bytes():
                        content.extend(chunk)

                        if len(content) > MAX_REMOTE_IMAGE_SIZE:
                            raise HTTPException(
                                status_code=413,
                                detail=(
                                    "Image exceeds the 10 MB size limit"
                                ),
                            )

                    break

            else:
                raise HTTPException(
                    status_code=400,
                    detail="Unable to follow image URL redirects",
                )

    except HTTPException:
        raise

    except httpx.TimeoutException:
        raise HTTPException(
            status_code=504,
            detail=(
                "Remote image download timed out. "
                "Check remote server and backend network connectivity."
            ),
        )

    except httpx.HTTPError:
        raise HTTPException(
            status_code=502,
            detail=(
                "Unable to download the image from the remote server"
            ),
        )

    if not content:
        raise HTTPException(
            status_code=400,
            detail="Downloaded image is empty",
        )

    extension = detect_image_extension(bytes(content))

    if not extension:
        raise HTTPException(
            status_code=400,
            detail=(
                "Downloaded file is not a supported image. "
                "Supported formats: JPEG, PNG, WEBP, GIF and AVIF."
            ),
        )

    actual_content_type = {
        "jpg": "image/jpeg",
        "png": "image/png",
        "webp": "image/webp",
        "gif": "image/gif",
        "avif": "image/avif",
    }[extension]

    original_name = f"imported-image.{extension}"
    unique_name = f"{uuid.uuid4().hex}.{extension}"
    gridfs_id = None

    try:
        gridfs_id = media_bucket.upload_from_stream(
            unique_name,
            bytes(content),
            metadata={
                "contentType": actual_content_type,
                "original_name": original_name,
                "source_url": url,
                "final_source_url": final_url,
            },
        )

        now = datetime.now(timezone.utc)

        media_data = {
            "file_name": unique_name,
            "original_name": original_name,
            "title": original_name,
            "alt_text": "",
            "description": f"Imported from {url}",
            "mime_type": actual_content_type,
            "file_type": "image",
            "extension": extension,
            "file_size": len(content),
            "gridfs_id": gridfs_id,
            "url": f"/api/media/file/{gridfs_id}",
            "is_deleted": False,
            "created_at": now,
            "updated_at": now,
        }

        result = media_collection.insert_one(media_data)

        media_data["_id"] = str(result.inserted_id)
        media_data["gridfs_id"] = str(gridfs_id)

        return {
            "message": "Image imported successfully",
            "media_id": str(result.inserted_id),
            "gridfs_id": str(gridfs_id),
            "url": media_data["url"],
            "item": media_data,
        }

    except Exception:
        if gridfs_id is not None:
            try:
                media_bucket.delete(gridfs_id)
            except Exception:
                pass

        raise HTTPException(
            status_code=500,
            detail=(
                "Failed to save imported image. Check backend logs."
            ),
        )


# --------------------------------------------------
# SERVE GRIDFS FILE
# GET /api/media/file/{file_id}
# --------------------------------------------------

@router.get("/file/{file_id}")
async def get_media_file(file_id: str):
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

    return StreamingResponse(
        stream_gridfs_file(file_stream),
        media_type=content_type,
        headers={
            "Content-Disposition": (
                f'inline; filename="{file_stream.filename}"'
            ),
            "X-Content-Type-Options": "nosniff",
        },
    )


# --------------------------------------------------
# GET MEDIA LIST
# GET /api/media/
# --------------------------------------------------

@router.get(
    "/",
    dependencies=[Depends(require_permission("media.view"))],
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
            {"original_name": {"$regex": search, "$options": "i"}},
            {"title": {"$regex": search, "$options": "i"}},
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
        "items": [serialize_media(item) for item in items],
        "total": total,
        "page": page,
        "limit": limit,
    }


# --------------------------------------------------
# GET MEDIA TRASH
# GET /api/media/trash
# --------------------------------------------------

@router.get(
    "/trash",
    dependencies=[Depends(require_permission("media.view"))],
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
            {"original_name": {"$regex": search, "$options": "i"}},
            {"title": {"$regex": search, "$options": "i"}},
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
        "items": [serialize_media(item) for item in items],
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
    dependencies=[Depends(require_permission("media.delete"))],
)
async def bulk_delete_media(media_ids: list[str]):
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
# BULK RESTORE
# POST /api/media/bulk-restore
# --------------------------------------------------

@router.post(
    "/bulk-restore",
    dependencies=[Depends(require_permission("media.edit"))],
)
async def bulk_restore_media(media_ids: list[str]):
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
    dependencies=[Depends(require_permission("media.delete"))],
)
async def bulk_permanent_delete_media(media_ids: list[str]):
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
    dependencies=[Depends(require_permission("media.delete"))],
)
async def empty_media_trash():
    media_items = list(
        media_collection.find({"is_deleted": True})
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
    dependencies=[Depends(require_permission("media.view"))],
)
async def get_media_by_id(media_id: str):
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
    dependencies=[Depends(require_permission("media.edit"))],
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

    return {"message": "Media updated successfully"}


# --------------------------------------------------
# MOVE SINGLE ITEM TO TRASH
# DELETE /api/media/{media_id}
# --------------------------------------------------

@router.delete(
    "/{media_id}",
    dependencies=[Depends(require_permission("media.delete"))],
)
async def delete_media(media_id: str):
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

    return {"message": "Media moved to trash"}


# --------------------------------------------------
# RESTORE SINGLE ITEM
# POST /api/media/{media_id}/restore
# --------------------------------------------------

@router.post(
    "/{media_id}/restore",
    dependencies=[Depends(require_permission("media.edit"))],
)
async def restore_media(media_id: str):
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

    return {"message": "Media restored successfully"}


# --------------------------------------------------
# PERMANENTLY DELETE SINGLE ITEM
# DELETE /api/media/{media_id}/permanent
# --------------------------------------------------

@router.delete(
    "/{media_id}/permanent",
    dependencies=[Depends(require_permission("media.delete"))],
)
async def permanent_delete_media(media_id: str):
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

    return {"message": "Media permanently deleted"}
