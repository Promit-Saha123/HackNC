from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/ingest")


@router.post("/{user_id}/token")
def create_token(user_id: int):
    """v3: per-user ingest token for the Shortcut (replaces the bare X-User-Id)."""
    raise HTTPException(501, "per-user ingest tokens land in v3")