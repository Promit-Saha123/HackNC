from fastapi import APIRouter, Depends, Header, HTTPException, Request

from ..auth import (
    check_new_password, check_password, check_rate, clean_username, clear_fails, client_ip, current_user_id,
    hash_password, make_token, record_fail, user_id_from,
)
from ..models import LoginRequest, LoginResponse, SignupRequest, User
from ..store import store

router = APIRouter()


@router.post("/auth/signup", response_model=LoginResponse, status_code=201)
def signup(body: SignupRequest, request: Request, authorization: str = Header("")):
    """Create a real account and sign it in. The username and a hash of the password are stored (never the password).
    409 if the username already has an account, or if the caller is already signed in to a real account."""
    key = f"signup:{client_ip(request)}"
    check_rate(key, 10, 3600)
    record_fail(key)  # every attempt counts toward the hourly cap, successful or not
    uid = user_id_from(authorization.removeprefix("Bearer ").strip())
    signed_in = store.get_user(uid) if uid is not None else None
    if signed_in and not signed_in.is_demo:  # a demo login may still sign up for a real account
        raise HTTPException(409, f"You already have an account ({signed_in.name}). Log out to create a different one.")
    name, password = clean_username(body.username), check_new_password(body.password)
    user = store.create_user(name, hash_password(password))
    if user is None:
        raise HTTPException(409, "An account with that username already exists. Log in instead.")
    return LoginResponse(user=user, token=make_token(user.id))


@router.post("/auth/login", response_model=LoginResponse)
def login(body: LoginRequest, request: Request):
    # failed attempts only: 10 per username and 50 per IP per 5 minutes, then 429
    user_key, ip_key = f"login:{body.username.strip().lower()}", f"login-ip:{client_ip(request)}"
    check_rate(user_key, 10, 300)
    check_rate(ip_key, 50, 300)
    found = store.login_info(body.username)
    # same error for unknown user and wrong password, so names can't be probed
    if found is None or not check_password(body.password, found[1], found[0].is_demo):
        record_fail(user_key)
        record_fail(ip_key)
        raise HTTPException(401, "That username and password do not match.")
    clear_fails(user_key)
    return LoginResponse(user=found[0], token=make_token(found[0].id))


@router.get("/auth/me", response_model=User)
def me(uid: int = Depends(current_user_id)):
    user = store.get_user(uid)
    if user is None:
        raise HTTPException(401, "that account no longer exists")
    return user
