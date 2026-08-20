from datetime import datetime, timezone

from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


def utcnow():
    """Naive UTC — the one clock every timestamp in this app is set from.

    MySQL's NOW() follows the database server's timezone: UTC on Railway, local
    time in development. Letting it fill created_at meant the same column held
    different instants depending on where it was written, and the frontend, which
    assumes UTC, rendered fresh rows as hours old.
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)

from models.user import User  # noqa: E402
from models.complaint import Complaint  # noqa: E402
from models.notification import Notification  # noqa: E402
from models.otp import Otp  # noqa: E402

# db.create_all() only creates missing tables — it never alters an existing one,
# so columns added after a table exists have to be applied here. Runs at startup
# as well as from create_db.py: a deploy that adds a column would otherwise fail
# every write until somebody remembered to run the script by hand.
ADDED_COLUMNS = {
    "complaints": {
        "latitude": "DECIMAL(9,6) NULL AFTER ward",
        "longitude": "DECIMAL(9,6) NULL AFTER latitude",
        "landmark": "VARCHAR(150) NULL AFTER longitude",
        "internal_notes": "TEXT NULL",
        "photo_data": "MEDIUMBLOB NULL",
    },
}


def apply_column_migrations():
    from sqlalchemy import inspect, text

    inspector = inspect(db.engine)
    existing_tables = set(inspector.get_table_names())

    for table, columns in ADDED_COLUMNS.items():
        if table not in existing_tables:
            continue
        present = {c["name"] for c in inspector.get_columns(table)}
        for column, definition in columns.items():
            if column in present:
                continue
            db.session.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {definition}"))
            if column == "photo_data":
                # photos used to be written to uploads/, which Railway wipes on
                # every deploy. Those rows keep a filename with no file behind
                # it, and the dashboards read the filename to decide whether to
                # render an <img> — so clear it and they show the placeholder.
                db.session.execute(text("UPDATE complaints SET photo_path = NULL"))
            db.session.commit()
            print(f"added column {table}.{column}", flush=True)
