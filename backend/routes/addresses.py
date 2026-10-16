from fastapi import APIRouter, HTTPException, Query
from datetime import datetime, timezone
from typing import Optional

from backend.database.connection import addresses_collection


router = APIRouter(
    prefix="/api/public/account",
    tags=["Account Addresses"],
)


def now():
    return datetime.now(timezone.utc)


def _clean_address(raw: Optional[dict]) -> Optional[dict]:
    """Normalize an address dict, strip strings, cap lengths."""
    if not raw or not isinstance(raw, dict):
        return None

    def s(key: str, max_len: int = 300) -> str:
        val = raw.get(key, "")
        if val is None:
            return ""
        return str(val).strip()[:max_len]

    return {
        "first_name": s("first_name", 100),
        "last_name": s("last_name", 100),
        "company": s("company", 200),
        "country": s("country", 100) or "India",
        "state": s("state", 100),
        "city": s("city", 100),
        "postcode": s("postcode", 20),
        "address_1": s("address_1", 300),
        "address_2": s("address_2", 300),
        "phone": s("phone", 30),
        "email": s("email", 320),
    }


def _validate_email(email: str) -> str:
    email = str(email or "").strip().lower()
    if "@" not in email or "." not in email or len(email) > 320:
        raise HTTPException(status_code=400, detail="Valid email required")
    return email


# ============================================================
# GET — load saved addresses for an email
# ============================================================
@router.get("/addresses")
def get_addresses(email: str = Query(..., description="User email")):
    email = _validate_email(email)

    doc = addresses_collection.find_one({"user_email": email})

    if not doc:
        return {"email": email, "billing": None, "shipping": None}

    return {
        "email": doc.get("user_email", email),
        "billing": doc.get("billing"),
        "shipping": doc.get("shipping"),
    }


# ============================================================
# POST — save / update billing + shipping
# ============================================================
@router.post("/addresses")
def save_addresses(payload: dict):
    email = _validate_email(payload.get("email", ""))

    billing = _clean_address(payload.get("billing"))
    shipping = _clean_address(payload.get("shipping"))

    if billing is None and shipping is None:
        raise HTTPException(
            status_code=400,
            detail="Provide billing and/or shipping address",
        )

    set_fields: dict = {
        "user_email": email,
        "updated_at": now(),
    }
    if billing is not None:
        set_fields["billing"] = billing
    if shipping is not None:
        set_fields["shipping"] = shipping

    addresses_collection.update_one(
        {"user_email": email},
        {
            "$set": set_fields,
            "$setOnInsert": {"created_at": now()},
        },
        upsert=True,
    )

    doc = addresses_collection.find_one({"user_email": email})

    return {
        "message": "Addresses saved successfully",
        "billing": doc.get("billing") if doc else None,
        "shipping": doc.get("shipping") if doc else None,
    }


# ============================================================
# DELETE — remove billing / shipping / both
# ============================================================
@router.delete("/addresses")
def delete_addresses(
    email: str = Query(...),
    type: Optional[str] = Query(None, description="billing | shipping | None"),
):
    email = _validate_email(email)

    if type == "billing":
        addresses_collection.update_one(
            {"user_email": email},
            {"$unset": {"billing": ""}, "$set": {"updated_at": now()}},
        )
    elif type == "shipping":
        addresses_collection.update_one(
            {"user_email": email},
            {"$unset": {"shipping": ""}, "$set": {"updated_at": now()}},
        )
    else:
        addresses_collection.delete_one({"user_email": email})

    return {"message": "Address(es) deleted successfully"}