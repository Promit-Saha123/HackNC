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
- P1 Promit, branch `backend`: next is the iOS Shortcut test against the Render API.
- P3 Pranav: PR #5 (`p3/design-system`), main merged in; needs a phone check, then merge.
- P2 Sharvil (`p2/gemini-briefing`, merged in #2): Gemini briefing in `backend/app/integrations/gemini.py` (gemini-3.8-flash, structured JSON, own-baseline only, retry on gemini-3.5-flash, template fallback, cached per night) + tests (`tests/test_gemini.py`, `tests/conftest.py` blocks live Gemini in tests). App: `src/components/BriefingCard.tsx` on Home (`src/app/index.tsx`, P3 sign-off needed), mock briefing in `src/api/mockClient.ts`.
- P2 Sharvil (`p2/weekly-insight`, merged in #9): `GET /ai/insight/{user_id}` -> `Insight`; `integrations/insight.py` finds the strongest pattern in the last 28 nights in code (bedtime-before-midnight, weekend drift, week trend, else steady), Gemini only phrases it, template fallback. Gemini calls fall through 3.8 -> 3.5 -> 3.5-lite -> 3.7 flash, skipping models that hit the daily quota. App: `api.insight()`, `api.squadLeaderboard()`, `period: 'improved'` (no insight UI yet; P3 can place it).
- P2 Sharvil (`p2/elevenlabs-briefing`, PR #16, stacked on #20): briefing read aloud. `Briefing.audio_url` = `/ai/briefing/{id}/audio` when `ELEVENLABS_API_KEY` is set (else null); that endpoint generates the MP3 on first tap via `integrations/elevenlabs.py` (eleven_flash_v2_5, default voice Sarah; falls back to it if `ELEVENLABS_VOICE_ID` is unknown or paid-only; cached in `backend/audio_cache/`; the not-medical note is shown, not spoken). App: Listen button in the briefing sheet (expo-audio, plays in silent mode, sends the auth header). AI endpoints (briefing, insight, audio) now honor `STRICT_PRIVACY` like overview/history.
- P2 Sharvil (`p2/api-client-catchup`, PR #19): `schema.ts` regenerated; new `api.*`: `login/signup/logout/me` (Bearer token kept in memory), `history`, `profile/updateProfile/changePassword`, `prefs/savePrefs`, `logSleep`; readable `ApiError` messages (`isAuthError` for 401). Mocks now mirror the backend's 8 demo friends with 60 scored nights each, and the same auth/prefs/log rules.
- P2 Sharvil (`p2/api-client-part2`, PR open, stacked on #19): `api.mySquad/createSquad/joinSquad/leaveSquad/squad(code)`, `api.friendCard`, `api.syncStatus`, `api.ingestToken`, `api.deleteMyData` (deletes the whole real account and signs out; demo profiles get 403, enforced by the backend). Mocks mirror all of it.
- P2 Sharvil (`p2/somni-chat`, PR open): **Somni**, the in-app chatbot. `POST /ai/chat/{user_id}` (`ChatRequest` -> `ChatReply`, new models in `models.py`, Promit to OK) via `integrations/somni.py`: Gemini answers only from a DATA sheet of the user's own nights/score/streak/goals/pattern plus score-level leaderboard and squad standings; declines off-topic and medical questions (crisis -> 988), ignores rule-override attempts, 30 messages / 5 min per user, data-snapshot fallback. App: `api.chat()` + keyword mock; `SomniButton`/`SomniChat` (`src/components/SomniChat.tsx`, sparkles icon in the Home header next to the calendar -> native page-sheet chat with suggestion chips and a mic). P3 to review the UI.
- P2 Sharvil (`p2/somni-voice`, PR open): **voice Somni**. Tap the mic in the Somni chat, speak, tap stop: `POST /ai/transcribe/{user_id}` (raw m4a body, ElevenLabs Scribe `scribe_v2`, 20 recordings / 5 min, 3 MB cap) -> text -> `POST /ai/chat/{user_id}` with `speak: true` -> `ChatReply.audio_url` (ElevenLabs TTS, cached MP3 served from `/ai/audio/`) auto-plays. New fields `ChatRequest.speak`, `ChatReply.audio_url` and model `Transcript` (additive, Promit to OK). **Render's `ELEVENLABS_API_KEY` must have Speech to Text enabled** (new key).

## Next up
- Everyone: scan the QR (`npx expo start --tunnel`) in Expo Go; the new UI is not yet verified on a phone.
- P1 Promit: build the Shortcut and test a real sync; then streaks/badges, v3 continuous aggregate + compression.
- Teammates: copy `DATABASE_URL` from Promit (never commit) or leave it unset to run on in-memory demo data.
- P2: Devpost + `docs/`.
- P3: merge PR #5; app icon + splash; wind-down notification; switch Improved / Squads boards to the real endpoints once P2 regenerates types.
- P3 (from P2): wire screens to the new client: login -> `api.login()` (drop the hard-coded password check), Trends/Achievements -> `api.history()` (drop `SAMPLE_NIGHTS`/`SAMPLE_BEST_STREAK`), Profile goals/privacy -> `api.prefs()/savePrefs()`, Log sleep sheet -> `api.logSleep()`. Mock names now match the backend's 8 demo friends. Part 2: Squad sheet -> `api.mySquad/createSquad/joinSquad/leaveSquad/squad(code)` (demo codes WOLF23, OWLS42, RATS17); friend sheet -> `api.friendCard(id)` (`details` is null when the friend doesn't share); Profile Apple Health row -> `api.syncStatus()`; "Delete my data" -> `api.deleteMyData()` shown ONLY when `!user.is_demo`, behind a confirm that says the account is deleted, then go to login.
- P1 (asks from P3): nightly bed/wake times for past nights, best streak, previous rank (for rank arrows); endpoints to save targets, privacy toggles, manual logs, squads; delete-my-data; real login. Until then the app uses labelled sample data (`app/src/data/sample.ts`) and in-memory state.

## Blockers / decisions needed
- Enable Gemini billing before the demo (free tier ran out on gemini-3.8-flash; fallback models + template exist).
- Shortcut is not built yet (P1, phone needed); its header is now `X-Ingest-Token`, see `shortcut/README.md`.
- Teammates need collaborator access to the GitHub repo (Promit adds them).
- P2 / P3 names are placeholders in the docs; the team knows who they are.

## How to run right now
- **Production backend (Render, always on, permanent URL): https://sleep-squad-api.onrender.com** (service `sleep-squad-api`, Ohio, next to Tiger Cloud). Use it everywhere: in `app/.env` set `EXPO_PUBLIC_API_URL=https://sleep-squad-api.onrender.com` and `EXPO_PUBLIC_USE_MOCKS=false`; the iOS Shortcut's URL step is `https://sleep-squad-api.onrender.com/sleep/shortcut` (header `X-User-Id`).
  - Deploys automatically from `main`. Its env vars (DATABASE_URL, AUTH_SECRET, GEMINI/ELEVENLABS keys, STRICT_PRIVACY) live in the Render dashboard (service -> Environment), never in git. Roll back from the Deploys tab.
  - Free plan sleeps after 15 min idle (first request then takes 30-60 s), so a monitor should ping `/health` every 5 min. `GET /health?deep=true` also checks the database.
  - After a demo, `python scripts/reset_demo.py` (from `backend/`) restores the demo friends without touching real accounts.
- Backend: `cd backend; .\.venv\Scripts\Activate.ps1; uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
- App: `cd app; npx expo start --tunnel` (`app/.env.example` points at the live API with mocks off)
- Expo tunnel: `npx expo start --tunnel` (`@expo/ngrok` is now an app devDependency, so there is no install prompt). Promit's real user is id 9 (`X-User-Id: 9`); do not run `seed.py --reset` or it is wiped.

## Known bugs / notes
- `npx expo lint` and `npm run typecheck` run. Lint has 1 error in the template file `app/src/hooks/use-color-scheme.web.ts` (setState in effect, web only); not ours, fix when touching web.
- `openapi-typescript` runs via `npx` in `npm run gen:api` (its peer range rejects TypeScript 6, so it is not a devDependency).
- Nothing verified on a phone yet; the real UI check is in Expo Go.
- `scripts/seed.py` works (`--reset` wipes and reseeds). The DB has the Tiger-managed `pg_buffercache` tables too; ignore them.
- Tests use the real DB when `DATABASE_URL` is set; `shortcut` test uses an in-memory `Store`.
- Gemini free tier is 5 requests/min per model; the per-night cache keeps it fine, but a cold first briefing can take ~3-13 s (the card shows "Writing your briefing..."). Needs `GEMINI_API_KEY` in `backend/.env`; without it the template text is returned.
- CLAUDE.md "Design brief" still says Frutiger Aero / Liquid Glass and "pick-your-user"; the app now uses the black/white design and a login screen. Needs a team decision + doc update.
- App: login, targets, logged nights and squads are in memory only (lost on reload). Sleep stages are demo data. Rank arrows compare against the previous night's ranking. Improved / Squads boards are computed in the app until the real endpoints are wired.

Last updated: 2026-10-11, Sharvil (P2)