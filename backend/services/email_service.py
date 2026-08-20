import contextlib
import os
import smtplib
import socket
import threading
from email.message import EmailMessage

SMTP_HOST = "smtp.gmail.com"
SMTP_TIMEOUT = 10

_real_getaddrinfo = socket.getaddrinfo


@contextlib.contextmanager
def _ipv4_only():
    """Force IPv4 for the duration of a send.

    Railway's containers have no IPv6 route, but smtp.gmail.com resolves to an
    IPv6 address first, so the connection dies with "[Errno 101] Network is
    unreachable" before it ever tries IPv4. Dropping the v6 records from
    resolution is what makes mail work there; locally it changes nothing.
    """

    def ipv4(*args, **kwargs):
        return [info for info in _real_getaddrinfo(*args, **kwargs) if info[0] == socket.AF_INET]

    socket.getaddrinfo = ipv4
    try:
        yield
    finally:
        socket.getaddrinfo = _real_getaddrinfo


def _send_over_ssl(sender, password, msg):
    with smtplib.SMTP_SSL(SMTP_HOST, 465, timeout=SMTP_TIMEOUT) as smtp:
        smtp.login(sender, password)
        smtp.send_message(msg)


def _send_over_starttls(sender, password, msg):
    with smtplib.SMTP(SMTP_HOST, 587, timeout=SMTP_TIMEOUT) as smtp:
        smtp.starttls()
        smtp.login(sender, password)
        smtp.send_message(msg)


def _deliver(sender, password, msg, to_address):
    """Returns None on success, or the failure reason as a string."""
    reasons = []
    # 465 is the normal route; 587 is the fallback for hosts that block it
    for label, send in (("465", _send_over_ssl), ("587", _send_over_starttls)):
        try:
            with _ipv4_only():
                send(sender, password, msg)
            print(f"[email] sent to {to_address} over {label}", flush=True)
            return None
        except Exception as e:
            # A mail failure must never break the request that triggered it — but
            # it must be visible: stdout is block-buffered when redirected to a
            # file, so without flush a failed send looks like a successful one.
            print(f"[email] port {label} failed for {to_address}: {e}", flush=True)
            reasons.append(f"{label}: {e}")

    return " / ".join(reasons)


def brevo_payload(sender, to_address, subject, body):
    return {
        "sender": {"email": sender, "name": "CivicPulse"},
        "to": [{"email": to_address}],
        "subject": subject,
        "textContent": body,
    }


def _deliver_over_http(sender, to_address, subject, body):
    """Send through Brevo's HTTPS API. Returns None on success, else the reason.

    Railway blocks outbound SMTP — 465 and 587 both time out — so on a host like
    that no mail can leave over SMTP at all. An ordinary HTTPS request is not
    blocked, so when BREVO_API_KEY is set it takes over. `sender` has to be an
    address verified in the Brevo dashboard.
    """
    import requests

    try:
        response = requests.post(
            "https://api.brevo.com/v3/smtp/email",
            headers={"api-key": os.getenv("BREVO_API_KEY"), "accept": "application/json"},
            json=brevo_payload(sender, to_address, subject, body),
            timeout=15,
        )
        if response.status_code < 300:
            print(f"[email] sent to {to_address} over the Brevo API", flush=True)
            return None
        # Brevo answers with a JSON message explaining the rejection, usually an
        # unverified sender or a bad key — worth passing through verbatim
        print(f"[email] Brevo rejected mail to {to_address}: {response.text}", flush=True)
        return f"Brevo returned {response.status_code}: {response.text[:200]}"
    except Exception as e:
        print(f"[email] Brevo request failed for {to_address}: {e}", flush=True)
        return str(e)


def send_email(to_address, subject, body, blocking=False):
    """Send a plain-text email, over the Brevo API if configured, else Gmail SMTP.

    Fire and forget by default — a status change should not make the officer
    wait on the handshake. `blocking=True` waits and returns whether the message
    actually left, which is what the OTP flow needs: telling someone their code
    is on its way when it never sent is worse than an error.

    Returns None on success or when queued, and the reason string on failure so
    the caller can log or surface it.
    """
    sender = os.getenv("BREVO_SENDER") or os.getenv("GMAIL_ADDRESS")

    if os.getenv("BREVO_API_KEY"):
        if not sender:
            return "No sender address set (BREVO_SENDER or GMAIL_ADDRESS)"
        if blocking:
            return _deliver_over_http(sender, to_address, subject, body)
        threading.Thread(
            target=_deliver_over_http, args=(sender, to_address, subject, body), daemon=True
        ).start()
        return None

    password = os.getenv("GMAIL_APP_PASSWORD")
    if not sender or not password:
        print(f"[email] SMTP not configured; skipping mail to {to_address}", flush=True)
        return "SMTP is not configured on the server (GMAIL_ADDRESS / GMAIL_APP_PASSWORD)"

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = sender
    msg["To"] = to_address
    msg.set_content(body)

    if blocking:
        return _deliver(sender, password, msg, to_address)

    # ponytail: one thread per email — fine at this volume, move to a queue or
    # Celery if mail ever gets sent in bulk
    threading.Thread(
        target=_deliver, args=(sender, password, msg, to_address), daemon=True
    ).start()
    return None


def send_otp(to_address, otp_code):
    """Returns None on success, or a reason string the caller can report."""
    return send_email(
        to_address,
        "Your Password Reset OTP - Civic Issue System",
        f"Your OTP for password reset is: {otp_code}\n"
        "This OTP is valid for 10 minutes. Do not share it with anyone.",
        blocking=True,
    )


if __name__ == "__main__":
    payload = brevo_payload("sender@example.com", "citizen@example.com", "Subject", "Body")
    assert payload["sender"]["email"] == "sender@example.com"
    assert payload["to"] == [{"email": "citizen@example.com"}]
    assert payload["textContent"] == "Body"

    # with no provider configured at all, the caller gets a reason, never silence
    for key in ("BREVO_API_KEY", "GMAIL_ADDRESS", "GMAIL_APP_PASSWORD", "BREVO_SENDER"):
        os.environ.pop(key, None)
    assert send_email("nobody@example.com", "s", "b", blocking=True)

    # an API key with no verified sender is a configuration error, not a silent send
    os.environ["BREVO_API_KEY"] = "test-key"
    assert send_email("nobody@example.com", "s", "b", blocking=True) == (
        "No sender address set (BREVO_SENDER or GMAIL_ADDRESS)"
    )
    print("email routing OK")
