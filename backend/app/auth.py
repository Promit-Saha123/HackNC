"""Login: scrypt password hashes + stateless HMAC-signed tokens (stdlib only).
Demo profiles (is_demo) share DEMO_PASSWORD until a user sets their own; real users need a hash (scripts/set_password.py).
Token = base64(user_id.expiry).signature, sent as `Authorization: Bearer <token>`.
ponytail: no revocation or refresh; the token just expires (TOKEN_DAYS). Add a denylist if logout must kill it server-side."""
import base64
import hashlib
import hmac
import os
import re
import time

from fastapi import Header, HTTPException, Request

from .config import settings

DEMO_PASSWORD = "sleepsquad"
TOKEN_DAYS = 30
NAME_RE = re.compile(r"^[A-Za-z0-9_.-]{3,24}$")


def clean_username(name: str) -> str:
    """Validate a username (login handle and display name): 3-24 chars of letters, digits, _ . -"""
    name = name.strip()
    if not NAME_RE.match(name):
        raise HTTPException(422, "Usernames are 3-24 characters: letters, numbers, _ . -")
    return name


def check_new_password(pw: str) -> str:
    if not 8 <= len(pw) <= 128:
        raise HTTPException(422, "Passwords are 8-128 characters.")
    return pw


# Attempt limiter. ponytail: in-process counters, so with several server workers each keeps its own (the real limit is
# workers x limit) and a restart resets them. Move to Redis or a table if that ever matters.
_fails: dict[str, list[float]] = {}
_MAX_WINDOW = 3600


def client_ip(request: Request) -> str:
    """Behind the Cloudflare tunnel the peer is the tunnel itself, so prefer the forwarded client IP.
    Those headers are spoofable if the server is exposed directly, so per-username limits back this up."""
    fwd = request.headers.get("cf-connecting-ip") or request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    return fwd or (request.client.host if request.client else "unknown")


def _recent(key: str, window: int) -> list[float]:
    hits = [t for t in _fails.get(key, []) if t > time.time() - window]
    if hits:
        _fails[key] = hits
    else:
        _fails.pop(key, None)
    return hits


def check_rate(key: str, limit: int, window: int) -> None:
    """429 once `key` has `limit` recorded attempts within `window` seconds."""
    if len(_fails) > 5000:  # bound memory: sweep expired keys
        for k in list(_fails):
            _recent(k, _MAX_WINDOW)
    if len(_recent(key, window)) >= limit:
        raise HTTPException(429, "Too many attempts. Try again in a few minutes.")


def record_fail(key: str) -> None:
    _fails.setdefault(key, []).append(time.time())


def clear_fails(key: str) -> None:
    _fails.pop(key, None)


def _scrypt(pw: str, salt: bytes) -> str:
    return hashlib.scrypt(pw.encode(), salt=salt, n=2**14, r=8, p=1).hex()


def hash_password(pw: str) -> str:
    salt = os.urandom(16)
    return salt.hex() + "$" + _scrypt(pw, salt)


def check_password(pw: str, stored: str | None, is_demo: bool) -> bool:
    if stored is None:
        return is_demo and hmac.compare_digest(pw, DEMO_PASSWORD)
    salt, digest = stored.split("$")
    return hmac.compare_digest(_scrypt(pw, bytes.fromhex(salt)), digest)


def _sign(msg: str) -> str:
    return hmac.new(settings.auth_secret.encode(), msg.encode(), hashlib.sha256).hexdigest()


def make_token(uid: int) -> str:
    msg = f"{uid}.{int(time.time()) + TOKEN_DAYS * 86400}"
    return base64.urlsafe_b64encode(msg.encode()).decode() + "." + _sign(msg)


def user_id_from(token: str) -> int | None:
    try:
        b64, sig = token.split(".")
        msg = base64.urlsafe_b64decode(b64).decode()
        uid, exp = msg.split(".")
        ok = hmac.compare_digest(sig, _sign(msg)) and int(exp) > time.time()
        return int(uid) if ok else None
    except ValueError:
        return None


def make_ingest_token(uid: int) -> str:
    """Long-lived, ingest-only token for the iOS Shortcut (can't read data or log in). Same secret, so rotating AUTH_SECRET revokes all."""
    return f"{uid}.{_sign(f'ingest.{uid}')}"


def ingest_user_id(token: str) -> int | None:
    uid, _, sig = token.partition(".")
    return int(uid) if uid.isdigit() and hmac.compare_digest(sig, _sign(f"ingest.{uid}")) else None


def require_self(user_id: int, authorization: str = Header("")) -> int:
    """Dependency for routes with a {user_id} path param that return one user's detailed sleep data.
    Off by default: the app doesn't send tokens everywhere yet. STRICT_PRIVACY=true limits them to the signed-in user
    (friends use /users/{id}/card, which shows score + streak only)."""
    if settings.strict_privacy and user_id_from(authorization.removeprefix("Bearer ").strip()) != user_id:
        raise HTTPException(403, "you can only read your own sleep data")
    return user_id


def current_user_id(authorization: str = Header("")) -> int:
    """FastAPI dependency: the user id behind a valid bearer token, else 401."""
    uid = user_id_from(authorization.removeprefix("Bearer ").strip())
    if uid is None:
        raise HTTPException(401, "missing or invalid token")
    return uid
