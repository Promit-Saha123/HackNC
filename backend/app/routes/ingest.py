from fastapi import APIRouter, Depends

from ..auth import current_user_id, make_ingest_token
from ..models import IngestToken

router = APIRouter(prefix="/ingest")


@router.post("/token", response_model=IngestToken)
def ingest_token(uid: int = Depends(current_user_id)):
    """Per-user token for the Shortcut's X-Ingest-Token header (replaces the bare X-User-Id)."""
    return IngestToken(user_id=uid, token=make_ingest_token(uid))
