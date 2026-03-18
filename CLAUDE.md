# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hobby project that downloads clips from a Blink Smart Security camera (pointed at a bird feeder), identifies bird species using Google Gemini AI, and logs results. Monorepo with a Node.js + Python backend (`server/`) and a Next.js frontend (`client/`).

## Repository Structure

```
├── server/          # Node.js orchestration + Python Blink API integration
├── client/          # Next.js static frontend
└── CLAUDE.md
```

There is no root-level `package.json` — each directory manages its own dependencies.

## Commands

### Server (`cd server`)

```bash
npm start                  # Run main app (node index.js)
npm run setup:python       # Install Python deps (uv pip install -e .)
npm run auth               # Authenticate with Blink camera
npm run list               # List clips from camera
```

### Client (`cd client`)

```bash
npm run dev                # Next.js dev server
npm run build              # Static export build
```

No test or lint commands exist yet.

## Architecture

### Server

- **Node.js orchestration layer** (`server/index.js`) — main loop that polls Blink for new clips on a configurable interval, downloads thumbnails, sends them to Gemini for bird identification, and stores results
- **Python subprocess** (`server/scripts/blink_manager.py`) — handles Blink Cloud API via blinkpy. Called from Node.js via `child_process.spawn` with JSON-over-stdout IPC. 30-second timeout per command.
- **AI provider** (`server/lib/ai-provider.js`) — sends base64-encoded JPEG to Google Gemini (`@google/genai`), returns structured JSON with species info
- **Storage** (`server/lib/storage.js`) — facade over a swappable storage provider; delegates to `server/lib/sqlite-storage.js` which persists clips and bird identifications to a SQLite database (`server/data/bird-data.db`) via `better-sqlite3`

### Client

- **Next.js 16 + React 19** with App Router, TypeScript, and Tailwind CSS v4
- **Static export** — configured in `next.config.ts` for output as static HTML/CSS/JS
- **Routes:** `/` lists available dates; `/[date]/` shows clips and identifications for a given date
- **Data access** (`client/lib/db.ts`) — reads the SQLite database directly via `better-sqlite3` at build time
- **Symlinked database** — `client/data/bird-data.db` symlinks to `server/data/bird-data.db`

## Key Conventions

- ES modules throughout (`"type": "module"` in server package.json)
- Uses `fileURLToPath` pattern for `__dirname` equivalent in server code
- Python venv at `server/.venv/`, managed with `uv`
- Auth tokens stored in `server/config/.blink_auth`
- Downloads organized by date: `server/downloads/YYYY/M/D/{clip-id}.jpg`
- Environment config via `.env` in each directory (see `.env.example` for variables)
- Dockerfile in `server/` for containerized deployment (node:20-slim base, volumes for `data/`, `downloads/`, `config/`)
