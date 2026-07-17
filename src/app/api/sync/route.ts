import { NextResponse } from "next/server";
import { getDb, isDatabaseConfigured } from "@/db";
import {
  consumeRateLimit,
  getClientIp,
  RATE_LIMIT_WINDOW_MS,
  SYNC_RATE_LIMIT,
} from "@/lib/rate-limit";
import { logError, logInfo } from "@/lib/logger";
import { resolveRequestUserId } from "@/lib/resolve-request-user";
import {
  runSync,
  type SyncChanges,
  type SyncRequestBody,
} from "@/lib/sync-server";

export const runtime = "nodejs";

const MAX_SYNC_BODY_BYTES = 2_000_000;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseSyncBody(raw: unknown): SyncRequestBody | null {
  if (!isObject(raw)) return null;

  const lastSyncedAt =
    raw.lastSyncedAt === null || typeof raw.lastSyncedAt === "string"
      ? raw.lastSyncedAt
      : null;

  const changesRaw = isObject(raw.changes) ? raw.changes : {};
  const changes: SyncChanges = {};

  if (Array.isArray(changesRaw.transactions)) {
    changes.transactions = changesRaw.transactions as SyncChanges["transactions"];
  }
  if (Array.isArray(changesRaw.categories)) {
    changes.categories = changesRaw.categories as SyncChanges["categories"];
  }
  if (Array.isArray(changesRaw.budgets)) {
    changes.budgets = changesRaw.budgets as SyncChanges["budgets"];
  }
  if (Array.isArray(changesRaw.incomeSources)) {
    changes.incomeSources =
      changesRaw.incomeSources as SyncChanges["incomeSources"];
  }
  if (Array.isArray(changesRaw.userRules)) {
    changes.userRules = changesRaw.userRules as SyncChanges["userRules"];
  }
  if (Array.isArray(changesRaw.accounts)) {
    changes.accounts = changesRaw.accounts as SyncChanges["accounts"];
  }
  if (changesRaw.profile === null) {
    changes.profile = null;
  } else if (isObject(changesRaw.profile)) {
    changes.profile = changesRaw.profile as unknown as NonNullable<
      SyncChanges["profile"]
    >;
  }

  return { lastSyncedAt, changes };
}

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "Database unavailable", code: "DATABASE_UNAVAILABLE" },
      { status: 503 },
    );
  }

  const userId = await resolveRequestUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader) {
    const contentLength = Number(contentLengthHeader);
    if (
      Number.isFinite(contentLength) &&
      contentLength > MAX_SYNC_BODY_BYTES
    ) {
      return NextResponse.json(
        { error: "Payload too large", code: "PAYLOAD_TOO_LARGE" },
        { status: 413 },
      );
    }
  }

  const ip = getClientIp(request);
  const rateLimit = consumeRateLimit(
    `sync:${ip}:${userId}`,
    SYNC_RATE_LIMIT,
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

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const body = parseSyncBody(raw);
  if (!body) {
    return NextResponse.json({ error: "Invalid sync payload" }, { status: 400 });
  }

  try {
    const db = getDb();
    const result = await runSync(db, userId, body);
    logInfo({
      event: "sync.ok",
      userId,
      message: "Sync completed",
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    const code =
      error instanceof Error && "code" in error && typeof error.code === "string"
        ? error.code
        : undefined;
    logError({
      event: "sync.failed",
      userId,
      message,
      code: code ?? "SYNC_FAILED",
    });
    return NextResponse.json(
      { error: "Sync failed", code: "SYNC_FAILED" },
      { status: 500 },
    );
  }
}
