import type { NextRequest } from "next/server";
import { updateSession } from "./lib/account/session";
export async function proxy(request: NextRequest) {
  return updateSession(request);
}
export const config = { matcher: ["/", "/auth/:path*"] };
