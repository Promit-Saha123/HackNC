# Somnia

**All-nighters are campus culture. Somnia makes sleep the thing your friends compete on.**

Somnia is an iPhone app where friends compete on sleep: a nightly 0-100 score, streaks and badges, leaderboards and squads, an AI morning briefing that reads itself aloud, and Somni, an AI sleep coach you can type to or talk to. Built for HackNC 2026.

- **Live API:** https://sleep-squad-api.onrender.com (interactive docs at [`/docs`](https://sleep-squad-api.onrender.com/docs))
- **Source:** https://github.com/Promit-Saha123/HackNC

## Overview
Sleep apps are built for one person, and nobody holds a student accountable. Somnia makes sleep social: your Apple Watch sleep syncs in one tap, is scored with a transparent formula, and is ranked on weekly and all-time leaderboards next to your friends. An AI coach turns your own numbers into a morning briefing you can listen to.

The goal was to apply data engineering, time-series storage and AI to a problem students actually have, and to build it as a real product with accounts, privacy controls and a live backend.

## Features

| | |
|---|---|
| **Nightly score, 0-100** | Duration, bedtime consistency, sleep quality and your streak, all things you can actually control. |
| **Leaderboards** | Weekly (resets Monday), all-time, **most improved**, and **squad vs. squad**. There is deliberately no "worst sleeper" board. |
| **Squads** | Create a squad, share its invite code, and compete with friends. |
| **Streaks and badges** | A streak night is 7+ hours within an hour of your usual bedtime. Badges at 3, 7, 14 and 30 nights: moon, cloud, rainbow, aurora. |
| **AI morning briefing** | Gemini writes a short recap of your night, compared only with *your own* recent nights. ElevenLabs reads it aloud. |
| **Weekly insight** | Finds your strongest pattern in the last 28 nights, in code, and Gemini phrases it as one friendly tip. |
| **Somni, your sleep coach** | Ask it about your own data by typing or by voice. It refuses off-topic and medical questions. |
| **Real sleep data** | Apple Health via a one-tap iOS Shortcut, WHOOP via OAuth, or log a night by hand. |
| **Real accounts and privacy** | Sign up, edit your profile, hide from leaderboards, delete your account and all its data. |

## Tech Stack
- **App:** Expo (React Native), TypeScript, Expo Router, Reanimated, react-native-gifted-charts, expo-audio, expo-haptics
- **Backend:** Python 3.12, FastAPI, Uvicorn, Pydantic, psycopg
- **Database:** Tiger Cloud (Postgres + TimescaleDB): hypertables, a continuous aggregate and compression
- **AI:** Google Gemini (briefing, weekly insight, Somni) and ElevenLabs (text-to-speech and speech-to-text)
- **Integrations:** iOS Shortcuts (Apple Health sleep) and WHOOP OAuth
- **Hosting and tooling:** Render, Expo Go, pytest, OpenAPI to generated TypeScript types

## How It Works

```
  iPhone (Expo Go)           iOS Shortcut                 WHOOP
  React Native app      (Apple Health sleep only)    (OAuth, sleep only)
        |                          |                       |
        +--------------------------+-----------------------+
                                   |
                        FastAPI backend on Render
              scoring - auth - leaderboards - squads - privacy
                  |                |                 |
                  v                v                 v
        Tiger Cloud           Gemini API         ElevenLabs
   (Postgres + TimescaleDB)   briefing, insight,  read aloud and
                              Somni coach         speech-to-text
```

Every AI feature goes through the backend, so API keys never ship in the app. The API contract is one source of truth: Pydantic models, exported to `shared/openapi.json`, generate the app's TypeScript types.

### How the score works
```
score = 40 x duration + 30 x bedtime consistency + 20 x quality + 10 x streak      (each part 0 to 1)
```
- **Duration:** full marks for 7-9 hours (it follows your own hours goal), falling to zero at 5 hours.
- **Consistency:** full marks within 30 minutes of your 7-night average bedtime, zero at 2 hours off.
- **Quality:** time asleep divided by time in bed.
- **Streak:** your current streak divided by 14, capped at 1.

### Real sleep data without HealthKit
Expo Go cannot read Apple Health, and none of us has a Mac. An **iOS Shortcut** reads *only* Sleep Analysis (start, end, stage) and POSTs it as plain text to `POST /sleep/shortcut`. The backend merges stage samples into one night per wake date. Setup: [`shortcut/README.md`](shortcut/README.md). **WHOOP** uses a backend-side OAuth flow that requests only `read:sleep`, `read:profile` (just the user id) and `offline`; new nights sync through a signed webhook.

## Built on Tiger Data (TimescaleDB)

- **Hypertables:** `sleep_sessions` and `daily_scores`, partitioned by time.
- **Continuous aggregate:** `weekly_leaderboard` (`time_bucket('1 week')`, Monday start) is a real-time aggregate, so a fresh sync counts immediately. It powers the "most improved" board and week-over-week comparisons.
- **Compression:** chunks older than 14 days are compressed, segmented by user.
- **Indexes:** per-user `(user_id, time)` indexes make overview, history, streaks and rescoring index reads instead of scans.
- **Tuned with measurements, not guesses.** One night per user per day means 7-day chunks hold only about 7 rows per user, which compressed *worse than not compressing* (0.8x). Moving to 90-day chunks fixed it. `backend/scripts/compression_demo.py` reproduces the numbers on **synthetic** data (109,500 rows) in its own table:

  | Chunk length | Size before -> after | Ratio |
  |---|---|---|
  | 7 days | 15.1 -> 17.8 MB | 0.8x |
  | 30 days | 13.2 -> 7.5 MB | 1.8x |
  | **90 days** (what we use) | 12.9 -> 5.4 MB | **2.4x** |
  | 365 days | 12.8 -> 3.9 MB | 3.3x |

  The synthetic values are random, which compresses less than real sleep data would, so treat these as a floor.

## AI: Gemini and ElevenLabs

- **We compute every number in code and let the model only phrase it.** The briefing, weekly insight and Somni all receive a fact sheet built from the user's own data, so the AI cannot invent statistics.
- **Gemini** uses structured JSON output with a fallback chain across Flash models (skipping any that hit their daily quota) plus a plain template, so the app never breaks when a quota runs out. Briefings and insights are cached per night.
- **ElevenLabs** text-to-speech reads the briefing and Somni's answers; **Scribe** speech-to-text powers push-to-talk.
- **Safety:** Gemini compares you only to yourself, makes no medical claims, ends with a not-medical-advice note, and Somni declines off-topic and medical questions.

## Privacy

- The Shortcut reads **Sleep Analysis only**. No heart rate, HRV or any other Health type.
- Friends see your **score and streak**. Bedtime and hours appear only if you opt in.
- You can hide from every leaderboard and squad list, and **delete your account and all its data**.
- Demo profiles are labelled and read-only. Passwords are stored as salted scrypt hashes.
- A strict-privacy mode (detailed sleep data readable only by its owner) is built into the backend and ships off until the app sends the token on every call.

## What We Learned
- Modeling time-series data with TimescaleDB, and measuring chunk sizes instead of guessing (7-day chunks compressed worse than no compression)
- Computing every number in code and letting the model only phrase it, so the AI cannot invent statistics
- Designing a contract-first API where the backend's Pydantic models generate the app's TypeScript types
- Working around Expo Go's limits with an iOS Shortcut instead of HealthKit
- Building privacy into the data model and endpoints, not only the copy
- Splitting work across three people with branches, file ownership and small PRs

## Future Improvements
- Persistent rate limiting and a paid hosting plan so the API never sleeps
- Push reminders to wind down before bedtime

## Running the Project
### 1. Run the app (Expo Go)

The app runs in **Expo Go** on an iPhone and talks to the live API above, so there is nothing to host.

1. Install **Expo Go** from the App Store. You need Node.js (LTS).
2. ```powershell
   git clone https://github.com/Promit-Saha123/HackNC.git
   cd HackNC\app
   npm install
   copy .env.example .env
   ```
3. In `app\.env`, set the two lines that point the app at the live API:
   ```
   EXPO_PUBLIC_API_URL=https://sleep-squad-api.onrender.com
   EXPO_PUBLIC_USE_MOCKS=false
   ```
4. ```powershell
   npx expo start --tunnel
   ```

#### Try it yourself (demo login)
Use this account to explore the full app in Expo Go, with nothing to sign up for:

| | |
|---|---|
| **Username** | `somnia-demo` |
| **Password** | `sleepy3210` |

It's a demo account on the live API, so you can look around the score, leaderboards, squads, briefing and Somni chat, log a night by hand, and join a demo squad with the code `WOLF23`. Please don't use a real password anywhere in this app.

You can also **log in** as any demo friend: `Maya`, `Jordan`, `Sam`, `Riley`, `Alex`, `Priya`, `Chris` or `Dana`, with the password `sleepsquad`. Or sign up for a fresh account.
**Join a demo squad** with the invite code `WOLF23`, `OWLS42` or `RATS17`.

The demo friends are labelled demo profiles with synthetic data. Real accounts never appear in the login screen's account list; they show up only on the leaderboards and squads they join.

### 2. Run the backend yourself (optional)

#### Backend (Python 3.12)
```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env          # leave DATABASE_URL empty to run on in-memory demo data
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
pytest                          # 100+ tests
```
API docs at http://localhost:8000/docs. With no `DATABASE_URL` the backend serves 8 demo friends from memory, so nothing else is needed. To use your own Tiger Cloud service, put its connection string in `DATABASE_URL`, then run `python scripts/apply_schema.py` and `python scripts/seed.py`.

#### Environment variables (`backend/.env`, never committed)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Tiger Cloud connection string (empty = in-memory demo data) |
| `GEMINI_API_KEY` | Briefing, weekly insight and Somni (a template is used without it) |
| `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` | Read-aloud and speech-to-text |
| `AUTH_SECRET` | Signs login tokens (set a long random value in production) |
| `WHOOP_CLIENT_ID`, `WHOOP_CLIENT_SECRET`, `PUBLIC_URL` | WHOOP OAuth (optional) |
| `STRICT_PRIVACY` | `true` limits detailed sleep data to its owner |

#### Useful scripts (run from `backend/`)

| Script | What it does |
|---|---|
| `python scripts/smoke_demo.py` | Plays a demo friend and a brand-new user through the live API and prints PASS/FAIL. Run it before a demo. |
| `python scripts/reset_demo.py` | Resets only the 8 demo friends to fresh data ending today. Never touches real accounts. |
| `python scripts/compression_demo.py` | Builds the synthetic compression table and prints the ratio. |
| `python scripts/apply_schema.py <file>` | Applies a migration from `backend/db/`. |
| `python scripts/export_openapi.py` | Regenerates `shared/openapi.json` (then `npm run gen:api` in `app/`). |

#### Deployment
The backend runs on Render (Ohio, next to Tiger Cloud) from [`render.yaml`](render.yaml), with pinned requirements and auto-deploy from `main`.

## API at a glance

Full, interactive documentation lives at [`/docs`](https://sleep-squad-api.onrender.com/docs).

| Area | Endpoints |
|---|---|
| Accounts | `POST /auth/signup`, `POST /auth/login`, `GET /auth/me`, `GET`/`PUT /me`, `POST /me/password` |
| Sleep in | `POST /sleep/shortcut`, `POST /me/sleep`, `GET /me/sync`, WHOOP: `POST /me/whoop/connect`, `GET /me/whoop`, `POST /me/whoop/sync`, `DELETE /me/whoop` |
| Your data | `GET /users/{id}/overview`, `GET /users/{id}/history`, `GET`/`PUT /me/prefs`, `DELETE /users/{id}/data` |
| Compete | `GET /leaderboard?period=week\|all\|improved`, `GET /leaderboard/squads`, `GET /squads/{code}`, `POST /me/squad`, `/me/squad/join`, `/me/squad/leave`, `GET /users/{id}/card` |
| AI | `GET /ai/briefing/{id}` (and `/audio`), `GET /ai/insight/{id}`, `POST /ai/chat/{id}`, `POST /ai/transcribe/{id}` |
| Ops | `GET /health` (`?deep=true` also checks the database) |

## Repository layout

```
app/        Expo (React Native, TypeScript, Expo Router) app
backend/    FastAPI app (routes, scoring, store, integrations), db/ migrations, scripts/, tests/
shared/     openapi.json, the contract generated from the backend models
shortcut/   iOS Shortcut setup (Apple Health -> backend)
docs/       Devpost write-up
render.yaml Render deployment blueprint
```

## Tests and quality

- **100+ backend tests** (`pytest`) covering scoring, the Shortcut parser, accounts, leaderboards, squads, privacy, WHOOP and the AI endpoints, with the live AI calls mocked.
- **A live smoke test** (`scripts/smoke_demo.py`) that exercises every endpoint the app uses against the deployed API.
- **Additive-only contract changes** and a typed Python-to-TypeScript API, so three people could build in parallel.

## Known limitations

- **Apple Health** sync uses a Shortcut, not HealthKit, because the app runs in Expo Go and none of us has a Mac.
- **Expo Go only.** There is no TestFlight or App Store build.
- **Free-tier hosting:** the Render service sleeps after 15 minutes without traffic, so the first request can take up to a minute. A health-check monitor keeps it awake.

## Team

- **Promit Saha**: data, backend, Tiger Cloud, deployment, Apple Health and WHOOP sync
- **Sharvil Desai**: AI (Gemini, ElevenLabs, Somni), API client, submission
- **Pranav**: app UI and design

Working on the repo? See [`CONTRIBUTING.md`](CONTRIBUTING.md). Current status lives in [`HANDOFF.md`](HANDOFF.md).
