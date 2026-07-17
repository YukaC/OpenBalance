# Deploy OpenBalance (AppFinanzas)

Production on **Vercel** + repo on **GitHub**, with **Neon Postgres** as the database.
Auth is **Auth.js (Credentials)** inside this app — do **not** enable Neon Auth.

## 0. Local first (recommended)

```bash
cp .env.example .env.local
# fill DATABASE_URL, AUTH_SECRET, AUTH_URL, NEXT_PUBLIC_AUTH_ENABLED=true

openssl rand -base64 32   # paste into AUTH_SECRET

# Local/empty DB only — never against production data:
npm run db:push
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

### Schema / migrations (H10)

SQL migrations live under `./drizzle` (generated from `src/db/schema.ts`). Commit those files to git.

| Script | When |
|--------|------|
| `npm run db:generate` | **Always** after changing `src/db/schema.ts` — writes SQL + meta under `./drizzle`. Safe: does **not** touch any database. |
| `npm run db:migrate` | Apply pending SQL to the DB pointed by `DATABASE_URL`. Review the SQL first. Use for **production** (and shared staging). |
| `npm run db:push` | **Local / empty DB only** — pushes schema without migration history. Can propose destructive diffs; **do not run against production data**. |

**Production workflow (never skip review):**

```bash
# 1) From a machine with .env.local (or DATABASE_URL set) — generate only:
npm run db:generate
# 2) Open ./drizzle/*.sql, review CREATE/ALTER carefully
# 3) Apply against the target DB (prod URL only when you intend to migrate prod):
DATABASE_URL="postgresql://…" npm run db:migrate
```

Do **not** run `db:migrate` or `db:push` casually against the production Neon URL from CI or chat agents. Generate locally; migrate intentionally.

If `./drizzle` is empty or meta is missing after a schema change, run `npm run db:generate` (requires `DATABASE_URL` in `.env.local` for drizzle-kit config, but generate does not apply SQL).

`drizzle.config.ts` loads `.env` then `.env.local` (drizzle-kit does not do this by itself).

### Password reset table

Forgot-password uses `password_reset_tokens`. After pulling schema changes:

- Prefer: `db:generate` → review → `db:migrate`
- Empty local DB only: `db:push`

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
| `AUTH_URL` | Yes in prod | Canonical **site** URL, e.g. `https://your-app.vercel.app` — not the Capacitor WebView origin |
| `NEXT_PUBLIC_AUTH_ENABLED` | Yes for login gate | `true` |
| `NEXTAUTH_URL` | Optional | Legacy alias of `AUTH_URL` |
| `NEXT_PUBLIC_API_BASE_URL` | Required for Capacitor APK | Same origin as `AUTH_URL` (no trailing slash). Also extends CSP `connect-src` on web |
| `NEXT_PUBLIC_ANDROID_DOWNLOAD_URL` | Optional | Mobile-web “Descargá la app” banner |
| `NEXT_PUBLIC_IOS_DOWNLOAD_URL` | Optional | Same, iOS |
| `RESEND_API_KEY` | Optional | Sends password-reset emails via Resend HTTP API (no npm package) |
| `RESEND_FROM` | Optional | From address for Resend (default `OpenBalance <onboarding@resend.dev>`) |
| `AUTH_DEV_RESET_URL` | Optional | `1` to include `resetUrl` in forgot-password API responses (also on in non-production) |
| `SMTP_URL` | Optional | Reserved for later SMTP/Nodemailer; **not wired yet** |

### Capacitor session recipe (C1)

WebView origin ≠ Vercel → Auth.js cookies usually **do not** stick. Production recipe:

1. **Vercel:** `AUTH_URL=https://your-app.vercel.app` + `AUTH_SECRET` + `NEXT_PUBLIC_AUTH_ENABLED=true` + `DATABASE_URL`.
2. **Mobile build:** bake `NEXT_PUBLIC_API_BASE_URL=https://your-app.vercel.app` (and `NEXT_PUBLIC_AUTH_ENABLED=true`) into `pnpm build:mobile`.
3. **Native login:** app calls `POST /api/auth/native-token`, stores JWT in `@capacitor/preferences`, syncs with `Authorization: Bearer`.
4. **SameSite:** leave Auth.js defaults for web (`Lax` on HTTPS). Do **not** require `SameSite=None` for the APK — Bearer is the supported path. Optional cookie cross-site is documented in [MOBILE.md](./MOBILE.md) only as a non-default experiment.

Smoke: APK → login → Configuración → **Sincronizar ahora** → Network shows `POST …/api/sync` with `Authorization: Bearer` and **200**.

### Password reset without email SaaS

Forgot-password always creates a hashed token in Postgres (`password_reset_tokens`).

- **Dev / no SMTP:** the server logs the reset URL and (when `NODE_ENV !== "production"` or `AUTH_DEV_RESET_URL=1`) returns `{ ok: true, resetUrl }` so you can open the link locally.
- **Production without `RESEND_API_KEY`:** token is still created; the API returns a generic message only. Configure Resend (or wire SMTP later) before relying on email delivery in prod.

Same Neon DB as local is fine for early MVP. Separate prod branch/DB is better later.

## 4. Production smoke check

1. Open the Vercel URL → register / sign in.
2. Add a transaction → Configuración → **Sincronizar ahora**.
3. Second browser / device → same account → sync → data appears.

### Leave-sync smoke (A2)

Dirty-only flush on tab hide / page leave (`visibilitychange` / `pagehide` + `keepalive`). Verify after deploy:

1. Sign in on desktop Chrome → add or edit a transaction (chip should show **Pendiente**).
2. Switch to another tab or minimize the window (do **not** press “Sincronizar ahora”).
3. Wait ~1–2s → return → chip should show **Sincronizado** (or check Network: `POST /api/sync` with `keepalive`).
4. Repeat on mobile web (Safari/Chrome): edit → switch apps / lock screen briefly → reopen → data still pending or already synced; second device pull confirms cloud has the edit.
5. Negative check: with **no** local edits, hide the tab → no sync request (or no-op / empty dirty payload).

## 5. CI

`.github/workflows/ci.yml` runs test, typecheck, lint, and build **without** a real database. Build must succeed with unset `DATABASE_URL` (lazy DB client). CI does **not** run `db:migrate` / `db:push`.

## Related

- [MOBILE.md](./MOBILE.md) — Capacitor / static export
- [A11Y.md](./A11Y.md) — checklist liviana de accesibilidad
- [../README.md](../README.md) — product overview + scripts
