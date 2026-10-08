from fastapi import APIRouter, Depends

from database.connection import (
    users_collection,
    products_collection
)

from backend.utils.permissions import require_permission

router = APIRouter(
    prefix="/api/dashboard",
    tags=["Dashboard"]
)


@router.get("/stats")
def get_dashboard_stats(
    current_user=Depends(
        require_permission("users.view")
    )
):

    total_users = users_collection.count_documents({})

    active_users = users_collection.count_documents({
        "is_active": {
            "$ne": False
        }
    })

    total_products = products_collection.count_documents({
        "is_deleted": {
            "$ne": True
        }
    })

    trash_products = products_collection.count_documents({
        "is_deleted": True
    })

    recent_users_cursor = users_collection.find(
        {}
    ).sort(
        "_id",
        -1
    ).limit(5)

    recent_users = []

    for user in recent_users_cursor:

        recent_users.append({
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
            )
        })

    recent_products_cursor = products_collection.find(
        {
            "is_deleted": {
                "$ne": True
            }
        }
    ).sort(
        "_id",
        -1
    ).limit(5)

    recent_products = []

    for product in recent_products_cursor:

        recent_products.append({
            "id": str(product["_id"]),
            "name": product.get(
                "name",
                ""
            ),
            "category": product.get(
                "category",
                ""
            ),
            "price": product.get(
                "price",
                0
            ),
            "quantity": product.get(
                "quantity",
                0
            ),
            "brand": product.get(
                "brand",
                ""
            ),
            "image": product.get(
                "image",
                ""
            )
        })

    return {
        "message": "Dashboard statistics fetched successfully",
        "total_users": total_users,
        "active_users": active_users,
        "total_products": total_products,
        "trash_products": trash_products,
        "recent_users": recent_users,
        "recent_products": recent_products
    }
