import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost:3100/?view=welcome",
});
Object.defineProperties(globalThis, {
  window: { value: dom.window, configurable: true },
  document: { value: dom.window.document, configurable: true },
  navigator: { value: dom.window.navigator, configurable: true },
  HTMLElement: { value: dom.window.HTMLElement, configurable: true },
  IS_REACT_ACT_ENVIRONMENT: { value: true, writable: true, configurable: true },
});
const { render, screen, fireEvent, cleanup } = await import("@testing-library/react");
const { JourneyHome } = await import("../components/journey-home");

for (const signedIn of [false, true]) {
  test(`example CTA reaches and focuses samples without route popstate (${signedIn ? "signed in" : "guest"})`, () => {
    let scrolledId = "";
    let popstates = 0;
    const popstate = () => { popstates++; };
    dom.window.addEventListener("popstate", popstate);
    dom.window.HTMLElement.prototype.scrollIntoView = function () { scrolledId = this.id; };
    dom.window.history.replaceState({ preserved: "route state", scrollY: 0 }, "", "/?view=welcome");
    let opened = "";
    try {
      render(React.createElement(JourneyHome, {
        signedIn,
        accountsAvailable: true,
        onScan: () => {},
        onSignIn: () => {},
        onExample: (id: string) => { opened = id; },
      }));
      const link = screen.getByRole("link", { name: "Explore an example" });
      assert.equal(link.getAttribute("href"), "#examples");
      // Cancelling the native fragment default avoids the route-restoration
      // popstate that previously immediately reset the scroll to zero.
      assert.equal(fireEvent.click(link), false);
      assert.equal(scrolledId, "examples");
      assert.equal(document.activeElement, document.getElementById("examples"));
      assert.equal(dom.window.location.search, "?view=welcome");
      assert.equal(dom.window.location.hash, "#examples");
      assert.equal(dom.window.history.state.preserved, "route state");
      assert.equal(popstates, 0);
      fireEvent.click(screen.getAllByRole("button", { name: /Open example:/ })[0]);
      assert.ok(opened, "sample-opening callback remains reachable after scrolling");
    } finally {
      cleanup();
      dom.window.removeEventListener("popstate", popstate);
    }
  });
}

const { waitFor, act } = await import("@testing-library/react");
const { NativeYardApp } = await import("../components/native-yard-app");
const { appServices } = await import("../lib/app-services");
const { exampleSurvey } = await import("../lib/survey");
const { sampleYards } = await import("../lib/sample-yards");
Object.defineProperty(globalThis, "location", { value: dom.window.location, configurable: true });
dom.window.scrollTo = () => {};

for (const signedIn of [false, true]) {
  test(`addressable gallery and samples preserve upload draft through Back and refresh (${signedIn ? "signed in" : "guest"})`, async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => Response.json({ vision: false, accounts: true });
    const pending = { ...exampleSurvey(), id: "private-pending-photo", source: "upload" as const,
      photo: "/pending-private-upload.jpg", sampleId: undefined };
    const kept: string[] = [];
    const user = signedIn ? { id: "owner-a", user_metadata: {}, app_metadata: {} } as import("@supabase/supabase-js").User : null;
    const services: import("../lib/app-services").AppServices = {
      ...appServices,
      auth: { ...appServices.auth, currentUser: async () => user, subscribe: () => () => {} },
      account: { ...appServices.account, loadAccount: async () => ({ properties: [{ id: "private-property", name: "Private home", zip: "07645", yard_areas: [{ id: "private-area", property_id: "private-property", name: "Private garden" }] }], surveys: [], tasks: [] }) },
      drafts: { readDraft: async () => pending, keepDraft: async (value) => { kept.push(value.source); }, clearDraft: async () => {} },
    };
    try {
      dom.window.history.replaceState({}, "", "/?view=analysis");
      render(React.createElement(NativeYardApp, { services }));
      await waitFor(() => assert.equal(screen.getByAltText("Survey photo with numbered plant regions").getAttribute("src"), pending.photo));
      if(signedIn){fireEvent.click(screen.getByRole("button",{name:"Home"}));fireEvent.click(screen.getByRole("link",{name:/Explore an example/}));}
      else fireEvent.click(screen.getByRole("button", { name: "Examples" }));
      assert.equal(dom.window.location.search, "?view=examples");
      fireEvent.click(screen.getByRole("button", { name: `Open example: ${sampleYards[1].title}` }));
      assert.equal(new URLSearchParams(dom.window.location.search).get("sample"), sampleYards[1].id);
      await waitFor(() => assert.equal(screen.getByAltText("Survey photo with numbered plant regions").getAttribute("src"), sampleYards[1].photo));
      assert.equal(screen.queryByRole("navigation", { name: "Breadcrumb" }), null,
        "a public sample must not appear inside the selected private property");
      assert.equal(screen.queryByText("Private home"), null);
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 550)); });
      assert.ok(kept.every((source) => source === "upload"), "sample must never overwrite pending upload storage");
      await act(async () => { dom.window.history.back(); await new Promise((resolve) => setTimeout(resolve, 30)); });
      await screen.findByRole("heading", { name: /Three yards/ });
      await act(async () => { dom.window.history.back(); await new Promise((resolve) => setTimeout(resolve, 30)); });
      if(signedIn) await act(async () => { dom.window.history.back(); await new Promise((resolve) => setTimeout(resolve,30)); });
      await waitFor(() => assert.equal(screen.getByAltText("Survey photo with numbered plant regions").getAttribute("src"), pending.photo));
      cleanup();
      dom.window.history.replaceState({}, "", `/?view=analysis&sample=${sampleYards[2].id}`);
      render(React.createElement(NativeYardApp, { services }));
      await waitFor(() => assert.equal(screen.getByAltText("Survey photo with numbered plant regions").getAttribute("src"), sampleYards[2].photo));
      assert.ok(kept.every((source) => source === "upload"));
      cleanup();
      dom.window.history.replaceState({}, "", "/?view=welcome");
      render(React.createElement(NativeYardApp, { services }));
      const entry = await screen.findByRole("link", { name: "Explore an example" });
      fireEvent.click(entry);
      assert.equal(dom.window.location.search, "?view=examples");
      assert.ok(screen.getByRole("button", { name: `Open example: ${sampleYards[0].title}` }));
    } finally { cleanup(); globalThis.fetch = originalFetch; }
  });
}

for (const signedIn of [false, true]) test(`legacy homepage examples fragment mounts and focuses gallery (${signedIn ? "signed in" : "guest"})`, async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ vision: false, accounts: false });
  try {
    dom.window.history.replaceState({}, "", "/?view=home#examples");
    const user = signedIn ? { id: "owner-a", user_metadata: {}, app_metadata: {} } as import("@supabase/supabase-js").User : null;
    const services = { ...appServices,
      auth: { ...appServices.auth, currentUser: async () => user, subscribe: () => () => {} },
      account: { ...appServices.account, loadAccount: async () => ({ properties: [], surveys: [], tasks: [] }) },
      drafts: { ...appServices.drafts, readDraft: async () => null } };
    render(React.createElement(NativeYardApp, { services }));
    await screen.findByRole("heading", { name: /Three yards/ });
    await waitFor(() => assert.equal(document.activeElement?.id, "examples"));
    assert.ok(screen.getByRole("button", { name: `Open example: ${sampleYards[0].title}` }));
  } finally { cleanup(); globalThis.fetch = originalFetch; }
});

for (const sample of ["does-not-exist", ""]) {
  test(`invalid sample ${sample || "empty"} is recoverable without exposing an underlying upload`, async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => Response.json({ vision: false, accounts: false });
    const pending = { ...exampleSurvey(), id: "pending-private", source: "upload" as const, photo: "/private-pending.jpg" };
    const services = { ...appServices,
      auth: { ...appServices.auth, currentUser: async () => null, subscribe: () => () => {} },
      drafts: { ...appServices.drafts, readDraft: async () => pending, keepDraft: async () => {} },
    };
    try {
      dom.window.history.replaceState({}, "", `/?view=analysis&sample=${sample}`);
      render(React.createElement(NativeYardApp, { services }));
      await screen.findByRole("heading", { name: "That example is unavailable" });
      assert.equal(screen.queryByAltText("Survey photo with numbered plant regions"), null);
      fireEvent.click(screen.getByRole("button", { name: "Choose another example" }));
      assert.equal(dom.window.location.search, "?view=examples");
      await screen.findByRole("heading", { name: /Three yards/ });
    } finally { cleanup(); globalThis.fetch = originalFetch; }
  });
}
