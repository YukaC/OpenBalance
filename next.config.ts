import type { NextConfig } from "next";

const isStaticExport = process.env.NEXT_OUTPUT === "export";
const isProduction = process.env.NODE_ENV === "production";

function buildConnectSrc(): string {
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

/**
 * H9 CSP strategy:
 * - SSR (Vercel): middleware sets per-request CSP with script nonces (no
 *   'unsafe-inline' / 'unsafe-eval' in production). Do NOT also set CSP here —
 *   duplicate CSP headers are AND-combined and would break the page.
 * - Static export (Capacitor): middleware does not run; keep a static CSP with
 *   'unsafe-inline' for scripts so the theme bootstrap + Next chunks work.
 * - style-src keeps 'unsafe-inline' in both paths (Tailwind / runtime styles).
 */
const scriptSrcForExport = isProduction
  ? "script-src 'self' 'unsafe-inline'"
  : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";

const staticExportCsp = [
  "default-src 'self'",
  scriptSrcForExport,
  "worker-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  buildConnectSrc(),
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  ...(isStaticExport ? { output: "export" as const } : {}),
  poweredByHeader: false,
  // Allow HMR when opening the app via LAN IP
  allowedDevOrigins: ["192.168.0.233", "127.0.0.1"],
  async headers() {
    const securityHeaders = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      {
        key: "Referrer-Policy",
        value: "strict-origin-when-cross-origin",
      },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()",
      },
    ];

    if (isStaticExport) {
      securityHeaders.push({
        key: "Content-Security-Policy",
        value: staticExportCsp,
      });
    }

    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
