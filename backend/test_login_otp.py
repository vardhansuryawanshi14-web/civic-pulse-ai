"""Self-check for the sign-in OTP flow. Run: venv/Scripts/python.exe test_login_otp.py

Uses a throwaway SQLite file and stubs the mailer, so it never sends mail and
never touches the real database.
"""

import os
import tempfile

os.environ["DATABASE_URL"] = "sqlite:///" + tempfile.mktemp(suffix=".db").replace("\\", "/")
os.environ.pop("ADMIN_EMAIL", None)
os.environ.pop("ADMIN_PASSWORD", None)

import services.email_service as email_service

sent = []
email_service.send_email = lambda to, subject, body, blocking=False: sent.append((to, subject)) or None

import routes.auth as auth_routes

auth_routes.send_otp = lambda to, code, purpose="password reset": (
    sent.append((to, purpose)) or None
)

from app import create_app
from models import db, Otp, User

app = create_app()
client = app.test_client()
EMAIL, PASSWORD = "citizen@example.com", "secret123"


def live_code(email):
    with app.app_context():
        otp = Otp.query.filter_by(email=email, is_used=False).first()
        return otp and otp.otp_code


# register hands back no token, only a demand for the code
r = client.post("/api/auth/register", json={"name": "Ada", "email": EMAIL, "password": PASSWORD})
body = r.get_json()["data"]
assert r.status_code == 200, r.get_json()
assert body["otp_required"] is True and body["email"] == EMAIL, body
assert "token" not in body, "register must not issue a token before verification"
assert sent[-1] == (EMAIL, "sign-in"), sent

# a wrong code is refused
assert client.post(
    "/api/auth/verify-login-otp", json={"email": EMAIL, "otp_code": "000000"}
).status_code == 400

# the real code becomes a token
code = live_code(EMAIL)
r = client.post("/api/auth/verify-login-otp", json={"email": EMAIL, "otp_code": code})
assert r.status_code == 200, r.get_json()
assert r.get_json()["data"]["token"], "verify must issue a token"

# and is single-use — the row is gone, so it cannot unlock a password reset either
assert client.post(
    "/api/auth/verify-login-otp", json={"email": EMAIL, "otp_code": code}
).status_code == 400
assert client.post(
    "/api/auth/reset-password", json={"email": EMAIL, "new_password": "hijacked1"}
).status_code == 403

# login stops at the code too, and a fresh one replaces the old
r = client.post("/api/auth/login", json={"email": EMAIL, "password": PASSWORD})
assert r.get_json()["data"]["otp_required"] is True, r.get_json()
first = live_code(EMAIL)
client.post("/api/auth/resend-otp", json={"email": EMAIL})
second = live_code(EMAIL)
assert second and second != first, "resend must replace the live code"
assert client.post(
    "/api/auth/verify-login-otp", json={"email": EMAIL, "otp_code": first}
).status_code == 400, "the replaced code must stop working"

r = client.post("/api/auth/verify-login-otp", json={"email": EMAIL, "otp_code": second})
assert r.status_code == 200 and r.get_json()["data"]["user"]["email"] == EMAIL

# a wrong password never reaches the mailer
before = len(sent)
assert client.post("/api/auth/login", json={"email": EMAIL, "password": "nope"}).status_code == 401
assert len(sent) == before, "no code may be sent for a failed password"

# a deactivated account cannot finish the flow
with app.app_context():
    User.query.filter_by(email=EMAIL).update({"is_active": False})
    db.session.commit()
assert client.post("/api/auth/login", json={"email": EMAIL, "password": PASSWORD}).status_code == 403

print("login OTP flow OK —", len(sent), "codes mailed")
