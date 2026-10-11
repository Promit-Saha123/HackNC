"""Apply db/001_schema.sql to DATABASE_URL (Tiger Cloud). Run from backend/: python scripts/apply_schema.py"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import psycopg  # noqa: E402

from app.config import settings  # noqa: E402

if not settings.database_url:
    sys.exit("DATABASE_URL is not set in backend/.env")

sql = (Path(__file__).resolve().parents[1] / "db" / (sys.argv[1] if len(sys.argv) > 1 else "001_schema.sql")).read_text(encoding="utf-8")
with psycopg.connect(settings.database_url, autocommit=True) as conn:
    for stmt in sql.split(";"):  # one at a time: refresh_continuous_aggregate can't run in a multi-statement transaction
        if stmt.strip():
            conn.execute(stmt)
    tables = conn.execute(
        "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1"
    ).fetchall()
print("tables:", [t[0] for t in tables])