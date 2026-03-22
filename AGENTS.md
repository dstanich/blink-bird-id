# AGENTS.md

This file provides guidance to AI agents such as Claude Code and GitHub Copilot when working with code in this repository.

## Project Overview

Hobby project that downloads clips from a Blink Smart Security camera (pointed at a bird feeder), identifies bird species using Google Gemini AI, and logs results. Monorepo with a Node.js + Python backend (`server/`) and a Next.js frontend (`client/`).

## Repository Structure

```
├── server/                        # Node.js orchestration + Python Blink API integration
│   ├── index.js                   # Main polling loop
│   ├── lib/
│   │   ├── ai-provider.js         # Gemini AI integration
│   │   ├── blink-manager.js       # Node.js wrapper for Python subprocess
│   │   ├── storage.js             # Storage facade
│   │   └── sqlite-storage.js      # SQLite implementation
│   ├── scripts/
│   │   └── blink_manager.py       # Python Blink Cloud API (blinkpy)
│   ├── data/bird-data.db          # SQLite database
│   ├── downloads/                 # Thumbnails: YYYY/M/D/{clip-id}.jpg
│   ├── config/.blink_auth         # Blink auth tokens
│   └── Dockerfile
├── client/                        # Next.js static frontend
│   ├── app/
│   │   ├── layout.tsx             # Root layout (optional Cloudflare Analytics)
│   │   ├── page.tsx               # Home: lists available dates
│   │   ├── settings/page.tsx      # Shows current AI model/prompt config
│   │   └── [date]/
│   │       ├── page.tsx           # Date detail: summary + clip grid
│   │       └── clip-grid.tsx      # Client component: filter birds/non-birds
│   ├── lib/db.ts                  # SQLite queries (build-time only)
│   ├── data/bird-data.db          # Symlink → server/data/bird-data.db
│   ├── scripts/scheduled-publish/ # S3 deploy script (build + upload + CloudFront invalidation)
│   └── Dockerfile                 # Container for scheduled S3 publishing
└── AGENTS.md
```

There is no root-level `package.json` — each directory manages its own dependencies.

## Commands

### Server (`cd server`)

```bash
npm start                  # Run main app (node index.js)
npm run setup:python       # Install Python deps (uv pip install -e .)
npm run auth               # Authenticate with Blink camera
npm run list               # List clips from camera
npm run download           # Download a specific clip (manual)
```

### Client (`cd client`)

```bash
npm run dev                # Next.js dev server
npm run build              # Static export build (outputs to client/out/)
npm run lint               # ESLint
```

## Architecture

### Server

- **Node.js orchestration layer** (`server/index.js`) — main loop that polls Blink for new clips on a configurable interval (default 2 hours), downloads thumbnails, sends them to Gemini for bird identification (with 30s delay between API calls), and stores results
- **Python subprocess** (`server/scripts/blink_manager.py`) — handles Blink Cloud API via `blinkpy==0.25.5`. Called from Node.js via `child_process.spawn` with JSON-over-stdout IPC. 30-second timeout per command. Supports 2FA via `BLINK_2FA_CODE` env var.
- **AI provider** (`server/lib/ai-provider.js`) — sends base64-encoded JPEG to Google Gemini (default model: `gemini-2.5-flash`), returns structured JSON with species info. Model and prompt are configurable via the `settings` database table.
- **Storage** (`server/lib/storage.js`) — facade over a swappable storage provider; delegates to `server/lib/sqlite-storage.js` which persists clips, bird identifications, and settings to a SQLite database (`server/data/bird-data.db`) via `better-sqlite3`. Uses WAL mode.

### Client

- **Next.js 16 + React 19** with App Router, TypeScript, and Tailwind CSS v4
- **Static export** — configured in `next.config.ts` (`output: "export"`, `trailingSlash: true`) for S3 hosting
- **Routes:** `/` lists available dates; `/[date]/` shows clips and identifications for a given date; `/settings/` shows current AI model and prompt
- **Data access** (`client/lib/db.ts`) — reads the SQLite database directly via `better-sqlite3` at build time (readonly). All dates use `America/Chicago` timezone, formatted with `en-CA` locale for YYYY-MM-DD URL paths.
- **Symlinked database** — `client/data/bird-data.db` symlinks to `server/data/bird-data.db`
- **Scheduled publishing** (`client/scripts/scheduled-publish/`) — builds static site, uploads changed files to S3 (skips unchanged via ETag/MD5), optionally invalidates CloudFront

### Database Schema

**clips** — `id` (PK), `created_at`, `updated_at`, `device_name`, `network_name`, `type`, `source`, `thumbnail`, `media`, `time_zone`, `local_thumbnail_path`

**identifications** — `id` (autoincrement PK), `clip_id` (FK → clips), `is_bird`, `species`, `gender`, `count`, `confidence`, `non_bird_species`, `ai_model_id` (FK → settings), `ai_prompt_id` (FK → settings)

**settings** — `id` (autoincrement PK), `name`, `value`, `is_active` (boolean). Used for `ai_model` and `ai_prompt` configuration.

## Key Conventions

- ES modules throughout (`"type": "module"` in server package.json)
- Uses `fileURLToPath` pattern for `__dirname` equivalent in server code
- Python 3.9+ venv at `server/.venv/`, managed with `uv`
- Auth tokens stored in `server/config/.blink_auth`
- Downloads organized by date: `server/downloads/YYYY/M/D/{clip-id}.jpg`
- Environment config via `.env` in each directory (see `.env.example` for variables)
- Server Dockerfile: `node:20-slim` base, volumes for `data/`, `downloads/`, `config/`
- Client Dockerfile: runs scheduled-publish script for automated S3 deployments
- Dark mode supported in frontend (Tailwind `dark:` prefixes)
- Path alias `@/*` → `./` in client TypeScript config
