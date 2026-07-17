import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db";
import { passwordResetTokens, users } from "@/db/schema";
import { hashPassword, isValidPassword } from "@/lib/auth-password";
import { hashResetToken } from "@/lib/password-reset";
import {
  consumeRateLimit,
  getClientIp,
  RATE_LIMIT_WINDOW_MS,
  RESET_PASSWORD_RATE_LIMIT,
} from "@/lib/rate-limit";

export const runtime = "nodejs";

type ResetBody = {
  token?: unknown;
  password?: unknown;
};

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "Database unavailable", code: "DATABASE_UNAVAILABLE" },
      { status: 503 },
    );
  }

  const clientIp = getClientIp(request);
  const ipLimit = consumeRateLimit(
    `reset-password:ip:${clientIp}`,
    RESET_PASSWORD_RATE_LIMIT,
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

  let body: ResetBody;
  try {
    body = (await request.json()) as ResetBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!token) {
    return NextResponse.json({ error: "Token is required" }, { status: 400 });
  }
  if (!isValidPassword(password)) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 },
    );
  }

  const tokenHash = hashResetToken(token);
  const db = getDb();
  const [row] = await db
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.tokenHash, tokenHash))
    .limit(1);

  if (!row || row.expiresAt.getTime() <= Date.now()) {
    if (row) {
      await db
        .delete(passwordResetTokens)
        .where(eq(passwordResetTokens.id, row.id));
    }
    return NextResponse.json(
      { error: "Invalid or expired token" },
      { status: 400 },
    );
  }

  const passwordHash = await hashPassword(password);

  await db
    .update(users)
    .set({ passwordHash })
    .where(eq(users.id, row.userId));

  await db
    .delete(passwordResetTokens)
    .where(eq(passwordResetTokens.userId, row.userId));

  return NextResponse.json({ ok: true });
}
