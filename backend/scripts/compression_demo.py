"""Compression at scale, for the demo. SYNTHETIC data in its own table (demo_scale_sleep), never read by the app.
Run from backend/:
  python scripts/compression_demo.py              300 users x 365 nights (~110k rows), compress, print the ratio
  python scripts/compression_demo.py --users 500 --days 365
  python scripts/compression_demo.py --drop       remove the demo table
The real tables hold ~56 rows per chunk, where compression overhead outweighs savings. This one holds thousands per chunk."""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import psycopg  # noqa: E402

from app.config import settings  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument("--users", type=int, default=300)
ap.add_argument("--days", type=int, default=365)
ap.add_argument("--chunk-days", type=int, default=90, help="chunk length: more days = more rows per user per chunk")
ap.add_argument("--drop", action="store_true")
args = ap.parse_args()

if not settings.database_url:
    sys.exit("DATABASE_URL is not set in backend/.env")

# Same columns as sleep_sessions, no foreign key to users (these users don't exist).
CREATE = """CREATE TABLE demo_scale_sleep (time TIMESTAMPTZ NOT NULL, user_id INT NOT NULL, end_time TIMESTAMPTZ,
duration_min INT, efficiency REAL, deep_min INT, rem_min INT, light_min INT, awake_min INT, source TEXT)"""

# Bedtime 10 pm-1 am, 6-9 h asleep, 88-98% efficiency, deep ~14-20%, REM ~19-25%. setseed makes every run identical.
FILL = """INSERT INTO demo_scale_sleep
SELECT bed, u, bed + make_interval(mins => in_bed), asleep, round(asleep::numeric / in_bed, 3)::real,
       deep, rem, asleep - deep - rem, in_bed - asleep, 'synthetic'
FROM (SELECT u, bed, asleep, round(asleep / (0.88 + random() * 0.10))::int AS in_bed,
             (asleep * (0.14 + random() * 0.06))::int AS deep, (asleep * (0.19 + random() * 0.06))::int AS rem
      FROM (SELECT u, date_trunc('day', now()) - make_interval(days => d) + make_interval(mins => 1320 + (random() * 180)::int) AS bed,
                   360 + (random() * 180)::int AS asleep
            FROM generate_series(1, %s) u, generate_series(0, %s) d) a) b"""

with psycopg.connect(settings.database_url, autocommit=True) as conn:
    conn.execute("DROP TABLE IF EXISTS demo_scale_sleep")
    if args.drop:
        sys.exit("dropped demo_scale_sleep")
    print("SYNTHETIC demo data: table demo_scale_sleep, not used by the app")
    conn.execute(CREATE)
    conn.execute(
        "SELECT create_hypertable('demo_scale_sleep', 'time', chunk_time_interval => make_interval(days => %s))",
        (args.chunk_days,),
    )
    conn.execute("SELECT setseed(0.42)")
    conn.execute(FILL, (args.users, args.days - 1))
    rows = conn.execute("SELECT count(*) FROM demo_scale_sleep").fetchone()[0]
    conn.execute(
        "ALTER TABLE demo_scale_sleep SET (timescaledb.compress, timescaledb.compress_segmentby = 'user_id',"
        " timescaledb.compress_orderby = 'time DESC')"
    )
    conn.execute("SELECT compress_chunk(c, if_not_compressed => true) FROM show_chunks('demo_scale_sleep') c")
    chunks, done, before, after = conn.execute(
        "SELECT total_chunks, number_compressed_chunks, before_compression_total_bytes, after_compression_total_bytes"
        " FROM hypertable_compression_stats('demo_scale_sleep')"
    ).fetchone()
    mb = lambda b: f"{b / 1e6:.1f} MB"  # noqa: E731
    print(f"{args.users} users x {args.days} nights = {rows:,} rows in {chunks} chunks ({rows // chunks:,} per chunk)")
    print(f"compressed {done}/{chunks} chunks: {mb(before)} -> {mb(after)}  =  {before / after:.1f}x smaller")
