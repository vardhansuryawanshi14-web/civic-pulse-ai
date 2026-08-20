import base64
import os
import tempfile
from datetime import timedelta

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def _materialise_google_credentials():
    """Railway has no filesystem to upload the service account JSON to, but the
    Vision client only reads it from a path. So accept the JSON itself in
    GOOGLE_CREDENTIALS_JSON (raw or base64), write it to a temp file, and point
    GOOGLE_APPLICATION_CREDENTIALS at that. Locally the path variable is set
    directly and this does nothing.
    """
    raw = os.getenv("GOOGLE_CREDENTIALS_JSON")
    if not raw:
        return
    content = raw if raw.lstrip().startswith("{") else base64.b64decode(raw).decode()
    path = os.path.join(tempfile.gettempdir(), "gcp-service-account.json")
    with open(path, "w") as f:
        f.write(content)
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = path


_materialise_google_credentials()


class Config:
    MAX_CONTENT_LENGTH = 6 * 1024 * 1024  # hard cap before Flask reads the body
    SECRET_KEY = os.getenv("SECRET_KEY")
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL", "").replace(
    "mysql://", "mysql+mysqlconnector://", 1
)
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    # A trailing slash or stray whitespace here breaks CORS silently: flask-cors
    # compares the browser's Origin header literally, and an Origin never has a
    # trailing slash, so "https://site.vercel.app/" matches nothing and every
    # credentialed request is dropped by the browser.
    FRONTEND_URL = (os.getenv("FRONTEND_URL") or "").strip().rstrip("/")
    GOOGLE_APPLICATION_CREDENTIALS = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    GMAIL_ADDRESS = os.getenv("GMAIL_ADDRESS")
    GMAIL_APP_PASSWORD = os.getenv("GMAIL_APP_PASSWORD")
    GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
    GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
    GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI")

    # Auth travels as a Bearer token, not a cookie: Vercel and Railway are
    # different sites, and Chrome blocks third-party cookies, so a session
    # cookie set by the backend was never sent back with the frontend's
    # requests. Nothing here configures cookies any more.
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY") or SECRET_KEY
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(days=7)
    # Complaint photos are loaded through <img src>, and an img tag cannot send
    # an Authorization header, so that one route also accepts ?token=. Headers
    # are checked first, so normal API calls are unaffected.
    JWT_TOKEN_LOCATION = ["headers", "query_string"]
    JWT_QUERY_STRING_NAME = "token"
    # the Flask session is still used for one thing: authlib parks the OAuth
    # state in it between the redirect out to Google and the callback back.
    # That callback is a top-level navigation, so a default Lax cookie is sent.
