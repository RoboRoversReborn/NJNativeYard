import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import type { User } from "../lib/app-services";
import type { Survey } from "../lib/survey";
import type { AppServices } from "../lib/app-services";
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost:3100/" });
Object.defineProperties(globalThis, {
  window: { value: dom.window, configurable: true }, document: { value: dom.window.document, configurable: true },
  navigator: { value: dom.window.navigator, configurable: true }, HTMLElement: { value: dom.window.HTMLElement, configurable: true },
  location: { value: dom.window.location, configurable: true },
  IS_REACT_ACT_ENVIRONMENT: { value: true, writable: true, configurable: true },
});
const scrolls: unknown[] = [];
dom.window.scrollTo = (options) => { scrolls.push(options); };
dom.window.HTMLElement.prototype.scrollIntoView = () => {};
const { render, screen, fireEvent, cleanup, act } = await import("@testing-library/react");
const { NativeYardApp } = await import("../components/native-yard-app");
const { CaptureContext } = await import("../components/capture-context");
const { SaveToast } = await import("../components/save-toast");
const { exampleSurvey } = await import("../lib/survey");
const { appServices } = await import("../lib/app-services");
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function harness(saveSurvey: AppServices["account"]["saveSurvey"], refreshFailure = false) {
  const draft: Survey = { ...exampleSurvey("07645"), source: "upload", id: "real-photo", photo: "/real.jpg" };
  const property = { id: "home", name: "Our home", zip: "07645", yard_areas: [{ id: "bed", property_id: "home", name: "Back border" }] };
  let loads = 0;
  const services: AppServices = {
    ...appServices,
    auth: { ...appServices.auth, currentUser: async () => ({ id: "owner", user_metadata: {} } as User), subscribe: () => () => {} },
    account: { ...appServices.account, saveSurvey, loadAccount: async () => {
      if (loads++ && refreshFailure) throw new Error("Account refresh failed");
      return { properties: [property], surveys: [], tasks: [] };
    } },
    drafts: { readDraft: async () => draft, keepDraft: async () => {}, clearDraft: async () => {} },
  };
  dom.window.history.replaceState(null, "", "/?view=analysis&resume=1&property=home&area=bed");
  scrolls.length = 0;
  return { services, draft };
}

test("real save waits for persistence, opens the saved destination at the top and preserves success when refresh fails", async () => {
  const before = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ vision: true, accounts: true });
  const saving = deferred<Awaited<ReturnType<AppServices["account"]["saveSurvey"]>>>();
  const { services, draft } = harness(async () => saving.promise, true);
  try {
    render(React.createElement(NativeYardApp, { services }));
    await screen.findByRole("button", { name: "Save survey" });
    const scope = document.querySelector(".saved-scope-summary") as HTMLDetailsElement;
    assert.equal(scope.open, true);
    (document.querySelector(".capture-context") as HTMLDetailsElement).open = true;
    fireEvent.click(screen.getByRole("button", { name: "Save survey" }));
    assert.equal(screen.queryByLabelText("Save feedback"), null);
    assert.equal(new URLSearchParams(location.search).has("survey"), false);
    assert.equal(scope.open, true);
    await act(async () => saving.resolve({ ...draft, areaId: "bed", photoPath: "owner/real.jpg", revision: undefined }));
    await screen.findByText("Survey saved to Our home / Back border.");
    const query = new URLSearchParams(location.search);
    assert.equal(query.get("view"), "analysis");
    assert.equal(query.get("property"), "home");
    assert.equal(query.get("area"), "bed");
    assert.equal(query.get("survey"), draft.id);
    assert.equal(document.activeElement?.id, "main-content");
    assert.deepEqual(scrolls.at(-1), { top: 0, behavior: "instant" });
    assert.equal(scope.open, false);
    assert.equal((document.querySelector(".capture-context") as HTMLDetailsElement).open, false);
    assert.ok(screen.getByText("Photo details · Edit"));
    scope.open = true;
    assert.equal((screen.getByLabelText("Yard area") as HTMLSelectElement).value, "bed");
    await screen.findByText(/Your survey was saved, but the account list could not refresh/);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss save confirmation" }));
    assert.equal(screen.queryByLabelText("Save feedback"), null);
  } finally { cleanup(); globalThis.fetch = before; }
});

test("failed persistence keeps the save form open and provides an actionable local error", async () => {
  const before = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ vision: true, accounts: true });
  const saving = deferred<Awaited<ReturnType<AppServices["account"]["saveSurvey"]>>>();
  const { services } = harness(async () => saving.promise);
  try {
    render(React.createElement(NativeYardApp, { services }));
    const save = await screen.findByRole("button", { name: "Save survey" });
    (document.querySelector(".capture-context") as HTMLDetailsElement).open = true;
    fireEvent.click(save);
    await act(async () => saving.reject(new Error("Connection interrupted")));
    await screen.findByRole("alert");
    assert.match(screen.getByRole("alert").textContent!, /Connection interrupted/);
    assert.equal((document.querySelector(".saved-scope-summary") as HTMLDetailsElement).open, true);
    assert.equal((document.querySelector(".capture-context") as HTMLDetailsElement).open, true);
    assert.equal(new URLSearchParams(location.search).has("survey"), false);
    assert.equal(screen.queryByLabelText("Save feedback"), null);
    assert.equal((screen.getByRole("button", { name: "Save survey" }) as HTMLButtonElement).disabled, false);
  } finally { cleanup(); globalThis.fetch = before; }
});

test("save toast stays fixed in the viewport and never takes focus", () => {
  try {
    const button = document.createElement("button");
    document.body.append(button); button.focus();
    render(React.createElement(SaveToast, { message: "Saved.", onDismiss: () => {} }));
    assert.equal(document.activeElement, button);
    assert.equal(screen.getByRole("status").getAttribute("aria-live"), "polite");
    const css = readFileSync(new URL("../app/save-feedback.css", import.meta.url), "utf8");
    assert.match(css, /\.save-toast\s*\{[^}]*position:\s*fixed/);
    button.remove();
  } finally { cleanup(); }
});

test("photo spot names remain optional and never silently confirm a comparison viewpoint", () => {
  let changed: Survey | undefined;
  const original: Survey = { ...exampleSurvey(), source: "upload", capture: { imageSha256: "a".repeat(64), photoPointId: "View old-id", photoPointConfirmed: true } };
  try {
    render(React.createElement(CaptureContext, { survey: original, previous: [], actorId: "owner", onChange: (s) => { changed = s; } }));
    assert.equal((screen.getByLabelText("Photo spot (optional)") as HTMLInputElement).value, "View old-id");
    const comparison = screen.getByText("Comparison setup (optional)").closest("details")!;
    assert.equal(comparison.open, false);
    fireEvent.click(screen.getByRole("button", { name: "Apply context to this draft" }));
    assert.equal(changed!.capture!.photoPointId, "View old-id");
    assert.equal(changed!.capture!.photoPointConfirmed, true);
    fireEvent.change(screen.getByLabelText("Photo spot (optional)"), { target: { value: "Back door facing the fence" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply context to this draft" }));
    assert.equal(changed!.capture!.photoPointId, "Back door facing the fence");
    assert.equal(changed!.capture!.photoPointConfirmed, false);
    assert.equal(changed!.capture!.imageSha256, original.capture!.imageSha256);
    assert.deepEqual(changed!.captureEdits!.at(-1)!.previous, original.capture);
    fireEvent.click(screen.getByLabelText("Confirm this photo spot and direction for comparison"));
    fireEvent.click(screen.getByRole("button", { name: "Apply context to this draft" }));
    assert.equal(changed!.capture!.photoPointConfirmed, true);
    fireEvent.change(screen.getByLabelText("Photo spot (optional)"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply context to this draft" }));
    assert.equal(changed!.capture!.photoPointId, undefined);
    assert.equal(changed!.capture!.photoPointConfirmed, false);
  } finally { cleanup(); }
});

test("automatic plan initialization runs on account open and again after a real save without blocking it", async () => {
  const before=globalThis.fetch;
  globalThis.fetch=async()=>Response.json({vision:true,accounts:true});
  const {services}=harness(async(value)=>({...value,areaId:'bed',photoPath:'owner/real.jpg',revision:undefined}));
  let generations=0;
  services.account.ensureAutoYardPlan=async propertyId=>{assert.equal(propertyId,'home');generations++;return[];};
  try{
    render(React.createElement(NativeYardApp,{services}));
    const save=await screen.findByRole('button',{name:'Save survey'});
    await act(async()=>{await new Promise(resolve=>setTimeout(resolve,0));});
    assert.equal(generations,1);
    fireEvent.click(save);
    await screen.findByLabelText('Save feedback');
    await act(async()=>{await new Promise(resolve=>setTimeout(resolve,0));});
    assert.equal(generations,2);
    assert.equal(new URLSearchParams(location.search).get('survey'),'real-photo');
  }finally{cleanup();globalThis.fetch=before;}
});
