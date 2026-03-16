# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hobby project that downloads clips from a Blink Smart Security camera (pointed at a bird feeder), identifies bird species using Google Gemini AI, and logs results. Hybrid Node.js + Python architecture.

## Commands

```bash
npm start                  # Run main app (node index.js)
npm run setup:python       # Install Python deps (uv pip install -e .)
npm run auth               # Authenticate with Blink camera
npm run list               # List clips from camera
```

No test or lint commands exist yet.

## Architecture

- **Node.js orchestration layer** (`index.js`) — main loop that polls Blink for new clips on a configurable interval, downloads thumbnails, sends them to Gemini for bird identification, and stores results
- **Python subprocess** (`scripts/blink_manager.py`) — handles Blink Cloud API via blinkpy. Called from Node.js via `child_process.spawn` with JSON-over-stdout IPC. 30-second timeout per command.
- **AI provider** (`lib/ai-provider.js`) — sends base64-encoded JPEG to Google Gemini, returns structured JSON with species info
- **Storage** (`lib/storage.js`) — facade over a swappable storage provider; delegates to `lib/sqlite-storage.js` which persists clips and bird identifications to a SQLite database (`data/` directory) via `better-sqlite3`

## Key Conventions

- ES modules throughout (`"type": "module"` in package.json)
- Uses `fileURLToPath` pattern for `__dirname` equivalent
- Python venv at `.venv/`, managed with `uv`
- Auth tokens stored in `config/.blink_auth`
- Downloads organized by date: `downloads/YYYY/M/D/{clip-id}.jpg`
- Environment config via `.env` (see `.env.example` for all variables)
- Dockerfile available for containerized deployment (node:20-slim base, volumes for `data/`, `downloads/`, `config/`)
