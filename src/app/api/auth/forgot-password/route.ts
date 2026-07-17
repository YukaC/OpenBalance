import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db";
import { passwordResetTokens, users } from "@/db/schema";
import { isValidEmail } from "@/lib/auth-password";
import {
  buildResetUrl,
  createResetToken,
  hashResetToken,
  PASSWORD_RESET_TTL_MS,
  shouldExposeResetUrl,
  trySendResetEmail,
} from "@/lib/password-reset";
import { logError, logInfo } from "@/lib/logger";
import {
  consumeRateLimit,
  FORGOT_PASSWORD_RATE_LIMIT,
  getClientIp,
  RATE_LIMIT_WINDOW_MS,
} from "@/lib/rate-limit";

export const runtime = "nodejs";

type ForgotBody = {
  email?: unknown;
};

function createId(prefix: string): string {
  const randomUuid = globalThis.crypto?.randomUUID?.();
  if (randomUuid) return `${prefix}-${randomUuid}`;
  return `${prefix}-${Date.now().toString(36)}`;
}

const GENERIC_OK_MESSAGE =
  "Si ese email está registrado, vas a recibir instrucciones para restablecer la contraseña.";

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "Database unavailable", code: "DATABASE_UNAVAILABLE" },
      { status: 503 },
    );
  }

  const clientIp = getClientIp(request);
  const ipLimit = consumeRateLimit(
    `forgot-password:ip:${clientIp}`,
    FORGOT_PASSWORD_RATE_LIMIT,
    RATE_LIMIT_WINDOW_MS,
  );
  if (!ipLimit.isAllowed) {
    return NextResponse.json(
      { error: "Too many requests", code: "RATE_LIMITED" },
      {
        status: 429,
        headers: { "Retry-After": String(ipLimit.retryAfterSeconds) },
      },
    );
  }

  let body: ForgotBody;
  try {
    body = (await request.json()) as ForgotBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const emailLimit = consumeRateLimit(
    `forgot-password:email:${email}`,
    FORGOT_PASSWORD_RATE_LIMIT,
    RATE_LIMIT_WINDOW_MS,
  );
  if (!emailLimit.isAllowed) {
    return NextResponse.json(
      { error: "Too many requests", code: "RATE_LIMITED" },
      {
        status: 429,
        headers: { "Retry-After": String(emailLimit.retryAfterSeconds) },
      },
    );
  }

  const db = getDb();
  const [user] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  // Always return the same shape when the email is unknown (no enumeration).
  if (!user) {
    logInfo({
      event: "forgot_password.unknown_email",
      message: "Forgot-password requested for unknown email",
    });
    return NextResponse.json({ ok: true, message: GENERIC_OK_MESSAGE });
  }

  const rawToken = createResetToken();
  const tokenHash = hashResetToken(rawToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + PASSWORD_RESET_TTL_MS);
  const resetUrl = buildResetUrl(rawToken);

  try {
    await db
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, user.id));

    await db.insert(passwordResetTokens).values({
      id: createId("prt"),
      userId: user.id,
      tokenHash,
      expiresAt,
      createdAt: now,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    logError({
      event: "forgot_password.failed",
      userId: user.id,
      message,
      code: "FORGOT_PASSWORD_FAILED",
    });
    return NextResponse.json(
      { error: "Request failed", code: "FORGOT_PASSWORD_FAILED" },
      { status: 500 },
    );
  }

  const wasEmailSent = await trySendResetEmail(user.email, resetUrl);

  if (!wasEmailSent) {
    logInfo({
      event: "forgot_password.reset_url_dev",
      userId: user.id,
      message: `Reset URL (email not sent): ${resetUrl}`,
    });
  } else {
    logInfo({
      event: "forgot_password.email_sent",
      userId: user.id,
      message: "Password reset email sent",
    });
  }

  const payload: {
    ok: true;
    message: string;
    resetUrl?: string;
  } = {
    ok: true,
    message: GENERIC_OK_MESSAGE,
  };

  if (shouldExposeResetUrl()) {
    payload.resetUrl = resetUrl;
  }

  return NextResponse.json(payload);
}
