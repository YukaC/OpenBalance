import type { NextConfig } from "next";

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

const isProduction = process.env.NODE_ENV === "production";

// Next.js still needs 'unsafe-inline' for script/style without a nonce/hash
// middleware pipeline (H9). Removing it here would break the App Router.
// 'unsafe-eval' is kept in development for HMR/devtools; omitted in production.
const scriptSrc = isProduction
  ? "script-src 'self' 'unsafe-inline'"
  : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";

const contentSecurityPolicy = [
  "default-src 'self'",
  scriptSrc,
  // Allow same-origin Service Worker (/sw.js) and dedicated/shared workers.
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
  poweredByHeader: false,
  // Allow HMR when opening the app via LAN IP
  allowedDevOrigins: ["192.168.0.233", "127.0.0.1"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
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
          {
            key: "Content-Security-Policy",
            value: contentSecurityPolicy,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
