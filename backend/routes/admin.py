from datetime import date, timedelta

from flask import Blueprint, request, send_file
from flask_jwt_extended import current_user, jwt_required
from sqlalchemy import func, text

from models import db, Complaint, Notification, User
from routes.auth import fail, ok
from routes.citizen import complaint_json
from services.district import normalize_district
from services.pdf_service import build_report

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")


def admin_only():
    return current_user.role == "admin"


def notify_admins(message, actor_id=None):
    """Record an audit line for every admin except the one who acted."""
    for admin in User.query.filter_by(role="admin", is_active=True).all():
        if admin.id == actor_id:
            continue
        db.session.add(Notification(user_id=admin.id, message=message))


def officer_json(officer):
    return {
        "id": officer.id,
        "name": officer.name,
        "email": officer.email,
        "ward": officer.ward,
        "phone": officer.phone,
        "is_active": bool(officer.is_active),
    }


RANGE_DAYS = {"7": 7, "30": 30}


def range_start(range_key):
    """None means 'all time'."""
    days = RANGE_DAYS.get(str(range_key))
    return date.today() - timedelta(days=days - 1) if days else None


def scoped(query, since):
    return query.filter(Complaint.created_at >= since) if since else query


def counts_by(column, since=None):
    rows = (
        scoped(db.session.query(column, func.count(Complaint.id)), since).group_by(column).all()
    )
    return {(key or "Unknown"): count for key, count in rows}


def time_series(since):
    """Daily complaint counts, zero-filled so the line chart has no gaps."""
    day = func.date(Complaint.created_at)
    rows = dict(
        scoped(db.session.query(day, func.count(Complaint.id)), since).group_by(day).all()
    )
    counts = {(k.isoformat() if hasattr(k, "isoformat") else str(k)): v for k, v in rows.items()}

    if since is None:
        if not counts:
            return []
        start = date.fromisoformat(min(counts))
    else:
        start = since

    today = date.today()
    span = (today - start).days
    # an "all time" range on old data could be thousands of points — cap the chart
    if span > 180:
        start = today - timedelta(days=180)
        span = 180

    return [
        {
            "date": (start + timedelta(days=i)).isoformat(),
            "count": counts.get((start + timedelta(days=i)).isoformat(), 0),
        }
        for i in range(span + 1)
    ]


def officer_performance():
    """Resolved counts and average turnaround per officer.

    updated_at is the closest thing to a resolution timestamp — the schema has no
    resolved_at, so this is the time to the LAST change, not strictly to resolution.
    """
    rows = (
        db.session.query(
            User.id,
            User.name,
            User.ward,
            User.is_active,
            func.sum(func.if_(Complaint.status == "Resolved", 1, 0)),
            func.count(Complaint.id),
            func.avg(
                func.if_(
                    Complaint.status == "Resolved",
                    func.timestampdiff(text("HOUR"), Complaint.created_at, Complaint.updated_at),
                    None,
                )
            ),
        )
        .outerjoin(Complaint, Complaint.officer_id == User.id)
        .filter(User.role == "officer")
        .group_by(User.id, User.name, User.ward, User.is_active)
        .order_by(User.name)
        .all()
    )
    return [
        {
            "id": oid,
            "name": name,
            "ward": ward,
            "is_active": bool(active),
            "resolved": int(resolved or 0),
            "handled": int(handled or 0),
            "avg_hours": round(float(avg_hours), 1) if avg_hours is not None else None,
        }
        for oid, name, ward, active, resolved, handled, avg_hours in rows
    ]


def analytics_data(range_key="all"):
    since = range_start(range_key)
    by_status = counts_by(Complaint.status, since)
    return {
        "range": str(range_key),
        "by_issue_type": counts_by(Complaint.issue_type, since),
        "by_status": by_status,
        "by_ward": counts_by(Complaint.ward, since),
        "by_urgency": counts_by(Complaint.urgency_level, since),
        "time_series": time_series(since),
        "officer_performance": officer_performance(),
        "total": sum(by_status.values()),
        "officers": User.query.filter_by(role="officer").count(),
        "citizens": User.query.filter_by(role="citizen").count(),
    }


@admin_bp.get("/complaints")
@jwt_required()
def list_complaints():
    if not admin_only():
        return fail("Admin access only", 403)

    reporter = db.aliased(User)
    assignee = db.aliased(User)
    rows = (
        db.session.query(Complaint, reporter, assignee)
        .join(reporter, reporter.id == Complaint.citizen_id)
        .outerjoin(assignee, assignee.id == Complaint.officer_id)
        .order_by(Complaint.priority_score.desc(), Complaint.created_at.desc())
        .all()
    )
    return ok(
        {
            "complaints": [
                {
                    **complaint_json(c),
                    "citizen": {"id": r.id, "name": r.name, "email": r.email},
                    "officer": {"id": a.id, "name": a.name, "ward": a.ward} if a else None,
                }
                for c, r, a in rows
            ]
        }
    )


@admin_bp.get("/analytics")
@jwt_required()
def analytics():
    if not admin_only():
        return fail("Admin access only", 403)
    return ok({"analytics": analytics_data(request.args.get("range", "all"))})


@admin_bp.get("/officers")
@jwt_required()
def list_officers():
    if not admin_only():
        return fail("Admin access only", 403)

    officers = User.query.filter_by(role="officer").order_by(User.name).all()
    return ok({"officers": [officer_json(o) for o in officers]})


@admin_bp.post("/officers")
@jwt_required()
def create_officer():
    if not admin_only():
        return fail("Admin access only", 403)

    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    ward = normalize_district(data.get("ward"))
    password = data.get("password") or ""

    if not name or not email or not ward or not password:
        return fail("Name, email, district and password are required")
    if len(password) < 6:
        return fail("Password must be at least 6 characters")
    if User.query.filter_by(email=email).first():
        return fail("An account with this email already exists", 409)

    # role is fixed here — an admin creates officers, never other admins
    officer = User(
        name=name, email=email, ward=ward, role="officer",
        phone=(data.get("phone") or "").strip() or None,
    )
    officer.set_password(password)
    db.session.add(officer)
    db.session.flush()

    # take ownership of the ward's unassigned backlog, but only when this officer
    # is the ward's sole active one — otherwise the choice is not ours to make
    others = User.query.filter(
        User.role == "officer", User.ward == ward, User.is_active.is_(True), User.id != officer.id
    ).count()
    adopted = 0
    if others == 0:
        adopted = Complaint.query.filter_by(ward=ward, officer_id=None).update(
            {"officer_id": officer.id}, synchronize_session=False
        )

    notify_admins(f"{officer.name} was added as an officer for {officer.ward}", current_user.id)
    db.session.commit()
    message = "Officer created"
    if adopted:
        message += f"; assigned {adopted} existing complaint{'s' if adopted != 1 else ''} in {ward}"
    return ok({"officer": officer_json(officer)}, message)


@admin_bp.patch("/officers/<int:officer_id>")
@jwt_required()
def update_officer(officer_id):
    if not admin_only():
        return fail("Admin access only", 403)

    officer = User.query.get_or_404(officer_id)
    if officer.role != "officer":
        return fail("This account is not an officer", 403)

    data = request.get_json(silent=True) or {}
    if "email" in data:
        email = (data.get("email") or "").strip().lower()
        if not email:
            return fail("Email cannot be empty")
        clash = User.query.filter_by(email=email).first()
        if clash and clash.id != officer.id:
            return fail("Another account already uses this email", 409)
        officer.email = email
    if "name" in data:
        name = (data.get("name") or "").strip()
        if not name:
            return fail("Name cannot be empty")
        officer.name = name
    if "ward" in data:
        ward = normalize_district(data.get("ward"))
        if not ward:
            return fail("District cannot be empty")
        officer.ward = ward
    if "phone" in data:
        officer.phone = (data.get("phone") or "").strip() or None
    if "is_active" in data:
        officer.is_active = bool(data["is_active"])
    if data.get("password"):
        if len(data["password"]) < 6:
            return fail("Password must be at least 6 characters")
        officer.set_password(data["password"])

    db.session.commit()
    return ok({"officer": officer_json(officer)}, "Officer updated")


@admin_bp.delete("/officers/<int:officer_id>")
@jwt_required()
def deactivate_officer(officer_id):
    if not admin_only():
        return fail("Admin access only", 403)

    officer = User.query.get_or_404(officer_id)
    if officer.role != "officer":
        return fail("This account is not an officer", 403)

    # deactivate rather than delete — complaints reference officer_id
    officer.is_active = False
    notify_admins(
        f"{officer.name} was deactivated; {officer.ward or 'their district'} may now be unstaffed",
        current_user.id,
    )
    db.session.commit()
    return ok({"officer": officer_json(officer)}, "Officer deactivated")


@admin_bp.get("/report")
@jwt_required()
def report():
    if not admin_only():
        return fail("Admin access only", 403)

    complaints = (
        Complaint.query.order_by(Complaint.priority_score.desc(), Complaint.created_at.desc())
        .limit(50)
        .all()
    )
    pdf = build_report(analytics_data(), complaints)
    return send_file(
        pdf, mimetype="application/pdf", as_attachment=True, download_name="civic-report.pdf"
    )
