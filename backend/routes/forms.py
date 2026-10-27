from datetime import datetime, timezone
import logging
import smtplib
from email.message import EmailMessage
from typing import Dict

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from pymongo.errors import PyMongoError

from backend.database.connection import (
    form_submissions_collection,
    pages_collection,
    settings_collection,
)
from backend.utils.permissions import require_permission
from backend.utils.secure_settings import decrypt_secret


router = APIRouter(prefix="/api/forms", tags=["Forms"])


def _find_widget(widgets: list, widget_id: str):
    for widget in widgets:
        if widget.get("id") == widget_id:
            return widget
        found = _find_widget(widget.get("children", []), widget_id)
        if found:
            return found
    return None


def _send_form_notification(page_id: str, widget_id: str, page_title: str, fields: Dict[str, str]):
    try:
        if not ObjectId.is_valid(page_id):
            return
        page = pages_collection.find_one({"_id": ObjectId(page_id), "status": "published"})
        if not page:
            return
        widget = _find_widget(page.get("layout", []), widget_id)
        if not widget or widget.get("type") != "form":
            return
        settings = settings_collection.find_one({"type": "payments"}) or {}
        recipient = settings.get("admin_notification_email", "")
        if not recipient or not settings.get("smtp_host") or not settings.get("smtp_from_email"):
            return

        field_text = "\n".join(f"{name}: {value}" for name, value in fields.items())
        replacements = {"page_title": page_title, "fields": field_text, **fields}
        form_settings = widget.get("settings", {})
        subject = form_settings.get("emailSubject", "New form submission")
        body = form_settings.get(
            "emailTemplate",
            "New submission from {{page_title}}\n\n{{fields}}",
        )
        for key, value in replacements.items():
            subject = subject.replace("{{" + key + "}}", value)
            body = body.replace("{{" + key + "}}", value)

        message = EmailMessage()
        message["Subject"] = " ".join(str(subject).splitlines())[:200]
        message["From"] = settings["smtp_from_email"]
        message["To"] = recipient
        message.set_content(body[:10000])
        with smtplib.SMTP(settings["smtp_host"], int(settings.get("smtp_port", 587)), timeout=15) as smtp:
            smtp.starttls()
            username = settings.get("smtp_username", "")
            encrypted_password = settings.get("smtp_password_encrypted")
            if username and encrypted_password:
                smtp.login(username, decrypt_secret(encrypted_password))
            smtp.send_message(message)
    except (
        OSError,
        smtplib.SMTPException,
        RuntimeError,
        ValueError,
        TypeError,
        PyMongoError,
    ):
        logging.exception("Form notification email could not be sent")


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
    _send_form_notification(
        submission.page_id,
        submission.widget_id,
        submission.page_title,
        submission.fields,
    )
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
