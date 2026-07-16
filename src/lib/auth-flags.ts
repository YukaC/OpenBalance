/**
 * Cloud auth gate for Rinde.
 *
 * Local-first default: auth is OFF unless explicitly enabled.
 * Set `NEXT_PUBLIC_AUTH_ENABLED=true` only when Auth.js + DB are configured
 * (see `.env.example` / docs/DEPLOY.md). Local dev without a database keeps
 * working because the AuthScreen gate is skipped.
 */
export function isAuthEnabled(): boolean {
  return process.env.NEXT_PUBLIC_AUTH_ENABLED === "true";
}

/** Same-origin by default; Capacitor/mobile sets the Vercel URL. */
export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
}
