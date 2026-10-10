# HANDOFF

Update this at the end of every work block (and every Claude session).

## Current slice
v1 in progress. Last tag: v0 (scaffold).

## Done
- 2026-10-10 Promit (main): backend with in-memory seeded demo data (8 users x 60 nights), scoring, overview + leaderboard, Shortcut parser, AI/ingest stubs; 12 tests pass. Expo app: Home (score card, 7-night chart, Sync button), Leaderboard (week/all), pick-your-user, glass cards.

## In progress
- Nobody yet.

## Next up
- P1 Promit: Tiger Cloud (create service, `DATABASE_URL`, `scripts/apply_schema.py`, `scripts/seed.py`), switch store -> SQL; build the Shortcut and test a real sync.
- P2: Gemini briefing (`integrations/gemini.py`) + ElevenLabs audio (`integrations/elevenlabs.py`), briefing card in the app via `app/src/api/`.
- P3: UI polish: font via expo-font, dream sky, clouds/bubbles, replace the leaderboard tab icon (still the template's explore icon).

## Blockers / decisions needed
- Tiger Cloud connection string (Promit) is not set up yet; the API runs on in-memory data until it is.
- Teammates need collaborator access to the GitHub repo (Promit adds them).

## How to run right now
- Backend: `cd backend; .\.venv\Scripts\Activate.ps1; uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
- App: `cd app; npx expo start --tunnel` (mocks on by default: `app/.env.example`)
- Expo tunnel: `npx expo start --tunnel` (`@expo/ngrok` is now an app devDependency, so there is no install prompt). Backend tunnel URL (cloudflared): none running.

## Known bugs / notes
- `npx expo lint` and `npm run typecheck` run. Lint has 1 error in the template file `app/src/hooks/use-color-scheme.web.ts` (setState in effect, web only); not ours, fix when touching web.
- `openapi-typescript` runs via `npx` in `npm run gen:api` (its peer range rejects TypeScript 6, so it is not a devDependency).
- Nothing verified on a phone yet; the real UI check is in Expo Go.
- `scripts/seed.py` is written but untested (needs Tiger Cloud).

Last updated: 2026-10-10, Promit