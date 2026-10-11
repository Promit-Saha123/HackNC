from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from .config import settings

_pool: ConnectionPool | None = None


def get_pool() -> ConnectionPool:
    """Lazy Tiger Cloud pool. UTC session so naive wall-clock datetimes round-trip through timestamptz unchanged."""
    global _pool
    if _pool is None:
        if not settings.database_url:
            raise RuntimeError("DATABASE_URL is not set (see backend/.env.example)")
        _pool = ConnectionPool(
            settings.database_url,
            min_size=1,
            max_size=5,
            kwargs={"row_factory": dict_row, "options": "-c timezone=UTC"},
        )
    return _pool