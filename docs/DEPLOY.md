# Deploy Rinde (AppFinanzas)

Production on **Vercel** + repo on **GitHub**, with **Neon Postgres** as the database.
Auth is **Auth.js (Credentials)** inside this app — do **not** enable Neon Auth.

## 0. Local first (recommended)

```bash
cp .env.example .env.local
# fill DATABASE_URL, AUTH_SECRET, AUTH_URL, NEXT_PUBLIC_AUTH_ENABLED=true

openssl rand -base64 32   # paste into AUTH_SECRET

npm run db:push           # creates tables in Neon (reads .env.local via drizzle.config.ts)
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
| `npm run db:push` | Fastest for empty/dev DB (what we use day-to-day) |
| `npm run db:generate` | Generate SQL under `./drizzle` from `src/db/schema.ts` |
| `npm run db:migrate` | Apply generated migrations |

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

Same Neon DB as local is fine for early MVP. Separate prod branch/DB is better later.

If the Vercel DB is **new**, run once from your machine:

```bash
DATABASE_URL="postgresql://..." npm run db:push
```

## 4. Production smoke check

1. Open the Vercel URL → register / sign in.
2. Add a transaction → Configuración → **Sincronizar ahora**.
3. Second browser / device → same account → sync → data appears.

## 5. CI

`.github/workflows/ci.yml` runs typecheck, lint, and build **without** a real database. Build must succeed with unset `DATABASE_URL` (lazy DB client).

## Related

- [MOBILE.md](./MOBILE.md) — Capacitor / static export
- [../README.md](../README.md) — product overview + scripts
