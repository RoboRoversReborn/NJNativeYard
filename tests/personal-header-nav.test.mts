import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import React from "react";
import type { User } from "@supabase/supabase-js";
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
Object.defineProperties(globalThis, {
  window: { value: dom.window, configurable: true },
  document: { value: dom.window.document, configurable: true },
  navigator: { value: dom.window.navigator, configurable: true },
  Node: { value: dom.window.Node, configurable: true },
  HTMLElement: { value: dom.window.HTMLElement, configurable: true },
  requestAnimationFrame: { value: (callback: FrameRequestCallback) => setTimeout(callback, 0), configurable: true },
  IS_REACT_ACT_ENVIRONMENT: { value: true, writable: true, configurable: true },
});
const { render, screen, fireEvent, cleanup, waitFor } = await import("@testing-library/react");
const { default: userEvent } = await import("@testing-library/user-event");
const { PersonalHeaderNav } = await import("../components/personal-header-nav");
afterEach(cleanup);
function user(id: string, metadata: Record<string, unknown>, email?: string): User {
  return { id, aud: "authenticated", app_metadata: {}, user_metadata: metadata, created_at: "2026-01-01", email };
}
const props = { active: "home" as const, onHome() {}, onYard() {}, onSettings() {}, onSignOut() {} };

test("uses actual metadata and switches identity without retaining previous photo or menu", async () => {
  const first = user("one", { full_name: "Maya Chen", avatar_url: "https://photos.example.test/maya.jpg" });
  const view = render(React.createElement(PersonalHeaderNav, { ...props, user: first }));
  assert.ok(screen.getByText("Hi Maya"));
  const photo = view.container.querySelector("img")!;
  assert.equal(photo.getAttribute("src"), "https://photos.example.test/maya.jpg");
  fireEvent.error(photo);
  assert.ok(screen.getByText("MC"));
  fireEvent.click(screen.getByRole("button", { name: "Open profile menu" }));
  await waitFor(() => assert.equal(document.activeElement?.textContent, "Settings"));
  view.rerender(React.createElement(PersonalHeaderNav, { ...props, user: user("two", { name: "Jordan Park", picture: "https://photos.example.test/jordan.jpg" }) }));
  assert.ok(screen.getByText("Hi Jordan"));
  assert.equal(screen.queryByText("Hi Maya"), null);
  assert.equal(screen.queryByRole("menu"), null);
  assert.equal(view.container.querySelector("img")?.getAttribute("src"), "https://photos.example.test/jordan.jpg");
});

test("rejects unsafe avatars and falls back to email or welcome", () => {
  const view = render(React.createElement(PersonalHeaderNav, { ...props, user: user("one", { avatar_url: "https://name:password@example.test/photo.jpg" }, "sam@example.test") }));
  assert.ok(screen.getByText("Hi sam"));
  assert.equal(view.container.querySelector("img"), null);
  view.rerender(React.createElement(PersonalHeaderNav, { ...props, user: user("two", { avatar_url: "javascript:alert(1)" }) }));
  assert.ok(screen.getByText("Hi Welcome"));
  assert.equal(view.container.querySelector("img"), null);
});

test("keyboard menu navigation, Escape, outside pointer, tab and actions", async () => {
  let settings = 0;
  let signouts = 0;
  const actions = userEvent.setup({ document: dom.window.document });
  render(React.createElement("div", null,
    React.createElement(PersonalHeaderNav, { ...props, user: user("one", { given_name: "Alex" }), onSettings: () => settings++, onSignOut: () => signouts++ }),
    React.createElement("button", null, "After header"),
  ));
  const opener = screen.getByRole("button", { name: "Open profile menu" });
  opener.focus();
  await actions.keyboard("{Enter}");
  const setting = await screen.findByRole("menuitem", { name: "Settings" });
  await waitFor(() => assert.equal(document.activeElement?.textContent, setting.textContent));
  await actions.keyboard("{ArrowDown}");
  const signout = screen.getByRole("menuitem", { name: "Sign out" });
  assert.equal(document.activeElement?.textContent, signout.textContent);
  await actions.keyboard("{Home}");
  assert.equal(document.activeElement?.textContent, setting.textContent);
  await actions.keyboard("{End}");
  assert.equal(document.activeElement?.textContent, signout.textContent);
  await actions.keyboard("{Escape}");
  assert.equal(document.activeElement?.getAttribute("aria-label"), "Open profile menu");
  assert.equal(opener.getAttribute("aria-expanded"), "false");
  await actions.keyboard(" ");
  await waitFor(() => assert.equal(document.activeElement?.textContent, "Settings"));
  await actions.tab();
  assert.equal(document.activeElement?.textContent, "After header");
  assert.equal(screen.queryByRole("menu"), null);
  fireEvent.click(opener);
  fireEvent.pointerDown(document.body);
  assert.equal(screen.queryByRole("menu"), null);
  fireEvent.click(opener);
  fireEvent.click(screen.getByRole("menuitem", { name: "Settings" }));
  assert.equal(settings, 1);
  fireEvent.click(opener);
  fireEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));
  assert.equal(signouts, 1);
  assert.equal(screen.queryByRole("menu"), null);
});
