"""Pre-demo smoke test: plays the demo friend, then a brand-new judge, against a running API and prints PASS/FAIL with timings.
Run from backend/:  python scripts/smoke_demo.py [--url https://sleep-squad-api.onrender.com] [--keep]
It calls the same endpoints the app calls. It creates one throwaway account (smoke_xxxxxx) and deletes it at the end
(--keep leaves it). Standard library only, nothing to install. Exit code 1 if anything failed."""
import argparse
import json
import random
import string
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta

ap = argparse.ArgumentParser()
ap.add_argument("--url", default="https://sleep-squad-api.onrender.com")
ap.add_argument("--keep", action="store_true", help="don't delete the throwaway account")
args = ap.parse_args()
BASE = args.url.rstrip("/")
SLOW = 5.0  # seconds before a step is flagged slow (Gemini/ElevenLabs steps are allowed 25)
results: list[bool] = []
slow: list[str] = []


class Client:
    def __init__(self):
        self.token = None

    def call(self, method, path, body=None, timeout=90):
        data = json.dumps(body).encode() if body is not None else None
        headers = {"Content-Type": "application/json"} if body is not None else {}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        req = urllib.request.Request(BASE + path, method=method, data=data, headers=headers)
        t = time.time()
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                raw, status, ctype = r.read(), r.status, r.headers.get("content-type", "")
        except urllib.error.HTTPError as e:
            raw, status, ctype = e.read(), e.code, e.headers.get("content-type", "")
        except Exception as e:  # network trouble: report it as a failure, not a crash
            return 0, {"error": str(e)[:80]}, time.time() - t
        body = json.loads(raw) if raw and "json" in ctype else raw
        return status, body, time.time() - t


def step(name, got, want_status, check=lambda b: True, ai=False):
    status, body, secs = got
    ok = status == want_status
    detail = f"HTTP {status}"
    if ok:
        try:
            ok = bool(check(body))
            if not ok:
                detail += " but the response looks wrong"
        except Exception as e:
            ok, detail = False, f"HTTP {status} but the response was unexpected ({e.__class__.__name__})"
    elif isinstance(body, dict):
        detail += f": {body.get('detail') or body.get('error')}"
    flag = ""
    if ok and secs > (25 if ai else SLOW):
        flag = "  <-- SLOW"
        slow.append(name)
    print(f"  {'PASS' if ok else 'FAIL'}  {name:<46} {secs:5.1f}s  {detail if not ok else ''}{flag}")
    results.append(ok)
    return body if ok else None


today = datetime.now().date()
print(f"Smoke test against {BASE}\n")
s0 = time.time()
anon = Client()
step("health (deep: database reachable)", anon.call("GET", "/health?deep=true"), 200, lambda b: b == {"status": "ok", "db": "ok"})

# ---------------- Part 1: a judge opens the app and picks a demo friend ----------------
print("\nPart 1: signed in as the demo friend Maya")
maya = Client()
r = step("login as Maya (demo password)", maya.call("POST", "/auth/login", {"username": "Maya", "password": "sleepsquad"}), 200, lambda b: b["user"]["name"] == "Maya")
maya.token = r["token"] if r else None
step("demo profile list (login picker)", anon.call("GET", "/users"), 200, lambda b: len(b) >= 8 and all(u["is_demo"] for u in b))
ov = step("overview: score, last night, streak", maya.call("GET", "/users/1/overview"), 200, lambda b: b["score"] and b["last_night"] and b["streak_days"] >= 0)
if ov:
    age = (today - datetime.fromisoformat(ov["last_night"]["day"]).date()).days
    ok = age <= 1
    print(f"  {'PASS' if ok else 'WARN'}  demo data is fresh (last night is {ov['last_night']['day']}, {age} day(s) old)" + ("" if ok else "  -> run: python scripts/reset_demo.py"))
    results.append(ok)
step("history (calendar and Trends, 60 nights)", maya.call("GET", "/users/1/history?days=60"), 200, lambda b: len(b) >= 30 and b[0]["deep_min"] is not None)
for label, path in (("weekly", "week"), ("all-time", "all"), ("most improved", "improved")):
    step(f"leaderboard: {label}", maya.call("GET", f"/leaderboard?period={path}"), 200, lambda b: isinstance(b["entries"], list))
step("leaderboard: Wolfpack squad filter", maya.call("GET", "/leaderboard?period=all&squad=Wolfpack"), 200, lambda b: {e["squad"] for e in b["entries"]} == {"Wolfpack"})
step("squad vs squad board", maya.call("GET", "/leaderboard/squads?period=week"), 200, lambda b: len(b["entries"]) >= 3)
step("squad members (code WOLF23)", maya.call("GET", "/squads/WOLF23"), 200, lambda b: len(b["members"]) >= 3)
step("friend card (Jordan)", maya.call("GET", "/users/2/card"), 200, lambda b: b["name"] == "Jordan")
step("my profile", maya.call("GET", "/me"), 200, lambda b: b["name"] == "Maya")
step("my prefs", maya.call("GET", "/me/prefs"), 200, lambda b: b["hours"] >= 4)
step("my sync status", maya.call("GET", "/me/sync"), 200, lambda b: "connected" in b)
step("my squad", maya.call("GET", "/me/squad"), 200, lambda b: b and b["code"] == "WOLF23")
step("weekly AI insight (Gemini)", maya.call("GET", "/ai/insight/1"), 200, lambda b: b["text"], ai=True)
br = step("morning briefing (Gemini)", maya.call("GET", "/ai/briefing/1"), 200, lambda b: "not medical advice" in b["text"].lower(), ai=True)
if br and br.get("audio_url"):
    step("briefing read aloud (ElevenLabs audio)", maya.call("GET", br["audio_url"]), 200, lambda b: isinstance(b, bytes) and len(b) > 5000, ai=True)
elif br:
    print("  WARN  briefing has no audio_url (ElevenLabs not configured?)")
step("Somni chat answers about my sleep", maya.call("POST", "/ai/chat/1", {"messages": [{"role": "user", "text": "How did I sleep last night?"}]}), 200, lambda b: b["reply"] and b["in_scope"], ai=True)
step("demo profile is read-only (edit refused)", maya.call("PUT", "/me", {"bio": "x"}), 403)
step("demo profile can't be deleted", maya.call("DELETE", "/users/1/data"), 403)

# ---------------- Part 2: a new judge signs up and logs a night ----------------
print("\nPart 2: a brand-new judge signs up")
name = "smoke_" + "".join(random.choices(string.ascii_lowercase + string.digits, k=6))
pw, pw2 = "smoke test pass 1", "smoke test pass 2"
judge = Client()
uid = None
try:
    r = step("sign up", judge.call("POST", "/auth/signup", {"username": name, "password": pw}), 201, lambda b: not b["user"]["is_demo"])
    if r:
        judge.token, uid = r["token"], r["user"]["id"]
    step("same username again says an account exists", anon.call("POST", "/auth/signup", {"username": name.upper(), "password": pw}), 409, lambda b: "already exists" in b["detail"])
    step("signed-in user can't make a second account", judge.call("POST", "/auth/signup", {"username": name + "x", "password": pw}), 409, lambda b: "already have an account" in b["detail"])
    step("new profile starts empty", judge.call("GET", "/me"), 200, lambda b: b["stats"]["nights"] == 0)
    step("edit avatar and bio", judge.call("PUT", "/me", {"avatar": "🌙", "bio": "smoke test"}), 200, lambda b: b["avatar"] == "🌙")
    step("set a goal (8 h)", judge.call("PUT", "/me/prefs", {"bedtime": 1365, "wake": 420, "hours": 8, "share_details": True, "show_on_board": True}), 200)
    bed = (datetime.now() - timedelta(days=1)).replace(hour=23, minute=0, second=0, microsecond=0)
    wake = datetime.now().replace(hour=7, minute=0, second=0, microsecond=0)
    step("log last night by hand (11 pm to 7 am)", judge.call("POST", "/me/sleep", {"bed": bed.strftime("%Y-%m-%dT%H:%M:%S"), "wake": wake.strftime("%Y-%m-%dT%H:%M:%S")}), 200, lambda b: b["duration_min"] == 480)
    step("overview shows the new night and a score", judge.call("GET", f"/users/{uid}/overview"), 200, lambda b: b["last_night"]["duration_min"] == 480 and b["score"]["score"] > 0)
    step("history has the night", judge.call("GET", f"/users/{uid}/history?days=60"), 200, lambda b: len(b) == 1)
    step("judge appears on the leaderboard", judge.call("GET", "/leaderboard?period=all&limit=100"), 200, lambda b: name in [e["name"] for e in b["entries"]])
    step("join the Wolfpack squad", judge.call("POST", "/me/squad/join", {"code": "WOLF23"}), 200, lambda b: b["name"] == "Wolfpack")
    step("squad list now includes the judge", judge.call("GET", "/squads/WOLF23"), 200, lambda b: name in [m["name"] for m in b["members"]])
    step("leave the squad", judge.call("POST", "/me/squad/leave"), 204)
    step("own friend card", judge.call("GET", f"/users/{uid}/card"), 200, lambda b: b["bio"] == "smoke test")
    step("morning briefing for the new user (Gemini)", judge.call("GET", f"/ai/briefing/{uid}"), 200, lambda b: b["text"], ai=True)
    step("change password", judge.call("POST", "/me/password", {"current_password": pw, "new_password": pw2}), 204)
    step("log in with the new password", anon.call("POST", "/auth/login", {"username": name, "password": pw2}), 200)
    step("old password no longer works", anon.call("POST", "/auth/login", {"username": name, "password": pw}), 401)
finally:
    if uid and not args.keep:
        ok = judge.call("DELETE", f"/users/{uid}/data")[0] == 204
        gone = anon.call("POST", "/auth/login", {"username": name, "password": pw2})[0] == 401
        print(f"  {'PASS' if ok and gone else 'FAIL'}  delete my data removes the account (cleanup)")
        results.append(ok and gone)
    elif uid:
        print(f"  (kept the account {name} / {pw2})")

failed = results.count(False)
print(f"\n{len(results) - failed}/{len(results)} checks passed in {time.time() - s0:.0f}s" + (f" | slow: {', '.join(slow)}" if slow else ""))
sys.exit(1 if failed else 0)
