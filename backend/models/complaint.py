from models import db, utcnow


class Complaint(db.Model):
    __tablename__ = "complaints"

    id = db.Column(db.Integer, primary_key=True)
    citizen_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    photo_path = db.Column(db.String(255))
    # the bytes live in the database, not on disk: Railway's filesystem is
    # ephemeral, so anything written to uploads/ disappears on the next deploy
    # and every complaint came back with a broken thumbnail. MEDIUMBLOB holds
    # 16 MB, well over the 5 MB upload cap.
    # deferred: without it every complaint list query would drag megabytes of
    # image data out of MySQL to render thumbnails nobody has asked for yet
    photo_data = db.deferred(db.Column(db.LargeBinary(length=(2**24) - 1)))
    description = db.Column(db.Text, nullable=False)
    ward = db.Column(db.String(100), nullable=False)
    # optional — a citizen can refuse location permission and still file a complaint
    latitude = db.Column(db.Numeric(9, 6))
    longitude = db.Column(db.Numeric(9, 6))
    landmark = db.Column(db.String(150))
    # ponytail: JSON list of {author, at, text}; move to its own table if notes
    # ever need querying, editing or per-note permissions
    internal_notes = db.Column(db.Text)
    issue_type = db.Column(
        db.Enum("Pothole", "Garbage", "Broken Light", "Water Leakage", "Other")
    )
    urgency_level = db.Column(db.Enum("Low", "Medium", "High"))
    priority_score = db.Column(db.Integer, default=0)
    status = db.Column(
        db.Enum("Open", "In Progress", "Resolved"), default="Open"
    )
    officer_id = db.Column(db.Integer, db.ForeignKey("users.id"))
    created_at = db.Column(db.TIMESTAMP, default=utcnow, server_default=db.func.now())
    updated_at = db.Column(
        db.TIMESTAMP, default=utcnow, onupdate=utcnow, server_default=db.func.now()
    )
