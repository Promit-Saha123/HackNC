"""Set a user's login password. Run from backend/: python scripts/set_password.py <name> <password>"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.auth import hash_password  # noqa: E402
from app.store import store  # noqa: E402

found = store.login_info(sys.argv[1])
if found is None:
    sys.exit(f"no user named {sys.argv[1]}")
store.set_password(found[0].id, hash_password(sys.argv[2]))
print(f"password set for {found[0].name} (id {found[0].id})")
