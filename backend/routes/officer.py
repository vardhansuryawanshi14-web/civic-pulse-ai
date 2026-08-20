import json

from flask import Blueprint, request
from flask_jwt_extended import current_user, jwt_required

from models import db, utcnow, Complaint, Notification, User
from routes.auth import fail, ok
from routes.citizen import complaint_json, iso
from services.email_service import send_email

officer_bp = Blueprint("officer", __name__, url_prefix="/api/officer")

STATUSES = ("Open", "In Progress", "Resolved")


def officer_only():
    return current_user.role == "officer"


def read_notes(complaint):
    try:
        return json.loads(complaint.internal_notes) if complaint.internal_notes else []
    except ValueError:
        return []


def officer_complaint_json(complaint, citizen=None, officer=None):
    """Officer view adds the reporter's contact — a citizen never sees this."""
    data = complaint_json(complaint)
    data["citizen"] = (
        {"id": citizen.id, "name": citizen.name, "email": citizen.email, "phone": citizen.phone}
        if citizen
        else None
    )
    data["officer"] = {"id": officer.id, "name": officer.name} if officer else None
    data["internal_notes"] = read_notes(complaint)
    return data


@officer_bp.get("/complaints")
@jwt_required()
def list_complaints():
    if not officer_only():
        return fail("Only officers can view the district queue", 403)
    if not current_user.ward:
        return fail("No district assigned to your account. Contact the admin", 403)

    rows = (
        db.session.query(Complaint, User)
        .join(User, User.id == Complaint.citizen_id)
        .filter(Complaint.ward == current_user.ward)
        .order_by(Complaint.priority_score.desc(), Complaint.created_at.desc())
        .all()
    )
    return ok({"complaints": [officer_complaint_json(c, u) for c, u in rows]})


@officer_bp.get("/complaints/<int:complaint_id>")
@jwt_required()
def get_complaint(complaint_id):
    if not officer_only():
        return fail("Only officers can view district complaints", 403)

    complaint = Complaint.query.get_or_404(complaint_id)
    if complaint.ward != current_user.ward:
        return fail("This complaint is outside your district", 403)

    citizen = db.session.get(User, complaint.citizen_id)
    officer = db.session.get(User, complaint.officer_id) if complaint.officer_id else None
    return ok({"complaint": officer_complaint_json(complaint, citizen, officer)})


@officer_bp.post("/complaints/<int:complaint_id>/notes")
@jwt_required()
def add_note(complaint_id):
    """Internal note, visible to officers of this district and to admins only."""
    if not officer_only():
        return fail("Only officers can add internal notes", 403)

    complaint = Complaint.query.get_or_404(complaint_id)
    if complaint.ward != current_user.ward:
        return fail("This complaint is outside your district", 403)

    text = ((request.get_json(silent=True) or {}).get("text") or "").strip()
    if not text:
        return fail("Note cannot be empty")

    notes = read_notes(complaint)
    notes.append(
        {
            "author": current_user.name,
            "at": iso(utcnow()),
            "text": text[:1000],
        }
    )
    complaint.internal_notes = json.dumps(notes)
    db.session.commit()
    return ok({"internal_notes": notes}, "Note added")


@officer_bp.patch("/complaints/<int:complaint_id>/status")
@jwt_required()
def update_status(complaint_id):
    if not officer_only():
        return fail("Only officers can update complaint status", 403)

    complaint = Complaint.query.get_or_404(complaint_id)
    if complaint.ward != current_user.ward:
        return fail("This complaint is outside your district", 403)

    status = (request.get_json(silent=True) or {}).get("status")
    if status not in STATUSES:
        return fail(f"Status must be one of: {', '.join(STATUSES)}")
    if status == complaint.status:
        return fail(f"Complaint is already {status}")

    complaint.status = status
    complaint.officer_id = current_user.id

    message = f"Complaint #{complaint.id} is now {status}"
    db.session.add(
        Notification(user_id=complaint.citizen_id, complaint_id=complaint.id, message=message)
    )
    db.session.commit()

    citizen = db.session.get(User, complaint.citizen_id)
    if citizen:
        send_email(
            citizen.email,
            f"Update on your complaint #{complaint.id} - Civic Issue System",
            f"Hello {citizen.name},\n\n{message}.\n\n"
            f"Issue: {complaint.issue_type}\nDistrict: {complaint.ward}\n"
            f"Description: {complaint.description}\n\n"
            "You can track this complaint from your CivicPulse dashboard.",
        )

    return ok({"complaint": officer_complaint_json(complaint, citizen)}, message)


@officer_bp.get("/profile")
@jwt_required()
def profile():
    if not officer_only():
        return fail("Only officers have a district profile", 403)

    open_count = Complaint.query.filter_by(ward=current_user.ward, status="Open").count()
    return ok(
        {
            "profile": {
                "id": current_user.id,
                "name": current_user.name,
                "email": current_user.email,
                "ward": current_user.ward,
                "open_complaints": open_count,
            }
        }
    )
