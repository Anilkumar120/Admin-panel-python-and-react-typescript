from datetime import datetime, timezone
from typing import Dict

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator

from backend.database.connection import form_submissions_collection
from backend.utils.permissions import require_permission


router = APIRouter(prefix="/api/forms", tags=["Forms"])


class FormSubmissionCreate(BaseModel):
    page_id: str = Field(min_length=1, max_length=150)
    page_title: str = Field(default="", max_length=200)
    widget_id: str = Field(min_length=1, max_length=150)
    fields: Dict[str, str] = Field(min_length=1, max_length=20)
    website: str = Field(default="", max_length=200)

    @field_validator("fields")
    @classmethod
    def validate_fields(cls, fields: Dict[str, str]) -> Dict[str, str]:
        for name, value in fields.items():
            if not name.strip() or len(name) > 100:
                raise ValueError("Field names must be between 1 and 100 characters")
            if len(value) > 5000:
                raise ValueError("Form field values cannot exceed 5000 characters")
        return fields


@router.post("/submissions", status_code=201)
def create_form_submission(submission: FormSubmissionCreate):
    if submission.website:
        raise HTTPException(status_code=400, detail="Invalid form submission")

    record = {
        "page_id": submission.page_id,
        "page_title": submission.page_title,
        "widget_id": submission.widget_id,
        "fields": submission.fields,
        "submitted_at": datetime.now(timezone.utc),
    }
    result = form_submissions_collection.insert_one(record)
    return {"id": str(result.inserted_id), "message": "Form submitted successfully"}


@router.get("/submissions")
def get_form_submissions(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=100),
    _current_user=Depends(require_permission("content.view")),
):
    skip = (page - 1) * limit
    records = list(
        form_submissions_collection.find({})
        .sort("submitted_at", -1)
        .skip(skip)
        .limit(limit)
    )
    total = form_submissions_collection.count_documents({})
    for record in records:
        record["id"] = str(record.pop("_id"))

    return {"items": records, "total": total, "page": page, "limit": limit}
