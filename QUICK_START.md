# Quick Start Guide

## Project layout

```
frontend/   → React + Vite app
backend/    → Supabase Edge Functions
database/   → SQL migrations + Supabase CLI config
```

## Step 1: Install dependencies

From the repo root:

```bash
npm run install:frontend
```

## Step 2: Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your Supabase URL and anon key, then restart the dev server if it is already running.

## Step 3: Start the development server

```bash
npm run dev
```

You should see:

```
  VITE v5.x  ready in … ms

  ➜  Local:   http://localhost:5173/
```

## Step 4: Open in browser

Go to **http://localhost:5173**

## Docker (optional)

**Dev** (hot reload): `npm run docker:dev` → http://localhost:5173

**Production**: `npm run docker:build && npm run docker:up` → http://localhost:8080

## Troubleshooting

### Cannot log in on localhost
Create `.env` from `.env.example` with valid `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then restart `npm run dev`.

### Port already in use
Vite picks the next free port; check the terminal for the actual URL.

### Module not found
Run `npm run install:frontend` from the repo root.

See `README.md` and `docs/SUPABASE_SETUP.md` for database migrations and Edge Function deploy.
