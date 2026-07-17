import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db";

export const runtime = "nodejs";

export async function GET() {
  const databaseConfigured = isDatabaseConfigured();

  if (!databaseConfigured) {
    return NextResponse.json({
      ok: true,
      databaseConfigured: false,
    });
  }

  const startedAt = Date.now();
  try {
    const db = getDb();
    await db.execute(sql`SELECT 1`);
    return NextResponse.json({
      ok: true,
      databaseConfigured: true,
      latencyMs: Date.now() - startedAt,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Database check failed";
    console.error("[health]", message);
    return NextResponse.json(
      {
        ok: false,
        databaseConfigured: true,
        latencyMs: Date.now() - startedAt,
      },
      { status: 503 },
    );
  }
}
