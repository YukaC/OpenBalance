import { eq } from "drizzle-orm";
import { encode } from "next-auth/jwt";
import { NextResponse } from "next/server";
import { getDb, isDatabaseConfigured } from "@/db";
import { users } from "@/db/schema";
import {
  assertAuthSecret,
  isAuthSecretConfigured,
} from "@/lib/auth";
import { verifyPassword } from "@/lib/auth-password";
import {
  consumeRateLimit,
  getClientIp,
  isRateLimitExceeded,
  LOGIN_FAILED_RATE_LIMIT,
  RATE_LIMIT_WINDOW_MS,
  resetRateLimit,
} from "@/lib/rate-limit";
import { AUTH_SESSION_SALT } from "@/lib/resolve-request-user";
import { logError } from "@/lib/logger";

export const runtime = "nodejs";

const NATIVE_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function loginRateLimitKey(ip: string, email: string): string {
  return `native-login:${ip}:${email}`;
}

export async function POST(request: Request) {
  if (!isAuthSecretConfigured()) {
    return NextResponse.json(
      {
        error: "AUTH_SECRET_MISSING",
        message: "Set AUTH_SECRET in the environment, then restart.",
      },
      { status: 503 },
    );
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "Database unavailable" },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email =
    typeof body === "object" &&
    body !== null &&
    typeof (body as { email?: unknown }).email === "string"
      ? (body as { email: string }).email.trim().toLowerCase()
      : "";
  const password =
    typeof body === "object" &&
    body !== null &&
    typeof (body as { password?: unknown }).password === "string"
      ? (body as { password: string }).password
      : "";

  if (!email || !password) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 400 });
  }

  const ip = getClientIp(request);
  const rateKey = loginRateLimitKey(ip, email);

  if (isRateLimitExceeded(rateKey, LOGIN_FAILED_RATE_LIMIT)) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  }

  try {
    assertAuthSecret();
    const db = getDb();
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      consumeRateLimit(rateKey, LOGIN_FAILED_RATE_LIMIT, RATE_LIMIT_WINDOW_MS);
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      consumeRateLimit(rateKey, LOGIN_FAILED_RATE_LIMIT, RATE_LIMIT_WINDOW_MS);
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    resetRateLimit(rateKey);

    const token = await encode({
      token: {
        sub: user.id,
        id: user.id,
        email: user.email,
        name: user.name,
      },
      secret: process.env.AUTH_SECRET!,
      salt: AUTH_SESSION_SALT,
      maxAge: NATIVE_TOKEN_MAX_AGE_SECONDS,
    });

    return NextResponse.json({
      token,
      user: { id: user.id, email: user.email, name: user.name },
      expiresIn: NATIVE_TOKEN_MAX_AGE_SECONDS,
    });
  } catch (error) {
    logError({
      event: "native-token.failed",
      message: error instanceof Error ? error.message : "Login failed",
    });
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
