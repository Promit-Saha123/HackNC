# SleepSquad Sync (iOS Shortcut)

Reads Apple Health **Sleep Analysis only** (start, end, stage) and POSTs it as plain text to the backend.
Expo Go can't use HealthKit, so this Shortcut is how real Apple Watch sleep reaches us. Build it once on an iPhone (iOS 26) in the Shortcuts app, name it exactly **SleepSquad Sync**. The app's Sync button opens it via `shortcuts://run-shortcut?name=SleepSquad%20Sync`.

## Steps
1. **Find Health Samples** where *Type* is **Sleep Analysis** and *Start Date* is in the last **7 days**; sort by *Start Date*, oldest first.
2. **Repeat with Each** item, with a **Text** action inside: `<Start Date ISO 8601>|<End Date ISO 8601>|<Value>`
   - Set the Start Date / End Date variables to format **ISO 8601** (tap the variable -> Date Format -> ISO 8601).
3. **Combine Text** with **New Lines** (the output of the Repeat).
4. **Get Contents of URL**: `https://sleep-squad-api.onrender.com/sleep/shortcut`
   - Method **POST**, header `X-User-Id` = your user id (see `GET /users`) (optionally `X-Ingest-Token` instead: log in, then `POST /ingest/token` with `Authorization: Bearer <login token>`), Request Body = **File**, using the combined text.
5. **Show Result** (the backend replies with how many nights it found).

## Notes
- Send **plain text, not JSON**. One sample per line: `start_iso|end_iso|value`. Values: Core, Deep, REM, Awake, In Bed / InBed, Asleep.
- iOS asks for Health permission on first run. Allow **Sleep** only; no other Health types are read.
- After it works, share it as an iCloud link so teammates can install it.
- Test without a phone (user id 1): `curl.exe -X POST https://sleep-squad-api.onrender.com/sleep/shortcut -H "X-User-Id: 1" -H "Content-Type: text/plain" --data-binary "2026-10-09T23:40:00-04:00|2026-10-10T07:20:00-04:00|Core"`