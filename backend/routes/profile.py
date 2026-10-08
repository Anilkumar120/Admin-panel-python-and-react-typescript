import os
import uuid

from bson import ObjectId

from fastapi import APIRouter, Depends, HTTPException, Form, UploadFile, File

from database.connection import users_collection, media_collection

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

        media = media_collection.find_one(
            {
                "_id": ObjectId(media_id),
                "is_deleted": False
            }
        )

        if media:

            profile_image = media.get(
                "url",
                profile_image
            )

    return {
        "id": str(current_user["_id"]),
        "name": current_user.get("name", ""),
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
        "name": name
    }


    if media_id:

        if not ObjectId.is_valid(
            media_id
        ):

            raise HTTPException(
                status_code=400,
                detail="Invalid media ID"
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


    users_collection.update_one(
        {
            "_id": current_user["_id"]
        },
        {
            "$set": update_data
        }
    )


    return {
        "message": "Profile updated successfully",
        "name": name,
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
        {
            "_id": current_user["_id"]
        },
        {
            "$set": {
                "password": hash_password(
                    new_password
                )
            }
        }
    )


    return {
        "message": "Password changed successfully"
    }
