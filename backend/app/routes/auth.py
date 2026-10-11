from fastapi import APIRouter, Depends, HTTPException

from ..auth import check_password, current_user_id, make_token
from ..models import LoginRequest, LoginResponse, User
from ..store import store

router = APIRouter()


@router.post("/auth/login", response_model=LoginResponse)
def login(body: LoginRequest):
    found = store.login_info(body.username)
    # same error for unknown user and wrong password, so names can't be probed
    if found is None or not check_password(body.password, found[1], found[0].is_demo):
        raise HTTPException(401, "That username and password do not match.")
    return LoginResponse(user=found[0], token=make_token(found[0].id))


@router.get("/auth/me", response_model=User)
def me(uid: int = Depends(current_user_id)):
    return next(u for u in store.list_users() if u.id == uid)
