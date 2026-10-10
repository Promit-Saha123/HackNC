# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

HackNC is a fresh starter: a FastAPI backend and a Vite + React frontend, with one `/api/health` endpoint wired end to end. No lint tooling is configured yet.

## Commands

Backend (run from `backend/`, venv active):
- Dev server: `uvicorn app.main:app --reload` (port 8000)
- Tests: `pytest`; single test: `pytest tests/test_health.py::test_health`

Frontend (run from `frontend/`):
- `npm run dev` (port 5173), `npm run build`

## Architecture

- `backend/app/main.py` — FastAPI app; all routes live under `/api`. CORS origins come from the `CORS_ORIGINS` env var (see `.env.example`).
- `frontend/` — Vite dev server proxies `/api` to `http://localhost:8000` (`vite.config.js`), so frontend code calls relative `/api/...` URLs rather than hardcoding the backend host.

## Environment

- Windows 11; primary shell is PowerShell (Bash also available).
- The `ecc` plugin is enabled via `.claude/settings.json`.
