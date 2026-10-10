"""Write the API contract to shared/openapi.json. Run from backend/: python scripts/export_openapi.py"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import app  # noqa: E402

out = Path(__file__).resolve().parents[2] / "shared" / "openapi.json"
out.parent.mkdir(exist_ok=True)
out.write_text(json.dumps(app.openapi(), indent=2) + "\n", encoding="utf-8")
print("wrote", out)