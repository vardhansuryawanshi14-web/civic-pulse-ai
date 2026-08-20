"""Self-check for timestamp handling. Run: venv/Scripts/python.exe test_timestamps.py

Rows must be stamped from the app's UTC clock, never the database server's local
one, and must go out to the browser with a zone marker. Uses a throwaway SQLite
file — it never touches the real database.
"""

import os
import tempfile

os.environ["DATABASE_URL"] = "sqlite:///" + tempfile.mktemp(suffix=".db").replace("\\", "/")
os.environ.pop("ADMIN_EMAIL", None)
os.environ.pop("ADMIN_PASSWORD", None)

from app import create_app
from models import db, utcnow, Complaint, Notification, User
from routes.citizen import iso

app = create_app()

with app.app_context():
    user = User(name="Ada", email="ada@example.com", role="citizen", ward="Kalwa West")
    user.set_password("secret123")
    db.session.add(user)
    db.session.commit()

    complaint = Complaint(
        citizen_id=user.id, description="Pothole", ward="Kalwa West", issue_type="Pothole"
    )
    db.session.add(complaint)
    db.session.add(Notification(user_id=user.id, message="Complaint received"))
    db.session.commit()

    note = Notification.query.first()

    # stamped from utcnow(), so a fresh row can never look hours old
    for label, stamped in (
        ("complaint.created_at", complaint.created_at),
        ("complaint.updated_at", complaint.updated_at),
        ("notification.created_at", note.created_at),
        ("user.created_at", user.created_at),
    ):
        assert stamped is not None, f"{label} was not stamped"
        drift = abs((stamped - utcnow()).total_seconds())
        assert drift < 60, f"{label} is {drift / 3600:.1f}h off UTC — a DB-clock default is back"

    # and leaves with a zone, or the browser reads UTC as local time
    out = iso(note.created_at)
    assert out.endswith("Z"), f"serialized timestamp has no zone marker: {out}"
    assert out.startswith(note.created_at.isoformat()), out
    assert iso(None) is None

print("timestamps OK — stamped in UTC, serialized as", iso(note.created_at))
