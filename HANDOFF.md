# HANDOFF

Update this at the end of every work block (and every Claude session).

## Current slice
v1 in progress. Last tag: v0 (scaffold).

## Done
- 2026-10-10 Promit (main): backend with in-memory seeded demo data (8 users x 60 nights), scoring, overview + leaderboard, Shortcut parser, AI/ingest stubs; 12 tests pass. Expo app: Home (score card, 7-night chart, Sync button), Leaderboard (week/all), pick-your-user, glass cards.

- 2026-10-10 Promit (branch `backend`, not yet merged): Tiger Cloud live. Schema applied, seeded (8 users, 480 sessions, 480 scores; both hypertables), `store.py` now has `SqlStore` selected when `DATABASE_URL` is set (else in-memory `Store`, so a fresh clone still runs). Parity with the in-memory store checked; 12 tests pass; shortcut write path tested. Response shapes unchanged.

## In progress
- P1 Promit, branch `backend`: next is the iOS Shortcut + cloudflared tunnel test.

## Next up
- Everyone: scan the QR (`npx expo start --tunnel`) in Expo Go; the glass UI is not yet verified on a phone.
- P1 Promit: build the Shortcut and test a real sync; then streaks/badges, v3 continuous aggregate + compression.
- Teammates: copy `DATABASE_URL` from Promit (never commit) or leave it unset to run on in-memory demo data.
- P2: Gemini briefing (`integrations/gemini.py`) + ElevenLabs audio (`integrations/elevenlabs.py`), briefing card in the app via `app/src/api/`.
- P3: UI polish: font via expo-font, dream sky, clouds/bubbles, replace the leaderboard tab icon (still the template's explore icon).

## Blockers / decisions needed
- Teammates need collaborator access to the GitHub repo (Promit adds them).
- P2 / P3 names are placeholders in the docs; the team knows who they are.

## How to run right now
- Backend: `cd backend; .\.venv\Scripts\Activate.ps1; uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
- App: `cd app; npx expo start --tunnel` (mocks on by default: `app/.env.example`)
- Expo tunnel: `npx expo start --tunnel` (`@expo/ngrok` is now an app devDependency, so there is no install prompt). Backend tunnel URL (cloudflared): none running.

## Known bugs / notes
- `npx expo lint` and `npm run typecheck` run. Lint has 1 error in the template file `app/src/hooks/use-color-scheme.web.ts` (setState in effect, web only); not ours, fix when touching web.
- `openapi-typescript` runs via `npx` in `npm run gen:api` (its peer range rejects TypeScript 6, so it is not a devDependency).
- Nothing verified on a phone yet; the real UI check is in Expo Go.
- `scripts/seed.py` works (`--reset` wipes and reseeds). The DB has the Tiger-managed `pg_buffercache` tables too; ignore them.
- Tests use the real DB when `DATABASE_URL` is set; `shortcut` test uses an in-memory `Store`.

Last updated: 2026-10-10, Promit