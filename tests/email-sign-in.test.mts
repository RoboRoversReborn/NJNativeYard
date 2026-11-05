import test, { mock } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { JSDOM } from "jsdom";
import { AuthApiError, type Session, type User } from "@supabase/supabase-js";
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost:3100/",
});
Object.defineProperties(globalThis, {
  window: { value: dom.window, configurable: true },
  document: { value: dom.window.document, configurable: true },
  navigator: { value: dom.window.navigator, configurable: true },
  HTMLElement: { value: dom.window.HTMLElement, configurable: true },
  location: { value: dom.window.location, configurable: true },
  IS_REACT_ACT_ENVIRONMENT: { value: true, writable: true, configurable: true },
});
const { render, screen, fireEvent, cleanup, act } =
  await import("@testing-library/react");
const { EmailSignIn } = await import("../components/email-sign-in");
test.afterEach(() => cleanup());

test("email request does not sign in; malformed email/code never reaches verification and resend is guarded", async () => {
  const sent: string[] = [];
  const verified: string[] = [];
  render(
    React.createElement(EmailSignIn, {
      onSendEmailCode: async (email) => {
        sent.push(email);
      },
      onVerifyEmailCode: async (email, code) => {
        verified.push(`${email}:${code}`);
      },
    }),
  );
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: "not-an-address" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send sign-in code" }));
  assert.ok(screen.getByRole("alert").textContent?.includes("valid email"));
  assert.equal(sent.length, 0);
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: " Gardener@Example.test " },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send sign-in code" }));
  await screen.findByLabelText("Sign-in code");
  assert.deepEqual(sent, ["gardener@example.test"]);
  assert.equal(verified.length, 0);
  assert.ok(screen.getByRole("status").textContent?.includes("not signed in"));
  assert.equal(
    (
      screen.getByRole("button", {
        name: "Send a new code",
      }) as HTMLButtonElement
    ).disabled,
    true,
  );
  fireEvent.click(screen.getByRole("button", { name: "Verify code" }));
  assert.ok(screen.getByRole("alert").textContent?.includes("6–10 digit"));
  assert.equal(verified.length, 0);
  fireEvent.click(screen.getByRole("button", { name: "Change email" }));
  assert.equal(
    (screen.getByLabelText("Email address") as HTMLInputElement).value,
    "Gardener@Example.test",
  );
  assert.equal(
    (
      screen.getByRole("button", {
        name: "Send sign-in code",
      }) as HTMLButtonElement
    ).disabled,
    true,
  );
});

test("expired or reused codes remain signed out and verification accepts only the callback result", async () => {
  let attempts = 0;
  render(
    React.createElement(EmailSignIn, {
      onSendEmailCode: async () => {},
      onVerifyEmailCode: async () => {
        attempts++;
        if (attempts === 1)
          throw new Error(
            "That code is invalid or expired. Request a new code and try again.",
          );
      },
    }),
  );
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: "gardener@example.test" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send sign-in code" }));
  await screen.findByLabelText("Sign-in code");
  fireEvent.change(screen.getByLabelText("Sign-in code"), {
    target: { value: "12345678" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Verify code" }));
  await screen.findByRole("alert");
  assert.equal(screen.queryByText(/Code accepted/), null);
  assert.equal(
    (screen.getByRole("button", { name: "Verify code" }) as HTMLButtonElement)
      .disabled,
    false,
  );
  fireEvent.change(screen.getByLabelText("Sign-in code"), {
    target: { value: "87654321" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Verify code" }));
  await screen.findByText("Code accepted. Finishing sign-in…");
  assert.equal(attempts, 2);
  assert.equal(
    (screen.getByRole("button", { name: "Verify code" }) as HTMLButtonElement)
      .disabled,
    true,
  );
  assert.equal(screen.queryByText("My properties."), null);
});

test("request failures permit retry and pending request cannot be double submitted", async () => {
  let calls = 0;
  let rejectPending: (reason: Error) => void = () => {};
  render(
    React.createElement(EmailSignIn, {
      onSendEmailCode: () => {
        calls++;
        return new Promise<void>((_, reject) => {
          rejectPending = reject;
        });
      },
      onVerifyEmailCode: async () => {},
    }),
  );
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: "gardener@example.test" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send sign-in code" }));
  assert.equal(
    (
      screen.getByRole("button", {
        name: "Requesting code…",
      }) as HTMLButtonElement
    ).disabled,
    true,
  );
  fireEvent.click(screen.getByRole("button", { name: "Requesting code…" }));
  assert.equal(calls, 1);
  await act(async () =>
    rejectPending(
      new Error("Too many attempts. Wait a little before trying again."),
    ),
  );
  await screen.findByRole("alert");
  assert.equal(screen.queryByLabelText("Sign-in code"), null);
  assert.equal(
    (
      screen.getByRole("button", {
        name: "Send sign-in code",
      }) as HTMLButtonElement
    ).disabled,
    false,
  );
});

test("email and Google availability are independent and no configured provider preserves guest exploration", async () => {
  const { SignIn } = await import("../components/account-views");
  render(
    React.createElement(SignIn, {
      configured: false,
      emailConfigured: true,
      onSignIn: () => {},
      onScan: () => {},
      busy: false,
      onSendEmailCode: async () => {},
      onVerifyEmailCode: async () => {},
    }),
  );
  assert.ok(screen.getByRole("heading", { name: "Continue with email" }));
  assert.equal(
    screen.queryByRole("button", { name: /Continue with Google/ }),
    null,
  );
  cleanup();
  render(
    React.createElement(SignIn, {
      configured: false,
      onSignIn: () => {},
      onScan: () => {},
      busy: false,
    }),
  );
  assert.ok(screen.getByRole("heading", { name: "Your NativeYard profile." }));
  assert.ok(
    screen.getByRole("button", { name: /Keep exploring without an account/ }),
  );
  assert.equal(screen.queryByLabelText("Email address"), null);
});

test("Supabase code service requests standard verification and never creates a pre-verification session", async () => {
  const previousURL = process.env.NEXT_PUBLIC_SUPABASE_URL,
    previousKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://email-test.example.test";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-only-anon-key";
  const { createClient } = await import("../lib/account/client.js");
  const { appServices } = await import("../lib/app-services");
  const client = createClient()!;
  assert.equal(createClient(), client);
  const user: User = {
    id: "verified-email-test",
    aud: "authenticated",
    app_metadata: { provider: "email" },
    user_metadata: {},
    created_at: "2026-11-04T00:00:00Z",
    email: "gardener@example.test",
    email_confirmed_at: "2026-11-04T00:00:00Z",
  };
  const session: Session = {
    access_token: "test-only-access-token",
    refresh_token: "test-only-refresh-token",
    expires_in: 3600,
    token_type: "bearer",
    user,
  };
  const sent: unknown[] = [],
    verified: unknown[] = [];
  let sessions = 0;
  let sendError: AuthApiError | null = null;
  let verifyError: AuthApiError | null = null;
  let hasSession = false;
  const sendMock = mock.method(
    client.auth,
    "signInWithOtp",
    async (params: Parameters<typeof client.auth.signInWithOtp>[0]) => {
      sent.push(params);
      return { data: { user: null, session: null }, error: sendError };
    },
  );
  const verifyMock = mock.method(
    client.auth,
    "verifyOtp",
    async (params: Parameters<typeof client.auth.verifyOtp>[0]) => {
      verified.push(params);
      if (verifyError)
        return { data: { user: null, session: null }, error: verifyError };
      return hasSession
        ? { data: { user, session }, error: null }
        : { data: { user, session: null }, error: null };
    },
  );
  const sessionMock = mock.method(client.auth, "setSession", async () => {
    sessions++;
    throw new Error("Unexpected client-created session");
  });
  try {
    await appServices.auth.sendEmailCode(" Gardener@Example.test ");
    assert.deepEqual(sent[0], {
      email: "gardener@example.test",
      options: {
        shouldCreateUser: true,
        emailRedirectTo: "http://localhost:3100/auth/callback",
      },
    });
    assert.equal(sessions, 0);
    assert.equal(verified.length, 0);
    await assert.rejects(
      appServices.auth.verifyEmailCode("gardener@example.test", "12345678"),
      /did not create a session/,
    );
    verifyError = new AuthApiError(
      "Sensitive upstream text must not appear",
      403,
      "otp_expired",
    );
    await assert.rejects(
      appServices.auth.verifyEmailCode("gardener@example.test", "12345678"),
      /invalid or expired/,
    );
    verifyError = null;
    hasSession = true;
    assert.equal(
      await appServices.auth.verifyEmailCode(
        "gardener@example.test",
        "87654321",
      ),
      undefined,
    );
    assert.deepEqual(verified.at(-1), {
      email: "gardener@example.test",
      token: "87654321",
      type: "email",
    });
    assert.equal(sessions, 0);
    sendError = new AuthApiError(
      "Private account detail",
      429,
      "over_email_send_rate_limit",
    );
    await assert.rejects(
      appServices.auth.sendEmailCode("gardener@example.test"),
      /Too many attempts/,
    );
    sendError = new AuthApiError(
      "This private user does not exist",
      400,
      "user_not_found",
    );
    await assert.rejects(
      appServices.auth.sendEmailCode("gardener@example.test"),
      (error) =>
        error instanceof Error &&
        !/private|does not exist/i.test(error.message),
    );
  } finally {
    sendMock.mock.restore();
    verifyMock.mock.restore();
    sessionMock.mock.restore();
    await client.auth.dispose();
    if (previousURL === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousURL;
    if (previousKey === undefined)
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousKey;
  }
});
