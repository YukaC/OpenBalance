# Deploy Rinde (AppFinanzas)

Production on **Vercel** + repo on **GitHub**, with **Neon Postgres** as the database.
Auth is **Auth.js (Credentials)** inside this app — do **not** enable Neon Auth.

## 0. Local first (recommended)

```bash
cp .env.example .env.local
# fill DATABASE_URL, AUTH_SECRET, AUTH_URL, NEXT_PUBLIC_AUTH_ENABLED=true

openssl rand -base64 32   # paste into AUTH_SECRET

npm run db:push           # local/dev only — creates tables in Neon (reads .env.local via drizzle.config.ts)
npm run dev
```

Smoke check:

1. Open `http://localhost:3000` → register a user.
2. Configuración → **Sincronizar ahora** → expect `POST /api/sync` **200**.
3. A failed login *before* registering logs `[auth][error] CredentialsSignin` — expected.

Without `DATABASE_URL`, `/api/auth/register` and `/api/sync` return **503** JSON (`DATABASE_UNAVAILABLE`) and the app still works local-first if `NEXT_PUBLIC_AUTH_ENABLED` is unset/false.

## 1. Neon (Postgres only)

1. Create a project at [console.neon.tech](https://console.neon.tech).
2. **Connection details** → copy the connection string.
3. Prefer **pooled** (`-pooler` in the host) for Vercel serverless.
4. Keep `sslmode=require`.
5. Paste into `.env.local` as `DATABASE_URL`.

Do **not** turn on Neon Auth — login lives in this repo (`src/lib/auth.ts`).

### Schema commands

| Script | When |
|--------|------|
| `npm run db:push` | **Local / empty DB only** — fast prototype sync; do not use against production data |
| `npm run db:generate` | Generate SQL under `./drizzle` from `src/db/schema.ts` |
| `npm run db:migrate` | Apply generated migrations — **use this in production** (review SQL first) |

Production schema changes: `db:generate` → review the SQL → `db:migrate`. Reserve `db:push` for local/dev (it can propose destructive diffs).

`drizzle.config.ts` loads `.env` then `.env.local` (drizzle-kit does not do this by itself).

## 2. GitHub → Vercel

1. Push the repo to GitHub.
2. [Vercel](https://vercel.com) → **Add New Project** → import the repo.
3. Framework: **Next.js** (auto).
4. Deploy.

Pushes to the production branch redeploy automatically.

## 3. Environment variables (Vercel)

| Variable | Required | Notes |
|----------|----------|--------|
| `DATABASE_URL` | Yes (auth/sync) | Neon pooled URL + `sslmode=require` |
| `AUTH_SECRET` | Yes | `openssl rand -base64 32` (can differ from local) |
| `AUTH_URL` | Yes in prod | e.g. `https://your-app.vercel.app` |
| `NEXT_PUBLIC_AUTH_ENABLED` | Yes for login gate | `true` |
| `NEXTAUTH_URL` | Optional | Legacy alias of `AUTH_URL` |
| `NEXT_PUBLIC_API_BASE_URL` | Optional | Only if client ≠ API origin (Capacitor); also extends CSP `connect-src` |
| `NEXT_PUBLIC_ANDROID_DOWNLOAD_URL` | Optional | Mobile-web “Descargá la app” banner |
| `NEXT_PUBLIC_IOS_DOWNLOAD_URL` | Optional | Same, iOS |
| `RESEND_API_KEY` | Optional | Sends password-reset emails via Resend HTTP API (no npm package) |
| `RESEND_FROM` | Optional | From address for Resend (default `Rinde <onboarding@resend.dev>`) |
| `AUTH_DEV_RESET_URL` | Optional | `1` to include `resetUrl` in forgot-password API responses (also on in non-production) |
| `SMTP_URL` | Optional | Reserved for later SMTP/Nodemailer; **not wired yet** |

### Password reset without email SaaS

Forgot-password always creates a hashed token in Postgres (`password_reset_tokens`).

- **Dev / no SMTP:** the server logs the reset URL and (when `NODE_ENV !== "production"` or `AUTH_DEV_RESET_URL=1`) returns `{ ok: true, resetUrl }` so you can open the link locally.
- **Production without `RESEND_API_KEY`:** token is still created; the API returns a generic message only. Configure Resend (or wire SMTP later) before relying on email delivery in prod.

After adding the table, run `npm run db:push` (or generate/migrate) so Neon has `password_reset_tokens`.

Same Neon DB as local is fine for early MVP. Separate prod branch/DB is better later.

If the Vercel DB is **new**, prefer migrate from your machine (or use `db:push` only when the DB is empty and you accept the risk):

```bash
DATABASE_URL="postgresql://..." npm run db:generate
DATABASE_URL="postgresql://..." npm run db:migrate
# empty/local only: DATABASE_URL="postgresql://..." npm run db:push
```

## 4. Production smoke check

1. Open the Vercel URL → register / sign in.
2. Add a transaction → Configuración → **Sincronizar ahora**.
3. Second browser / device → same account → sync → data appears.

## 5. CI

`.github/workflows/ci.yml` runs test, typecheck, lint, and build **without** a real database. Build must succeed with unset `DATABASE_URL` (lazy DB client).

## Related

- [MOBILE.md](./MOBILE.md) — Capacitor / static export
- [../README.md](../README.md) — product overview + scripts
