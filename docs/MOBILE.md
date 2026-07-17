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

# 2) Primera vez (genera /android y /ios — ignorados en .gitignore)
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

## Soft native behavior (sin plugins extra)

Hoy solo están instalados `@capacitor/core` / `android` / `ios` / `cli`. Sin pedir deps nuevas:

| Ítem | Qué hay hoy | Límite |
| --- | --- | --- |
| **K1 Backup export** | `downloadJsonFile` intenta Web Share (`navigator.share` + `File`) en mobile/native; si falla → `<a download>` | En WebView el download casi no funciona; Share ayuda a “guardar/enviar”. Guardar a disco nativo requiere plugins abajo. |
| **K2 Back** | `src/lib/android-back.ts` — al abrir el form de transacción se hace `pushState`; el back físico (que suele mapear a `history.back()`) cierra el form | No intercepta salir de la app ni prioridad total; hace falta `@capacitor/app` + `backButton`. |
| **K5 Safe-area** | CSS `--safe-top/bottom/left/right` desde `env(safe-area-inset-*)` | Usar las vars en layouts que toquen bordes en landscape. |

## Checklist — plugins / assets a agregar después (pedir OK de deps)

No instalar sin acuerdo; lista para cuando se apruebe:

| Prioridad | Paquete / asset | Para qué |
| --- | --- | --- |
| P1 | `@capacitor/filesystem` | Guardar backup JSON en Documents/Downloads nativo |
| P1 | `@capacitor/share` | Sheet nativo de share/export (más fiable que Web Share en WebView) |
| P1 | `@capacitor/app` | `App.addListener("backButton", …)` — cerrar form/sección antes de `App.exitApp()` |
| P2 | `@capacitor/splash-screen` | Splash de marca al arrancar el APK/IPA |
| P2 | `@capacitor/haptics` | Feedback táctil en FAB / confirmaciones |
| P2 | PNG icons 192×192 y 512×512 (any + maskable) | PWA + stores; hoy solo `public/icons/icon.svg` |
| P2 | Adaptive icon / splash assets en `/android` y `/ios` | Branding nativo post-`cap add` |

## Iconos y manifest (estado actual)

- `public/manifest.webmanifest` apunta solo a `/icons/icon.svg` (any + maskable).
- **Faltan** PNG rasterizados 192/512 y maskable dedicados — iOS/Android y algunos launchers no usan SVG bien.
- El `<link rel="apple-touch-icon">` (si existe en el layout) suele necesitar PNG 180×180.
- Splash nativo: no configurado hasta `@capacitor/splash-screen` + assets.

## Notas

- Static export **no** incluye Route Handlers; auth/sync viven en Vercel.
- `[[...slug]]` define `generateStaticParams` para el export.
- Sesión Auth.js con cookie + origen distinto (Capacitor → Vercel) puede requerir ajustes de cookie/`AUTH_URL` más adelante; smoke-testeá login en el WebView.
- No commitear secretos; solo `NEXT_PUBLIC_*` van al cliente.
- Carpetas `/android` y `/ios` están en `.gitignore` hasta que decidas versionarlas.

## Related

- [DEPLOY.md](./DEPLOY.md) — Neon + Vercel + env vars
- [IMPLEMENTATION-PLAN.md](./IMPLEMENTATION-PLAN.md) — Fase K (mobile nativo avanzado)
