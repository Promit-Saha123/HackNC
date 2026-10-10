# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Sleep Squad — HackNC 2026

## Project
- iPhone app where friends compete on sleep: overview, 0–100 nightly score, leaderboards, streaks, AI morning briefing read aloud.
- Pitch: "All-nighters are campus culture. We made sleep the thing your friends compete on instead."
- Prizes: Best Community Hack, Frutiger Aero, Tiger Data (primary), Gemini API, ElevenLabs. Solana only if v4 lands.
- Deadline: Devpost 10:00 AM Sun Oct 11; submit by 9:45. Video max 2 min. Judges score impact, functionality/UI polish, creativity, technical complexity (we must explain our code), presentation.
- Team of 3 on Windows (PowerShell), no Mac/Xcode. App runs in Expo Go on iPhones (iOS 26). No native builds, no HealthKit.
- Repo root is `HackNC/` (GitHub: Promit-Saha123/HackNC), not `sleep-squad/`.

## Run
- Backend (from `backend/`): `py -3.12 -m venv .venv; .\.venv\Scripts\Activate.ps1; pip install -r requirements.txt` once, then `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`.
- Backend tests: `pytest`; single: `pytest tests/test_health.py::test_health`.
- Apply DB schema / seed: `python scripts/apply_schema.py`, `python scripts/seed.py` (needs `DATABASE_URL` in `backend/.env`).
- Export contract: `python scripts/export_openapi.py` → `shared/openapi.json`.
- Tunnel (phones + Shortcut): `cloudflared tunnel --url http://localhost:8000`. URL changes every run; put it in `app/.env` (`EXPO_PUBLIC_API_URL`), the Shortcut URL action, and HANDOFF.md.
- App (from `app/`): `npm install`, `npx expo start --tunnel`, scan QR in Expo Go. `npx expo start --web` is a rough layout check only.
- Regenerate API types (from `app/`): `npm run gen:api` (never hand-edit `src/api/schema.ts`).
- Env: copy `backend/.env.example` → `backend/.env`, `app/.env.example` → `app/.env`. Never commit either.
- `.claude/settings.json` enables the `ecc` plugin.

## Architecture
- `app/` (Expo, React Native, TypeScript, Expo Router tabs) → FastAPI `backend/` → Tiger Cloud.
- Real sleep: iOS Shortcut "SleepSquad Sync" reads Apple Health Sleep Analysis (last 7 days) and POSTs plain text to `POST /sleep/shortcut` (header `X-User-Id`; one line per sample `start_iso|end_iso|value`; values Core, Deep, REM, Awake, InBed, Asleep). Backend merges samples into one night per user.
- App Sync button opens `shortcuts://run-shortcut?name=SleepSquad%20Sync` via expo-linking, then refetches when AppState returns to active.
- Backend calls Gemini (briefing text, structured JSON) and ElevenLabs (MP3, cached, served at `/ai/audio/{file}`). API keys live only in `backend/.env`, never in the app.
- All sources (seed, shortcut, whoop) write the same normalized `sleep_sessions` row.
- Endpoints: `/health`, `/users`, `/users/{id}/overview`, `/leaderboard?period=week|all&squad=`, `POST /sleep/shortcut`, `/ai/briefing/{user_id}`, `/ai/audio/{file}`.
- Contract = Pydantic models in `backend/app/models.py` → `shared/openapi.json` → `app/src/api/schema.ts`.
- Screens use `mockClient.ts` while `EXPO_PUBLIC_USE_MOCKS=true`; `client.ts` hits `EXPO_PUBLIC_API_URL`.

## Tech stack
- App: Expo latest SDK, TypeScript, Expo Router; expo-glass-effect (GlassView/GlassContainer) with expo-blur fallback; expo-linear-gradient; react-native-reanimated; lottie-react-native; react-native-gifted-charts + react-native-svg; expo-audio; expo-haptics; expo-notifications (local only); expo-linking; expo-font; expo-auth-session (v4 Whoop).
- Backend: Python 3.12, FastAPI, Uvicorn, psycopg pool, pydantic-settings, google-genai, elevenlabs, httpx, numpy, pandas, pytest.
- DB: Tiger Cloud (Postgres + TimescaleDB). Tables: `users`, `sleep_sessions` (hypertable), `daily_scores` (hypertable). v3: continuous aggregate `weekly_leaderboard` (`time_bucket('1 week')`) + compression policy; show compression ratio in demo.
- Auth: pick-your-user demo login. v3 adds a per-user ingest token.

## Scoring
- score = 40·D + 30·C + 20·Q + 10·S, each part 0–1 (formula lives in `backend/app/scoring.py`).
- D duration: 1.0 inside 7–9 h; linear to 0 at 5 h; no bonus above 9 h; small taper above 10 h.
- C consistency: 1.0 within 30 min of the user's 7-day average bedtime; 0 at 2 h off.
- Q quality: efficiency = asleep / in bed.
- S streak: min(streak / 14, 1).
- Streak night = 7 h+ and within 1 h of usual bedtime. Badge tiers 3/7/14/30 nights (moon, cloud, rainbow, aurora). Streaks via gaps-and-islands query.
- Leaderboards: weekly (resets Monday), all-time, most improved, squad vs squad (average member score). No "worst sleeper" board ever.

## Privacy rules (enforce in code and copy)
- Shortcut reads Sleep Analysis only; send only start, end, stage. No heart rate, HRV or other Health types.
- Friends see score + streak only.
- Gemini compares a user only to their own baseline; no medical claims; include a one-line not-medical-advice note.
- Synthetic friends are labelled demo profiles (`users.is_demo`).
- "Delete my data" removes a user's rows.

## Design brief
"Frutiger Aero, 2008, built with iOS 26 Liquid Glass via expo-glass-effect: sky-blue to white gradients, glossy glass cards, rounded corners, drifting clouds and bubbles, green accents, optimistic and calm. No dark-mode cyberpunk, no flat corporate grey."
- Always guard GlassView with `isGlassEffectAPIAvailable()`; fall back to BlurView.
- Home "dream sky" shifts with last night's score: clear blue + sun for great sleep, clouds + dusk for bad.
- Font: humanist sans (Istok Web or Hind) via expo-font.
- Real UI check is on a phone in Expo Go; web preview shows glass as blur.

## Features by slice
Each slice is a complete, demoable app merged to main and tagged. Never start the next slice while main is broken.
- v1 (11:30 PM Sat): Expo Go app, pick-your-user, seeded friends (6–8 × 60 nights: weekend drift, exam-week crash, one night owl, one perfect sleeper), scoring + `daily_scores`, overview (last night + 7-day chart), weekly leaderboard, basic glass cards. Tag v1.
- v2 (3:30 AM Sun): Shortcut sync + parser, one-tap Sync button, Gemini briefing + ElevenLabs audio in app, streaks + badges, dream sky, rank-up haptic. Tag v2, then record a backup demo video.
- v3 (7:00 AM Sun): squads, most improved, weekly Gemini insight ("you sleep 45 min more when you stop studying by midnight"), wind-down local notification at bedtime minus 30 min, per-user ingest token, continuous aggregate + compression, animation polish. Tag v3.
- v4 (only if v3 done by 6 AM): Whoop OAuth, Wii-style ElevenLabs rank announcer, floating cloud leaderboard, Solana devnet streak badge.
- A slice is done only when it runs from a fresh clone and a teammate clicked through it. If a slice runs 1 h late, cut its lowest feature and tag anyway. Hard stop on features at 7:30 AM; after that only video, Devpost, README.

## Ownership (only the owner edits these files)
- P1 Promit — data/backend/Shortcut: `backend/db/`, `backend/app/routes/{sleep,leaderboard,ingest}.py`, `backend/app/scoring.py`, `backend/scripts/`, `shortcut/`.
- P2 — AI/API client/submission: `backend/app/routes/ai.py`, `backend/app/integrations/`, `app/src/api/` (client, mocks, generated schema.ts), `docs/`, Devpost, demo video.
- P3 — app UI/design: everything else in `app/` (`app/(tabs)/`, `src/components/`, `src/theme/`, `assets/`, `app.json`, `package.json`, `package-lock.json`).
- Hotspots: `models.py`, `shared/openapi.json`, `main.py` → P1. `package.json`, lockfile, `app.json` → P3. Anyone else posts the change in team chat; the owner makes a tiny PR.
- If asked to change a file you don't own: stop, explain the needed change, and draft it for the owner instead.

## Git workflow
- Branches: `p1/<task>`, `p2/<task>`, `p3/<task>`; 1–2 hours of work each; no branch lives over 2 hours.
- Before a PR: `git fetch && git rebase origin/main`; run the backend and open the app in Expo Go.
- Merge small PRs to main once they run; one teammate glance is enough.
- Contracts are additive only: add fields, never rename or remove mid-slice. After a contract change, P1 exports openapi.json and P2 runs `npm run gen:api`.
- Only P3 runs `npx expo install`. Lockfile conflict: take main's version, P3 re-runs install. Never hand-merge lockfiles.
- `.gitattributes` enforces LF endings. Never commit `.env` or `app/.env`.
- Several Claude Code sessions: one git worktree per branch; one Expo dev server at a time or separate ports.
- At each slice target: freeze merges 15 min, run main from a fresh clone, tag.

## Agent rules
- Run tests / start the server before claiming done.
- Keep diffs small and inside your owner's folders.
- Ask before adding any dependency.
- Update HANDOFF.md at the end of every work block: current slice + tag, done, in progress (who/branch/files), next per person, blockers, how to run now (incl. tunnel URL), known bugs, last updated.
- Do not edit `app/CLAUDE.md` or `app/AGENTS.md` (generated by create-expo-app).
