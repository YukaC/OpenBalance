/**
 * Shared CSP helpers for middleware (SSR nonces) and next.config (static export).
 * H9: production script-src uses nonces via middleware — no 'unsafe-inline' / 'unsafe-eval'.
 */

export function buildConnectSrcDirective(): string {
  const sources = new Set<string>(["'self'"]);
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (apiBase) {
    try {
      sources.add(new URL(apiBase).origin);
    } catch {
      // Ignore invalid URL — keep CSP on 'self' only.
    }
  }
  return `connect-src ${Array.from(sources).join(" ")}`;
}

export type CspOptions = {
  /** Per-request nonce for script-src (SSR middleware). Omit for static export. */
  nonce?: string;
  isDev?: boolean;
  /**
   * When true (Capacitor static export / no middleware), allow inline scripts.
   * Prefer nonces on the Vercel SSR path.
   */
  allowUnsafeInlineScripts?: boolean;
};

/**
 * Build a CSP header value.
 * - SSR + nonce: script-src 'self' 'nonce-…' 'strict-dynamic' (no unsafe-inline/eval in prod)
 * - Static export: script-src keeps 'unsafe-inline' because middleware cannot run
 * - style-src always allows 'unsafe-inline' (Tailwind / runtime styles)
 */
export function buildContentSecurityPolicy(options: CspOptions = {}): string {
  const isDev = options.isDev ?? process.env.NODE_ENV === "development";
  const { nonce, allowUnsafeInlineScripts = false } = options;

  let scriptSrc: string;
  if (nonce) {
    scriptSrc = isDev
      ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`
      : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`;
  } else if (allowUnsafeInlineScripts) {
    scriptSrc = isDev
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
      : "script-src 'self' 'unsafe-inline'";
  } else {
    scriptSrc = isDev
      ? "script-src 'self' 'unsafe-eval'"
      : "script-src 'self'";
  }

  return [
    "default-src 'self'",
    scriptSrc,
    // Allow same-origin Service Worker (/sw.js) and dedicated/shared workers.
    "worker-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    buildConnectSrcDirective(),
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}
