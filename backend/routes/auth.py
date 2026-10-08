from fastapi import APIRouter, Form, HTTPException, Depends
from fastapi.security import OAuth2PasswordRequestForm

from database.connection import users_collection

from backend.utils.auth import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    save_refresh_token,
    get_refresh_token_user,
    revoke_refresh_token,
    get_current_user,
    save_reset_token,
    verify_reset_token
)

router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"]
)


@router.post("/register")
def register_user(
    name: str = Form(...),
    email: str = Form(...),
    password: str = Form(...)
):

    email = email.strip().lower()

    name = name.strip()

    if len(password) < 6:

        raise HTTPException(
            status_code=400,
            detail="Password must be at least 6 characters"
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
        "password": hash_password(password),
        "role": "subscriber",
        "is_active": True,
        "is_deleted": False
    }

    result = users_collection.insert_one(
        user_data
    )

    return {
        "message": "User registered successfully",
        "user_id": str(result.inserted_id),
        "role": "subscriber"
    }


@router.post("/login")
def login_user(
    form_data: OAuth2PasswordRequestForm = Depends()
):

    email = form_data.username.strip().lower()

    password = form_data.password

    user = users_collection.find_one({
        "email": email
    })

    if user is None:

        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    if user.get(
        "is_deleted",
        False
    ):

        raise HTTPException(
            status_code=403,
            detail="User account is in trash"
        )

    if not verify_password(
        password,
        user.get("password", "")
    ):

        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    if not user.get(
        "is_active",
        True
    ):

        raise HTTPException(
            status_code=403,
            detail="User account is inactive"
        )

    access_token = create_access_token({
        "sub": email
    })

    refresh_token, refresh_token_hash, refresh_token_expiry = create_refresh_token()

    save_refresh_token(
        user["_id"],
        refresh_token_hash,
        refresh_token_expiry
    )

    return {
        "message": "Login successful",
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "id": str(user["_id"]),
            "name": user.get("name", ""),
            "email": user.get("email", ""),
            "role": user.get("role", "subscriber"),
            "is_active": user.get("is_active", True)
        }
    }


@router.post("/refresh")
def refresh_access_token(
    refresh_token: str = Form(...)
):

    user = get_refresh_token_user(
        refresh_token
    )

    if user is None:

        raise HTTPException(
            status_code=401,
            detail="Invalid or expired refresh token"
        )

    access_token = create_access_token({
        "sub": user.get("email", "")
    })

    return {
        "message": "Access token refreshed successfully",
        "access_token": access_token,
        "token_type": "bearer"
    }


@router.post("/logout")
def logout_user(
    current_user=Depends(
        get_current_user
    )
):

    revoke_refresh_token(
        current_user["_id"]
    )

    return {
        "message": "Logout successful"
    }


@router.get("/me")
def get_me(
    current_user=Depends(
        get_current_user
    )
):

    return {
        "id": current_user["id"],
        "name": current_user.get(
            "name",
            ""
        ),
        "email": current_user.get(
            "email",
            ""
        ),
        "role": current_user.get(
            "role",
            "subscriber"
        ),
        "is_active": current_user.get(
            "is_active",
            True
        )
    }


@router.post("/forgot-password")
def forgot_password(
    email: str = Form(...)
):

    email = email.strip().lower()

    user = users_collection.find_one({
        "email": email
    })

    if user is None:

        return {
            "message": "If this email exists, a password reset link has been generated."
        }

    reset_token = save_reset_token(
        email
    )

    return {
        "message": "Password reset token generated successfully",
        "reset_token": reset_token
    }


@router.post("/reset-password")
def reset_password(
    token: str = Form(...),
    new_password: str = Form(...)
):

    if len(new_password) < 6:

        raise HTTPException(
            status_code=400,
            detail="Password must be at least 6 characters"
        )

    user = verify_reset_token(
        token
    )

    if user is None:

        raise HTTPException(
            status_code=400,
            detail="Invalid or expired reset token"
        )

    users_collection.update_one(
        {
            "_id": user["_id"]
        },
        {
            "$set": {
                "password": hash_password(
                    new_password
                )
            },
            "$unset": {
                "reset_token": "",
                "reset_token_expiry": ""
            }
        }
    )

    return {
        "message": "Password reset successfully"
    }
