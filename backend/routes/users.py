from bson import ObjectId

from fastapi import APIRouter, Depends, HTTPException, Form

from backend.database.connection import users_collection

from backend.utils.auth import hash_password

from backend.utils.permissions import require_permission


router = APIRouter(
    prefix="/api/users",
    tags=["Users"]
)


ALLOWED_ROLES = [
    "administrator",
    "editor",
    "author",
    "contributor",
    "seo_manager",
    "seo_editor",
    "web_designer",
    "subscriber"
]


@router.get("/")
def get_users(
    current_user=Depends(
        require_permission("users.view")
    )
):

    users = users_collection.find({
        "is_deleted": {
            "$ne": True
        }
    })

    user_list = []

    for user in users:

        user_list.append({
            "id": str(user["_id"]),
            "name": user.get(
                "name",
                ""
            ),
            "email": user.get(
                "email",
                ""
            ),
            "role": user.get(
                "role",
                "subscriber"
            ),
            "is_active": user.get(
                "is_active",
                True
            ),
            "is_deleted": user.get(
                "is_deleted",
                False
            )
        })

    return {
        "message": "Users fetched successfully",
        "total": len(user_list),
        "users": user_list
    }


@router.post("/")
def create_user(
    name: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    role: str = Form("subscriber"),
    current_user=Depends(
        require_permission("users.create")
    )
):

    email = email.strip().lower()

    name = name.strip()

    if len(password) < 6:

        raise HTTPException(
            status_code=400,
            detail="Password must be at least 6 characters"
        )

    if role not in ALLOWED_ROLES:

        raise HTTPException(
            status_code=400,
            detail="Invalid user role"
        )

    existing_user = users_collection.find_one({
        "email": email
    })

    if existing_user:

        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )

    user_data = {
        "name": name,
        "email": email,
        "password": hash_password(
            password
        ),
        "role": role,
        "is_active": True,
        "is_deleted": False
    }

    result = users_collection.insert_one(
        user_data
    )

    return {
        "message": "User created successfully",
        "user_id": str(
            result.inserted_id
        ),
        "role": role
    }


@router.put("/{user_id}")
def update_user(
    user_id: str,
    name: str = Form(...),
    email: str = Form(...),
    password: str = Form(""),
    role: str = Form("subscriber"),
    is_active: bool = Form(True),
    current_user=Depends(
        require_permission("users.edit")
    )
):

    if not ObjectId.is_valid(user_id):

        raise HTTPException(
            status_code=400,
            detail="Invalid user ID"
        )

    email = email.strip().lower()

    name = name.strip()

    if role not in ALLOWED_ROLES:

        raise HTTPException(
            status_code=400,
            detail="Invalid user role"
        )

    user = users_collection.find_one({
        "_id": ObjectId(user_id),
        "is_deleted": {
            "$ne": True
        }
    })

    if user is None:

        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    if str(current_user["_id"]) == user_id:

        if role != "administrator":

            raise HTTPException(
                status_code=400,
                detail="Administrator cannot remove their own administrator role"
            )

        if not is_active:

            raise HTTPException(
                status_code=400,
                detail="You cannot deactivate your own account"
            )

    existing_user = users_collection.find_one({
        "email": email,
        "_id": {
            "$ne": ObjectId(user_id)
        }
    })

    if existing_user:

        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )

    update_data = {
        "name": name,
        "email": email,
        "role": role,
        "is_active": is_active
    }

    if password.strip():

        if len(password) < 6:

            raise HTTPException(
                status_code=400,
                detail="Password must be at least 6 characters"
            )

        update_data["password"] = hash_password(
            password
        )

    users_collection.update_one(
        {
            "_id": ObjectId(user_id)
        },
        {
            "$set": update_data
        }
    )

    return {
        "message": "User updated successfully",
        "user_id": user_id
    }


@router.put("/{user_id}/role")
def change_user_role(
    user_id: str,
    role: str = Form(...),
    current_user=Depends(
        require_permission("users.edit")
    )
):

    if not ObjectId.is_valid(user_id):

        raise HTTPException(
            status_code=400,
            detail="Invalid user ID"
        )

    if role not in ALLOWED_ROLES:

        raise HTTPException(
            status_code=400,
            detail="Invalid user role"
        )

    if (
        str(current_user["_id"]) == user_id
        and role != "administrator"
    ):

        raise HTTPException(
            status_code=400,
            detail="Administrator cannot remove their own administrator role"
        )

    result = users_collection.update_one(
        {
            "_id": ObjectId(user_id),
            "is_deleted": {
                "$ne": True
            }
        },
        {
            "$set": {
                "role": role
            }
        }
    )

    if result.matched_count == 0:

        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    return {
        "message": "User role updated successfully",
        "user_id": user_id,
        "role": role
    }


@router.put("/{user_id}/status")
def change_user_status(
    user_id: str,
    is_active: bool = Form(...),
    current_user=Depends(
        require_permission("users.edit")
    )
):

    if not ObjectId.is_valid(user_id):

        raise HTTPException(
            status_code=400,
            detail="Invalid user ID"
        )

    if str(current_user["_id"]) == user_id:

        raise HTTPException(
            status_code=400,
            detail="You cannot change your own account status"
        )

    result = users_collection.update_one(
        {
            "_id": ObjectId(user_id),
            "is_deleted": {
                "$ne": True
            }
        },
        {
            "$set": {
                "is_active": is_active
            }
        }
    )

    if result.matched_count == 0:

        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    return {
        "message": "User status updated successfully",
        "user_id": user_id,
        "is_active": is_active
    }


@router.get("/trash")
def get_deleted_users(
    current_user=Depends(
        require_permission("users.delete")
    )
):

    users = users_collection.find({
        "is_deleted": True
    })

    user_list = []

    for user in users:

        user_list.append({
            "id": str(user["_id"]),
            "name": user.get(
                "name",
                ""
            ),
            "email": user.get(
                "email",
                ""
            ),
            "role": user.get(
                "role",
                "subscriber"
            ),
            "is_active": user.get(
                "is_active",
                True
            ),
            "is_deleted": True
        })

    return {
        "message": "Trash users fetched successfully",
        "total": len(user_list),
        "users": user_list
    }


@router.put("/{user_id}/trash")
def move_user_to_trash(
    user_id: str,
    current_user=Depends(
        require_permission("users.delete")
    )
):

    if not ObjectId.is_valid(user_id):

        raise HTTPException(
            status_code=400,
            detail="Invalid user ID"
        )

    if str(current_user["_id"]) == user_id:

        raise HTTPException(
            status_code=400,
            detail="You cannot move your own account to trash"
        )

    result = users_collection.update_one(
        {
            "_id": ObjectId(user_id),
            "is_deleted": {
                "$ne": True
            }
        },
        {
            "$set": {
                "is_deleted": True,
                "is_active": False
            }
        }
    )

    if result.matched_count == 0:

        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    return {
        "message": "User moved to trash successfully",
        "user_id": user_id
    }


@router.put("/{user_id}/restore")
def restore_user(
    user_id: str,
    current_user=Depends(
        require_permission("users.edit")
    )
):

    if not ObjectId.is_valid(user_id):

        raise HTTPException(
            status_code=400,
            detail="Invalid user ID"
        )

    result = users_collection.update_one(
        {
            "_id": ObjectId(user_id),
            "is_deleted": True
        },
        {
            "$set": {
                "is_deleted": False,
                "is_active": True
            }
        }
    )

    if result.matched_count == 0:

        raise HTTPException(
            status_code=404,
            detail="User not found in trash"
        )

    return {
        "message": "User restored successfully",
        "user_id": user_id
    }


@router.delete("/{user_id}")
def delete_user(
    user_id: str,
    current_user=Depends(
        require_permission("users.delete")
    )
):

    if not ObjectId.is_valid(user_id):

        raise HTTPException(
            status_code=400,
            detail="Invalid user ID"
        )

    if str(current_user["_id"]) == user_id:

        raise HTTPException(
            status_code=400,
            detail="You cannot delete your own account"
        )

    user = users_collection.find_one({
        "_id": ObjectId(user_id)
    })

    if user is None:

        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    result = users_collection.delete_one({
        "_id": ObjectId(user_id)
    })

    if result.deleted_count == 0:

        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    return {
        "message": "User permanently deleted successfully",
        "user_id": user_id
    }
