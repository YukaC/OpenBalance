import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db";
import { accounts, profiles, users } from "@/db/schema";
import {
  hashPassword,
  isValidEmail,
  isValidPassword,
} from "@/lib/auth-password";
import {
  consumeRateLimit,
  getClientIp,
  RATE_LIMIT_WINDOW_MS,
  REGISTER_RATE_LIMIT,
} from "@/lib/rate-limit";

export const runtime = "nodejs";

type RegisterBody = {
  email?: unknown;
  password?: unknown;
  name?: unknown;
};

function createId(prefix: string): string {
  const randomUuid = globalThis.crypto?.randomUUID?.();
  if (randomUuid) return `${prefix}-${randomUuid}`;
  return `${prefix}-${Date.now().toString(36)}`;
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "Database unavailable", code: "DATABASE_UNAVAILABLE" },
      { status: 503 },
    );
  }

  const ip = getClientIp(request);
  const rateLimit = consumeRateLimit(
    `register:${ip}`,
    REGISTER_RATE_LIMIT,
    RATE_LIMIT_WINDOW_MS,
  );
  if (!rateLimit.isAllowed) {
    return NextResponse.json(
      {
        error: "Too many requests",
        code: "RATE_LIMITED",
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  let body: RegisterBody;
  try {
    body = (await request.json()) as RegisterBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }
  if (!isValidPassword(password)) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 },
    );
  }
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const db = getDb();
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  // Anti-enumeration: do not reveal that the email is already registered.
  if (existing) {
    return NextResponse.json(
      {
        ok: true,
        message: "If the email is valid, the account was created.",
      },
      { status: 200 },
    );
  }

  const userId = createId("user");
  const accountId = createId("acc");
  const passwordHash = await hashPassword(password);
  const now = new Date();

  await db.insert(users).values({
    id: userId,
    email,
    passwordHash,
    name,
    createdAt: now,
  });

  await db.insert(accounts).values({
    id: accountId,
    userId,
    name: "Principal",
    currency: "ARS",
    updatedAt: now,
    deletedAt: null,
  });

  await db.insert(profiles).values({
    userId,
    clientId: userId,
    name,
    email,
    defaultCurrency: "ARS",
    paydayWeekday: "viernes",
    initials: initialsFromName(name),
    isSetupComplete: false,
    defaultAccountId: accountId,
    shouldRemindPaydayLoad: false,
    updatedAt: now,
    deletedAt: null,
  });

  return NextResponse.json(
    {
      id: userId,
      email,
      name,
    },
    { status: 201 },
  );
}
