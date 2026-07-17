import { handlers } from "@/lib/auth";
import { NextResponse } from "next/server";

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

export async function GET(request: Request) {
  const missing = missingAuthSecretResponse();
  if (missing) return missing;
  return handlers.GET(request);
}

export async function POST(request: Request) {
  const missing = missingAuthSecretResponse();
  if (missing) return missing;
  return handlers.POST(request);
}
