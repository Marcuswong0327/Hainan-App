# Database (Supabase PostgreSQL)

Schema, migrations, and SQL setup scripts for the Hainan App.

## Contents

| Path | Purpose |
|------|---------|
| `migrations/` | Versioned schema changes (run with Supabase CLI) |
| `sql/` | One-shot setup scripts for SQL Editor |
| `functions/` | Edge Functions (synced from `backend/functions/` before deploy) |
| `config.toml` | Supabase local dev configuration |

## Hosted Supabase (production)

1. Create a project at [supabase.com](https://supabase.com).
2. Run migrations:
   ```bash
   cd database
   supabase link --project-ref YOUR_PROJECT_REF
   supabase db push
   ```
3. Or paste `sql/study_loan_recipients_complete_setup.sql` in the SQL Editor for greenfield setup.
4. See `../docs/SUPABASE_SETUP.md` for profiles, storage bucket, and RLS policies.

## Local Supabase (optional)

Requires [Supabase CLI](https://supabase.com/docs/guides/cli).

```bash
cd database
supabase start
```

Studio: http://localhost:54323  
API: http://localhost:54321

## Migrations

Files in `migrations/` are applied in filename order. Do not edit applied migrations; add new ones.
