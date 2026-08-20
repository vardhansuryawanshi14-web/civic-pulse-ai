import os
import secrets
from datetime import datetime, timedelta, timezone

from authlib.integrations.flask_client import OAuth
from flask import Blueprint, current_app, jsonify, redirect, request, url_for
from flask_jwt_extended import create_access_token, current_user, jwt_required

from models import db, User, Otp
from services.district import normalize_district
from services.email_service import send_otp

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

oauth = OAuth()

OTP_VALIDITY_MINUTES = 10


def init_oauth(app):
    oauth.init_app(app)
    oauth.register(
        name="google",
        client_id=app.config["GOOGLE_CLIENT_ID"],
        client_secret=app.config["GOOGLE_CLIENT_SECRET"],
        server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
        client_kwargs={"scope": "openid email profile"},
    )


def utcnow():
    """Naive UTC — matches how MySQL TIMESTAMP columns come back."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def ok(data=None, message=""):
    return jsonify({"success": True, "data": data or {}, "message": message})


def fail(message, code=400):
    return jsonify({"success": False, "message": message, "error_code": code}), code


def issue_otp(email, purpose="password reset"):
    """Replace any live OTP for this email with a fresh one and mail it.

    Returns None on success, or the mail failure reason. A silent failure would
    leave the user waiting for a code that never sent, so callers report it.
    """
    Otp.query.filter_by(email=email).delete()  # only one live OTP per email
    code = f"{secrets.randbelow(1000000):06d}"
    db.session.add(
        Otp(
            email=email,
            otp_code=code,
            expires_at=utcnow() + timedelta(minutes=OTP_VALIDITY_MINUTES),
        )
    )
    db.session.commit()
    return send_otp(email, code, purpose)


def otp_sent(email):
    """Login and register both stop here — no token until the code is verified."""
    return ok(
        {"otp_required": True, "email": email},
        "We sent a 6-digit code to your email",
    )


def user_json(user):
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "ward": user.ward,
        "phone": user.phone,
    }


@auth_bp.post("/register")
def register():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    phone = (data.get("phone") or "").strip() or None
    ward = normalize_district(data.get("ward")) or None

    if not name or not email or not password:
        return fail("Name, email and password are required")
    if "@" not in email or "." not in email.split("@")[-1]:
        return fail("Enter a valid email address")
    if len(password) < 6:
        return fail("Password must be at least 6 characters")
    if User.query.filter_by(email=email).first():
        return fail("An account with this email already exists", 409)

    # role is never taken from the request — self-signup is always a citizen
    user = User(name=name, email=email, role="citizen", phone=phone, ward=ward)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    # the account exists but stays unusable until the emailed code comes back,
    # which is what proves the address belongs to whoever just signed up
    failure = issue_otp(email, "sign-in")
    if failure:
        return fail(f"Could not send the verification code: {failure}", 502)
    return otp_sent(email)


@auth_bp.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        if user and not user.password_hash:
            return fail(
                "Your account uses Google Sign-In. "
                "Please continue with Google to access your account.",
                401,
            )
        return fail("Invalid email or password", 401)
    if not user.is_active:
        return fail("This account has been deactivated", 403)

    # the password alone no longer logs anyone in — it only earns the right to a
    # code at the address on file, and /verify-login-otp is what issues the token
    failure = issue_otp(email, "sign-in")
    if failure:
        return fail(f"Could not send the sign-in code: {failure}", 502)
    return otp_sent(email)


@auth_bp.post("/verify-login-otp")
def verify_login_otp():
    """Second half of login and register: a correct code becomes the token."""
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    code = (data.get("otp_code") or "").strip()
    if not email or not code:
        return fail("Email and OTP are required")

    otp = Otp.query.filter_by(email=email, otp_code=code, is_used=False).first()
    if not otp:
        return fail("Invalid OTP", 400)
    if otp.expires_at < utcnow():
        db.session.delete(otp)
        db.session.commit()
        return fail("OTP has expired. Request a new one", 400)

    user = User.query.filter_by(email=email).first()
    if not user:
        return fail("Account not found", 404)
    if not user.is_active:
        return fail("This account has been deactivated", 403)

    # deleted rather than marked used: a spent sign-in code must not double as
    # the proof of ownership that /reset-password looks for
    db.session.delete(otp)
    db.session.commit()
    return ok({"user": user_json(user), "token": create_access_token(user)}, "Login successful")


@auth_bp.post("/resend-otp")
def resend_otp():
    """Resend a sign-in code. The verify screen has the email but not the password."""
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    if not email:
        return fail("Email is required")

    generic = "If an account exists for that email, a new code has been sent"
    user = User.query.filter_by(email=email).first()
    if not user or not user.password_hash:
        return ok(message=generic)  # don't reveal which emails are registered

    failure = issue_otp(email, "sign-in")
    if failure:
        return fail(f"Could not send the sign-in code: {failure}", 502)
    return ok(message=generic)


@auth_bp.post("/logout")
@jwt_required()
def logout():
    # nothing to destroy server-side — the frontend drops the token. Kept as a
    # route so the frontend's logout call does not 404.
    return ok(message="Logged out")


@auth_bp.get("/me")
@jwt_required()
def me():
    return ok({"user": user_json(current_user)})


@auth_bp.get("/google")
def google_login():
    return oauth.google.authorize_redirect(
        os.getenv("GOOGLE_REDIRECT_URI") or url_for("auth.google_callback", _external=True)
    )


@auth_bp.get("/google/callback")
def google_callback():
    frontend = current_app.config["FRONTEND_URL"]
    try:
        token = oauth.google.authorize_access_token()
    except Exception:
        return redirect(f"{frontend}/login?error=google_failed")

    info = token.get("userinfo") or {}
    email = (info.get("email") or "").strip().lower()
    if not email:
        return redirect(f"{frontend}/login?error=google_failed")

    user = User.query.filter_by(email=email).first()
    if not user:
        user = User(name=info.get("name") or email.split("@")[0], email=email, role="citizen")
        db.session.add(user)
        db.session.commit()
    elif not user.is_active:
        return redirect(f"{frontend}/login?error=deactivated")

    # a redirect cannot carry a JSON body, so the token rides in the query string
    # and /oauth-callback on the frontend immediately stores it and cleans the URL
    return redirect(f"{frontend}/oauth-callback?token={create_access_token(user)}")


@auth_bp.post("/forgot-password")
def forgot_password():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    if not email:
        return fail("Email is required")

    generic = "If an account exists for that email, an OTP has been sent"
    user = User.query.filter_by(email=email).first()
    if not user:
        return ok(message=generic)  # don't reveal which emails are registered
    if not user.password_hash:
        return fail(
            "Your account uses Google Sign-In. "
            "Please continue with Google to access your account."
        )

    # a silent mail failure used to look identical to success here, so the user
    # sat waiting for a code that was never sent. The reason is not about the
    # account, so reporting it leaks nothing about who is registered.
    failure = issue_otp(email)
    if failure:
        return fail(f"Could not send the OTP email: {failure}", 502)
    return ok(message=generic)


@auth_bp.post("/verify-otp")
def verify_otp():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    code = (data.get("otp_code") or "").strip()
    if not email or not code:
        return fail("Email and OTP are required")

    otp = Otp.query.filter_by(email=email, otp_code=code, is_used=False).first()
    if not otp:
        return fail("Invalid OTP", 400)
    if otp.expires_at < utcnow():
        db.session.delete(otp)
        db.session.commit()
        return fail("OTP has expired. Request a new one", 400)

    otp.is_used = True
    db.session.commit()
    return ok(message="OTP verified")


@auth_bp.post("/reset-password")
def reset_password():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    new_password = data.get("new_password") or ""
    if not email or not new_password:
        return fail("Email and new password are required")
    if len(new_password) < 6:
        return fail("Password must be at least 6 characters")

    # a verified (is_used) unexpired OTP is the proof of ownership — without this
    # check anyone could reset any account by posting an email address
    otp = Otp.query.filter_by(email=email, is_used=True).first()
    if not otp or otp.expires_at < utcnow():
        return fail("Verify your OTP before resetting the password", 403)

    user = User.query.filter_by(email=email).first()
    if not user:
        return fail("Account not found", 404)

    user.set_password(new_password)
    db.session.delete(otp)
    db.session.commit()
    return ok(message="Password reset successful. Please log in")
