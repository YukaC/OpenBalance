import { handlers } from "@/lib/auth";
import { type NextRequest, NextResponse } from "next/server";

function missingAuthSecretResponse() {
  if (process.env.AUTH_SECRET?.trim()) return null;
  return NextResponse.json(
    {
      error: "AUTH_SECRET_MISSING",
      message:
        "Set AUTH_SECRET in Vercel Environment Variables, then Redeploy.",
    },
    { status: 503 },
  );
}

export async function GET(request: NextRequest) {
  const missing = missingAuthSecretResponse();
  if (missing) return missing;
  return handlers.GET(request);
}

export async function POST(request: NextRequest) {
  const missing = missingAuthSecretResponse();
  if (missing) return missing;
  return handlers.POST(request);
}
