import { NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db";
import { profiles, users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { isValidEmail, verifyPassword } from "@/lib/auth-password";
import {
  CHANGE_EMAIL_RATE_LIMIT,
  consumeRateLimit,
  getClientIp,
  RATE_LIMIT_WINDOW_MS,
} from "@/lib/rate-limit";

export const runtime = "nodejs";

type ChangeEmailBody = {
  currentPassword?: unknown;
  newEmail?: unknown;
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
    `change-email:ip:${clientIp}:${userId}`,
    CHANGE_EMAIL_RATE_LIMIT,
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

  let body: ChangeEmailBody;
  try {
    body = (await request.json()) as ChangeEmailBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const currentPassword =
    typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newEmail =
    typeof body.newEmail === "string" ? body.newEmail.trim().toLowerCase() : "";

  if (!currentPassword) {
    return NextResponse.json(
      { error: "Current password is required" },
      { status: 400 },
    );
  }
  if (!isValidEmail(newEmail)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const db = getDb();
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.email.toLowerCase() === newEmail) {
    return NextResponse.json(
      { error: "New email must be different" },
      { status: 400 },
    );
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

  const [emailTaken] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, newEmail), ne(users.id, userId)))
    .limit(1);

  if (emailTaken) {
    return NextResponse.json(
      { error: "Email already in use" },
      { status: 409 },
    );
  }

  await db.update(users).set({ email: newEmail }).where(eq(users.id, userId));
  await db
    .update(profiles)
    .set({ email: newEmail, updatedAt: new Date() })
    .where(eq(profiles.userId, userId));

  return NextResponse.json({ ok: true, email: newEmail });
}
