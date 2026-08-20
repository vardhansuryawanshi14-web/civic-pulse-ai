from models import db, utcnow


class Otp(db.Model):
    __tablename__ = "otps"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(150), nullable=False)
    otp_code = db.Column(db.String(6), nullable=False)
    expires_at = db.Column(db.TIMESTAMP, nullable=False)
    is_used = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.TIMESTAMP, default=utcnow, server_default=db.func.now())
