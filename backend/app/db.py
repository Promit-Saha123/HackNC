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
            max_size=settings.db_pool_max,
            timeout=10,  # a request waits at most 10 s for a free connection, then fails fast instead of piling up
            open=True,
            # statement_timeout stops one runaway query from holding a connection for ever
            kwargs={
                "row_factory": dict_row,
                "options": f"-c timezone=UTC -c statement_timeout={settings.db_statement_timeout_ms}",
            },
        )
    return _pool