import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const response = NextResponse.redirect(
    new URL("/?view=home&resume=1", request.url),
  );
  if (code && url && key) {
    const client = createServerClient(url, key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (items) => {
          for (const { name, value, options } of items)
            response.cookies.set(name, value, options);
        },
      },
    });
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) return response;
  }
  return NextResponse.redirect(
    new URL("/?view=signin&error=signin_failed", request.url),
  );
}
