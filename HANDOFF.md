# HANDOFF

Update this at the end of every work block (and every Claude session).

## Current slice
v1 in progress. Last tag: v0 (scaffold).

## Done
- 2026-10-10 Promit (main): backend with in-memory seeded demo data (8 users x 60 nights), scoring, overview + leaderboard, Shortcut parser, AI/ingest stubs; 12 tests pass. Expo app: Home (score card, 7-night chart, Sync button), Leaderboard (week/all), pick-your-user, glass cards.

- 2026-10-10 P3 Pranav (`p3/design-system`, PR #5): new design replaces Frutiger Aero: deep black + white/gray theme, Plus Jakarta Sans, no glass (removed `expo-glass-effect`/`expo-blur`). Login screen (hard-coded demo: any demo name, password `sleepsquad`). Screens moved to `app/src/app/(tabs)/`. 5 tabs: Home (no-scroll, night-clock outer ring + sleep-stage inner ring, briefing row, Log sleep / Targets / Squads actions, calendar), Leaderboard (podium, Weekly / All-time / Improved / Squads, rank arrows, friend card), Trends, Achievements, Profile (goals, privacy, squad, log out). Tap-for-details pop-ups everywhere. P2's `BriefingCard` restyled as a compact Home row that opens the full text in a sheet.

- 2026-10-10 Promit (branch `backend`, not yet merged): Tiger Cloud live. Schema applied, seeded (8 users, 480 sessions, 480 scores; both hypertables), `store.py` now has `SqlStore` selected when `DATABASE_URL` is set (else in-memory `Store`, so a fresh clone still runs). Parity with the in-memory store checked; 12 tests pass; shortcut write path tested. Response shapes unchanged.
- 2026-10-10 Promit (PR #6, merged): `Insight` model in `models.py` and `recent_nights(uid, limit=28)` on `Store`/`SqlStore` for P2's weekly insight. SQL version untested.
- 2026-10-10 Promit (PRs #8, #10, #11 merged): `best_streak`, `prev_rank`, per-night bed/wake in history; `DELETE /users/{id}/data` (own token only); login `POST /auth/login` + `GET /auth/me` (scrypt hashes, signed 30-day bearer tokens; demo profiles share password `sleepsquad`; real users: `python scripts/set_password.py <name> <pw>`). Set `AUTH_SECRET` in `backend/.env`.
- 2026-10-10 Promit (branches `p1/me-endpoints`, `p1/ingest-token`, stacked, PRs pending): `/me/prefs` (GET/PUT goals + privacy toggles; hidden users leave all leaderboards), `POST /me/sleep` (manual log; send LOCAL times with no UTC offset), `/me/squad` (GET, POST create, POST join; codes WOLF23, OWLS42, RATS17), `POST /ingest/token` + `X-Ingest-Token` on `/sleep/shortcut` (real users need it; demo profiles may still send `X-User-Id`). DB migrations `db/003_auth.sql`, `db/004_profile.sql` already applied to Tiger Cloud.

## In progress
- P1 Promit, branch `backend`: next is the iOS Shortcut + cloudflared tunnel test.
- P3 Pranav: PR #5 (`p3/design-system`), main merged in; needs a phone check, then merge.
- P2 Sharvil (`p2/gemini-briefing`, merged in #2): Gemini briefing in `backend/app/integrations/gemini.py` (gemini-3.8-flash, structured JSON, own-baseline only, retry on gemini-3.5-flash, template fallback, cached per night) + tests (`tests/test_gemini.py`, `tests/conftest.py` blocks live Gemini in tests). App: `src/components/BriefingCard.tsx` on Home (`src/app/index.tsx`, P3 sign-off needed), mock briefing in `src/api/mockClient.ts`.

## Next up
- Everyone: scan the QR (`npx expo start --tunnel`) in Expo Go; the new UI is not yet verified on a phone.
- P1 Promit: build the Shortcut and test a real sync; then streaks/badges, v3 continuous aggregate + compression.
- Teammates: copy `DATABASE_URL` from Promit (never commit) or leave it unset to run on in-memory demo data.
- P2: open PR for `p2/gemini-briefing`; then v3 weekly Gemini insight. ElevenLabs audio (`integrations/elevenlabs.py`) is deferred to the end if time allows (no key yet).
- P3: merge PR #5; app icon + splash; wind-down notification; switch Improved / Squads boards to the real endpoints once P2 regenerates types.
- P2 (asks from P3): run `npm run gen:api` (schema.ts lacks `improved` / `SquadLeaderboard`), add `api.squadLeaderboard()` + `period: 'improved'` to `client.ts` and `mockClient.ts`; mock fixture names to match the demo story; manual log via `POST /sleep/shortcut`.
- P1 (asks from P3): nightly bed/wake times for past nights, best streak, previous rank (for rank arrows); endpoints to save targets, privacy toggles, manual logs, squads; delete-my-data; real login. Until then the app uses labelled sample data (`app/src/data/sample.ts`) and in-memory state.

## Blockers / decisions needed
- Enable Gemini billing before the demo (free tier ran out on gemini-3.8-flash; fallback models + template exist).
- P2: rebase `p2/weekly-insight` on main, then regenerate `openapi.json` / `schema.ts` (Insight is now in `models.py`).
- Shortcut is not built yet (P1, phone needed); its header is now `X-Ingest-Token`, see `shortcut/README.md`.
- Teammates need collaborator access to the GitHub repo (Promit adds them).
- P2 / P3 names are placeholders in the docs; the team knows who they are.

## How to run right now
- Backend: `cd backend; .\.venv\Scripts\Activate.ps1; uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
- App: `cd app; npx expo start --tunnel` (mocks on by default: `app/.env.example`)
- Expo tunnel: `npx expo start --tunnel` (`@expo/ngrok` is now an app devDependency, so there is no install prompt). Backend tunnel URL (cloudflared, restarted 2026-10-11 02:22 UTC after a low-memory kill, changes every run): https://quebec-clone-translations-experience.trycloudflare.com. Promit's real user is id 9 (`X-User-Id: 9`); do not run `seed.py --reset` or it is wiped. `cloudflared` lives at `C:\Program Files (x86)\cloudflared\cloudflared.exe` (not on PATH in every shell).

## Known bugs / notes
- `npx expo lint` and `npm run typecheck` run. Lint has 1 error in the template file `app/src/hooks/use-color-scheme.web.ts` (setState in effect, web only); not ours, fix when touching web.
- `openapi-typescript` runs via `npx` in `npm run gen:api` (its peer range rejects TypeScript 6, so it is not a devDependency).
- Nothing verified on a phone yet; the real UI check is in Expo Go.
- `scripts/seed.py` works (`--reset` wipes and reseeds). The DB has the Tiger-managed `pg_buffercache` tables too; ignore them.
- Tests use the real DB when `DATABASE_URL` is set; `shortcut` test uses an in-memory `Store`.
- Gemini free tier is 5 requests/min per model; the per-night cache keeps it fine, but a cold first briefing can take ~3-13 s (the card shows "Writing your briefing..."). Needs `GEMINI_API_KEY` in `backend/.env`; without it the template text is returned.
- CLAUDE.md "Design brief" still says Frutiger Aero / Liquid Glass and "pick-your-user"; the app now uses the black/white design and a login screen. Needs a team decision + doc update.
- App: login, targets, logged nights and squads are in memory only (lost on reload). Sleep stages are demo data. Rank arrows compare against the previous night's ranking. Improved / Squads boards are computed in the app until the real endpoints are wired.

Last updated: 2026-10-10, Promit (P1)