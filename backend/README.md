# Backend (Supabase Edge Functions)

Serverless Deno functions — no custom Node/Express server.

| Function | Trigger | Purpose |
|----------|---------|---------|
| `send-fcm-notifications` | HTTP POST | Send FCM push to registered devices |
| `process-scheduled-notifications` | Cron / HTTP | Process `scheduled_notifications`, send email + push |

## Source of truth

Edit functions in **`backend/functions/`**. Before deploy, sync to `database/functions/` (Supabase CLI requirement):

```bash
# From repo root
npm run sync:functions
cd database
supabase functions deploy
```

## Required secrets (Supabase Dashboard → Edge Functions → Secrets)

- `FIREBASE_SERVICE_ACCOUNT` — Firebase Admin JSON
- `RESEND_API_KEY` — Email (scheduled notifications)
- `RESEND_FROM` — Sender email address
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — Auto-injected in hosted Supabase

## Local testing

```bash
cd database
supabase functions serve send-fcm-notifications --env-file ../.env
```

See `../docs/FCM_SETUP.md` and `../docs/SCHEDULED_NOTIFICATIONS_SETUP.md`.
