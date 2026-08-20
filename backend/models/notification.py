from models import db, utcnow


class Notification(db.Model):
    __tablename__ = "notifications"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    complaint_id = db.Column(db.Integer, db.ForeignKey("complaints.id"))
    message = db.Column(db.String(255), nullable=False)
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.TIMESTAMP, default=utcnow, server_default=db.func.now())
