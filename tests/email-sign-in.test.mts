import test, { mock } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { JSDOM } from "jsdom";
import type { User } from "../lib/app-services";
class AuthApiError extends Error {
  status: number;
  code: string;
  constructor(message: string, status: number, code: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = "AuthApiError";
  }
}
type Session = { user: User; [key: string]: unknown };
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

