"""Brings the database up to date and seeds the admin. Safe to re-run.

`--reset` first empties every table — users, complaints, notifications, OTPs —
leaving a database with nothing in it but the admin this script then creates.
Photos live in the complaints rows, so they go with them. There is no undo.
"""

import os
import sys

from app import app
from models import db, apply_column_migrations, Complaint, Notification, Otp, User


def wipe_everything():
    """Empty all four tables. Children go first — complaints and notifications
    both point at users, so deleting users first would trip the foreign keys."""
    for model in (Notification, Complaint, Otp, User):
        removed = model.query.delete()
        print(f"deleted {removed} rows from {model.__tablename__}")
    db.session.commit()


with app.app_context():
    db.create_all()
    apply_column_migrations()

    if "--reset" in sys.argv:
        wipe_everything()

    # ADMIN_EMAIL/ADMIN_PASSWORD let the production run seed a real admin instead
    # of the local throwaway one. Only used when that admin does not exist yet.
    email = os.getenv("ADMIN_EMAIL", "admin@civicpulse.local")
    password = os.getenv("ADMIN_PASSWORD", "admin123")

    if not User.query.filter_by(email=email).first():
        admin = User(name="Admin", email=email, role="admin")
        admin.set_password(password)
        db.session.add(admin)
        db.session.commit()
        print(f"created admin: {email}")
    else:
        print(f"admin already exists: {email}")
