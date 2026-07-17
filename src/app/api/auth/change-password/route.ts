import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db";
import { users } from "@/db/schema";
import { auth } from "@/lib/auth";
import {
  hashPassword,
  isValidPassword,
  verifyPassword,
} from "@/lib/auth-password";
import {
  CHANGE_PASSWORD_RATE_LIMIT,
  consumeRateLimit,
  getClientIp,
  RATE_LIMIT_WINDOW_MS,
} from "@/lib/rate-limit";

export const runtime = "nodejs";

type ChangePasswordBody = {
  currentPassword?: unknown;
  newPassword?: unknown;
};

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "Database unavailable", code: "DATABASE_UNAVAILABLE" },
      { status: 503 },
    );
  }

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientIp = getClientIp(request);
  const ipLimit = consumeRateLimit(
    `change-password:ip:${clientIp}:${userId}`,
    CHANGE_PASSWORD_RATE_LIMIT,
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

  let body: ChangePasswordBody;
  try {
    body = (await request.json()) as ChangePasswordBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const currentPassword =
    typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword =
    typeof body.newPassword === "string" ? body.newPassword : "";

  if (!currentPassword) {
    return NextResponse.json(
      { error: "Current password is required" },
      { status: 400 },
    );
  }
  if (!isValidPassword(newPassword)) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 },
    );
  }
  if (currentPassword === newPassword) {
    return NextResponse.json(
      { error: "New password must be different" },
      { status: 400 },
    );
  }

  const db = getDb();
  const [user] = await db
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isCurrentValid = await verifyPassword(
    currentPassword,
    user.passwordHash,
  );
  if (!isCurrentValid) {
    return NextResponse.json(
      { error: "Current password is incorrect" },
      { status: 400 },
    );
  }

  const passwordHash = await hashPassword(newPassword);
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));

  return NextResponse.json({ ok: true });
}
