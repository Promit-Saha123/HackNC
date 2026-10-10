# Sleep Squad

HackNC 2026. Friends compete on sleep: nightly 0-100 score, leaderboards, streaks, and an AI morning briefing read aloud.
Expo (React Native) app in Expo Go -> FastAPI backend -> Tiger Cloud (Postgres + TimescaleDB). Real sleep comes from Apple Watch via an iOS Shortcut (`shortcut/README.md`).

Read `CLAUDE.md` first: slices, scoring, file ownership, and git rules.

## Prerequisites (Windows)
Git, Python 3.12, Node LTS, `cloudflared`, and Expo Go on your iPhone.

## Backend
```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env          # fill in keys; leave DATABASE_URL empty to use the in-memory demo data
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
pytest                          # tests
```
API docs: http://localhost:8000/docs

## App
```powershell
cd app
npm install
copy .env.example .env          # EXPO_PUBLIC_USE_MOCKS=true works with no backend
npx expo start --tunnel         # scan the QR code with the iPhone camera -> opens in Expo Go
```
To use the real backend, set `EXPO_PUBLIC_USE_MOCKS=false` and `EXPO_PUBLIC_API_URL` in `app/.env`, then restart Expo.

## Phones and the Shortcut -> backend (tunnel)
```powershell
cloudflared tunnel --url http://localhost:8000
```
Copy the printed `https://...trycloudflare.com` URL into `app/.env` (`EXPO_PUBLIC_API_URL`) and the Shortcut's URL action.
The URL changes every run: record the current one in `HANDOFF.md`.

## API contract
Pydantic models in `backend/app/models.py` are the contract.
After changing them: `python backend/scripts/export_openapi.py`, then in `app/`: `npm run gen:api`.