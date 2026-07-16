# Rinde — Capacitor mobile

Empaquetar la web estática en Android/iOS con Capacitor. El backend (auth/sync) sigue en Vercel.

## Idea

- `npm run build` → Next normal en Vercel (SSR + API routes).
- `npm run build:mobile` → `NEXT_OUTPUT=export` → carpeta `out/` (static).
- La app nativa carga `out/` y llama a la API remota con `NEXT_PUBLIC_API_BASE_URL`.

## Variables

| Variable | Uso |
| --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | Origen de la API en producción (obligatorio en mobile). Ej: `https://tu-app.vercel.app` |
| `NEXT_PUBLIC_AUTH_ENABLED` | `true` si querés login en la app nativa |
| `NEXT_PUBLIC_ANDROID_DOWNLOAD_URL` | Link del banner “Descargá la app” (solo mobile **web**) |
| `NEXT_PUBLIC_IOS_DOWNLOAD_URL` | Idem iOS |

El CSP web (`connect-src` en `next.config.ts`) incluye `NEXT_PUBLIC_API_BASE_URL` cuando está definida. Dentro de Capacitor el WebView carga archivos locales; el CSP de Next no aplica ahí.

## Build + sync

```bash
# 1) Export estático → out/
NEXT_PUBLIC_API_BASE_URL=https://tu-app.vercel.app \
NEXT_PUBLIC_AUTH_ENABLED=true \
  npm run build:mobile

# 2) Primera vez (genera /android y /ios — estánados en .gitignore)
npx cap add android
npx cap add ios   # macOS + Xcode

# 3) Copiar assets
npm run cap:sync   # o: npx cap sync

# 4) IDE
npx cap open android
npx cap open ios
```

Scripts:

- `build:mobile` — `node scripts/build-mobile.mjs` (export; aparta temporalmente `src/app/api`)
- `cap:sync` — `npx cap sync`

## Banner “Descargá la app”

`DownloadAppSection` en Configuración solo si `shouldShowDownloadAppBanner()`:

- navegador mobile **y**
- **no** estás dentro de la app Capacitor

Sin URLs de store, muestra copy de “llega pronto”.

## Notas

- Static export **no** incluye Route Handlers; auth/sync viven en Vercel.
- `[[...slug]]` define `generateStaticParams` para el export.
- Sesión Auth.js con cookie + origen distinto (Capacitor → Vercel) puede requerir ajustes de cookie/`AUTH_URL` más adelante; smoke-testeá login en el WebView.
- No commitear secretos; solo `NEXT_PUBLIC_*` van al cliente.
- Carpetas `/android` y `/ios` están en `.gitignore` hasta que decidas versionarlas.

## Related

- [DEPLOY.md](./DEPLOY.md) — Neon + Vercel + env vars
