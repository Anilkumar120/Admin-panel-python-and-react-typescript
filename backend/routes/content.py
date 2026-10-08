import os

import uuid

from fastapi import (
    APIRouter,
    Form,
    HTTPException,
    Depends,
    UploadFile,
    File
)

from bson import ObjectId

from datetime import datetime, timezone

from database.connection import (
    db,
    media_collection
)

from backend.utils.permissions import require_permission



router = APIRouter(

    prefix="/api/content",

    tags=["Content"]

)



post_types_collection = db["post_types"]

content_collection = db["content"]

taxonomies_collection = db["taxonomies"]



DEFAULT_POST_TAXONOMIES = [

    {

        "name": "Categories",

        "slug": "categories",

        "type": "category"

    },

    {

        "name": "Tags",

        "slug": "tags",

        "type": "tag"

    }

]



DEFAULT_CONTENT_FEATURES = {

    "title": True,

    "description": True,

    "featured_image": True,

    "seo": True,

    "categories": True,

    "tags": True,

    "parent_page": False

}



DEFAULT_PAGE_FEATURES = {

    "title": True,

    "description": True,

    "featured_image": True,

    "seo": True,

    "categories": False,

    "tags": False,

    "parent_page": True

}



UPLOAD_DIR = os.path.join(

    os.path.dirname(

        os.path.dirname(

            os.path.dirname(

                os.path.abspath(__file__)

            )

        )

    ),

    "uploads",

    "content"

)



os.makedirs(

    UPLOAD_DIR,

    exist_ok=True

)



def now():

    return datetime.now(

        timezone.utc

    )



def get_features(

    post_type

):

    slug = post_type.get(

        "slug",

        ""

    )



    if slug == "pages":

        features = DEFAULT_PAGE_FEATURES.copy()

    else:

        features = DEFAULT_CONTENT_FEATURES.copy()



    stored_features = post_type.get(

        "features",

        {}

    )



    if isinstance(

        stored_features,

        dict

    ):

        features.update(

            stored_features

        )



    if slug == "pages":

        features["categories"] = False

        features["tags"] = False

        features["parent_page"] = True



    return features



def initialize_builtin_post_types():

    try:

        posts = post_types_collection.find_one(

            {

                "slug": "posts"

            }

        )



        if not posts:

            post_types_collection.insert_one(

                {

                    "name": "Posts",

                    "slug": "posts",

                    "icon": "📝",

                    "is_builtin": True,

                    "is_active": True,

                    "is_deleted": False,

                    "fields": [],

                    "taxonomies": DEFAULT_POST_TAXONOMIES,

                    "features": DEFAULT_CONTENT_FEATURES,

                    "created_at": now(),

                    "updated_at": now()

                }

            )



        else:

            post_types_collection.update_one(

                {

                    "_id": posts["_id"]

                },

                {

                    "$set": {

                        "name": "Posts",

                        "slug": "posts",

                        "icon": "📝",

                        "is_builtin": True,

                        "is_active": True,

                        "is_deleted": False,

                        "features": DEFAULT_CONTENT_FEATURES,

                        "taxonomies": DEFAULT_POST_TAXONOMIES,

                        "updated_at": now()

                    }

                }

            )



        pages = post_types_collection.find_one(

            {

                "slug": "pages"

            }

        )



        if not pages:

            post_types_collection.insert_one(

                {

                    "name": "Pages",

                    "slug": "pages",

                    "icon": "📄",

                    "is_builtin": True,

                    "is_active": True,

                    "is_deleted": False,

                    "fields": [],

                    "taxonomies": [],

                    "features": DEFAULT_PAGE_FEATURES,

                    "created_at": now(),

                    "updated_at": now()

                }

            )



        else:

            post_types_collection.update_one(

                {

                    "_id": pages["_id"]

                },

                {

                    "$set": {

                        "name": "Pages",

                        "slug": "pages",

                        "icon": "📄",

                        "is_builtin": True,

                        "is_active": True,

                        "is_deleted": False,

                        "features": DEFAULT_PAGE_FEATURES,

                        "taxonomies": [],

                        "updated_at": now()

                    }

                }

            )

    except Exception as exc:

        print(

            f"MongoDB unavailable during startup; skipping built-in post type initialization: {exc}"

        )



initialize_builtin_post_types()



def get_post_type_or_404(

    post_type_slug: str

):

    post_type = post_types_collection.find_one(

        {

            "slug": post_type_slug,

            "is_deleted": False,

            "is_active": True

        }

    )



    if not post_type:

        raise HTTPException(

            status_code=404,

            detail="Post type not found"

        )



    return post_type



def get_post_type_response(

    post_type

):

    return {

        "id": str(

            post_type["_id"]

        ),

        "name": post_type.get(

            "name",

            ""

        ),

        "slug": post_type.get(

            "slug",

            ""

        ),

        "icon": post_type.get(

            "icon",

            "📄"

        ),

        "is_builtin": post_type.get(

            "is_builtin",

            False

        ),

        "is_active": post_type.get(

            "is_active",

            True

        ),

        "fields": post_type.get(

            "fields",

            []

        ),

        "taxonomies": post_type.get(

            "taxonomies",

            []

        ),

        "features": get_features(

            post_type

        )

    }



def build_seo(

    seo_title: str,

    seo_description: str,

    focus_keyword: str,

    canonical_url: str,

    robots: str,

    og_title: str,

    og_description: str,

    og_image: str,

    twitter_title: str,

    twitter_description: str,

    twitter_image: str,

    schema_type: str

):

    return {

        "title": seo_title.strip(),

        "description": seo_description.strip(),

        "focus_keyword": focus_keyword.strip(),

        "canonical_url": canonical_url.strip(),

        "robots": robots.strip(),

        "og_title": og_title.strip(),

        "og_description": og_description.strip(),

        "og_image": og_image.strip(),

        "twitter_title": twitter_title.strip(),

        "twitter_description": twitter_description.strip(),

        "twitter_image": twitter_image.strip(),

        "schema_type": schema_type.strip()

    }



def parse_ids(

    value

):

    if not value:

        return []



    return [

        item.strip()

        for item in value.split(",")

        if item.strip()

    ]



def validate_taxonomies(

    post_type_slug,

    categories,

    tags

):

    post_type = get_post_type_or_404(

        post_type_slug

    )



    features = get_features(

        post_type

    )



    valid_categories = []

    valid_tags = []



    if features.get(

        "categories",

        False

    ):

        for category_id in categories:

            if not ObjectId.is_valid(

                category_id

            ):

                continue



            category = taxonomies_collection.find_one(

                {

                    "_id": ObjectId(

                        category_id

                    ),

                    "type": "category",

                    "post_type_slug": post_type_slug,

                    "is_deleted": False

                }

            )



            if category:

                valid_categories.append(

                    category_id

                )



    if features.get(

        "tags",

        False

    ):

        for tag_id in tags:

            if not ObjectId.is_valid(

                tag_id

            ):

                continue



            tag = taxonomies_collection.find_one(

                {

                    "_id": ObjectId(

                        tag_id

                    ),

                    "type": "tag",

                    "post_type_slug": post_type_slug,

                    "is_deleted": False

                }

            )



            if tag:

                valid_tags.append(

                    tag_id

                )



    return (

        valid_categories,

        valid_tags

    )



def validate_parent_page(

    parent_id,

    current_item_id=""

):

    if not parent_id:

        return None



    if not ObjectId.is_valid(

        parent_id

    ):

        raise HTTPException(

            status_code=400,

            detail="Invalid parent page ID"

        )



    if (

        current_item_id

        and parent_id == current_item_id

    ):

        raise HTTPException(

            status_code=400,

            detail="A page cannot be its own parent"

        )



    parent = content_collection.find_one(

        {

            "_id": ObjectId(

                parent_id

            ),

            "post_type": "pages",

            "status": "published",

            "is_deleted": False

        }

    )



    if not parent:

        raise HTTPException(

            status_code=400,

            detail="Parent page must be a published page"

        )



    return parent_id



def validate_featured_image(

    media_id

):

    if not media_id:

        return ""



    if not ObjectId.is_valid(

        media_id

    ):

        raise HTTPException(

            status_code=400,

            detail="Invalid featured image ID"

        )



    media = media_collection.find_one(

        {

            "_id": ObjectId(

                media_id

            ),

            "is_deleted": False

        }

    )



    if not media:

        raise HTTPException(

            status_code=400,

            detail="Featured image not found in Media Library"

        )



    return media_id



def get_featured_image_url(

    media_id,

    fallback=""

):

    if media_id and ObjectId.is_valid(

        media_id

    ):

        media = media_collection.find_one(

            {

                "_id": ObjectId(

                    media_id

                ),

                "is_deleted": False

            }

        )



        if media:

            return media.get(

                "url",

                fallback

            )



    return fallback



@router.get(

    "/stats"

)

def get_content_stats(

    user=Depends(

        require_permission(

            "content.view"

        )

    )

):

    posts = content_collection.count_documents(

        {

            "post_type": "posts",

            "is_deleted": False

        }

    )



    pages = content_collection.count_documents(

        {

            "post_type": "pages",

            "is_deleted": False

        }

    )



    custom_post_types = post_types_collection.count_documents(

        {

            "is_builtin": False,

            "is_deleted": False

        }

    )



    taxonomies = taxonomies_collection.count_documents(

        {

            "is_deleted": False

        }

    )



    return {

        "posts": posts,

        "pages": pages,

        "custom_post_types": custom_post_types,

        "taxonomies": taxonomies

    }



@router.get(

    "/post-types"

)

def get_post_types(

    user=Depends(

        require_permission(

            "content.view"

        )

    )

):

    initialize_builtin_post_types()



    post_types = []



    for post_type in post_types_collection.find(

        {

            "is_deleted": False,

            "is_active": True

        }

    ).sort(

        "name",

        1

    ):

        post_types.append(

            get_post_type_response(

                post_type

            )

        )



    return {

        "post_types": post_types

    }



@router.post(

    "/post-types"

)

def create_post_type(

    name: str = Form(...),

    slug: str = Form(...),

    icon: str = Form("📄"),

    user=Depends(

        require_permission(

            "content.manage_types"

        )

    )

):

    name = name.strip()

    slug = slug.strip().lower()



    if not name:

        raise HTTPException(

            status_code=400,

            detail="Post type name is required"

        )



    if not slug:

        raise HTTPException(

            status_code=400,

            detail="Post type slug is required"

        )



    existing = post_types_collection.find_one(

        {

            "slug": slug,

            "is_deleted": False

        }

    )



    if existing:

        raise HTTPException(

            status_code=400,

            detail="Post type slug already exists"

        )



    result = post_types_collection.insert_one(

        {

            "name": name,

            "slug": slug,

            "icon": icon,

            "is_builtin": False,

            "is_active": True,

            "is_deleted": False,

            "fields": [],

            "taxonomies": DEFAULT_POST_TAXONOMIES,

            "features": DEFAULT_CONTENT_FEATURES,

            "created_at": now(),

            "updated_at": now()

        }

    )



    return {

        "message": "Post type created successfully",

        "id": str(

            result.inserted_id

        )

    }



@router.get(

    "/post-types/by-slug/{slug}"

)

def get_post_type_by_slug(

    slug: str,

    user=Depends(

        require_permission(

            "content.view"

        )

    )

):

    post_type = get_post_type_or_404(

        slug

    )



    return get_post_type_response(

        post_type

    )



@router.get(

    "/post-types/{post_type_id}"

)

def get_post_type(

    post_type_id: str,

    user=Depends(

        require_permission(

            "content.view"

        )

    )

):

    if not ObjectId.is_valid(

        post_type_id

    ):

        raise HTTPException(

            status_code=400,

            detail="Invalid post type ID"

        )



    post_type = post_types_collection.find_one(

        {

            "_id": ObjectId(

                post_type_id

            ),

            "is_deleted": False

        }

    )



    if not post_type:

        raise HTTPException(

            status_code=404,

            detail="Post type not found"

        )



    return get_post_type_response(

        post_type

    )



@router.put(

    "/post-types/{post_type_id}"

)

def update_post_type(

    post_type_id: str,

    name: str = Form(...),

    slug: str = Form(...),

    icon: str = Form("📄"),

    user=Depends(

        require_permission(

            "content.manage_types"

        )

    )

):

    if not ObjectId.is_valid(

        post_type_id

    ):

        raise HTTPException(

            status_code=400,

            detail="Invalid post type ID"

        )



    post_type = post_types_collection.find_one(

        {

            "_id": ObjectId(

                post_type_id

            ),

            "is_deleted": False

        }

    )



    if not post_type:

        raise HTTPException(

            status_code=404,

            detail="Post type not found"

        )



    if post_type.get(

        "is_builtin",

        False

    ):

        raise HTTPException(

            status_code=400,

            detail="Built-in post types cannot be edited"

        )



    name = name.strip()

    slug = slug.strip().lower()



    if not name:

        raise HTTPException(

            status_code=400,

            detail="Post type name is required"

        )



    if not slug:

        raise HTTPException(

            status_code=400,

            detail="Post type slug is required"

        )



    existing = post_types_collection.find_one(

        {

            "slug": slug,

            "is_deleted": False,

            "_id": {

                "$ne": ObjectId(

                    post_type_id

                )

            }

        }

    )



    if existing:

        raise HTTPException(

            status_code=400,

            detail="Post type slug already exists"

        )



    old_slug = post_type.get(

        "slug"

    )



    post_types_collection.update_one(

        {

            "_id": ObjectId(

                post_type_id

            )

        },

        {

            "$set": {

                "name": name,

                "slug": slug,

                "icon": icon,

                "updated_at": now()

            }

        }

    )



    if old_slug != slug:

        content_collection.update_many(

            {

                "post_type": old_slug

            },

            {

                "$set": {

                    "post_type": slug,

                    "updated_at": now()

                }

            }

        )



        taxonomies_collection.update_many(

            {

                "post_type_slug": old_slug

            },

            {

                "$set": {

                    "post_type_slug": slug,

                    "updated_at": now()

                }

            }

        )



    return {

        "message": "Post type updated successfully"

    }



@router.delete(

    "/post-types/{post_type_id}"

)

def delete_post_type(

    post_type_id: str,

    user=Depends(

        require_permission(

            "content.manage_types"

        )

    )

):

    if not ObjectId.is_valid(

        post_type_id

    ):

        raise HTTPException(

            status_code=400,

            detail="Invalid post type ID"

        )



    post_type = post_types_collection.find_one(

        {

            "_id": ObjectId(

                post_type_id

            ),

            "is_deleted": False

        }

    )



    if not post_type:

        raise HTTPException(

            status_code=404,

            detail="Post type not found"

        )



    if post_type.get(

        "is_builtin",

        False

    ):

        raise HTTPException(

            status_code=400,

            detail="Built-in post types cannot be deleted"

        )



    post_types_collection.update_one(

        {

            "_id": ObjectId(

                post_type_id

            )

        },

        {

            "$set": {

                "is_deleted": True,

                "is_active": False,

                "updated_at": now()

            }

        }

    )



    content_collection.update_many(

        {

            "post_type": post_type.get(

                "slug"

            )

        },

        {

            "$set": {

                "is_deleted": True,

                "deleted_at": now(),

                "updated_at": now()

            }

        }

    )



    return {

        "message": "Post type deleted successfully"

    }



@router.get(

    "/items/{post_type_slug}"

)

def get_content_by_post_type(

    post_type_slug: str,

    include_trash: bool = False,

    user=Depends(

        require_permission(

            "content.view"

        )

    )

):

    post_type = get_post_type_or_404(

        post_type_slug

    )



    query = {

        "post_type": post_type_slug

    }



    if not include_trash:

        query["is_deleted"] = False



    items = []



    for item in content_collection.find(

        query

    ).sort(

        "created_at",

        -1

    ):

        items.append(

            {

                "id": str(

                    item["_id"]

                ),

                "post_type": item.get(

                    "post_type",

                    post_type_slug

                ),

                "title": item.get(

                    "title",

                    ""

                ),

                "slug": item.get(

                    "slug",

                    ""

                ),

                "content": item.get(

                    "content",

                    ""

                ),

                "status": item.get(

                    "status",

                    "draft"

                ),

                "featured_image_id": item.get(

                    "featured_image_id",

                    ""

                ),

                "featured_image": get_featured_image_url(

                    item.get(

                        "featured_image_id",

                        ""

                    ),

                    item.get(

                        "featured_image",

                        ""

                    )

                ),

                "parent_id": item.get(

                    "parent_id"

                ),

                "categories": item.get(

                    "categories",

                    []

                ),

                "tags": item.get(

                    "tags",

                    []

                ),

                "fields": item.get(

                    "fields",

                    {}

                ),

                "seo": item.get(

                    "seo",

                    {}

                ),

                "author_id": item.get(

                    "author_id",

                    ""

                ),

                "is_deleted": item.get(

                    "is_deleted",

                    False

                ),

                "created_at": item.get(

                    "created_at"

                ),

                "updated_at": item.get(

                    "updated_at"

                )

            }

        )



    return {

        "post_type": get_post_type_response(

            post_type

        ),

        "items": items

    }



@router.get(

    "/items/single/{item_id}"

)

def get_content_item(

    item_id: str,

    user=Depends(

        require_permission(

            "content.view"

        )

    )

):

    if not ObjectId.is_valid(

        item_id

    ):

        raise HTTPException(

            status_code=400,

            detail="Invalid content ID"

        )



    item = content_collection.find_one(

        {

            "_id": ObjectId(

                item_id

            )

        }

    )



    if not item:

        raise HTTPException(

            status_code=404,

            detail="Content not found"

        )



    return {

        "id": str(

            item["_id"]

        ),

        "post_type": item.get(

            "post_type",

            ""

        ),

        "title": item.get(

            "title",

            ""

        ),

        "slug": item.get(

            "slug",

            ""

        ),

        "content": item.get(

            "content",

            ""

        ),

        "status": item.get(

            "status",

            "draft"

        ),

        "featured_image_id": item.get(

            "featured_image_id",

            ""

        ),

        "featured_image": get_featured_image_url(

            item.get(

                "featured_image_id",

                ""

            ),

            item.get(

                "featured_image",

                ""

            )

        ),

        "parent_id": item.get(

            "parent_id"

        ),

        "categories": item.get(

            "categories",

            []

        ),

        "tags": item.get(

            "tags",

            []

        ),

        "fields": item.get(

            "fields",

            {}

        ),

        "seo": item.get(

            "seo",

            {}

        ),

        "is_deleted": item.get(

            "is_deleted",

            False

        ),

        "created_at": item.get(

            "created_at"

        ),

        "updated_at": item.get(

            "updated_at"

        )

    }



@router.get(

    "/pages"

)

def get_pages(

    published_only: bool = False,

    include_trash: bool = False,

    user=Depends(

        require_permission(

            "content.view"

        )

    )

):

    query = {

        "post_type": "pages"

    }



    if not include_trash:

        query["is_deleted"] = False



    if published_only:

        query["status"] = "published"



    pages = []



    for page in content_collection.find(

        query

    ).sort(

        "title",

        1

    ):

        pages.append(

            {

                "id": str(

                    page["_id"]

                ),

                "title": page.get(

                    "title",

                    ""

                ),

                "slug": page.get(

                    "slug",

                    ""

                ),

                "content": page.get(

                    "content",

                    ""

                ),

                "featured_image_id": page.get(

                    "featured_image_id",

                    ""

                ),

                "featured_image": get_featured_image_url(

                    page.get(

                        "featured_image_id",

                        ""

                    ),

                    page.get(

                        "featured_image",

                        ""

                    )

                ),

                "parent_id": page.get(

                    "parent_id"

                ),

                "status": page.get(

                    "status",

                    "draft"

                ),

                "seo": page.get(

                    "seo",

                    {}

                ),

                "is_deleted": page.get(

                    "is_deleted",

                    False

                )

            }

        )



    return {

        "pages": pages

    }



@router.post(

    "/upload-image"

)

async def upload_content_image(

    file: UploadFile = File(...),

    user=Depends(

        require_permission(

            "content.create"

        )

    )

):

    if not file.filename:

        raise HTTPException(

            status_code=400,

            detail="Image file is required"

        )



    extension = os.path.splitext(

        file.filename

    )[1].lower()



    allowed_extensions = [

        ".jpg",

        ".jpeg",

        ".png",

        ".webp",

        ".gif"

    ]



    if extension not in allowed_extensions:

        raise HTTPException(

            status_code=400,

            detail="Only JPG, JPEG, PNG, WEBP and GIF images are allowed"

        )



    filename = (

        str(uuid.uuid4())

        + extension

    )



    file_path = os.path.join(

        UPLOAD_DIR,

        filename

    )



    try:

        with open(

            file_path,

            "wb"

        ) as output_file:

            while True:

                chunk = await file.read(

                    1024 * 1024

                )



                if not chunk:

                    break



                output_file.write(

                    chunk

                )



    except Exception as error:

        raise HTTPException(

            status_code=500,

            detail=f"Unable to upload image: {str(error)}"

        )



    return {

        "filename": filename,

        "image_url": f"/uploads/content/{filename}"

    }



@router.post(

    "/items/{post_type_slug}"

)

def create_content(

    post_type_slug: str,

    title: str = Form(...),

    slug: str = Form(...),

    content: str = Form(""),

    status: str = Form("draft"),

    featured_image: str = Form(""),

    featured_image_id: str = Form(""),

    parent_id: str = Form(""),

    categories: str = Form(""),

    tags: str = Form(""),

    seo_title: str = Form(""),

    seo_description: str = Form(""),

    focus_keyword: str = Form(""),

    canonical_url: str = Form(""),

    robots: str = Form("index,follow"),

    og_title: str = Form(""),

    og_description: str = Form(""),

    og_image: str = Form(""),

    twitter_title: str = Form(""),

    twitter_description: str = Form(""),

    twitter_image: str = Form(""),

    schema_type: str = Form("Article"),

    user=Depends(

        require_permission(

            "content.create"

        )

    )

):

    post_type = get_post_type_or_404(

        post_type_slug

    )



    features = get_features(

        post_type

    )



    title = title.strip()

    slug = slug.strip().lower()

    content = content.strip()



    if features.get(

        "title",

        True

    ) and not title:

        raise HTTPException(

            status_code=400,

            detail="Title is required"

        )



    if not slug:

        raise HTTPException(

            status_code=400,

            detail="Slug is required"

        )



    existing = content_collection.find_one(

        {

            "post_type": post_type_slug,

            "slug": slug,

            "is_deleted": False

        }

    )



    if existing:

        raise HTTPException(

            status_code=400,

            detail="Content slug already exists"

        )



    if status not in [

        "draft",

        "published"

    ]:

        status = "draft"



    category_ids = parse_ids(

        categories

    )



    tag_ids = parse_ids(

        tags

    )



    (

        category_list,

        tag_list

    ) = validate_taxonomies(

        post_type_slug,

        category_ids,

        tag_ids

    )



    valid_parent_id = None



    if features.get(

        "parent_page",

        False

    ):

        valid_parent_id = validate_parent_page(

            parent_id

        )



    valid_featured_image_id = ""



    if features.get(

        "featured_image",

        False

    ):

        valid_featured_image_id = validate_featured_image(

            featured_image_id

        )

    else:

        featured_image = ""



    seo = {}



    if features.get(

        "seo",

        False

    ):

        seo = build_seo(

            seo_title,

            seo_description,

            focus_keyword,

            canonical_url,

            robots,

            og_title,

            og_description,

            og_image,

            twitter_title,

            twitter_description,

            twitter_image,

            schema_type

        )



    result = content_collection.insert_one(

        {

            "post_type": post_type_slug,

            "title": title,

            "slug": slug,

            "content": content,

            "status": status,

            "featured_image": featured_image.strip(),

            "featured_image_id": valid_featured_image_id,

            "parent_id": valid_parent_id,

            "categories": category_list,

            "tags": tag_list,

            "fields": {},

            "seo": seo,

            "author_id": str(

                user.get(

                    "id",

                    ""

                )

            ),

            "is_deleted": False,

            "created_at": now(),

            "updated_at": now()

        }

    )



    return {

        "message": "Content created successfully",

        "id": str(

            result.inserted_id

        )

    }



@router.put(

    "/items/{item_id}"

)

def update_content(

    item_id: str,

    title: str = Form(...),

    slug: str = Form(...),

    content: str = Form(""),

    status: str = Form("draft"),

    featured_image: str = Form(""),

    featured_image_id: str = Form(""),

    parent_id: str = Form(""),

    categories: str = Form(""),

    tags: str = Form(""),

    seo_title: str = Form(""),

    seo_description: str = Form(""),

    focus_keyword: str = Form(""),

    canonical_url: str = Form(""),

    robots: str = Form("index,follow"),

    og_title: str = Form(""),

    og_description: str = Form(""),

    og_image: str = Form(""),

    twitter_title: str = Form(""),

    twitter_description: str = Form(""),

    twitter_image: str = Form(""),

    schema_type: str = Form("Article"),

    user=Depends(

        require_permission(

            "content.edit"

        )

    )

):

    if not ObjectId.is_valid(

        item_id

    ):

        raise HTTPException(

            status_code=400,

            detail="Invalid content ID"

        )



    item = content_collection.find_one(

        {

            "_id": ObjectId(

                item_id

            ),

            "is_deleted": False

        }

    )



    if not item:

        raise HTTPException(

            status_code=404,

            detail="Content not found"

        )



    post_type_slug = item.get(

        "post_type",

        ""

    )



    post_type = get_post_type_or_404(

        post_type_slug

    )



    features = get_features(

        post_type

    )



    title = title.strip()

    slug = slug.strip().lower()

    content = content.strip()



    if features.get(

        "title",

        True

    ) and not title:

        raise HTTPException(

            status_code=400,

            detail="Title is required"

        )



    if not slug:

        raise HTTPException(

            status_code=400,

            detail="Slug is required"

        )



    existing = content_collection.find_one(

        {

            "post_type": post_type_slug,

            "slug": slug,

            "is_deleted": False,

            "_id": {

                "$ne": ObjectId(

                    item_id

                )

            }

        }

    )



    if existing:

        raise HTTPException(

            status_code=400,

            detail="Content slug already exists"

        )



    if status not in [

        "draft",

        "published"

    ]:

        status = "draft"



    category_ids = parse_ids(

        categories

    )



    tag_ids = parse_ids(

        tags

    )



    (

        category_list,

        tag_list

    ) = validate_taxonomies(

        post_type_slug,

        category_ids,

        tag_ids

    )



    valid_parent_id = None



    if features.get(

        "parent_page",

        False

    ):

        valid_parent_id = validate_parent_page(

            parent_id,

            item_id

        )



    valid_featured_image_id = ""



    if features.get(

        "featured_image",

        False

    ):

        if featured_image_id:

            valid_featured_image_id = validate_featured_image(

                featured_image_id

            )

        else:

            valid_featured_image_id = item.get(

                "featured_image_id",

                ""

            )

    else:

        featured_image = ""



    seo = {}



    if features.get(

        "seo",

        False

    ):

        seo = build_seo(

            seo_title,

            seo_description,

            focus_keyword,

            canonical_url,

            robots,

            og_title,

            og_description,

            og_image,

            twitter_title,

            twitter_description,

            twitter_image,

            schema_type

        )



    content_collection.update_one(

        {

            "_id": ObjectId(

                item_id

            )

        },

        {

            "$set": {

                "title": title,

                "slug": slug,

                "content": content,

                "status": status,

                "featured_image": featured_image.strip(),

                "featured_image_id": valid_featured_image_id,

                "parent_id": valid_parent_id,

                "categories": category_list,

                "tags": tag_list,

                "seo": seo,

                "updated_at": now()

            }

        }

    )



    return {

        "message": "Content updated successfully",

        "id": item_id

    }



@router.put(

    "/items/{item_id}/trash"

)

def move_to_trash(

    item_id: str,

    user=Depends(

        require_permission(

            "content.delete"

        )

    )

):

    if not ObjectId.is_valid(

        item_id

    ):

        raise HTTPException(

            status_code=400,

            detail="Invalid content ID"

        )



    result = content_collection.update_one(

        {

            "_id": ObjectId(

                item_id

            ),

            "is_deleted": False

        },

        {

            "$set": {

                "is_deleted": True,

                "deleted_at": now(),

                "updated_at": now()

            }

        }

    )



    if result.matched_count == 0:

        raise HTTPException(

            status_code=404,

            detail="Content not found"

        )



    return {

        "message": "Content moved to trash"

    }



@router.put(

    "/items/{item_id}/restore"

)

def restore_content(

    item_id: str,

    user=Depends(

        require_permission(

            "content.delete"

        )

    )

):

    if not ObjectId.is_valid(

        item_id

    ):

        raise HTTPException(

            status_code=400,

            detail="Invalid content ID"

        )



    result = content_collection.update_one(

        {

            "_id": ObjectId(

                item_id

            ),

            "is_deleted": True

        },

        {

            "$set": {

                "is_deleted": False,

                "updated_at": now()

            },

            "$unset": {

                "deleted_at": ""

            }

        }

    )



    if result.matched_count == 0:

        raise HTTPException(

            status_code=404,

            detail="Content not found in trash"

        )



    return {

        "message": "Content restored successfully"

    }



@router.delete(

    "/items/{item_id}/permanent"

)

def permanent_delete(

    item_id: str,

    user=Depends(

        require_permission(

            "content.delete"

        )

    )

):

    if not ObjectId.is_valid(

        item_id

    ):

        raise HTTPException(

            status_code=400,

            detail="Invalid content ID"

        )



    result = content_collection.delete_one(

        {

            "_id": ObjectId(

                item_id

            )

        }

    )



    if result.deleted_count == 0:

        raise HTTPException(

            status_code=404,

            detail="Content not found"

        )



    return {

        "message": "Content permanently deleted"

    }



@router.post(

    "/items/bulk-trash"

)

def bulk_trash(

    ids: list[str],

    user=Depends(

        require_permission(

            "content.delete"

        )

    )

):

    object_ids = []



    for item_id in ids:

        if ObjectId.is_valid(

            item_id

        ):

            object_ids.append(

                ObjectId(

                    item_id

                )

            )



    if not object_ids:

        raise HTTPException(

            status_code=400,

            detail="No valid content selected"

        )



    result = content_collection.update_many(

        {

            "_id": {

                "$in": object_ids

            },

            "is_deleted": False

        },

        {

            "$set": {

                "is_deleted": True,

                "deleted_at": now(),

                "updated_at": now()

            }

        }

    )



    return {

        "message": "Selected content moved to trash",

        "count": result.modified_count

    }



@router.post(

    "/items/bulk-restore"

)

def bulk_restore(

    ids: list[str],

    user=Depends(

        require_permission(

            "content.delete"

        )

    )

):

    object_ids = []



    for item_id in ids:

        if ObjectId.is_valid(

            item_id

        ):

            object_ids.append(

                ObjectId(

                    item_id

                )

            )



    if not object_ids:

        raise HTTPException(

            status_code=400,

            detail="No valid content selected"

        )



    result = content_collection.update_many(

        {

            "_id": {

                "$in": object_ids

            },

            "is_deleted": True

        },

        {

            "$set": {

                "is_deleted": False,

                "updated_at": now()

            },

            "$unset": {

                "deleted_at": ""

            }

        }

    )



    return {

        "message": "Selected content restored",

        "count": result.modified_count

    }



@router.post(

    "/items/bulk-delete"

)

def bulk_delete(

    ids: list[str],

    user=Depends(

        require_permission(

            "content.delete"

        )

    )

):

    object_ids = []



    for item_id in ids:

        if ObjectId.is_valid(

            item_id

        ):

            object_ids.append(

                ObjectId(

                    item_id

                )

            )



    if not object_ids:

        raise HTTPException(

            status_code=400,

            detail="No valid content selected"

        )



    result = content_collection.delete_many(

        {

            "_id": {

                "$in": object_ids

            }

        }

    )



    return {

        "message": "Selected content permanently deleted",

        "count": result.deleted_count

    }



# Categories



@router.get(

    "/taxonomies/{post_type_slug}/categories"

)

def get_categories(

    post_type_slug: str,

    user=Depends(

        require_permission(

            "content.view"

        )

    )

):

    post_type = get_post_type_or_404(

        post_type_slug

    )



    features = get_features(

        post_type

    )



    if not features.get(

        "categories",

        False

    ):

        return {

            "categories": []

        }



    categories = list(

        taxonomies_collection.find(

            {

                "post_type_slug": post_type_slug,

                "type": "category",

                "is_deleted": False

            }

        ).sort(

            "name",

            1

        )

    )



    result = []



    for category in categories:

        result.append(

            {

                "id": str(

                    category["_id"]

                ),

                "name": category.get(

                    "name",

                    ""

                ),

                "slug": category.get(

                    "slug",

                    ""

                ),

                "parent_id": category.get(

                    "parent_id"

                ),

                "post_type_slug": category.get(

                    "post_type_slug",

                    post_type_slug

                )

            }

        )



    return {

        "categories": result

    }



@router.post(

    "/taxonomies/{post_type_slug}/categories"

)

def create_category(

    post_type_slug: str,

    name: str = Form(...),

    slug: str = Form(""),

    parent_id: str = Form(""),

    user=Depends(

        require_permission(

            "content.manage_taxonomies"

        )

    )

):

    post_type = get_post_type_or_404(

        post_type_slug

    )



    features = get_features(

        post_type

    )



    if not features.get(

        "categories",

        False

    ):

        raise HTTPException(

            status_code=400,

            detail="Categories are disabled for this content type"

        )



    name = name.strip()

    slug = slug.strip().lower()



    if not name:

        raise HTTPException(

            status_code=400,

            detail="Category name is required"

        )



    if not slug:

        slug = name.lower().replace(

            " ",

            "-"

        )



    existing = taxonomies_collection.find_one(

        {

            "post_type_slug": post_type_slug,

            "type": "category",

            "slug": slug,

            "is_deleted": False

        }

    )



    if existing:

        raise HTTPException(

            status_code=400,

            detail="Category already exists"

        )



    valid_parent_id = None



    if parent_id:

        if not ObjectId.is_valid(

            parent_id

        ):

            raise HTTPException(

                status_code=400,

                detail="Invalid parent category ID"

            )



        parent = taxonomies_collection.find_one(

            {

                "_id": ObjectId(

                    parent_id

                ),

                "post_type_slug": post_type_slug,

                "type": "category",

                "is_deleted": False

            }

        )



        if not parent:

            raise HTTPException(

                status_code=400,

                detail="Parent category not found"

            )



        valid_parent_id = parent_id



    category = {

        "name": name,

        "slug": slug,

        "type": "category",

        "post_type_slug": post_type_slug,

        "parent_id": valid_parent_id,

        "is_deleted": False,

        "created_at": now(),

        "updated_at": now()

    }



    result = taxonomies_collection.insert_one(

        category

    )



    return {

        "message": "Category created successfully",

        "id": str(

            result.inserted_id

        ),

        "name": name,

        "slug": slug,

        "parent_id": valid_parent_id,

        "post_type_slug": post_type_slug

    }



@router.put(

    "/taxonomies/categories/{category_id}"

)

def update_category(

    category_id: str,

    name: str = Form(...),

    slug: str = Form(""),

    parent_id: str = Form(""),

    user=Depends(

        require_permission(

            "content.manage_taxonomies"

        )

    )

):

    if not ObjectId.is_valid(

        category_id

    ):

        raise HTTPException(

            status_code=400,

            detail="Invalid category ID"

        )



    category = taxonomies_collection.find_one(

        {

            "_id": ObjectId(

                category_id

            ),

            "type": "category",

            "is_deleted": False

        }

    )



    if not category:

        raise HTTPException(

            status_code=404,

            detail="Category not found"

        )



    name = name.strip()

    slug = slug.strip().lower()



    if not name:

        raise HTTPException(

            status_code=400,

            detail="Category name is required"

        )



    if not slug:

        slug = name.lower().replace(

            " ",

            "-"

        )



    existing = taxonomies_collection.find_one(

        {

            "post_type_slug": category.get(

                "post_type_slug"

            ),

            "type": "category",

            "slug": slug,

            "is_deleted": False,

            "_id": {

                "$ne": ObjectId(

                    category_id

                )

            }

        }

    )



    if existing:

        raise HTTPException(

            status_code=400,

            detail="Category slug already exists"

        )



    valid_parent_id = None



    if parent_id:

        if parent_id == category_id:

            raise HTTPException(

                status_code=400,

                detail="Category cannot be its own parent"

            )



        if not ObjectId.is_valid(

            parent_id

        ):

            raise HTTPException(

                status_code=400,

                detail="Invalid parent category ID"

            )



        parent = taxonomies_collection.find_one(

            {

                "_id": ObjectId(

                    parent_id

                ),

                "post_type_slug": category.get(

                    "post_type_slug"

                ),

                "type": "category",

                "is_deleted": False

            }

        )



        if not parent:

            raise HTTPException(

                status_code=400,

                detail="Parent category not found"

            )



        valid_parent_id = parent_id



    taxonomies_collection.update_one(

        {

            "_id": ObjectId(

                category_id

            )

        },

        {

            "$set": {

                "name": name,

                "slug": slug,

                "parent_id": valid_parent_id,

                "updated_at": now()

            }

        }

    )



    return {

        "message": "Category updated successfully"

    }



@router.delete(

    "/taxonomies/categories/{category_id}"

)

def delete_category(

    category_id: str,

    user=Depends(

        require_permission(

            "content.manage_taxonomies"

        )

    )

):

    if not ObjectId.is_valid(

        category_id

    ):

        raise HTTPException(

            status_code=400,

            detail="Invalid category ID"

        )



    category = taxonomies_collection.find_one(

        {

            "_id": ObjectId(

                category_id

            ),

            "type": "category",

            "is_deleted": False

        }

    )



    if not category:

        raise HTTPException(

            status_code=404,

            detail="Category not found"

        )



    result = taxonomies_collection.update_one(

        {

            "_id": ObjectId(

                category_id

            )

        },

        {

            "$set": {

                "is_deleted": True,

                "updated_at": now()

            }

        }

    )



    if result.modified_count == 0:

        raise HTTPException(

            status_code=404,

            detail="Category not found"

        )



    taxonomies_collection.update_many(

        {

            "type": "category",

            "parent_id": category_id,

            "is_deleted": False

        },

        {

            "$set": {

                "parent_id": None,

                "updated_at": now()

            }

        }

    )



    return {

        "message": "Category deleted successfully"

    }



# Tags



@router.get(

    "/taxonomies/{post_type_slug}/tags"

)

def get_tags(

    post_type_slug: str,

    user=Depends(

        require_permission(

            "content.view"

        )

    )

):

    post_type = get_post_type_or_404(

        post_type_slug

    )



    features = get_features(

        post_type

    )



    if not features.get(

        "tags",

        False

    ):

        return {

            "tags": []

        }



    tags = list(

        taxonomies_collection.find(

            {

                "post_type_slug": post_type_slug,

                "type": "tag",

                "is_deleted": False

            }

        ).sort(

            "name",

            1

        )

    )



    result = []



    for tag in tags:

        result.append(

            {

                "id": str(

                    tag["_id"]

                ),

                "name": tag.get(

                    "name",

                    ""

                ),

                "slug": tag.get(

                    "slug",

                    ""

                ),

                "post_type_slug": tag.get(

                    "post_type_slug",

                    post_type_slug

                )

            }

        )



    return {

        "tags": result

    }



@router.post(

    "/taxonomies/{post_type_slug}/tags"

)

def create_tag(

    post_type_slug: str,

    name: str = Form(...),

    slug: str = Form(""),

    user=Depends(

        require_permission(

            "content.manage_taxonomies"

        )

    )

):

    post_type = get_post_type_or_404(

        post_type_slug

    )



    features = get_features(

        post_type

    )



    if not features.get(

        "tags",

        False

    ):

        raise HTTPException(

            status_code=400,

            detail="Tags are disabled for this content type"

        )



    name = name.strip()

    slug = slug.strip().lower()



    if not name:

        raise HTTPException(

            status_code=400,

            detail="Tag name is required"

        )



    if not slug:

        slug = name.lower().replace(

            " ",

            "-"

        )



    existing = taxonomies_collection.find_one(

        {

            "post_type_slug": post_type_slug,

            "type": "tag",

            "slug": slug,

            "is_deleted": False

        }

    )



    if existing:

        raise HTTPException(

            status_code=400,

            detail="Tag already exists"

        )



    tag = {

        "name": name,

        "slug": slug,

        "type": "tag",

        "post_type_slug": post_type_slug,

        "is_deleted": False,

        "created_at": now(),

        "updated_at": now()

    }



    result = taxonomies_collection.insert_one(

        tag

    )



    return {

        "message": "Tag created successfully",

        "id": str(

            result.inserted_id

        ),

        "name": name,

        "slug": slug,

        "post_type_slug": post_type_slug

    }



@router.put(

    "/taxonomies/tags/{tag_id}"

)

def update_tag(

    tag_id: str,

    name: str = Form(...),

    slug: str = Form(""),

    user=Depends(

        require_permission(

            "content.manage_taxonomies"

        )

    )

):

    if not ObjectId.is_valid(

        tag_id

    ):

        raise HTTPException(

            status_code=400,

            detail="Invalid tag ID"

        )



    tag = taxonomies_collection.find_one(

        {

            "_id": ObjectId(

                tag_id

            ),

            "type": "tag",

            "is_deleted": False

        }

    )



    if not tag:

        raise HTTPException(

            status_code=404,

            detail="Tag not found"

        )



    name = name.strip()

    slug = slug.strip().lower()



    if not name:

        raise HTTPException(

            status_code=400,

            detail="Tag name is required"

        )



    if not slug:

        slug = name.lower().replace(

            " ",

            "-"

        )



    existing = taxonomies_collection.find_one(

        {

            "post_type_slug": tag.get(

                "post_type_slug"

            ),

            "type": "tag",

            "slug": slug,

            "is_deleted": False,

            "_id": {

                "$ne": ObjectId(

                    tag_id

                )

            }

        }

    )



    if existing:

        raise HTTPException(

            status_code=400,

            detail="Tag slug already exists"

        )



    taxonomies_collection.update_one(

        {

            "_id": ObjectId(

                tag_id

            )

        },

        {

            "$set": {

                "name": name,

                "slug": slug,

                "updated_at": now()

            }

        }

    )



    return {

        "message": "Tag updated successfully"

    }



@router.delete(

    "/taxonomies/tags/{tag_id}"

)

def delete_tag(

    tag_id: str,

    user=Depends(

        require_permission(

            "content.manage_taxonomies"

        )

    )

):

    if not ObjectId.is_valid(

        tag_id

    ):

        raise HTTPException(

            status_code=400,

            detail="Invalid tag ID"

        )



    tag = taxonomies_collection.find_one(

        {

            "_id": ObjectId(

                tag_id

            ),

            "type": "tag",

            "is_deleted": False

        }

    )



    if not tag:

        raise HTTPException(

            status_code=404,

            detail="Tag not found"

        )



    result = taxonomies_collection.update_one(

        {

            "_id": ObjectId(

                tag_id

            )

        },

        {

            "$set": {

                "is_deleted": True,

                "updated_at": now()

            }

        }

    )



    if result.modified_count == 0:

        raise HTTPException(

            status_code=404,

            detail="Tag not found"

        )



    return {

        "message": "Tag deleted successfully"

    }
