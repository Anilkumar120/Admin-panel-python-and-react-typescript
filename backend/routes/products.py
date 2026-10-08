import os 
import uuid 
 
from bson import ObjectId 
from fastapi import (APIRouter, UploadFile, File, Form, HTTPException, Query, Request, Depends) 
from database.connection import products_collection, media_collection
from backend.utils.permissions import require_permission
 
router = APIRouter( prefix="/api/products", tags=["Products"]) 
 
# PROJECT ROOT 
 
BASE_DIR = os.path.dirname( 
    os.path.dirname( 
        os.path.dirname( 
            os.path.abspath(__file__) 
        ) 
    ) 
) 
 
# IMAGE UPLOAD FOLDER 
 
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads","products" ) 
 
# CREATE PRODUCT 
 
@router.post("/") 
async def create_product( 
    request: Request, 
    name: str = Form(...), 
    description: str = Form(""), 
    price: float = Form(...), 
    quantity: int = Form(...), 
    category: str = Form(...), 
    brand: str = Form(""), 
    media_id: str = Form(...),
    current_user=Depends(require_permission("products.create"))
): 
 
    # Price validation 
 
    if price <= 0: 
        raise HTTPException( 
            status_code=400, 
            detail="Price must be greater than 0" 
        ) 
 
    # Quantity validation 
 
    if quantity < 0: 
        raise HTTPException( 
            status_code=400, 
            detail="Quantity cannot be negative" 
        ) 
 
    # Media validation 
 
    if not ObjectId.is_valid(media_id): 
        raise HTTPException( 
            status_code=400, 
            detail="Invalid media ID" 
        ) 
 
    media = media_collection.find_one( 
        { 
            "_id": ObjectId(media_id), 
            "is_deleted": { 
                "$ne": True 
            } 
        } 
    ) 
 
    if media is None: 
        raise HTTPException( 
            status_code=404, 
            detail="Selected media not found" 
        ) 
 
    # Product data 
 
    product_data = { 
        "name": name, 
        "description": description, 
        "price": price, 
        "quantity": quantity, 
        "category": category, 
        "brand": brand, 
        "media_id": media_id,
        "image": media.get("url", ""),
        "is_deleted": False 
    } 
 
    # MongoDB insert 
 
    try: 
        result = products_collection.insert_one(product_data) 
 
    except Exception as error: 
 
        raise HTTPException( 
            status_code=500, 
            detail=f"MongoDB error: {str(error)}" 
        ) 
 
    product_id = str(result.inserted_id) 
 
    image_path = media.get("url", "") 
 
    # Response 
 
    return { 
        "message": "Product created successfully", 
        "id": product_id, 
        "product": { 
            "id": product_id, 
            "name": name, 
            "description": description, 
            "price": price, 
            "quantity": quantity, 
            "category": category, 
            "brand": brand, 
            "media_id": media_id,
            "image": image_path, 
            "image_url": ( 
                f"{str(request.base_url).rstrip('/')}" 
                f"{image_path}" 
                if image_path.startswith("/")
                else image_path
            ) 
        } 
    } 
 
# GET PRODUCTS 
# Search + Category + Pagination 
 
@router.get("/") 
def get_products( 
    request: Request, 
    search: str = Query("",description="Search by product name or brand"), 
    category: str = Query("", description="Filter by category"), 
    page: int = Query(1, ge=1, description="Page number"), 
    limit: int = Query(10, ge=1, le=100, description="Products per page"), 
    current_user=Depends(require_permission("products.view"))
): 
 
    try: 
 
        # MongoDB query 
 
        query = { 
            "is_deleted": { 
                "$ne": True 
            } 
        } 
 
        if search.strip(): 
 
            query["$or"] = [ 
                { 
                    "name": { 
                        "$regex": search.strip(), 
                        "$options": "i" 
                    } 
                }, 
                { 
                    "brand": { 
                        "$regex": search.strip(), 
                        "$options": "i" 
                    } 
                } 
            ] 
 
        # Category filter 
 
        if category.strip(): 
 
            query["category"] = { 
                "$regex": category.strip(), 
                "$options": "i" 
            } 
 
        total = products_collection.count_documents(query) 
 
        skip = (page - 1) * limit 
 
        products = products_collection.find( 
            query 
        ).skip(skip).limit(limit) 
 
        product_list = [] 
 
        for product in products: 
 
            image_path = product.get("image", "")
 
            media_id = product.get("media_id", "")
 
            if media_id and ObjectId.is_valid(media_id): 
 
                media = media_collection.find_one( 
                    { 
                        "_id": ObjectId(media_id), 
                        "is_deleted": { 
                            "$ne": True 
                        } 
                    } 
                ) 
 
                if media is not None: 
 
                    image_path = media.get("url", "") 
 
            product_list.append({ 
                "id": str(product["_id"]), 
                "name": product.get("name", ""), 
                "description": product.get("description",""), 
                "price": product.get("price", 0), 
                "quantity": product.get("quantity", 0), 
                "category": product.get("category", ""), 
                "brand": product.get("brand",""), 
                "media_id": media_id,
                "image": image_path, 
                "image_url": ( 
                    f"{str(request.base_url).rstrip('/')}" 
                    f"{image_path}"
                    if image_path.startswith("/")
                    else image_path
                ) 
            }) 
 
        total_pages = ((total + limit - 1) // limit) 
 
        # Response 
 
        return { 
            "message": "Products fetched successfully", 
            "total": total, 
            "page": page, 
            "limit": limit, 
            "total_pages": total_pages, 
            "products": product_list 
        } 
 
    except Exception as error: 
 
        raise HTTPException( 
            status_code=500, 
            detail=( 
                f"Failed to fetch products: " 
                f"{str(error)}" 
            ) 
        ) 
 
# GET TRASH PRODUCTS 
 
@router.get("/trash") 
def get_trash_products(
    request: Request,
    current_user=Depends(require_permission("products.view"))
): 
 
    try: 
 
        products = products_collection.find( 
            { 
                "is_deleted": True 
            } 
        ) 
 
        product_list = [] 
 
        for product in products: 
 
            image_path = product.get("image", "")
 
            media_id = product.get("media_id", "")
 
            if media_id and ObjectId.is_valid(media_id): 
 
                media = media_collection.find_one( 
                    { 
                        "_id": ObjectId(media_id) 
                    } 
                ) 
 
                if media is not None: 
 
                    image_path = media.get("url", "") 
 
            product_list.append({ 
                "id": str(product["_id"]), 
                "name": product.get("name", ""), 
                "description": product.get("description", ""), 
                "price": product.get("price", 0), 
                "quantity": product.get("quantity", 0), 
                "category": product.get("category", ""), 
                "brand": product.get("brand", ""), 
                "media_id": media_id,
                "image": image_path, 
                "image_url": ( 
                    f"{str(request.base_url).rstrip('/')}" 
                    f"{image_path}"
                    if image_path.startswith("/")
                    else image_path
                ) 
            }) 
 
        return { 
            "message": "Trash products fetched successfully", 
            "total": len(product_list), 
            "products": product_list 
        } 
 
    except Exception as error: 
 
        raise HTTPException( 
            status_code=500, 
            detail=( 
                f"Failed to fetch trash products: " 
                f"{str(error)}" 
            ) 
        ) 
 
# GET PRODUCT CATEGORIES

@router.get("/categories")
def get_product_categories(
    current_user=Depends(require_permission("products.view"))
):

    try:

        categories = products_collection.distinct(
            "category",
            {
                "is_deleted": {
                    "$ne": True
                }
            }
        )

        categories = [
            category
            for category in categories
            if category and category.strip()
        ]

        categories.sort(
            key=lambda item: item.lower()
        )

        return {
            "message": "Product categories fetched successfully",
            "categories": categories
        }

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=(
                f"Failed to fetch product categories: "
                f"{str(error)}"
            )
        )
 
# GET SINGLE PRODUCT 
 
@router.get("/{product_id}") 
def get_product( 
    request: Request, 
    product_id: str,
    current_user=Depends(require_permission("products.view"))
): 
 
    if not ObjectId.is_valid(product_id): 
 
        raise HTTPException( 
            status_code=400, 
            detail="Invalid product ID" 
        ) 
 
    product = products_collection.find_one( 
        { 
            "_id": ObjectId(product_id) 
        } 
    ) 
 
    # Product not found 
 
    if product is None: 
 
        raise HTTPException( 
            status_code=404, 
            detail="Product not found" 
        ) 
 
    # Product is in trash 
 
    if product.get("is_deleted", False): 
 
        raise HTTPException( 
            status_code=404, 
            detail="Product not found" 
        ) 
 
    image_path = product.get("image", "")
 
    media_id = product.get("media_id", "")
 
    if media_id and ObjectId.is_valid(media_id): 
 
        media = media_collection.find_one( 
            { 
                "_id": ObjectId(media_id), 
                "is_deleted": { 
                    "$ne": True 
                } 
            } 
        ) 
 
        if media is not None: 
 
            image_path = media.get("url", "") 
 
    # Return product 
 
    return { 
        "id": str(product["_id"]), 
        "name": product.get("name", ""), 
        "description": product.get("description",""), 
        "price": product.get("price",0), 
        "quantity": product.get("quantity",0), 
        "category": product.get("category",""), 
        "brand": product.get("brand",""), 
        "media_id": media_id,
        "image": image_path, 
        "image_url": ( 
            f"{str(request.base_url).rstrip('/')}" 
            f"{image_path}"
            if image_path.startswith("/")
            else image_path
        ) 
    } 
 
# UPDATE PRODUCT 
 
@router.put("/{product_id}") 
async def update_product( 
    request: Request, 
    product_id: str, 
    name: str | None = Form(None), 
    description: str | None = Form(None), 
    price: float | None = Form(None), 
    quantity: int | None = Form(None), 
    category: str | None = Form(None), 
    brand: str | None = Form(None), 
    media_id: str | None = Form(None),
    image: UploadFile | None = File(None),
    current_user=Depends(require_permission("products.edit"))
): 
 
    # Validate ObjectId 
 
    if not ObjectId.is_valid(product_id): 
 
        raise HTTPException( 
            status_code=400, 
            detail="Invalid product ID" 
        ) 
 
    # Find existing product 
 
    existing_product = products_collection.find_one( 
        { 
            "_id": ObjectId(product_id) 
        } 
    ) 
 
    if existing_product is None: 
 
        raise HTTPException( 
            status_code=404, 
            detail="Product not found" 
        ) 
 
    # Product is in trash 
 
    if existing_product.get("is_deleted", False): 
 
        raise HTTPException( 
            status_code=400, 
            detail="Product is in trash. Restore it first" 
        ) 
 
    # Existing values 
 
    old_name = existing_product.get( 
        "name", 
        "" 
    ) 
 
    old_description = existing_product.get( 
        "description", 
        "" 
    ) 
 
    old_price = existing_product.get( 
        "price", 
        0 
    ) 
 
    old_quantity = existing_product.get( 
        "quantity", 
        0 
    ) 
 
    old_category = existing_product.get( 
        "category", 
        "" 
    ) 
 
    old_brand = existing_product.get( 
        "brand", 
        "" 
    ) 
 
    old_image_path = existing_product.get( 
        "image", 
        "" 
    ) 

    old_media_id = existing_product.get(
        "media_id",
        ""
    )
 
    # Use existing values if field is not provided 
 
    updated_name = ( 
        old_name 
        if name is None 
        else name 
    ) 
 
    updated_description = ( 
        old_description 
        if description is None 
        else description 
    ) 
 
    updated_price = ( 
        old_price 
        if price is None 
        else price 
    ) 
 
    updated_quantity = ( 
        old_quantity 
        if quantity is None 
        else quantity 
    ) 
 
    updated_category = ( 
        old_category 
        if category is None 
        else category 
    ) 
 
    updated_brand = ( 
        old_brand 
        if brand is None 
        else brand 
    ) 

    updated_media_id = (
        old_media_id
        if media_id is None
        else media_id
    )
 
    # Price validation 
 
    if updated_price <= 0: 
 
        raise HTTPException( 
            status_code=400, 
            detail="Price must be greater than 0" 
        ) 
 
    # Quantity validation 
 
    if updated_quantity < 0: 
 
        raise HTTPException( 
            status_code=400, 
            detail="Quantity cannot be negative" 
        ) 

    # Media validation

    if media_id is not None:

        if not ObjectId.is_valid(media_id):

            raise HTTPException(
                status_code=400,
                detail="Invalid media ID"
            )

        media = media_collection.find_one(
            {
                "_id": ObjectId(media_id),
                "is_deleted": {
                    "$ne": True
                }
            }
        )

        if media is None:

            raise HTTPException(
                status_code=404,
                detail="Selected media not found"
            )

        updated_image_path = media.get(
            "url",
            ""
        )

    else:

        updated_image_path = old_image_path

        if old_media_id and ObjectId.is_valid(old_media_id):

            old_media = media_collection.find_one(
                {
                    "_id": ObjectId(old_media_id),
                    "is_deleted": {
                        "$ne": True
                    }
                }
            )

            if old_media is not None:

                updated_image_path = old_media.get(
                    "url",
                    ""
                )
 
    # Updated data 
 
    updated_data = { 
        "name": updated_name, 
        "description": updated_description, 
        "price": updated_price, 
        "quantity": updated_quantity, 
        "category": updated_category, 
        "brand": updated_brand, 
        "media_id": updated_media_id,
        "image": updated_image_path
    } 
 
    # Update MongoDB 
 
    try: 
 
        result = products_collection.update_one( 
            { 
                "_id": ObjectId(product_id) 
            }, 
            { 
                "$set": updated_data 
            } 
        ) 
 
    except Exception as error: 
 
        raise HTTPException( 
            status_code=500, 
            detail=f"MongoDB update error: {str(error)}" 
        ) 
 
    if result.matched_count == 0: 
 
        raise HTTPException( 
            status_code=404, 
            detail="Product not found" 
        ) 
 
    # Response 
 
    return { 
        "message": "Product updated successfully", 
        "product": { 
            "id": product_id, 
            "name": updated_name, 
            "description": updated_description, 
            "price": updated_price, 
            "quantity": updated_quantity, 
            "category": updated_category, 
            "brand": updated_brand, 
            "media_id": updated_media_id,
            "image": updated_image_path, 
            "image_url": ( 
                f"{str(request.base_url).rstrip('/')}" 
                f"{updated_image_path}"
                if updated_image_path.startswith("/")
                else updated_image_path
            ) 
        }
    } 
 
# RESTORE PRODUCT 
 
@router.post("/{product_id}/restore") 
def restore_product(
    product_id: str,
    current_user=Depends(require_permission("products.edit"))
): 
 
    # Validate ObjectId 
 
    if not ObjectId.is_valid(product_id): 
 
        raise HTTPException( 
            status_code=400, 
            detail="Invalid product ID" 
        ) 
 
    # Find deleted product 
 
    product = products_collection.find_one( 
        { 
            "_id": ObjectId(product_id) 
        } 
    ) 
 
    # Product not found 
 
    if product is None: 
 
        raise HTTPException( 
            status_code=404, 
            detail="Product not found" 
        ) 
 
    # Product is not in trash 
 
    if not product.get("is_deleted", False): 
 
        raise HTTPException( 
            status_code=400, 
            detail="Product is not in trash" 
        ) 
 
    # Restore product 
 
    try: 
 
        result = products_collection.update_one( 
            { 
                "_id": ObjectId(product_id) 
            }, 
            { 
                "$set": { 
                    "is_deleted": False 
                } 
            } 
        ) 
 
    except Exception as error: 
 
        raise HTTPException( 
            status_code=500, 
            detail=f"MongoDB restore error: {str(error)}" 
        ) 
 
    if result.modified_count == 0: 
 
        raise HTTPException( 
            status_code=404, 
            detail="Product could not be restored" 
        ) 
 
    # Final response 
 
    return { 
        "message": "Product restored successfully", 
        "product_id": product_id 
    } 
 
# DELETE PRODUCT 
 
@router.delete("/{product_id}") 
def delete_product(
    product_id: str,
    current_user=Depends(require_permission("products.delete"))
): 
 
    # Validate ObjectId 
 
    if not ObjectId.is_valid(product_id): 
 
        raise HTTPException( 
            status_code=400, 
            detail="Invalid product ID" 
        ) 
 
    # Find existing product 
 
    product = products_collection.find_one( 
        { 
            "_id": ObjectId(product_id) 
        } 
    ) 
 
    # Product not found 
 
    if product is None: 
 
        raise HTTPException( 
            status_code=404, 
            detail="Product not found" 
        ) 
 
    # Already deleted 
 
    if product.get("is_deleted", False): 
 
        raise HTTPException( 
            status_code=400, 
            detail="Product is already in trash" 
        ) 
 
    # Soft delete product 
 
    try: 
 
        result = products_collection.update_one( 
            { 
                "_id": ObjectId(product_id) 
            }, 
            { 
                "$set": { 
                    "is_deleted": True 
                } 
            } 
        ) 
 
    except Exception as error: 
 
        raise HTTPException( 
            status_code=500, 
            detail=f"MongoDB delete error: {str(error)}" 
        ) 
 
    if result.modified_count == 0: 
 
        raise HTTPException( 
            status_code=404, 
            detail="Product could not be moved to trash" 
        ) 
 
    # Final response 
 
    return { 
        "message": "Product moved to trash successfully", 
        "product_id": product_id 
    } 
 
# PERMANENT DELETE PRODUCT 
 
@router.delete("/{product_id}/permanent") 
def permanent_delete_product(
    product_id: str,
    current_user=Depends(require_permission("products.delete"))
): 
 
    # Validate ObjectId 
 
    if not ObjectId.is_valid(product_id): 
 
        raise HTTPException( 
            status_code=400, 
            detail="Invalid product ID" 
        ) 
 
    # Find existing product 
 
    product = products_collection.find_one( 
        { 
            "_id": ObjectId(product_id) 
        } 
    ) 
 
    # Product not found 
 
    if product is None: 
 
        raise HTTPException( 
            status_code=404, 
            detail="Product not found" 
        ) 
 
    # Product must be in trash 
 
    if not product.get("is_deleted", False): 
 
        raise HTTPException( 
            status_code=400, 
            detail="Only trash products can be permanently deleted" 
        ) 
 
    # Delete product from MongoDB 
 
    try: 
 
        result = products_collection.delete_one( 
            { 
                "_id": ObjectId(product_id) 
            } 
        ) 
 
    except Exception as error: 
 
        raise HTTPException( 
            status_code=500, 
            detail=f"MongoDB permanent delete error: {str(error)}" 
        ) 
 
    if result.deleted_count == 0: 
 
        raise HTTPException( 
            status_code=404, 
            detail="Product could not be permanently deleted" 
        ) 
 
    # Media Library image is NOT deleted here

    # The image belongs to Media Library
 
    return { 
        "message": "Product permanently deleted", 
        "product_id": product_id
    }
