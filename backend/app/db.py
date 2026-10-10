from psycopg_pool import ConnectionPool

from .config import settings

_pool: ConnectionPool | None = None


def get_pool() -> ConnectionPool:
    """Lazy Tiger Cloud pool. Unused while the in-memory store (app/store.py) backs the API."""
    global _pool
    if _pool is None:
        if not settings.database_url:
            raise RuntimeError("DATABASE_URL is not set (see backend/.env.example)")
        _pool = ConnectionPool(settings.database_url, min_size=1, max_size=5)
    return _pool