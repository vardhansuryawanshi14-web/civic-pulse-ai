import mimetypes
import os
import uuid

from flask import Blueprint, Response, request
from flask_jwt_extended import current_user, jwt_required
from werkzeug.utils import secure_filename

from models import db, Complaint, Notification, User
from routes.auth import fail, ok
from services.district import normalize_district
from services.email_service import send_email
from services.nlp_model import predict_urgency
from services.priority import calculate_priority_score
from services.vision_api import classify_image

citizen_bp = Blueprint("citizen", __name__, url_prefix="/api/citizen")
files_bp = Blueprint("files", __name__, url_prefix="/api")

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_PHOTO_BYTES = 5 * 1024 * 1024
HIGH_PRIORITY_SCORE = 20  # matches the "Critical" band on the dashboards


def citizen_only():
    """Every route here is for citizens; officers and admins get their own."""
    return current_user.role == "citizen"


def iso(dt):
    """Serialize a stored (naive UTC) timestamp for the browser.

    The trailing Z is what makes it unambiguous: JavaScript reads a date-time
    string without a zone as local time, which turned every fresh row into one
    that looked hours old.
    """
    return dt.isoformat() + "Z" if dt else None


def complaint_json(c):
    return {
        "id": c.id,
        "description": c.description,
        "ward": c.ward,
        "latitude": float(c.latitude) if c.latitude is not None else None,
        "longitude": float(c.longitude) if c.longitude is not None else None,
        "landmark": c.landmark,
        "issue_type": c.issue_type,
        "urgency_level": c.urgency_level,
        "priority_score": c.priority_score,
        "status": c.status,
        # the filename, not the bytes — reading photo_data here would load every
        # image in the list. The migration clears photo_path on the old rows
        # whose file Railway deleted, so a filename now means bytes exist.
        "has_photo": bool(c.photo_path),
        "created_at": iso(c.created_at),
        "updated_at": iso(c.updated_at),
    }


def parse_coordinates(form):
    """Return (latitude, longitude, error). Both must be present and in range,
    or both absent — half a coordinate pair is worse than none."""
    raw_lat = (form.get("latitude") or "").strip()
    raw_lng = (form.get("longitude") or "").strip()
    if not raw_lat and not raw_lng:
        return None, None, None
    if not raw_lat or not raw_lng:
        return None, None, "Send both latitude and longitude, or neither"

    try:
        latitude, longitude = float(raw_lat), float(raw_lng)
    except ValueError:
        return None, None, "Latitude and longitude must be numbers"
    if not -90 <= latitude <= 90 or not -180 <= longitude <= 180:
        return None, None, "Latitude must be between -90 and 90, longitude between -180 and 180"
    return latitude, longitude, None


def save_photo(file_storage):
    """Read an uploaded photo and return (filename, bytes, error).

    The bytes go into the complaint row rather than uploads/ — Railway wipes the
    filesystem on every deploy, which left older complaints pointing at photos
    that no longer existed.
    """
    if not file_storage or not file_storage.filename:
        return None, None, None

    extension = os.path.splitext(secure_filename(file_storage.filename))[1].lower()
    if extension not in ALLOWED_EXTENSIONS:
        return None, None, "Photo must be a JPG, PNG or WEBP image"

    data = file_storage.read()
    if len(data) > MAX_PHOTO_BYTES:
        return None, None, "Photo must be 5 MB or smaller"

    # random name — the original filename is attacker-controlled. Only kept now
    # to remember the image format for the Content-Type on the way back out.
    return f"{uuid.uuid4().hex}{extension}", data, None


@citizen_bp.post("/complaints")
@jwt_required()
def create_complaint():
    if not citizen_only():
        return fail("Only citizens can submit complaints", 403)

    description = (request.form.get("description") or "").strip()
    ward = normalize_district(request.form.get("ward"))
    if not description or not ward:
        return fail("Description and district are required")
    if len(description) < 10:
        return fail("Please describe the issue in at least 10 characters")

    latitude, longitude, error = parse_coordinates(request.form)
    if error:
        return fail(error)

    filename, photo_data, error = save_photo(request.files.get("photo"))
    if error:
        return fail(error)

    issue_type = classify_image(photo_data, description)
    urgency_level = predict_urgency(description)

    # a ward with exactly one active officer has an obvious owner; more than one
    # (or none) stays unassigned until somebody acts on it
    ward_officers = User.query.filter_by(role="officer", ward=ward, is_active=True).all()

    complaint = Complaint(
        citizen_id=current_user.id,
        officer_id=ward_officers[0].id if len(ward_officers) == 1 else None,
        photo_path=filename,
        photo_data=photo_data,
        description=description,
        ward=ward,
        latitude=latitude,
        longitude=longitude,
        landmark=(request.form.get("landmark") or "").strip()[:150] or None,
        issue_type=issue_type,
        urgency_level=urgency_level,
        priority_score=calculate_priority_score(issue_type, urgency_level),
    )
    db.session.add(complaint)
    db.session.flush()

    db.session.add(
        Notification(
            user_id=current_user.id,
            complaint_id=complaint.id,
            message=f"Complaint #{complaint.id} received and classified as {issue_type} ({urgency_level} urgency)",
        )
    )
    db.session.commit()

    notify_new_complaint(complaint)

    return ok({"complaint": complaint_json(complaint)}, "Complaint submitted")


def notify_new_complaint(complaint):
    """Alert whoever needs to act: ward officers on a critical complaint, and
    admins on anything critical or landing in a ward with nobody assigned."""
    officers = User.query.filter_by(role="officer", ward=complaint.ward, is_active=True).all()
    admins = User.query.filter_by(role="admin", is_active=True).all()
    critical = complaint.priority_score >= HIGH_PRIORITY_SCORE

    if critical:
        for admin in admins:
            db.session.add(
                Notification(
                    user_id=admin.id,
                    complaint_id=complaint.id,
                    message=(
                        f"Critical: complaint #{complaint.id} in {complaint.ward} scored "
                        f"{complaint.priority_score}"
                    ),
                )
            )

    # a ward with no active officer means nobody is working that queue
    if not officers:
        for admin in admins:
            db.session.add(
                Notification(
                    user_id=admin.id,
                    complaint_id=complaint.id,
                    message=(
                        f"Complaint #{complaint.id} was filed in {complaint.ward}, which has no "
                        "active officer assigned"
                    ),
                )
            )
        db.session.commit()
        return

    if not critical:
        db.session.commit()
        return

    for officer in officers:
        # in-app too, so the officer's notifications screen matches the email
        db.session.add(
            Notification(
                user_id=officer.id,
                complaint_id=complaint.id,
                message=(
                    f"Critical: complaint #{complaint.id} in {complaint.ward} scored "
                    f"{complaint.priority_score} and needs immediate action"
                ),
            )
        )
        send_email(
            officer.email,
            f"High priority complaint #{complaint.id} in {complaint.ward}",
            f"Hello {officer.name},\n\n"
            f"A new complaint scored {complaint.priority_score} and needs attention.\n\n"
            f"Issue: {complaint.issue_type}\nUrgency: {complaint.urgency_level}\n"
            f"District: {complaint.ward}\nDescription: {complaint.description}\n\n"
            "Open your district queue in CivicPulse to update its status.",
        )
    db.session.commit()


@citizen_bp.get("/complaints")
@jwt_required()
def list_complaints():
    if not citizen_only():
        return fail("Only citizens can view their complaints", 403)

    complaints = (
        Complaint.query.filter_by(citizen_id=current_user.id)
        .order_by(Complaint.created_at.desc())
        .all()
    )
    return ok({"complaints": [complaint_json(c) for c in complaints]})


@citizen_bp.get("/complaints/<int:complaint_id>")
@jwt_required()
def get_complaint(complaint_id):
    if not citizen_only():
        return fail("Only citizens can view their complaints", 403)

    complaint = Complaint.query.get_or_404(complaint_id)
    if complaint.citizen_id != current_user.id:
        return fail("This complaint does not belong to you", 403)

    # the detail view may name who is handling it; the list view still does not
    officer = db.session.get(User, complaint.officer_id) if complaint.officer_id else None
    return ok(
        {
            "complaint": {
                **complaint_json(complaint),
                "officer": {"name": officer.name, "ward": officer.ward} if officer else None,
            }
        }
    )


@citizen_bp.get("/notifications")
@jwt_required()
def list_notifications():
    notifications = (
        Notification.query.filter_by(user_id=current_user.id)
        .order_by(Notification.created_at.desc())
        .all()
    )
    return ok(
        {
            "notifications": [
                {
                    "id": n.id,
                    "complaint_id": n.complaint_id,
                    "message": n.message,
                    "is_read": bool(n.is_read),
                    "created_at": iso(n.created_at),
                }
                for n in notifications
            ]
        }
    )


@citizen_bp.patch("/notifications/read-all")
@jwt_required()
def mark_all_read():
    updated = Notification.query.filter_by(user_id=current_user.id, is_read=False).update(
        {"is_read": True}, synchronize_session=False
    )
    db.session.commit()
    return ok({"updated": updated}, "All notifications marked as read")


@citizen_bp.patch("/notifications/<int:notification_id>")
@jwt_required()
def mark_notification_read(notification_id):
    notification = Notification.query.get_or_404(notification_id)
    if notification.user_id != current_user.id:
        return fail("This notification does not belong to you", 403)

    notification.is_read = True
    db.session.commit()
    return ok(message="Notification marked as read")


@files_bp.get("/complaints/<int:complaint_id>/photo")
@jwt_required()
def complaint_photo(complaint_id):
    """Single guarded path to every complaint photo — citizens see their own,
    officers see their ward, admins see all. Photos are never served statically."""
    complaint = Complaint.query.get_or_404(complaint_id)
    if not complaint.photo_data:
        return fail("This complaint has no photo", 404)

    allowed = (
        current_user.role == "admin"
        or (current_user.role == "citizen" and complaint.citizen_id == current_user.id)
        or (current_user.role == "officer" and complaint.ward == current_user.ward)
    )
    if not allowed:
        return fail("You cannot view this photo", 403)

    mimetype = mimetypes.guess_type(complaint.photo_path or "")[0] or "image/jpeg"
    return Response(complaint.photo_data, mimetype=mimetype)
