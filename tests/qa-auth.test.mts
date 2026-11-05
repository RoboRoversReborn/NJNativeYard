import test from "node:test";
import assert from "node:assert/strict";
import type { Session, User } from "@supabase/supabase-js";
import { isLocalQaRequest } from "../lib/qa/gate";
import { validQaConfig, type LocalQaConfig } from "../lib/qa/config";
import { handleQaLogin } from "../lib/qa/login";
const config: LocalQaConfig = {
  version: 1,
  projectRef: "qa-project",
  marker: "a1111111-1111-4111-8111-111111111111",
  accounts: {
    A: {
      id: "b1111111-1111-4111-8111-111111111111",
      email: "qa-a-a1111111-1111-4111-8111-111111111111@qa.nativeyard.invalid",
      password: "fake-test-only-password-at-least32chars",
    },
    B: {
      id: "c1111111-1111-4111-8111-111111111111",
      email: "qa-b-a1111111-1111-4111-8111-111111111111@qa.nativeyard.invalid",
      password: "fake-test-only-other-password32chars",
    },
  },
};
const environment = {
  NATIVEYARD_RUNTIME: "local-qa",
  NATIVEYARD_QA_AUTH: "true",
  NEXT_PUBLIC_SUPABASE_URL: "https://qa-project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "fake-anon-key",
  NODE_ENV: "production",
};
function request(
  body: unknown = { account: "A" },
  headers: Record<string, string> = {},
  url = "http://localhost:3100/api/qa-login",
  method = "POST",
) {
  return new Request(url, {
    method,
    headers: {
      host: new URL(url).host,
      origin: new URL(url).origin,
      "content-type": "application/json",
      ...headers,
    },
    ...(method === "GET"
      ? {}
      : { body: typeof body === "string" ? body : JSON.stringify(body) }),
  });
}
function identity(name: "A" | "B" = "A"): User {
  return {
    id: config.accounts[name].id,
    email: config.accounts[name].email,
    aud: "authenticated",
    created_at: "2026-11-04T00:00:00Z",
    app_metadata: {
      nativeyard_qa: true,
      nativeyard_qa_marker: config.marker,
      nativeyard_qa_account: name,
    },
    user_metadata: {},
  };
}
function fixture(user: User = identity(), failed = false) {
  let authCalls = 0;
  let disposals = 0;
  const session: Session = {
    access_token: "fake-access-token-never-return",
    refresh_token: "fake-refresh-token-never-return",
    expires_in: 3600,
    token_type: "bearer",
    user,
  };
  return {
    get calls() {
      return authCalls;
    },
    get disposals() {
      return disposals;
    },
    dependencies: {
      environment,
      loadConfig: async () => config,
      createAuth: (
        _url: string,
        _key: string,
        queue: (
          items: { name: string; value: string; options: { path?: string } }[],
        ) => void,
      ) => ({
        auth: {
          signInWithPassword: async (credentials: {
            email: string;
            password: string;
          }) => {
            authCalls++;
            assert.equal(credentials.email, config.accounts.A.email);
            assert.equal(credentials.password, config.accounts.A.password);
            queue([
              {
                name: "sb-qa-project-auth-token",
                value: "fake-session-cookie",
                options: { path: "/" },
              },
            ]);
            return {
              data: { user, session },
              error: failed ? new Error("expired credentials") : null,
            };
          },
          dispose: async () => {
            disposals++;
          },
        },
      }),
    },
  };
}

test("local QA gate requires explicit flags, exact localhost host+origin, and rejects deployments but permits local production build", () => {
  assert.equal(isLocalQaRequest(request(), {}), false);
  assert.equal(isLocalQaRequest(request(), environment), true);
  assert.equal(
    isLocalQaRequest(
      request(undefined, {}, "http://127.0.0.1:3100/api/qa-login"),
      environment,
    ),
    true,
  );
  for (const overrides of [
    { NATIVEYARD_QA_AUTH: "false" },
    { NATIVEYARD_RUNTIME: "production" },
    { VERCEL: "1" },
    { VERCEL_ENV: "production" },
    { DEPLOYMENT_TARGET: "production" },
    { NATIVEYARD_DEPLOYMENT_TARGET: "production" },
  ])
    assert.equal(
      isLocalQaRequest(request(), { ...environment, ...overrides }),
      false,
    );
  for (const url of [
    "http://example.test:3100/api/qa-login",
    "http://localhost:3000/api/qa-login",
    "https://localhost:3100/api/qa-login",
  ])
    assert.equal(
      isLocalQaRequest(request(undefined, {}, url), environment),
      false,
    );
  for (const headers of [
    { origin: "http://evil.test" },
    { origin: "" },
    { host: "evil.test" },
    { "x-forwarded-host": "evil.test" },
    { "sec-fetch-site": "cross-site" },
  ] as Record<string, string>[])
    assert.equal(
      isLocalQaRequest(request(undefined, headers), environment),
      false,
    );
  const get = request(
    undefined,
    {},
    "http://localhost:3100/api/capabilities",
    "GET",
  );
  get.headers.delete("origin");
  assert.equal(isLocalQaRequest(get, environment), true);
});

test("configuration admits only distinct marker-owned synthetic QA accounts", () => {
  assert.equal(validQaConfig(config, "qa-project"), true);
  assert.equal(validQaConfig(config, "another-project"), false);
  const duplicate = structuredClone(config);
  duplicate.accounts.B.id = duplicate.accounts.A.id;
  assert.equal(validQaConfig(duplicate, "qa-project"), false);
  const real = structuredClone(config);
  real.accounts.A.email = "real@example.test";
  assert.equal(validQaConfig(real, "qa-project"), false);
});

test("QA login commits real SDK session cookies only after expected trusted QA identity and returns no credentials", async () => {
  const f = fixture();
  const result = await handleQaLogin(
    request(
      { account: "A" },
      { cookie: "sb-qa-project-auth-token.4=old-cookie; unrelated=preserve" },
    ),
    f.dependencies,
  );
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { ok: true, account: "A" });
  const cookies = result.headers.get("set-cookie")!;
  assert.match(cookies, /fake-session-cookie/);
  assert.match(cookies, /sb-qa-project-auth-token\.4=/);
  assert.doesNotMatch(cookies, /unrelated=/);
  assert.equal(f.calls, 1);
  assert.equal(f.disposals, 1);
  assert.equal(result.headers.get("cache-control"), "no-store");
});

test("wrong identity, real-user metadata, expired credentials and unavailable setup never apply queued cookies", async () => {
  for (const user of [
    identity("B"),
    { ...identity(), app_metadata: {} },
    {
      ...identity(),
      app_metadata: {
        ...identity().app_metadata,
        nativeyard_qa_marker: "another-marker",
      },
    },
    { ...identity(), email: "real@example.test" },
  ]) {
    const f = fixture(user);
    const result = await handleQaLogin(request(), f.dependencies);
    assert.equal(result.status, 403);
    assert.equal(result.headers.get("set-cookie"), null);
  }
  const expired = fixture(identity(), true);
  const denied = await handleQaLogin(request(), expired.dependencies);
  assert.equal(denied.status, 401);
  assert.equal(denied.headers.get("set-cookie"), null);
  const missing = fixture();
  const result = await handleQaLogin(request(), {
    ...missing.dependencies,
    loadConfig: async () => {
      throw new Error("missing secret file");
    },
  });
  assert.equal(result.status, 404);
  assert.equal(missing.calls, 0);
  assert.equal(result.headers.get("set-cookie"), null);
});

test("default/remote/malformed/arbitrary account requests do not invoke auth or set cookies", async () => {
  for (const req of [
    request({ account: "C" }),
    request({ account: ["A"] }),
    request({ account: "A", password: "arbitrary" }),
    request("not-json"),
    request(undefined, { origin: "http://evil.test" }),
  ]) {
    const f = fixture();
    const result = await handleQaLogin(req, f.dependencies);
    assert.ok(result.status >= 400);
    assert.equal(f.calls, 0);
    assert.equal(result.headers.get("set-cookie"), null);
  }
  const f = fixture();
  const result = await handleQaLogin(request(), {
    ...f.dependencies,
    environment: {},
  });
  assert.equal(result.status, 404);
  assert.equal(f.calls, 0);
});

test("local QA UI sends only a fixed account choice and reloads only after success", async () => {
  const { JSDOM } = await import("jsdom");
  const React = await import("react");
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost:3100/?view=signin",
  });
  Object.defineProperties(globalThis, {
    window: { value: dom.window, configurable: true },
    document: { value: dom.window.document, configurable: true },
    navigator: { value: dom.window.navigator, configurable: true },
    HTMLElement: { value: dom.window.HTMLElement, configurable: true },
    IS_REACT_ACT_ENVIRONMENT: {
      value: true,
      writable: true,
      configurable: true,
    },
  });
  const { render, screen, fireEvent, waitFor, cleanup } =
    await import("@testing-library/react");
  const { QaSignIn } = await import("../components/qa-sign-in");
  const savedFetch = globalThis.fetch;
  const calls: { url: string; body: unknown }[] = [];
  let reloads = 0;
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), body: JSON.parse(String(options?.body)) });
    return Response.json({ ok: true });
  };
  try {
    render(
      React.createElement(QaSignIn, {
        onSignedIn: () => {
          reloads++;
        },
      }),
    );
    assert.ok(screen.getByRole("heading", { name: "Local QA only" }));
    fireEvent.click(screen.getByRole("button", { name: "Use QA account A" }));
    await waitFor(() => assert.equal(reloads, 1));
    assert.deepEqual(calls, [{ url: "/api/qa-login", body: { account: "A" } }]);
    cleanup();
    globalThis.fetch = async () =>
      Response.json({ error: "unavailable" }, { status: 401 });
    render(
      React.createElement(QaSignIn, {
        onSignedIn: () => {
          reloads++;
        },
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Use QA account B" }));
    await screen.findByRole("alert");
    assert.equal(reloads, 1);
  } finally {
    cleanup();
    globalThis.fetch = savedFetch;
    dom.window.close();
  }
});
