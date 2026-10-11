# Contributing (team workflow)

How the three of us work in this repo. Current status and everyone's next task: [`HANDOFF.md`](HANDOFF.md). Rules in full (slices, scoring, file ownership, git): [`CLAUDE.md`](CLAUDE.md).

## Roles
Only edit your own files. For anything else, ask the owner or send a tiny PR.

| Role | Who | Owns |
|------|-----|------|
| P1 data / backend / Shortcut | Promit Saha | `backend/db`, `backend/app/routes/{sleep,leaderboard,ingest,me,auth,whoop}.py`, `scoring.py`, `store.py`, `models.py`, `main.py`, `backend/scripts`, `shortcut/`, `render.yaml` |
| P2 AI / API client / submission | Sharvil Desai | `routes/ai.py`, `backend/app/integrations/` (Gemini, ElevenLabs, Somni), `app/src/api/`, `docs/`, Devpost, demo video |
| P3 app UI / design | Pranav | the rest of `app/`, including `package.json`, the lockfile and `app.json` |

## Set up (Windows)
Prerequisites: Git, Python 3.12, Node LTS, and Expo Go on your iPhone. Then follow "Run it yourself" in the [README](README.md).

If `pip install` fails with a "No such file or directory" path error, the repo path is too long for Windows: clone to a short path (for example `C:\dev\HackNC`) or enable long paths.

You're ready when `pytest` passes in `backend/` and the app opens in Expo Go on your iPhone.

## Branching and PRs
- `main` must always run. Never commit to it directly; everything lands through a PR.
- Branch names: `p1/<task>`, `p2/<task>`, `p3/<task>`, for example `p2/gemini-briefing`. One task per branch, 1-2 hours at most.

```powershell
git checkout main; git pull
git checkout -b p2/gemini-briefing          # your role + task

# work, then commit small and often (add only your files, never .env)
git add backend/app/integrations/gemini.py
git commit -m "Gemini briefing: structured JSON prompt"

git fetch; git rebase origin/main           # before every PR; fix conflicts, then: git rebase --continue
# run the backend and open the app in Expo Go
git push -u origin p2/gemini-briefing       # after a rebase on an already-pushed branch: git push --force-with-lease
```
Then open a PR on GitHub into `main`, get one teammate to glance at it, merge, and delete the branch.

### Conflict rules
- **Lockfile** (`app/package-lock.json`): take main's version; P3 re-runs `npx expo install`. Never hand-merge it. Only P3 runs `npx expo install`.
- **Generated files** (`app/src/api/schema.ts`, `shared/openapi.json`): re-run `python backend/scripts/export_openapi.py`, then `npm run gen:api` in `app/`, instead of merging by hand.
- **The API contract** (`backend/app/models.py`): additive only. Add fields, never rename or remove. P1 owns it, so ask Promit or send a tiny PR.

### Slices and tags
At each slice target (v1, v2, v3) merges freeze for 15 minutes, `main` is run from a fresh clone, and then it is tagged (`git tag v1; git push --tags`).

### Several sessions at once
Give each branch its own folder: `git worktree add ..\HackNC-p2 p2/<task>`.

## Secrets stay out of git
`.env` files are ignored. Share `DATABASE_URL` and API keys privately (a direct message, never the repo). Each person who runs the backend locally puts their own keys in `backend/.env`. The deployed backend keeps its keys in the Render dashboard.

## End of every work block
Update `HANDOFF.md`: current slice, done, in progress, next per person, blockers, how to run now, known bugs.

## Using Claude Code (optional)
It reads `CLAUDE.md` automatically. `.claude/settings.json` enables the `ecc` plugin; run `/plugin marketplace add affaan-m/everything-claude-code` once so it can load.
