# OpenBalance — Capacitor mobile

Empaquetar la web estática en Android/iOS con Capacitor. El backend (auth/sync) sigue en Vercel.

## Idea

- `pnpm build` → Next normal en Vercel (SSR + API routes).
- `pnpm build:mobile` → `NEXT_OUTPUT=export` → carpeta `out/` (static).
- La app nativa carga `out/` y llama a la API remota con `NEXT_PUBLIC_API_BASE_URL`.

## Variables

| Variable | Uso |
| --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | Origen de la API en producción (obligatorio en mobile). Ej: `https://tu-app.vercel.app` |
| `NEXT_PUBLIC_AUTH_ENABLED` | `true` si querés login en la app nativa |
| `NEXT_PUBLIC_ANDROID_DOWNLOAD_URL` | Link del banner “Descargá la app” (solo mobile **web**) |
| `NEXT_PUBLIC_IOS_DOWNLOAD_URL` | Idem iOS |
| `AUTH_URL` | (servidor) URL canónica de la app web Auth.js, ej. `https://tu-app.vercel.app` |
| `AUTH_SECRET` | (servidor) secreto JWT / cookies Auth.js |

El CSP web (`connect-src` en `next.config.ts`) incluye `NEXT_PUBLIC_API_BASE_URL` cuando está definida. Dentro de Capacitor el WebView carga archivos locales; el CSP de Next no aplica ahí.

## Build + sync (C2)

```bash
# 1) Export estático → out/
NEXT_PUBLIC_API_BASE_URL=https://tu-app.vercel.app \
NEXT_PUBLIC_AUTH_ENABLED=true \
  pnpm build:mobile

# 2) Primera vez (genera /android y /ios — ignorados en .gitignore)
npx cap add android
npx cap add ios   # macOS + Xcode

# 3) Copiar assets + plugins nativos
pnpm cap:sync   # o: npx cap sync

# 4) IDE → firmar APK/AAB o IPA
npx cap open android
npx cap open ios
```

Scripts:

- `build:mobile` — `node scripts/build-mobile.mjs` (export; aparta temporalmente `src/app/api`)
- `cap:sync` — `npx cap sync`
- `node scripts/generate-icons.mjs` — regenera PNG 180/192/512 desde `icon.svg` (usa `sharp` si está en node_modules)

Pipeline típico: `pnpm build:mobile` → `pnpm cap:sync` → abrir Android Studio / Xcode → generar APK/AAB firmado.

### Firma Android (sin keystore real en el repo)

No commitear keystores ni passwords. Flujo típico en Android Studio:

1. **Build → Generate Signed Bundle / APK**.
2. Crear un keystore local (`*.jks` / `*.keystore`) fuera del repo (o en un path gitignored).
3. Guardar alias + passwords en un gestor de secretos / CI secrets (`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEY_ALIAS`, …).
4. Para debug diario alcanza el debug keystore de Android Studio; para Play Store necesitás el release keystore + AAB.

iOS: certificados/provisioning en Xcode / App Store Connect (fuera de este repo).

## Auth nativa (C1) — cookies vs Bearer

En Capacitor el WebView tiene origen distinto al API de Vercel (`https://localhost` / `capacitor://` / scheme propio). Las cookies de sesión Auth.js **suelen no cruzar** ese origen.

### Qué hacer en Vercel (si probás cookies)

- `AUTH_URL=https://tu-app.vercel.app` (origen canónico del sitio, no el WebView).
- Cookies de sesión con `Secure` + `SameSite=None` si alguna vez querés cookie cross-site (Auth.js / trustHost). En la práctica el path KISS de OpenBalance **no depende** de eso en native.

### Path KISS que usa la app nativa

1. Login/registro llama a `POST /api/auth/native-token` (email + password).
2. El JWT cifrado (Auth.js `encode`, salt `authjs.session-token`) se guarda en `@capacitor/preferences` (fallback `localStorage`).
3. `pushPullSync` envía `Authorization: Bearer <token>` además de `credentials: "include"`.
4. `/api/sync` resuelve usuario por cookie **o** Bearer (`resolveRequestUserId` / `getToken`).

En web el flujo sigue siendo Auth.js + cookies (`signIn`).

## Banner “Descargá la app” (C3)

`DownloadAppSection` en Configuración solo si `shouldShowDownloadAppBanner()`:

- navegador mobile **y**
- **no** estás dentro de la app Capacitor

URLs: `NEXT_PUBLIC_ANDROID_DOWNLOAD_URL` / `NEXT_PUBLIC_IOS_DOWNLOAD_URL`. Sin URLs de store, muestra copy de “llega pronto”.

## Plugins Capacitor instalados

| Paquete | Uso |
| --- | --- |
| `@capacitor/preferences` | Token de auth nativo (C1) + flags biométricos |
| `@capacitor/filesystem` + `@capacitor/share` | Backup export nativo (K1) |
| `@capacitor/app` | Back button Android (K2) + deep links `getLaunchUrl` / `appUrlOpen` (K6) |
| `@capacitor/splash-screen` | Splash de marca (K3) — config en `capacitor.config.ts` |
| `@capacitor/haptics` | FAB + guardado de movimiento (K4) |
| `@capacitor/local-notifications` | Recordatorio día de cobro (E3) |
| `@aparajita/capacitor-biometric-auth` | Desbloqueo biométrico opcional (S4) |

Todos los imports van detrás de `isRunningInNativeApp()` + dynamic `import()` para no romper `pnpm build` / `pnpm typecheck` en web.

## Comportamiento nativo

| Ítem | Comportamiento |
| --- | --- |
| **K1 Backup** | En native: escribe JSON en Cache + sheet de Share. Fallback web: Web Share → `<a download>`. |
| **K2 Back** | `App.addListener("backButton")`: cierra form → vuelve a Resumen → `exitApp()`. También se mantiene el soft history overlay. |
| **K3 Splash / icons** | Splash configurado en `capacitor.config.ts`. PNGs 192/512 (+ apple-touch 180) en `public/icons/`. |
| **K4 Haptics** | Impacto liviano al abrir FAB; success al guardar movimiento. |
| **K5 Safe-area** | CSS `--safe-top/bottom/left/right`; `--page-pad-left/right` asimétricos en shell, dock, FAB, sheets y pantallas de gate. |
| **K6 Deep links** | Stub: `App.getLaunchUrl` + `appUrlOpen` + tap de notificación → `openbalance://income` abre form de ingreso. Intent filters nativos al versionar `/android` `/ios`. |
| **E3 Payday** | `syncNativePaydayNotification` agenda aviso semanal 09:00 el día de cobro. Tap → deep link ingreso. |
| **S4 Biometría** | Con PIN activo, toggle en Configuración. Guarda PIN local tras autenticar; el cifrado sigue siendo la clave derivada del PIN. |

## Iconos y manifest

- `public/manifest.webmanifest` apunta a PNG 192/512 (any + maskable) y al SVG.
- Apple touch: `icon-180.png` (ver `layout.tsx`).
- Regenerar: `node scripts/generate-icons.mjs` (requiere `sharp` disponible).
- Tras `cap add`, copiá adaptive icons / splash resources a los proyectos nativos.

## Checklist (C / K / E3 / S4)

| Ítem | Estado |
| --- | --- |
| C1 Sesión Capacitor ↔ Vercel (Bearer + Preferences) | **done** |
| C2 `pnpm build:mobile` + docs firma | **done** (firma documentada; keystore no en repo) |
| C3 Banner + env download URLs | **done** |
| K1 Backup Filesystem + Share | **done** |
| K2 Android `backButton` | **done** |
| K3 Splash + PNG icons + maskable | **done** (splash nativo de plataforma: partial hasta versionar `/android`) |
| K4 Haptics FAB / save | **done** |
| K5 Safe-area L/R | **done** |
| K6 Deep link stub (`getLaunchUrl` / `appUrlOpen`) | **done** (scheme/intents nativos: partial) |
| E3 Local Notifications payday | **done** |
| S4 Biometric unlock opcional | **done** |

## Notas

- Static export **no** incluye Route Handlers; auth/sync viven en Vercel.
- `[[...slug]]` define `generateStaticParams` para el export.
- No commitear secretos; solo `NEXT_PUBLIC_*` van al cliente.
- Carpetas `/android` y `/ios` están en `.gitignore` hasta que decidas versionarlas.

## Related

- [DEPLOY.md](./DEPLOY.md) — Neon + Vercel + env vars
- [IMPLEMENTATION-PLAN.md](./IMPLEMENTATION-PLAN.md) — Fases C / K / E3 / S4
