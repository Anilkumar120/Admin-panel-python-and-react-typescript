from fastapi import (
    APIRouter,
    HTTPException,
    Depends
)

from bson import ObjectId

from datetime import datetime, timezone

from backend.database.connection import (
    menus_collection,
    products_collection,
    content_collection,
    post_types_collection,
    taxonomies_collection
)

from backend.utils.permissions import require_permission


router = APIRouter(
    prefix="/api/menus",
    tags=["Menus"]
)


def now():

    return datetime.now(
        timezone.utc
    )


def menu_response(menu):

    return {
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
        ),
        "auto_add_pages": menu.get(
            "auto_add_pages",
            False
        ),
        "locations": menu.get(
            "locations",
            []
        ),
        "created_at": menu.get(
            "created_at"
        ),
        "updated_at": menu.get(
            "updated_at"
        )
    }


@router.get("")
def get_menus(

    user=Depends(
        require_permission(
            "menus.view"
        )
    )

):

    menus = menus_collection.find().sort(
        "created_at",
        -1
    )

    return [
        menu_response(
            menu
        )
        for menu in menus
    ]


@router.get(
    "/sources"
)
def get_menu_sources(

    user=Depends(
        require_permission(
            "menus.view"
        )
    )

):

    pages = []

    for page in content_collection.find(
        {
            "post_type": "pages",
            "is_deleted": False
        }
    ).sort(
        "title",
        1
    ):

        pages.append(
            {
                "id": str(
                    page["_id"]
                ),
                "label": page.get(
                    "title",
                    ""
                ),
                "url": f"/{page.get('slug', '')}",
                "source_id": str(
                    page["_id"]
                ),
                "source_type": "page"
            }
        )


    posts = []

    for post in content_collection.find(
        {
            "post_type": "posts",
            "is_deleted": False
        }
    ).sort(
        "title",
        1
    ):

        posts.append(
            {
                "id": str(
                    post["_id"]
                ),
                "label": post.get(
                    "title",
                    ""
                ),
                "url": f"/blog/{post.get('slug', '')}",
                "source_id": str(
                    post["_id"]
                ),
                "source_type": "post"
            }
        )


    categories = []

    for category in taxonomies_collection.find(
        {
            "type": "category",
            "is_deleted": False
        }
    ).sort(
        "name",
        1
    ):

        categories.append(
            {
                "id": str(
                    category["_id"]
                ),
                "label": category.get(
                    "name",
                    ""
                ),
                "url": f"/category/{category.get('slug', '')}",
                "source_id": str(
                    category["_id"]
                ),
                "source_type": "category",
                "post_type_slug": category.get(
                    "post_type_slug",
                    ""
                )
            }
        )


    tags = []

    for tag in taxonomies_collection.find(
        {
            "type": "tag",
            "is_deleted": False
        }
    ).sort(
        "name",
        1
    ):

        tags.append(
            {
                "id": str(
                    tag["_id"]
                ),
                "label": tag.get(
                    "name",
                    ""
                ),
                "url": f"/tag/{tag.get('slug', '')}",
                "source_id": str(
                    tag["_id"]
                ),
                "source_type": "tag",
                "post_type_slug": "tag"
            }
        )


    products = []

    for product in products_collection.find(
        {
            "is_deleted": {
                "$ne": True
            }
        }
    ).sort(
        "name",
        1
    ):

        products.append(
            {
                "id": str(
                    product["_id"]
                ),
                "label": product.get(
                    "name",
                    ""
                ),
                "url": f"/products/{str(product['_id'])}",
                "source_id": str(
                    product["_id"]
                ),
                "source_type": "product"
            }
        )


    product_categories = []

    product_category_values = products_collection.distinct(
        "category",
        {
            "is_deleted": {
                "$ne": True
            }
        }
    )


    product_category_values = [
        category
        for category in product_category_values
        if category and category.strip()
    ]


    product_category_values.sort(
        key=lambda item: item.lower()
    )


    for category in product_category_values:

        product_categories.append(
            {
                "id": category,
                "label": category,
                "url": f"/product-category/{category.lower().replace(' ', '-')}",
                "source_id": category,
                "source_type": "product_category"
            }
        )


    custom_post_types = []

    for post_type in post_types_collection.find(
        {
            "is_builtin": False,
            "is_deleted": False,
            "is_active": True
        }
    ).sort(
        "name",
        1
    ):

        custom_post_types.append(
            {
                "id": str(
                    post_type["_id"]
                ),
                "label": post_type.get(
                    "name",
                    ""
                ),
                "url": f"/{post_type.get('slug', '')}",
                "source_id": str(
                    post_type["_id"]
                ),
                "source_type": "custom_post_type",
                "slug": post_type.get(
                    "slug",
                    ""
                )
            }
        )


    custom_post_type_items = []


    for post_type in post_types_collection.find(
        {
            "is_builtin": False,
            "is_deleted": False,
            "is_active": True
        }
    ).sort(
        "name",
        1
    ):

        post_type_slug = post_type.get(
            "slug",
            ""
        )

        post_type_name = post_type.get(
            "name",
            ""
        )


        items = content_collection.find(
            {
                "post_type": post_type_slug,
                "is_deleted": False
            }
        ).sort(
            "title",
            1
        )


        for item in items:

            custom_post_type_items.append(
                {
                    "id": str(
                        item["_id"]
                    ),
                    "label": item.get(
                        "title",
                        ""
                    ),
                    "url": (
                        f"/{post_type_slug}/"
                        f"{item.get('slug', '')}"
                    ),
                    "source_id": str(
                        item["_id"]
                    ),
                    "source_type": "custom_post_type_item",
                    "post_type_slug": post_type_slug,
                    "post_type_name": post_type_name
                }
            )


    return {
        "pages": pages,
        "posts": posts,
        "categories": categories,
        "tags": tags,
        "products": products,
        "product_categories": product_categories,
        "custom_post_types": custom_post_types,
        "custom_post_type_items": custom_post_type_items
    }


@router.get(
    "/{menu_id}"
)
def get_menu(

    menu_id: str,

    user=Depends(
        require_permission(
            "menus.view"
        )
    )

):

    if not ObjectId.is_valid(
        menu_id
    ):

        raise HTTPException(
            status_code=400,
            detail="Invalid menu ID"
        )

    menu = menus_collection.find_one(
        {
            "_id": ObjectId(
                menu_id
            )
        }
    )

    if not menu:

        raise HTTPException(
            status_code=404,
            detail="Menu not found"
        )

    return menu_response(
        menu
    )


@router.post("")
def create_menu(

    data: dict,

    user=Depends(
        require_permission(
            "menus.create"
        )
    )

):

    name = data.get(
        "name",
        ""
    ).strip()

    items = data.get(
        "items",
        []
    )

    auto_add_pages = data.get(
        "auto_add_pages",
        False
    )

    locations = data.get(
        "locations",
        []
    )

    if not name:

        raise HTTPException(
            status_code=400,
            detail="Menu name is required"
        )

    if not isinstance(
        items,
        list
    ):

        raise HTTPException(
            status_code=400,
            detail="Menu items must be a list"
        )

    if not isinstance(
        auto_add_pages,
        bool
    ):

        auto_add_pages = False

    if not isinstance(
        locations,
        list
    ):

        locations = []

    menu = {

        "name": name,

        "items": items,

        "auto_add_pages": auto_add_pages,

        "locations": locations,

        "created_at": now(),

        "updated_at": now()

    }

    result = menus_collection.insert_one(
        menu
    )

    return {
        "message": "Menu created successfully",
        "id": str(
            result.inserted_id
        )
    }


@router.put(
    "/{menu_id}"
)
def update_menu(

    menu_id: str,

    data: dict,

    user=Depends(
        require_permission(
            "menus.edit"
        )
    )

):

    if not ObjectId.is_valid(
        menu_id
    ):

        raise HTTPException(
            status_code=400,
            detail="Invalid menu ID"
        )

    name = data.get(
        "name",
        ""
    ).strip()

    items = data.get(
        "items",
        []
    )

    auto_add_pages = data.get(
        "auto_add_pages",
        False
    )

    locations = data.get(
        "locations",
        []
    )

    if not name:

        raise HTTPException(
            status_code=400,
            detail="Menu name is required"
        )

    if not isinstance(
        items,
        list
    ):

        raise HTTPException(
            status_code=400,
            detail="Menu items must be a list"
        )

    if not isinstance(
        auto_add_pages,
        bool
    ):

        auto_add_pages = False

    if not isinstance(
        locations,
        list
    ):

        locations = []

    result = menus_collection.update_one(

        {
            "_id": ObjectId(
                menu_id
            )
        },

        {
            "$set": {

                "name": name,

                "items": items,

                "auto_add_pages": auto_add_pages,

                "locations": locations,

                "updated_at": now()

            }
        }

    )

    if result.matched_count == 0:

        raise HTTPException(
            status_code=404,
            detail="Menu not found"
        )

    return {
        "message": "Menu updated successfully"
    }


@router.delete(
    "/{menu_id}"
)
def delete_menu(

    menu_id: str,

    user=Depends(
        require_permission(
            "menus.delete"
        )
    )

):

    if not ObjectId.is_valid(
        menu_id
    ):

        raise HTTPException(
            status_code=400,
            detail="Invalid menu ID"
        )

    result = menus_collection.delete_one(
        {
            "_id": ObjectId(
                menu_id
            )
        }
    )

    if result.deleted_count == 0:

        raise HTTPException(
            status_code=404,
            detail="Menu not found"
        )

    return {
        "message": "Menu deleted successfully"
    }
