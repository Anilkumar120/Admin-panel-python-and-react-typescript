from fastapi import Depends, HTTPException

from backend.utils.auth import get_current_user


# ROLE PERMISSIONS

ROLE_PERMISSIONS = {

    "administrator": [
        "*"
    ],

    "editor": [
        "products.view",
        "products.create",
        "products.edit",
        "products.delete",
        "content.view",
        "content.create",
        "content.edit",
        "content.delete"
    ],

    "author": [
        "content.view",
        "content.create",
        "content.edit"
    ],

    "contributor": [
        "content.view",
        "content.create"
    ],

    "seo_manager": [
        "seo.view",
        "seo.create",
        "seo.edit",
        "seo.delete",
        "seo.settings"
    ],

    "seo_editor": [
        "seo.view",
        "seo.edit"
    ],

    "web_designer": [
        "pages.view",
        "pages.create",
        "pages.edit",
        "pages.delete",
        "design.view",
        "design.edit",
        "media.view",
        "media.upload"
    ],

    "subscriber": [
        "profile.view",
        "profile.edit"
    ]
}


# CHECK PERMISSION

def require_permission(
    permission: str
):

    def permission_checker(
        current_user=Depends(
            get_current_user
        )
    ):

        role = current_user.get(
            "role",
            "subscriber"
        )

        permissions = ROLE_PERMISSIONS.get(
            role,
            []
        )

        if "*" not in permissions:

            if permission not in permissions:

                raise HTTPException(
                    status_code=403,
                    detail="You do not have permission to perform this action"
                )

        return current_user

    return permission_checker