# Frontend — React PWA

## Development

```bash
npm install
npm run dev
```

Requires `.env` in the **repo root** (or copy to `frontend/.env`) with:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## Build

```bash
npm run build
npm run preview
```

## Docker

- **Dev:** `docker compose -f ../docker-compose.dev.yml up` (from repo root)
- **Prod:** built via `frontend/Dockerfile` → nginx on port 8080

## Structure

```
frontend/
├── src/
│   ├── main.tsx          # Entry
│   ├── App.tsx           # Role routing
│   ├── AuthContext.tsx   # Supabase auth
│   ├── components/       # Pages & features
│   ├── ui/               # shadcn/ui primitives
│   ├── lib/              # Supabase client, Firebase, utilities
│   ├── types/            # Domain types
│   └── styles/           # Global CSS
├── public/               # PWA manifest, service workers
└── index.html
```
