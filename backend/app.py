import os

from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager

from config import Config
from models import db, apply_column_migrations, User
from routes.admin import admin_bp
from routes.auth import auth_bp, init_oauth
from routes.citizen import citizen_bp, files_bp
from routes.officer import officer_bp


def ensure_tables(app):
    """Create any tables that do not exist yet, once per worker at startup.

    Railway starts with an empty database and nothing runs migrations for it, so
    the first request would otherwise fail with "Table 'railway.users' doesn't
    exist". create_all only issues CREATE TABLE for what is missing — it never
    drops, alters or touches existing tables or rows, so every boot after the
    first is a no-op. Columns added to a model after its table already exists
    are applied by apply_column_migrations, which is also a no-op once they are.
    """
    with app.app_context():
        try:
            db.create_all()
            apply_column_migrations()
        except Exception as e:
            # gunicorn runs several workers, and on a cold start they can race
            # each other to create the same table. The loser sees it already
            # exists, which is the state we wanted anyway.
            print(f"[db] create_all skipped: {e}", flush=True)


def ensure_admin(app):
    """Make sure the ADMIN_EMAIL account exists and is an admin.

    A fresh deploy has an empty users table, and nothing in the app can create
    an admin: registration is always a citizen, and so is a first Google
    sign-in. That left production with no way in to the admin screens at all.
    Setting ADMIN_EMAIL and ADMIN_PASSWORD is the way in.

    It only ever adds or promotes, never demotes or deletes, and it leaves an
    admin that already has a password completely alone — so a password changed
    later is not overwritten on the next restart. An admin without one is the
    exception: promoting a Google account leaves password_hash NULL, which locks
    it out of both the login form and the OTP reset, so it gets the password.
    Skipped entirely when the two variables are not set, which is the case in
    local development.
    """
    email = (os.getenv("ADMIN_EMAIL") or "").strip().lower()
    password = os.getenv("ADMIN_PASSWORD")
    if not email or not password:
        return

    with app.app_context():
        try:
            user = User.query.filter_by(email=email).first()
            if user and user.role == "admin" and user.password_hash:
                return
            if user:
                # the account already exists as a citizen, usually because they
                # signed in with Google before an admin was ever created
                action = "gave a password to" if user.role == "admin" else "promoted"
                user.role = "admin"
                user.is_active = True
                user.set_password(password)
            else:
                user = User(name="Admin", email=email, role="admin")
                user.set_password(password)
                db.session.add(user)
                action = "created"
            db.session.commit()
            print(f"[admin] {action} {email}", flush=True)
        except Exception as e:
            db.session.rollback()
            print(f"[admin] bootstrap skipped: {e}", flush=True)


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    db.init_app(app)

    # Credentialed CORS cannot use a wildcard origin, so this has to be the exact
    # frontend origin the browser sends. Printed at boot because a mismatch here
    # looks identical to "not logged in" from the frontend, with nothing in the
    # logs to say why.
    origin = app.config["FRONTEND_URL"]
    CORS(app, supports_credentials=True, origins=[origin] if origin else [])
    print(f"[cors] origin={origin or 'MISSING — set FRONTEND_URL'}", flush=True)

    jwt = JWTManager(app)

    @jwt.user_identity_loader
    def user_identity(user):
        """Tokens are minted from a User object; the subject claim must be a
        string, so ids go in as text and come back out through the lookup below."""
        return str(user.id)

    @jwt.user_lookup_loader
    def load_user(_jwt_header, jwt_data):
        """Turns the token's identity back into a User row on every request, so
        routes keep reading current_user.role / .ward / .id exactly as before."""
        return db.session.get(User, int(jwt_data["sub"]))

    # every rejection path returns the same JSON shape the frontend already reads
    def unauthorized(message="Login required"):
        return jsonify({"success": False, "message": message, "error_code": 401}), 401

    jwt.unauthorized_loader(lambda _reason: unauthorized())
    jwt.invalid_token_loader(lambda _reason: unauthorized("Invalid token"))
    jwt.expired_token_loader(lambda _header, _data: unauthorized("Session expired, please log in again"))
    # the account was deleted after the token was issued
    jwt.user_lookup_error_loader(lambda _header, _data: unauthorized("Account no longer exists"))

    init_oauth(app)
    app.register_blueprint(auth_bp)
    app.register_blueprint(citizen_bp)
    app.register_blueprint(officer_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(files_bp)

    @app.route("/")
    def home():
        return jsonify({"success": True, "message": "Civic Issue System API is running"})

    # last, so every model and blueprint is registered before the tables are read
    ensure_tables(app)
    ensure_admin(app)

    return app


app = create_app()

if __name__ == "__main__":
    app.run(debug=True, port=5000)