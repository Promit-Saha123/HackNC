from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import settings
from .db import get_pool
from .routes import ai, auth, ingest, me, leaderboard, sleep

app = FastAPI(title="Sleep Squad API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.api_route("/health", methods=["GET", "HEAD"])  # HEAD too: many uptime monitors (UptimeRobot) probe with HEAD
def health(deep: bool = False):
    """Liveness by default (cheap). ?deep=true also pings the database and returns 503 if it's down, for uptime checks."""
    if not deep:
        return {"status": "ok"}
    if not settings.database_url:
        return {"status": "ok", "db": "memory"}  # in-memory demo mode
    try:
        with get_pool().connection() as c:
            c.execute("SELECT 1")
    except Exception:  # any failure (down, timeout, pool exhausted) means not healthy
        return JSONResponse({"status": "degraded", "db": "down"}, status_code=503)
    return {"status": "ok", "db": "ok"}


for module in (sleep, leaderboard, ai, ingest, auth, me):
    app.include_router(module.router)