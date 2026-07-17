/**
 * Resolve the authenticated user id from cookie session or Bearer JWT (C1).
 */

import { getToken } from "next-auth/jwt";
import { auth, isAuthSecretConfigured } from "@/lib/auth";

/** Same salt Auth.js uses for the default session cookie name. */
export const AUTH_SESSION_SALT = "authjs.session-token";

export async function resolveRequestUserId(
  request: Request,
): Promise<string | null> {
  const session = await auth();
  if (session?.user?.id) return session.user.id;

  if (!isAuthSecretConfigured()) return null;

  try {
    const token = await getToken({
      req: request,
      secret: process.env.AUTH_SECRET,
      salt: AUTH_SESSION_SALT,
    });
    if (!token) return null;
    if (typeof token.id === "string" && token.id) return token.id;
    if (typeof token.sub === "string" && token.sub) return token.sub;
    return null;
  } catch {
    return null;
  }
}
