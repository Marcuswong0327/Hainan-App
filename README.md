# Hainan App — Monorepo

```
hainan-app/
├── frontend/          # React + Vite PWA (browser client)
├── backend/           # Supabase Edge Functions (Deno, serverless)
├── database/          # PostgreSQL migrations + Supabase CLI config
├── docs/              # Setup guides
├── docker-compose.yml # Production: nginx frontend
└── docker-compose.dev.yml
```

| Layer | Folder | Technology |
|-------|--------|------------|
| **Frontend** | `frontend/` | React 18, TypeScript, Vite, Tailwind, shadcn/ui |
| **Backend** | `backend/functions/` | Supabase Edge Functions (FCM, scheduled notifications) |
| **Database** | `database/` | PostgreSQL via Supabase (migrations, RLS, storage) |

There is **no custom Node/Express API**. The browser talks to Supabase directly; server logic runs in Edge Functions.

## Quick start (local, no Docker)

```bash
# 1. Install frontend dependencies
npm run install:frontend

# 2. Configure environment
cp .env.example .env
# Edit .env with your Supabase URL and anon key

# 3. Run dev server
npm run dev
# → http://localhost:5173
```

## Docker

**Development** (hot reload):

```bash
cp .env.example .env
npm run docker:dev
```

**Production** (nginx serving built static files):

```bash
cp .env.example .env
npm run docker:build
npm run docker:up
# → http://localhost:8080
```

## Database & backend deploy

```bash
# Sync Edge Functions source → database/functions/
npm run sync:functions

# Push migrations (requires Supabase CLI + linked project)
cd database && supabase link --project-ref YOUR_REF && supabase db push

# Deploy Edge Functions
npm run functions:deploy
```

See `database/README.md`, `backend/README.md`, and `docs/SUPABASE_SETUP.md`.

## Super admin (first signup)

Email: `marcuswong0327@gmail.com` — sign up once via the app; role is assigned automatically.
