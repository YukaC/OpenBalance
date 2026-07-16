import { NextResponse } from "next/server";
import { getDb, isDatabaseConfigured } from "@/db";
import { auth } from "@/lib/auth";
import {
  runSync,
  type SyncChanges,
  type SyncRequestBody,
} from "@/lib/sync-server";

export const runtime = "nodejs";

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

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    return NextResponse.json(result);
  } catch (error) {
    console.error("[sync]", error);
    return NextResponse.json(
      { error: "Sync failed", code: "SYNC_FAILED" },
      { status: 500 },
    );
  }
}
