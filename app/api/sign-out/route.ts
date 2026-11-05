import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { authCookieNames } from "@/lib/account/logout";
export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return NextResponse.json(
      { error: "Same-origin request required" },
      { status: 403 },
    );
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let remoteRevoked = false;
  const response = NextResponse.json(
    { ok: true, remoteRevoked: false },
    { headers: { "Cache-Control": "no-store" } },
  );
  if (url && key) {
    try {
      const client = createServerClient(url, key, {
        global: {
          fetch: async (input, init) =>
            fetch(input, {
              ...init,
              signal: AbortSignal.any([
                ...(init?.signal ? [init.signal] : []),
                AbortSignal.timeout(6000),
              ]),
            }),
        },
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: (items) => {
            for (const { name, value, options } of items)
              response.cookies.set(name, value, options);
          },
        },
      });
      const { error } = await client.auth.signOut({ scope: "local" });
      remoteRevoked = !error;
    } catch {
      /* Local cookie removal is unconditional; remote revocation remains unconfirmed. */
    }
  }
  if (url)
    for (const name of authCookieNames(
      request.headers.get("cookie") || "",
      url,
    ))
      response.cookies.set(name, "", { path: "/", maxAge: 0, sameSite: "lax" });
  const finalResponse = NextResponse.json(
    { ok: true, remoteRevoked },
    { headers: { "Cache-Control": "no-store" } },
  );
  for (const cookie of response.cookies.getAll())
    finalResponse.cookies.set(cookie);
  return finalResponse;
}
