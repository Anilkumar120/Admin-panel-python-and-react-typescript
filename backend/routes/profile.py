import os
import uuid
import logging
import smtplib
from email.message import EmailMessage
from datetime import datetime, timezone

from bson import ObjectId

from fastapi import APIRouter, Depends, HTTPException, Form, UploadFile, File

from backend.database.connection import users_collection, media_collection, settings_collection
from gridfs import GridFSBucket
from backend.utils.secure_settings import decrypt_secret

from backend.utils.auth import (
    get_current_user,
    hash_password,
    verify_password
)

from backend.utils.permissions import require_permission


router = APIRouter(
    prefix="/api/profile",
    tags=["Profile"]
)


PROFILE_UPLOAD_DIR = "uploads/profile"

os.makedirs(
    PROFILE_UPLOAD_DIR,
    exist_ok=True
)

profile_media_bucket = GridFSBucket(media_collection.database, bucket_name="media_files")
MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024
PROFILE_IMAGE_EXTENSIONS = {"jpg", "jpeg", "png", "webp", "gif"}

def _send_password_changed_email(user: dict) -> None:
    """Send a password-change notification using the configured store SMTP settings."""
    try:
        settings = settings_collection.find_one({"type": "payments"}) or {}
        if not settings.get("smtp_host") or not settings.get("smtp_from_email") or not user.get("email"):
            logging.warning("Password-change email skipped: SMTP settings or customer email missing")
            return
        message = EmailMessage()
        message["Subject"] = "Your account password was changed"
        message["From"] = settings["smtp_from_email"]
        message["To"] = user["email"]
        message.set_content(
            f"Hello {user.get('name', 'Customer')},\n\n"
            "The password for your account was changed successfully.\n"
            "If you did not make this change, contact the site administrator immediately.\n\n"
            "Regards,\nSupport Team"
        )
        with smtplib.SMTP(settings["smtp_host"], int(settings.get("smtp_port", 587)), timeout=15) as smtp:
            smtp.starttls()
            username = settings.get("smtp_username", "")
            encrypted_password = settings.get("smtp_password_encrypted")
            if username and encrypted_password:
                smtp.login(username, decrypt_secret(encrypted_password))
            smtp.send_message(message)
    except Exception:
        # Do not undo a successful password change if mail delivery fails.
        logging.exception("Password-change notification email could not be sent")


@router.get("/")
def get_profile(
    current_user=Depends(
        require_permission("profile.view")
    )
):

    media_id = current_user.get(
        "media_id",
        ""
    )

    profile_image = current_user.get(
        "profile_image",
        ""
    )

    if media_id and ObjectId.is_valid(media_id):

        media_query = {"_id": ObjectId(media_id), "is_deleted": False}
        if current_user.get("role") != "administrator":
            media_query["owner_user_id"] = str(current_user["_id"])
        media = media_collection.find_one(media_query)

        if media:

            profile_image = media.get(
                "url",
                profile_image
            )

    return {
        "id": str(current_user["_id"]),
        "name": current_user.get("name", ""),
        "first_name": current_user.get("first_name", ""),
        "last_name": current_user.get("last_name", ""),
        "email": current_user.get("email", ""),
        "role": current_user.get(
            "role",
            "subscriber"
        ),
        "is_active": current_user.get(
            "is_active",
            True
        ),
        "profile_image": profile_image,
        "media_id": media_id
    }


@router.put("/")
def update_profile(
    name: str = Form(...),
    email: str | None = Form(None),
    first_name: str | None = Form(None),
    last_name: str | None = Form(None),
    media_id: str | None = Form(None),
    current_user=Depends(
        require_permission("profile.edit")
    )
):

    name = name.strip()

    if not name:

        raise HTTPException(
            status_code=400,
            detail="Name is required"
        )


    update_data = {
        "name": name,
        "first_name": (first_name or "").strip(),
        "last_name": (last_name or "").strip(),
    }

    if email is not None:
        email = email.strip().lower()
        if not email or "@" not in email:
            raise HTTPException(status_code=400, detail="A valid email address is required")
        duplicate = users_collection.find_one({"email": email, "_id": {"$ne": current_user["_id"]}, "is_deleted": {"$ne": True}})
        if duplicate:
            raise HTTPException(status_code=409, detail="This email address is already registered")
        update_data["email"] = email

    if media_id:

        if not ObjectId.is_valid(
            media_id
        ):

            raise HTTPException(
                status_code=400,
                detail="Invalid media ID"
            )


        media_query = {"_id": ObjectId(media_id), "is_deleted": False}
        if current_user.get("role") != "administrator":
            media_query["owner_user_id"] = str(current_user["_id"])
        media = media_collection.find_one(media_query)


        if not media:

            raise HTTPException(
                status_code=404,
                detail="Media not found"
            )


        if media.get(
            "file_type"
        ) != "image":

            raise HTTPException(
                status_code=400,
                detail="Selected media must be an image"
            )


        update_data[
            "media_id"
        ] = media_id


        update_data[
            "profile_image"
        ] = media.get(
            "url",
            ""
        )


    update_operations = {"$set": update_data}
    old_email = current_user.get("email", "").strip().lower()
    new_email = update_data.get("email", old_email)
    if old_email and new_email != old_email:
        update_operations["$addToSet"] = {"previous_emails": old_email}
    users_collection.update_one({"_id": current_user["_id"]}, update_operations)


    return {
        "message": "Profile updated successfully",
        "name": name,
        "email": update_data.get("email", current_user.get("email", "")),
        "first_name": update_data["first_name"],
        "last_name": update_data["last_name"],
        "profile_image": update_data.get(
            "profile_image",
            current_user.get(
                "profile_image",
                ""
            )
        ),
        "media_id": update_data.get(
            "media_id",
            current_user.get(
                "media_id",
                ""
            )
        )
    }


@router.post("/image")
async def upload_profile_image(
    file: UploadFile = File(...),
    current_user=Depends(require_permission("profile.edit")),
):
    original_name = os.path.basename(file.filename or "profile-image")
    extension = original_name.rsplit(".", 1)[-1].lower() if "." in original_name else ""
    if extension not in PROFILE_IMAGE_EXTENSIONS:
        await file.close()
        raise HTTPException(status_code=400, detail="Profile image must be JPG, PNG, WEBP, or GIF")
    content = await file.read(MAX_PROFILE_IMAGE_BYTES + 1)
    await file.close()
    if not content:
        raise HTTPException(status_code=400, detail="Image file is empty")
    if len(content) > MAX_PROFILE_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Profile image must be 5 MB or smaller")
    mime_type = file.content_type or "application/octet-stream"
    if not mime_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Uploaded file is not an image")
    unique_name = f"{uuid.uuid4().hex}.{extension}"
    gridfs_id = profile_media_bucket.upload_from_stream(unique_name, content, metadata={"contentType": mime_type, "original_name": original_name})
    now = datetime.now(timezone.utc)
    media_data = {
        "file_name": unique_name, "original_name": original_name,
        "title": f"{current_user.get('name', 'Customer')} profile image",
        "alt_text": "Profile image", "description": "Customer profile image",
        "mime_type": mime_type, "file_type": "image", "extension": extension,
        "file_size": len(content), "gridfs_id": gridfs_id,
        "url": f"/api/media/file/{gridfs_id}", "is_deleted": False,
        "owner_user_id": str(current_user["_id"]),
        "created_by_user_id": str(current_user["_id"]),
        "created_at": now, "updated_at": now,
    }
    result = media_collection.insert_one(media_data)
    media_id = str(result.inserted_id)
    media_url = media_data["url"]
    users_collection.update_one({"_id": current_user["_id"]}, {"$set": {"media_id": media_id, "profile_image": media_url}})
    return {"message": "Profile image uploaded", "media_id": media_id, "profile_image": media_url, "url": media_url}


@router.put("/password")
def change_password(
    current_password: str = Form(...),
    new_password: str = Form(...),
    current_user=Depends(
        require_permission("profile.edit")
    )
):

    if len(new_password) < 6:

        raise HTTPException(
            status_code=400,
            detail="Password must be at least 6 characters"
        )


    if not verify_password(
        current_password,
        current_user.get(
            "password",
            ""
        )
    ):

        raise HTTPException(
            status_code=400,
            detail="Current password is incorrect"
        )


    users_collection.update_one(
        {"_id": current_user["_id"]},
        {"$set": {"password": hash_password(new_password)}}
    )

    _send_password_changed_email(current_user)

    return {
        "message": "Password changed successfully"
    }
