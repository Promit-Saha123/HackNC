"""Login: scrypt password hashes + stateless HMAC-signed tokens (stdlib only).
Demo profiles (is_demo) share DEMO_PASSWORD until a user sets their own; real users need a hash (scripts/set_password.py).
Token = base64(user_id.expiry).signature, sent as `Authorization: Bearer <token>`.
ponytail: no revocation or refresh; the token just expires (TOKEN_DAYS). Add a denylist if logout must kill it server-side."""
import base64
import hashlib
import hmac
import os
import time

from fastapi import Header, HTTPException

from .config import settings

DEMO_PASSWORD = "sleepsquad"
TOKEN_DAYS = 30


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


def current_user_id(authorization: str = Header("")) -> int:
    """FastAPI dependency: the user id behind a valid bearer token, else 401."""
    uid = user_id_from(authorization.removeprefix("Bearer ").strip())
    if uid is None:
        raise HTTPException(401, "missing or invalid token")
    return uid
