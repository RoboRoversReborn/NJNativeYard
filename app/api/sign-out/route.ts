import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return NextResponse.json(
      { error: "Same-origin request required" },
      { status: 403 },
    );
  }
  return NextResponse.json(
    { ok: true, remoteRevoked: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
