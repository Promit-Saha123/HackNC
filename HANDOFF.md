# HANDOFF

Update this at the end of every work block (and every Claude session).

Last updated: 2026-10-11, Pranav (P3). Deadline: Devpost 10:00 AM Sun Oct 11, submit by 9:45. Video max 2 min.

## Current state at a glance
- **App name is now Somni** (was "Sleep Squad"). User-facing strings, `app.json` name, icon and splash are updated. The iOS Shortcut is still called "SleepSquad Sync" (P1 owns it; renaming it means changing `SHORTCUT_URL` in `app/src/components/sheets/LogSleepSheet.tsx` too).
- **Last tag:** v0 (scaffold). No v1/v2/v3 tags yet.
- **Main** has all P1 backend work through PR #18 (`p1/demo-safety`) and P2's briefing + insight.
- **P3 work is NOT on main yet.** It lives on `p3/api-catchup` (pushed, PR open; includes everything from `p3/design-system` / PR #5, so #5 can be closed).

## Branches (P3)
| Branch | State | What's on it |
| --- | --- | --- |
| `p3/design-system` | Pushed, PR #5 open. Last commit `34e2b72` (merged `origin/main`). | Full redesign, glass, sky backdrop, login, all 5 tabs, pop-ups. |
| `p3/api-catchup` | Pushed, rebased on `origin/main`, PR open. Branched from `p3/design-system` (includes it). ~30 modified files + 2 new (`InsightCard.tsx`, `sheets/AccountSheet.tsx`). | App wired to the real backend + latest frosted glass, swipe-down pop-ups, night-only sky. |

**To ship P3:** phone-test `p3/api-catchup` against Render (mocks off), merge its PR, close #5.

## Done

### P1 Promit (backend, merged to main)
- Backend with seeded demo data (8 users x 60 nights), scoring, overview + leaderboard, Shortcut parser.
- Tiger Cloud live: schema applied and seeded (both hypertables); `store.py` picks `SqlStore` when `DATABASE_URL` is set, else the in-memory `Store` (a fresh clone still runs). Compression policies + `weekly_leaderboard` continuous aggregate; `scripts/compression_demo.py` for the demo.
- Leaderboards: `period=week|all`, `period=improved` (this week vs last week, improvers only), `/leaderboard/squads` (average member score).
- `best_streak`, `prev_rank`, per-night bed/wake in `/history`; goal-aware scoring; strict privacy switch.
- Auth: `POST /auth/login`, `POST /auth/signup`, `GET /auth/me`, password change (scrypt hashes, signed 30-day bearer tokens). Demo profiles share password `sleepsquad`. Real users: `python scripts/set_password.py <name> <pw>`. Needs `AUTH_SECRET` in `backend/.env`.
- `/me/prefs` (goals + privacy; hidden users leave all leaderboards), `POST /me/sleep` (manual log; send LOCAL times without a UTC offset), `/me/squad` (get / create / join / leave / members; demo codes WOLF23, OWLS42, RATS17), `DELETE /users/{id}/data` (own token only), friend card, sync status.
- `POST /ingest/token` + `X-Ingest-Token` header on `/sleep/shortcut` (real users need it; demo profiles may still send `X-User-Id`).
- PR #18: demo reset script, deep health check, upload size cap. DB migrations `db/003`-`007` applied to Tiger Cloud.

### P2 Sharvil (AI / API client)
- Gemini morning briefing (`backend/app/integrations/gemini.py`): structured JSON, compares only to the user's own baseline, model fallbacks (3.8 -> 3.5 -> 3.5-lite -> 3.7 flash, skipping models over daily quota), template fallback, cached per night. Tests block live Gemini (`tests/conftest.py`).
- Weekly insight `GET /ai/insight/{user_id}` (`integrations/insight.py`): strongest pattern in the last 28 nights found in code (bedtime before midnight, weekend drift, week trend, else steady); Gemini only phrases it.
- App side: regenerated `schema.ts`, `api.squadLeaderboard()`, `period: 'improved'`, `api.insight()` + mocks.
- API client catch-up (PRs #19, #20, merged): login/signup/logout/me, history, profile/updateProfile/changePassword, prefs, logSleep, squads, friendCard, syncStatus, ingestToken, deleteMyData; `ApiError` / `isAuthError` in `src/api/errors.ts`. Mocks mirror the backend's 8 demo friends x 60 nights.
- ElevenLabs Listen button (PR #23, merged): in the briefing sheet (`BriefingCard.tsx`), plays the cached MP3 with the user's auth header.
- P1: WHOOP backend (PR #24, merged): OAuth connect, sleep sync, webhook, disconnect (`routes/whoop.py`, `db/008_whoop.sql`). No app UI yet.

### P3 Pranav (app UI): design (`p3/design-system`)
- **Look:** Frutiger Aero on iOS Liquid Glass over a night sky. Font: Plus Jakarta Sans. White text with soft shadows.
- **Background** (`components/Backdrop.tsx`, `utils/sky.ts`, `state/sky.tsx`): drawn SVG scene behind every screen and the login screen. Night sky gradient, ~90 stars, crescent moon with glow and craters, wooded island on the horizon, faint far hills, ocean with ripples and a moon reflection, broad tropical leaves on the left, slowly drifting clouds. **Night only**, fixed at about 3:30 am (`NIGHT_HOUR` in `state/sky.tsx`; change it to move the moon). Day-mode code (sun, bubbles, dawn/dusk colors) still exists in `utils/sky.ts` and `Backdrop.tsx` but is never shown.
- **Glass** (`components/Glass.tsx`), one recipe everywhere: `expo-glass-effect` `GlassView` (regular, light scheme) with a frosted sky-blue tint, soft top glow, bright bottom edge, clean white rim and inner bevel. Without Liquid Glass it falls back to a translucent blue card. The `solid` prop adds an opaque backing (used by pop-ups). Callers cannot override the tint, on purpose, so every surface matches.
- **Reusable components:** `Screen` (backdrop, title row, scroll, pull-to-refresh), `Section`, `Card` (glass; optional `onPress` / `highlight`), `IconCircle` (glass orb), `GlassIconButton`, `GlassBubble` (big glass sphere behind the Home ring), `GlossCap`, `GradientButton` / `OutlineButton`, `Segmented` (sliding pill switcher), `Stepper` (+/- with hold to repeat), `TextField`, `ProgressBar`, `Avatar` (initial + gradient ring), `BadgeHex`, `Podium`, `RankChange`, `NightBarChart`, `SleepRing`, `Logo`, `ActionBar`.
- **Pop-ups** (`components/Sheet.tsx`): bottom sheet with a solid frosted panel and a lift shadow over a dimmed screen. **Swipe down to close** (gesture-handler pan + reanimated; closes past 110 pt or on a flick, springs back otherwise), scrollable content (pulling down at the top drags the sheet), close (X) button, tap outside to close, keyboard-aware. Sheets in `components/sheets/`: Night (ring breakdown), Calendar, LogSleep, Targets, Squad, Friend, Info, Account.
- **Login** (`src/app/login.tsx`): Somni logo (moon + stars), log in, create account (name, email, username, password, confirm, inline validation), forgot password sheet, demo account chips. A dark wash behind the form keeps it readable.
- **Tabs** (`src/app/(tabs)/`; native tab bar, Liquid Glass on iOS 26+):
  - **Home:** glass bubble holding a double ring. Outer = "night clock" (bedtime-to-wake arc on a 12 h dial over the faint target window). Inner = sleep-stage segments. Score in the center; tap for the full breakdown. Morning briefing row (tap for full text), weekly insight card, Quick recap tiles (time slept, streak), action bar (Log sleep, Targets, Squads), sleep log, calendar button.
  - **Leaderboard:** Weekly / All-time / Improved / Squads, podium for the top 3, rank arrows, friend card on tap, info button.
  - **Trends** ("Sleep journey"): Score / Time in bed / Bedtime bar charts (glass-tube bars), stat cards, sleep distribution; every element taps for details.
  - **Achievements:** streak ring card, best streak, 2x2 hex badges (Moon 3, Cloud 7, Rainbow 14, Aurora 30), recent unlocks, badge detail sheet.
  - **Profile:** header, stats, sleep goals, log a night, squad, privacy toggles, Apple Health / Shortcut key, account editing, delete my data, log out.
- **Assets:** `assets/images/icon.png`, `splash-icon.png`, `favicon.png` regenerated as the moon + stars mark; `app.json` points iOS at `icon.png`. Expo Go shows its own icon; the splash is visible.
- **Dependencies** (P3 owns `package.json`): added `@expo-google-fonts/plus-jakarta-sans`, re-added `expo-glass-effect`, removed `expo-blur`. Already installed and now used: `react-native-gesture-handler`, `react-native-worklets`, `react-native-svg`, `expo-linear-gradient`, `expo-symbols`.

### P3 Pranav: API catch-up (`p3/api-catchup`, PR open)
- `src/api/`: merged `origin/main` and took P2's client (#19, #20) over our own version; screens now call P2's names (`profile`, `updateProfile`, `logSleep`, `deleteMyData`, `logout`). The client keeps the token itself.
- Real login/signup (`state/user.tsx`, token in memory), goals + privacy saved via `/me/prefs` (`state/prefs.tsx`, optimistic with rollback), Log sleep -> `POST /me/sleep`, real squads (create / join / leave / members / share code), Improved / Squads boards and rank arrows from the API, friend card details, weekly insight card on Home, Trends / calendar / achievements from `/history`. Profile: edit profile, change password, Shortcut key (share sheet), sync status, delete my data.
- `useOverview()` (`hooks/use-overview.ts`) loads the overview + 60 nights of history and refetches on pull-to-refresh, app foreground and after any user change (`version` bump).
- Sample data removed except the stage split for hand-logged nights. Typecheck + lint clean (except the known template error), iOS bundle builds, mock flows smoke-tested. **Not yet tested against the live backend or end-to-end on a phone.**

## In progress
- **P3 Pranav:** `p3/api-catchup` PR open; phone-test against Render (mocks off), merge.
- **P1 Promit:** iOS Shortcut + real sync test through the tunnel.
- **P2 Sharvil:** Devpost, `docs/`, demo video. ElevenLabs Listen button merged (#23; plays when the backend has an ElevenLabs key).

## Next up
- **Everyone:** phone-test `p3/api-catchup` in Expo Go (QR command below).
- **P3:**
  1. Merge the `p3/api-catchup` PR after a phone test; close #5.
  2. Test with `EXPO_PUBLIC_USE_MOCKS=false` and `EXPO_PUBLIC_API_URL=https://sleep-squad-api.onrender.com` in `app/.env`.
  3. Wind-down local notification (target bedtime minus 30 min; `expo-notifications` is installed).
  4. Delete unused template files: `components/animated-icon*`, `hint-row`, `web-badge`, `external-link`, `themed-text`, `themed-view`, `ui/collapsible`, `hooks/use-theme`, `hooks/use-color-scheme*`, `constants/theme.ts`. They only reference each other; removing `use-color-scheme.web.ts` also clears the one lint error.
  5. Optional: remove the unused day-mode code from `utils/sky.ts` / `Backdrop.tsx` now that night-only is final.
- **P1:** keep the tunnel URL here current. Real users' Shortcut sends `X-Ingest-Token` (Profile > Shortcut key shares it).
- **P2:** mock fixture names to match the demo story; ElevenLabs if time allows.
- **Team:** update CLAUDE.md. It still says "Sleep Squad", sky-blue daytime Frutiger Aero with green accents, "pick-your-user" login, Istok Web / Hind font. Reality: Somni, night-sky Aero glass, real login, Plus Jakarta Sans.

## Blockers / decisions needed
- Enable Gemini billing before the demo (free tier ran out on gemini-3.8-flash; fallback models + template exist).
- Shortcut not built yet (P1, needs a phone); see `shortcut/README.md`.
- Decide: rename the Shortcut to "Somni Sync"? (P1 Shortcut + `SHORTCUT_URL` in the app.)
- Teammates need collaborator access to the GitHub repo (Promit adds them).
- P2 / P3 names are placeholders in the docs; the team knows who they are.

## How to run right now
- **Production backend (Render, always on, permanent URL): https://sleep-squad-api.onrender.com** (service `sleep-squad-api`, Ohio, next to Tiger Cloud). Use it everywhere instead of the tunnel: in `app/.env` set `EXPO_PUBLIC_API_URL=https://sleep-squad-api.onrender.com` and `EXPO_PUBLIC_USE_MOCKS=false`; the iOS Shortcut's URL step is `https://sleep-squad-api.onrender.com/sleep/shortcut` (header `X-User-Id`).
  - Deploys automatically from `main`. Its env vars (DATABASE_URL, AUTH_SECRET, GEMINI/ELEVENLABS keys, STRICT_PRIVACY) live in the Render dashboard (service -> Environment), never in git. Roll back from the Deploys tab.
  - Free plan sleeps after 15 min idle (first request then takes 30-60 s), so a monitor should ping `/health` every 5 min. `GET /health?deep=true` also checks the database.
  - After a demo, `python scripts/reset_demo.py` (from `backend/`) restores the demo friends without touching real accounts.
  - The cloudflared tunnel below is now only a fallback.
- **Backend:** `cd backend; .\.venv\Scripts\Activate.ps1; uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`. Copy `DATABASE_URL` from Promit into `backend/.env` (never commit), or leave it unset to run on in-memory demo data.
- **Backend tunnel (fallback only)** (cloudflared, URL changes every run): last known https://quebec-clone-translations-experience.trycloudflare.com (restarted 2026-10-11 02:22 UTC). `cloudflared` lives at `C:\Program Files (x86)\cloudflared\cloudflared.exe`. Promit's real user is id 9; do not run `seed.py --reset` or it is wiped.
- **App** (from `app/`): `npm install` once, copy `.env.example` to `.env` (mocks on by default), then:
  ```powershell
  npx expo start --tunnel --clear --max-workers 2
  ```
  Scan the QR with the iPhone Camera; it opens in Expo Go. Fast Refresh updates the phone on save. Re-run only after closing the terminal, a crash, or a package / `app.json` change.
- **Use `--max-workers 2` on Windows:** Metro starts one worker per CPU thread (22 on Pranav's machine) and ran Node out of memory ("Zone Allocation failed - process out of memory"). If memory is still tight, close Chrome tabs and run `wsl --shutdown`.
- **PowerShell "running scripts is disabled":** use `npx.cmd`, or `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.
- **`--tunnel` needs an Expo account:** `npx expo login` once.
- **Checks:** `npx tsc --noEmit`, `npx expo lint`, bundle check `npx expo export --platform ios --output-dir <tmp dir> --max-workers 1`. If tsc complains about the `/login` route type, run `npx expo start` once to regenerate `.expo/types`.

## Known bugs / notes
- Lint: 1 error in the template file `app/src/hooks/use-color-scheme.web.ts` (setState in effect, web only). Not ours; goes away when the template files are deleted.
- The sign-in token is in memory only, so reloading the app (including a full Fast Refresh reload) signs you out. `expo-secure-store` would fix it (needs a dependency OK).
- Hand-logged nights show typical stage proportions on the ring (real stages for synced nights). Forgot password has no reset flow (no email stored); the sheet says so.
- The round gear bubble in phone screenshots is Expo Go's developer menu, not our UI.
- `openapi-typescript` runs via `npx` in `npm run gen:api` (its peer range rejects TypeScript 6, so it is not a devDependency).
- `scripts/seed.py` works (`--reset` wipes and reseeds). The DB also has Tiger-managed `pg_buffercache` tables; ignore them. Tests use the real DB when `DATABASE_URL` is set; the shortcut test uses an in-memory `Store`.
- Gemini free tier is 5 requests/min per model; a cold first briefing can take 3-13 s (the card shows "Writing your briefing..."). Without `GEMINI_API_KEY` the template text is returned.
- Two Claude sessions worked in the same folder on 2026-10-11 (design + API catch-up). For parallel sessions, use one git worktree per branch so they can't overwrite each other.
