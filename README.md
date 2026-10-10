# Sleep Squad

HackNC 2026. Friends compete on sleep: nightly 0-100 score, leaderboards, streaks, and an AI morning briefing read aloud.
Expo (React Native) app in Expo Go -> FastAPI backend -> Tiger Cloud (Postgres + TimescaleDB). Real sleep comes from Apple Watch via an iOS Shortcut (`shortcut/README.md`).

Read `CLAUDE.md` first: slices, scoring, file ownership, and git rules.

## Teammate quickstart
Current status and everyone's next task: `HANDOFF.md`. Rules (file ownership, git, scoring, slices): `CLAUDE.md`.

1. **Get access and clone.** Promit adds you as a collaborator (GitHub -> Settings -> Collaborators), then:
   ```powershell
   git clone https://github.com/Promit-Saha123/HackNC.git
   cd HackNC
   ```
2. **Set up** with the Backend and App sections below. You're ready when `pytest` passes and the app opens in Expo Go on your iPhone (mock data works with no backend).
3. **Know your role** (only edit your own files; for anything else, ask the owner):

   | Role | Who | Owns | First task |
   |------|-----|------|-----------|
   | P1 data / backend / Shortcut | Promit | `backend/db`, sleep + leaderboard + ingest routes, `scoring.py`, `backend/scripts`, `shortcut/` | Tiger Cloud + real Shortcut sync |
   | P2 AI / API client / submission | _name TBD_ | `routes/ai.py`, `backend/app/integrations`, `app/src/api`, `docs/`, Devpost, demo video | Gemini briefing + ElevenLabs audio |
   | P3 app UI / design | _name TBD_ | rest of `app/` incl. `package.json`, lockfile, `app.json` | Frutiger Aero polish: dream sky, font, icons |

4. **Work in small branches.** `git checkout -b p2/<task>` (use your own `p1`/`p2`/`p3`). Keep branches under 2 hours, then `git fetch; git rebase origin/main`, run the backend and the app, and open a small PR. Only P3 runs `npx expo install`.
5. **Secrets stay out of git.** `.env` files are ignored. Promit shares `DATABASE_URL` privately; P2 creates their own Gemini and ElevenLabs keys and puts them in `backend/.env`.
6. **Using Claude Code (optional).** It reads `CLAUDE.md` automatically. `.claude/settings.json` enables the `ecc` plugin; run `/plugin marketplace add affaan-m/everything-claude-code` once so it can load.
7. **End of every work block:** update `HANDOFF.md`.
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