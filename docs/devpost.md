# Sleep Squad: Devpost draft

> Working draft for the Devpost submission (due **9:45 AM Sun Oct 11**). Copy each section into the matching Devpost field.
> Items marked **[TODO]** need a real value before submitting. Everything else is checked against the code on `main`.

**Before submitting (checklist)**
- [ ] PR #27 (voice Somni) merged and the new ElevenLabs key (with Speech to Text) set on Render. Otherwise, cut the "talk to Somni" lines.
- [ ] Compression ratio: run `python backend/scripts/compression_demo.py` (needs `DATABASE_URL`) and fill in both **[TODO: ratio]** spots.
- [ ] Frutiger Aero: keep or delete that prize section (team decision).
- [ ] Team names, demo video link, screenshots, Expo link.
- [ ] Re-read after the 7:30 AM feature freeze and cut anything that didn't ship.
- [ ] Run `python backend/scripts/smoke_demo.py` against Render right before recording and presenting.

---

## Tagline (under 200 characters)

All-nighters are campus culture. Sleep Squad makes sleep the thing your friends compete on: nightly scores, streaks, squads, and an AI coach you can talk to.

---

## Inspiration

On our campus, pulling an all-nighter is a flex. "I slept three hours" gets a laugh; "I slept eight" gets nothing. Sleep trackers already exist, but they're private, clinical and easy to ignore: a graph you check alone and forget.

We asked what would actually make a college student go to bed. Not another lecture about health, but the same thing that gets people to the gym: **friends, competition and streaks**. So we built Sleep Squad. It turns sleep into a friendly game with your friends, and it keeps your actual sleep data private.

---

## What it does

**Sleep Squad is an iPhone app where friends compete on sleep.**

- **A nightly score from 0 to 100.** Every night is scored on four things you can actually control:
  `score = 40 × duration + 30 × bedtime consistency + 20 × quality + 10 × streak`.
  You get full duration marks at 7–9 hours and full consistency marks within 30 minutes of your usual bedtime. Quality is time asleep divided by time in bed.
- **Real sleep data, automatically.** Nights sync from **Apple Health (Apple Watch)** through a one-tap iOS Shortcut, or from **WHOOP** via OAuth. You can also log a night by hand.
- **Leaderboards and squads.** Weekly (resets Monday), all-time, **most improved**, and **squad vs. squad** (average member score, so big squads don't win by size). There is deliberately **no "worst sleeper" board**.
- **Streaks and badges.** A streak night is 7+ hours within an hour of your usual bedtime. Badges unlock at 3, 7, 14 and 30 nights (moon, cloud, rainbow, aurora).
- **An AI morning briefing, read aloud.** Every morning, **Gemini** writes a short, personal recap of your night compared only with *your own* recent nights. **ElevenLabs** reads it to you with one tap, because nobody wants to read a paragraph with half-open eyes.
- **A weekly AI insight.** The app finds your strongest pattern from the last 28 nights, like *"You sleep 2 h 33 min more on nights you're in bed by midnight,"* and Gemini turns it into one friendly tip.
- **Somni, your AI sleep coach (type or talk).** Ask *"Why was my score so low?"* or *"How do I catch up to Chris this week?"* Somni answers only from your own Sleep Squad data. You can **talk to it**: ElevenLabs speech-to-text hears your question and Somni answers out loud.
- **Privacy by design.** Friends see your score and streak, never your bedtimes or health data unless you choose to share them. You can hide from leaderboards entirely, and you can delete your account and all its data.

---

## How we built it

**App:** React Native + **Expo** (SDK 57, Expo Router, TypeScript), running in Expo Go on our iPhones. It has a typed API client generated from the backend's OpenAPI contract, plus mock data for all 8 demo friends, so the UI could be built before the backend existed. We used `expo-audio` for playback and push-to-talk recording.

**Backend:** **Python 3.12 + FastAPI**, deployed on **Render** next to our database. Pydantic models are the API contract (→ `openapi.json` → generated TypeScript types). It has signed bearer-token auth with scrypt password hashing, rate limits on login, signup and AI endpoints, and a strict-privacy mode that limits detailed sleep data to its owner.

**Database: Tiger Cloud (PostgreSQL + TimescaleDB).**
- `sleep_sessions` and `daily_scores` are **hypertables**, partitioned by time.
- A **continuous aggregate**, `weekly_leaderboard`, uses `time_bucket('1 week')` and starts on Monday, matching the weekly reset. It's a *real-time* aggregate (`materialized_only = false`), so a fresh sync shows up on the board immediately, with a refresh policy for the rest.
- A **compression policy** compresses chunks older than 14 days, segmented by user. We tuned chunk size (90-day chunks) after measuring that small chunks compressed badly, and we wrote a demo script that shows compression at scale: **[TODO: ratio from `python backend/scripts/compression_demo.py`]**.
- We added per-user indexes so overview, history, streaks and rescoring are index reads instead of scans.

**Getting real sleep data without HealthKit:** none of us has a Mac, so we couldn't build a native app with HealthKit. Instead, an **iOS Shortcut** reads *only* Sleep Analysis (start, end, stage) from Apple Health and POSTs it as plain text to our backend with a per-user ingest token. The backend merges stage samples into one night per wake date. **WHOOP** uses a backend-side OAuth flow (the client secret never touches the phone), with HMAC-verified webhooks for new nights.

**AI layer (Gemini + ElevenLabs):** every AI feature goes through the backend, so API keys never ship in the app.
- **Gemini** (`gemini-3.8-flash`) uses **structured JSON output**, with a fallback chain across several Gemini models that skips any model that has hit its daily quota, plus a template fallback so the app never breaks.
- **We compute every number in code and let Gemini only phrase it.** The weekly insight, briefing and Somni all get a fact sheet built from the user's own data, so the AI can't invent stats.
- **ElevenLabs** text-to-speech (`eleven_flash_v2_5`) reads briefings and Somni's replies, cached on disk so each text costs one call. ElevenLabs **Scribe** speech-to-text (`scribe_v2`) powers push-to-talk Somni.

**Team workflow:** three people on Windows, one role each (data/backend, AI/API client/submission, UI/design). We used small PRs, protected `main`, additive-only contract changes, and a shared HANDOFF.md updated every work block. The backend has **100+ pytest tests**, plus a smoke-test script that runs the whole demo against the live API before we present.

---

## Challenges we ran into

- **No Mac, no HealthKit.** Expo Go can't read Apple Health. The iOS Shortcut bridge solved it, but we had to handle time zones carefully: we store device-local wall-clock time so "bed at 11:40 PM" means the same thing everywhere.
- **Free-tier AI quotas at 3 AM.** We hit Gemini's daily free-tier limit mid-build. We added a model fallback chain that skips exhausted models, per-night caching, rate limits, and template fallbacks, so the app degrades gracefully instead of breaking.
- **Keeping the AI honest.** LLMs love to invent numbers. Our fix was architectural: the code finds the pattern and computes the stats, and Gemini only writes the sentence. Somni gets a data sheet and strict scope rules, and it refuses off-topic, medical and "ignore your rules" requests.
- **Voice in Expo Go.** Real-time voice agents need native modules Expo Go doesn't have, and an always-listening wake word isn't possible there. We designed push-to-talk instead: record with `expo-audio`, transcribe with ElevenLabs, answer, speak back.
- **Privacy vs. social.** A competitive app wants to show everything; a sleep app shouldn't. We drew a clear line: friends get score-level data only, everything detailed is owner-only, and that line is enforced in the backend, not just hidden in the UI.
- **Three people, one repo, one night.** Stacked pull requests got merged in the wrong order once, so a feature merged into a branch that had already landed. We caught it and re-landed it, and learned to merge bottom-up.

---

## Accomplishments that we're proud of

- A **real, deployed product**: a live backend on Render, a real database on Tiger Cloud, real sleep from an actual Apple Watch, and real accounts. It's more than a mockup.
- **AI that's grounded, not decorative.** Every AI sentence is built on numbers our code computed from your own nights.
- **You can talk to it.** Ask Somni a question out loud and hear the answer, built on ElevenLabs speech-to-text and text-to-speech.
- **Privacy enforced in the backend**, not just promised: owner-only detail, score-level friends, hide-from-boards, and real account deletion (demo profiles are protected).
- **TimescaleDB used for what it's good at:** hypertables, a real-time continuous aggregate for the weekly board, and compression tuned with real measurements.
- **Strong testing for a hackathon:** 100+ backend tests, a live smoke test, and a typed contract shared from Python to TypeScript.

---

## What we learned

- Grounding beats prompting. The biggest jump in AI quality came from giving Gemini computed facts, not from better wording.
- Design for failure early. Quotas, cold starts and flaky Wi-Fi are guaranteed at a hackathon demo, so every AI call has a fallback.
- TimescaleDB's continuous aggregates are a natural fit for leaderboards. Compression needs enough rows per chunk to pay off, so measure before you tune.
- An API contract generated from one source of truth (Pydantic → OpenAPI → TypeScript) let three people build in parallel without breaking each other.

---

## What's next for Sleep Squad

- Native HealthKit and background sync once we can build with Xcode.
- Wind-down reminders at your bedtime minus 30 minutes, and a spoken wind-down from Somni so you can put the phone face down.
- Campus-wide squad leagues (dorm vs. dorm, club vs. club) with seasonal resets.
- More data sources (Oura, Fitbit, Garmin) feeding the same normalized sleep table.

---

## Prize tracks

### Tiger Data: best use of TimescaleDB (primary)
- **Hypertables:** `sleep_sessions` and `daily_scores`, partitioned by time.
- **Real-time continuous aggregate:** `weekly_leaderboard` = `time_bucket('1 week', time)` (Monday start = weekly reset) with `materialized_only = false`, so new syncs count immediately. It powers the weekly and most-improved boards.
- **Compression:** chunks older than 14 days, `segmentby = user_id`, `orderby = time DESC`. We measured that tiny chunks compress badly and moved to 90-day chunks. Compression at scale: **[TODO: ratio]**.
- **Per-user indexes** so streaks and history are index reads as real users join.

### Best use of the Gemini API
- **Three Gemini features, all grounded in the user's own data:** the morning briefing, the weekly insight, and **Somni**, a scoped in-app chatbot.
- **Structured JSON output** everywhere. A model fallback chain skips quota-exhausted models; caching and templates keep it working when the API doesn't.
- **Safety:** Gemini compares you only to yourself, makes no medical claims, refuses off-topic and medical questions, points crisis mentions to 988, and resists prompt-injection attempts.

### Best use of ElevenLabs
- **ElevenLabs is Somni's ears and voice.** Push-to-talk questions are transcribed with **Scribe** (`scribe_v2`), and replies are spoken with **text-to-speech** (`eleven_flash_v2_5`).
- **The morning briefing, read aloud:** one tap, generated on demand, cached per briefing.
- **Why voice here:** the two moments a sleep app matters most are right after you wake up and right before bed, which are exactly the moments you shouldn't be staring at a screen.

### Best Community Hack
- Built for campus culture: it turns all-nighter bragging into healthy competition among real friend groups and squads.
- Positive by design: no "worst sleeper" board, a "most improved" board instead, and AI that's kind on rough nights.
- Privacy-respecting social features, so friends can compete without exposing anyone's health data.

### Frutiger Aero: **[TODO: team decision]**
Our original design was Frutiger Aero with iOS 26 Liquid Glass. The current app uses a black-and-white design. Either restore the glassy sky look on key screens and enter this track, or delete this section.

---

## Built with

React Native · Expo · Expo Router · TypeScript · expo-audio · Python · FastAPI · Pydantic · PostgreSQL · TimescaleDB · Tiger Cloud · psycopg · Google Gemini API · ElevenLabs (text-to-speech + Scribe speech-to-text) · Apple Health (iOS Shortcuts) · WHOOP API · Render · OpenAPI · openapi-typescript · pytest

---

## Links and media [TODO]

- **Demo video (2 min max):** [TODO: YouTube/Vimeo link]
- **GitHub:** https://github.com/Promit-Saha123/HackNC
- **Try it:** [TODO: Expo Go link or QR code] (demo login: any of Maya, Jordan, Sam, Riley, Alex, Priya, Chris, Dana; password `sleepsquad`)
- **Screenshots:** [TODO] Home (score ring + briefing), Leaderboard (podium + squads), Somni chat (voice), Trends, Achievements.

## Team [TODO: confirm names]
- **Promit Saha**: data, backend, Tiger Cloud, Apple Health and WHOOP sync
- **Sharvil Desai**: AI (Gemini, ElevenLabs, Somni), API client, submission
- **Pranav [TODO: last name]**: app UI and design
