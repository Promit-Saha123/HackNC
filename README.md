# HackNC

- `backend/` — FastAPI (Python)
- `frontend/` — Vite + React

## Run

```powershell
# backend (http://localhost:8000)
cd backend
python -m venv .venv; .venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload

# frontend (http://localhost:5173, proxies /api to the backend)
cd frontend
npm install
npm run dev
```

## Test

```powershell
cd backend; pytest                      # all
cd backend; pytest tests/test_health.py::test_health   # single
```
