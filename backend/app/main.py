from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .routes import ai, ingest, leaderboard, sleep

app = FastAPI(title="Sleep Squad API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


for module in (sleep, leaderboard, ai, ingest):
    app.include_router(module.router)