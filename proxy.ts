import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function proxy(_request: NextRequest) {
  return NextResponse.next();
}

export const config = { matcher: ["/", "/auth/:path*"] };
