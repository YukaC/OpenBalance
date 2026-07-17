"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";
import { getApiBaseUrl } from "@/lib/auth-flags";

/**
 * Auth.js client session context.
 * Safe to mount even when NEXT_PUBLIC_AUTH_ENABLED is false — the AppShell
 * gate simply ignores session status in local-only mode.
 *
 * When `NEXT_PUBLIC_API_BASE_URL` is set (Capacitor / remote API), point the
 * session client at that origin so `/api/auth/session` hits Vercel.
 */
export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const apiBase = getApiBaseUrl();
  return (
    <SessionProvider basePath={apiBase ? `${apiBase}/api/auth` : undefined}>
      {children}
    </SessionProvider>
  );
}
