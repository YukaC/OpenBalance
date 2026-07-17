import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db";
import { users } from "@/db/schema";
import { verifyPassword } from "@/lib/auth-password";
import {
  consumeRateLimit,
  getClientIp,
  isRateLimitExceeded,
  LOGIN_FAILED_RATE_LIMIT,
  RATE_LIMIT_WINDOW_MS,
  resetRateLimit,
} from "@/lib/rate-limit";

export function isAuthSecretConfigured(): boolean {
  return Boolean(process.env.AUTH_SECRET?.trim());
}

/** Throws with a clear message when AUTH_SECRET is missing. */
export function assertAuthSecret(): void {
  if (isAuthSecretConfigured()) return;
  throw new Error(
    "AUTH_SECRET is not configured. Set AUTH_SECRET in the environment, then restart.",
  );
}

function loginRateLimitKey(ip: string, email: string): string {
  return `login:${ip}:${email}`;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Explicit so missing Vercel env fails clearly instead of opaque 500s.
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        assertAuthSecret();

        if (!isDatabaseConfigured()) {
          return null;
        }

        const email =
          typeof credentials?.email === "string"
            ? credentials.email.trim().toLowerCase()
            : "";
        const password =
          typeof credentials?.password === "string" ? credentials.password : "";

        if (!email || !password) return null;

        const ip =
          request instanceof Request ? getClientIp(request) : "unknown";
        const rateKey = loginRateLimitKey(ip, email);

        if (isRateLimitExceeded(rateKey, LOGIN_FAILED_RATE_LIMIT)) {
          return null;
        }

        const db = getDb();
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (!user) {
          consumeRateLimit(
            rateKey,
            LOGIN_FAILED_RATE_LIMIT,
            RATE_LIMIT_WINDOW_MS,
          );
          return null;
        }

        const isValid = await verifyPassword(password, user.passwordHash);
        if (!isValid) {
          consumeRateLimit(
            rateKey,
            LOGIN_FAILED_RATE_LIMIT,
            RATE_LIMIT_WINDOW_MS,
          );
          return null;
        }

        resetRateLimit(rateKey);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user, trigger, session }) {
      if (user?.id) {
        token.id = user.id;
      }
      if (typeof user?.email === "string") {
        token.email = user.email;
      }
      if (
        trigger === "update" &&
        session &&
        typeof session === "object" &&
        "email" in session &&
        typeof session.email === "string"
      ) {
        token.email = session.email;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && typeof token.id === "string") {
        session.user.id = token.id;
      }
      if (session.user && typeof token.email === "string") {
        session.user.email = token.email;
      }
      return session;
    },
  },
});
