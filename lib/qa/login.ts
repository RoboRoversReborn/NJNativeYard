import { NextResponse } from "next/server";
import { isLocalQaRequest, type QaEnvironment } from "./gate";
import {
  loadQaConfig,
  validQaConfig,
  type LocalQaConfig,
  type QaAccountName,
} from "./config";
import type { User } from "../app-services";
type Session = { user: User; access_token?: string; refresh_token?: string; [key: string]: unknown };
type CookieOptions = Record<string, unknown>;
type CookieWrite = { name: string; value: string; options: CookieOptions };
type AuthClient = {
  auth: {
    signInWithPassword: (credentials: {
      email: string;
      password: string;
    }) => Promise<{
      data: { user: User | null; session: Session | null };
      error: unknown;
    }>;
    dispose?: () => Promise<void>;
  };
};
type LoginDependencies = {
  environment?: QaEnvironment;
  loadConfig?: () => Promise<LocalQaConfig>;
  createAuth?: (
    url: string,
    key: string,
    queue: (items: CookieWrite[]) => void,
  ) => AuthClient;
};
const response = (body: Record<string, unknown>, status: number) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function handleQaLogin(
  request: Request,
  dependencies: LoginDependencies = {},
) {
  const environment = dependencies.environment ?? process.env;
  if (request.method !== "POST") return response({ error: "Not found." }, 404);
  if (!isLocalQaRequest(request, environment))
    return response({ error: "Local QA sign-in is unavailable." }, 404);
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return response({ error: "Choose a dedicated QA account." }, 400);
  let name: QaAccountName;
  try {
    const text = await request.text();
    if (text.length > 128) throw new Error();
    const body: unknown = JSON.parse(text);
    if (
      !body ||
      typeof body !== "object" ||
      Object.keys(body).length !== 1 ||
      !("account" in body) ||
      typeof body.account !== "string" ||
      !["A", "B"].includes(body.account)
    )
      throw new Error();
    name = body.account as QaAccountName;
  } catch {
    return response({ error: "Choose a dedicated QA account." }, 400);
  }
  let config: LocalQaConfig;
  try {
    config = await (dependencies.loadConfig ?? loadQaConfig)();
  } catch {
    return response({ error: "Local QA sign-in is unavailable." }, 404);
  }
  const url = environment.NEXT_PUBLIC_SUPABASE_URL,
    key = environment.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key)
    return response({ error: "Local QA sign-in is unavailable." }, 404);
  try {
    if (!validQaConfig(config, new URL(url).hostname.split(".")[0]))
      return response({ error: "Local QA sign-in is unavailable." }, 404);
  } catch {
    return response({ error: "Local QA sign-in is unavailable." }, 404);
  }
  const account = config.accounts[name];
  const pending: CookieWrite[] = [];
  const createAuth =
    dependencies.createAuth ??
    ((_url: string, _key: string, _queue: (items: CookieWrite[]) => void) => ({
      auth: {
        signInWithPassword: async () => ({
          data: { user: null, session: null },
          error: new Error("Supabase is disabled; use Firebase Authentication."),
        }),
      },
    }));
  let client: AuthClient | undefined;
  try {
    client = createAuth(url, key, (items) => pending.push(...items));
    const { data, error } = await client.auth.signInWithPassword({
      email: account.email,
      password: account.password,
    });
    if (error || !data.user || !data.session || !data.session.access_token)
      return response(
        {
          error:
            "QA sign-in failed. Refresh the local test-account setup and try again.",
        },
        401,
      );
    const user = data.user,
      meta = user.app_metadata,
      sessionUser = data.session.user,
      sessionMeta = sessionUser.app_metadata;
    if (
      user.id !== account.id ||
      sessionUser.id !== account.id ||
      user.email !== account.email ||
      sessionUser.email !== account.email ||
      meta.nativeyard_qa !== true ||
      meta.nativeyard_qa_marker !== config.marker ||
      meta.nativeyard_qa_account !== name ||
      sessionMeta.nativeyard_qa !== true ||
      sessionMeta.nativeyard_qa_marker !== config.marker ||
      sessionMeta.nativeyard_qa_account !== name
    )
      return response(
        { error: "QA account identity could not be verified." },
        403,
      );
    if (
      !pending.some(
        (cookie) =>
          cookie.value &&
          cookie.name.startsWith(`sb-${config.projectRef}-auth-token`),
      )
    )
      return response(
        { error: "QA session cookies could not be prepared." },
        503,
      );
    const result = response({ ok: true, account: name }, 200);
    const authCookieName = `sb-${config.projectRef}-auth-token`;
    for (const pair of (request.headers.get("cookie") || "").split(";")) {
      const oldName = pair.split("=", 1)[0].trim();
      if (
        oldName === authCookieName ||
        oldName.startsWith(`${authCookieName}.`)
      )
        result.cookies.set(oldName, "", {
          path: "/",
          maxAge: 0,
          sameSite: "lax",
        });
    }
    for (const cookie of pending)
      result.cookies.set(cookie.name, cookie.value, {
        ...cookie.options,
        sameSite: "lax",
      });
    return result;
  } catch {
    return response(
      { error: "Local QA sign-in is temporarily unavailable." },
      503,
    );
  } finally {
    try {
      await client?.auth.dispose?.();
    } catch {
      /* No credentials or provider errors are logged. */
    }
  }
}
