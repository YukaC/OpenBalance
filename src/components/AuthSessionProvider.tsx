"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

/**
 * Auth.js client session context.
 * Safe to mount even when NEXT_PUBLIC_AUTH_ENABLED is false — the AppShell
 * gate simply ignores session status in local-only mode.
 */
export function AuthSessionProvider({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
