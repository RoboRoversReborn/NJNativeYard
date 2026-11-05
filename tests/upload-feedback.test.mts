import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import type { AppServices } from "../lib/app-services";
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost:3100/?view=scan" });
Object.defineProperties(globalThis, {
  window: { value: dom.window, configurable: true }, document: { value: dom.window.document, configurable: true },
  navigator: { value: dom.window.navigator, configurable: true }, HTMLElement: { value: dom.window.HTMLElement, configurable: true },
  location: { value: dom.window.location, configurable: true },
  IS_REACT_ACT_ENVIRONMENT: { value: true, writable: true, configurable: true },
});
dom.window.scrollTo = () => {};
dom.window.HTMLElement.prototype.scrollIntoView = () => {};
const { render, screen, fireEvent, cleanup, act } = await import("@testing-library/react");
const { NativeYardApp } = await import("../components/native-yard-app");
const { appServices } = await import("../lib/app-services");
const { exampleSurvey } = await import("../lib/survey");
function services(): AppServices {
  return { ...appServices,
    auth: { ...appServices.auth, currentUser: async () => null, subscribe: () => () => {} },
    drafts: { readDraft: async () => null, keepDraft: async () => {}, clearDraft: async () => {} },
  };
}
async function start(response: () => Promise<Response>) {
  dom.window.history.replaceState(null, "", "/?view=scan");
  globalThis.fetch = async (input) => String(input).includes("/api/analyze") ? response() : Response.json({ vision: true, accounts: false });
  render(React.createElement(NativeYardApp, { services: services() }));
  return await screen.findByLabelText("Upload a plant or yard photo");
}
function choose(input: HTMLElement, file: File) { fireEvent.change(input, { target: { files: [file] } }); }
function assertLocalError(fileName: string, message: RegExp) {
  const inline = document.getElementById("photo-upload-error")!;
  assert.ok(inline);
  assert.match(inline.textContent!, message);
  assert.match(inline.textContent!, new RegExp(fileName.replaceAll(".", "\\.")));
  assert.equal(inline.getAttribute("role"), null);
  assert.equal(screen.getAllByRole("alert").length, 1);
  assert.match(screen.getByRole("alert").textContent!, message);
  assert.equal(screen.getByLabelText("Upload a plant or yard photo").getAttribute("aria-describedby"), inline.id);
  const controls = screen.getByLabelText("Upload a plant or yard photo").closest(".actions")!;
  assert.equal(controls.nextElementSibling, inline);
  assert.equal((screen.getByLabelText("One plant") as HTMLInputElement).checked, true);
  assert.equal((screen.getByLabelText("New Jersey ZIP code") as HTMLInputElement).value, "07030");
  assert.equal(new URLSearchParams(location.search).get("view"), "scan");
}
function settings() {
  fireEvent.click(screen.getByLabelText("One plant"));
  fireEvent.change(screen.getByLabelText("New Jersey ZIP code"), { target: { value: "07030" } });
}
for (const [name, makeFile, expected] of [
  ["wrong file type", () => new File(["wrong"], "notes.txt", { type: "text/plain" }), /Choose a JPEG/],
  ["oversized photo", () => { const file = new File(["photo"], "large.jpg", { type: "image/jpeg" }); Object.defineProperty(file, "size", { value: 13 * 1024 * 1024 }); return file; }, /smaller than 12 MB/],
] as const) {
  test(`${name} stays beside the picker and in one dismissible viewport alert with settings retained`, async () => {
    const before = globalThis.fetch;
    let requests = 0;
    try {
      const input = await start(async () => { requests++; return Response.json({}); });
      settings();
      const file = makeFile();
      choose(input, file);
      await screen.findByRole("alert");
      assertLocalError(file.name, expected);
      assert.equal(requests, 0);
      fireEvent.click(screen.getByRole("button", { name: "Dismiss upload error" }));
      assert.equal(screen.queryByRole("alert"), null);
      assert.ok(document.getElementById("photo-upload-error"));
      assert.ok(screen.getByRole("button", { name: "Retry this photo" }));
    } finally { cleanup(); globalThis.fetch = before; }
  });
}
test("provider error retains the file and retry clears feedback while preserving scan context", async () => {
  const before = globalThis.fetch;
  let attempts = 0;
  let retryResolve!: (value: Response) => void;
  const retry = new Promise<Response>((resolve) => { retryResolve = resolve; });
  try {
    const input = await start(async () => ++attempts === 1 ? Response.json({ error: "Photo provider unavailable. Try again." }, { status: 503 }) : retry);
    settings();
    choose(input, new File(["photo"], "back-bed.jpg", { type: "image/jpeg" }));
    await screen.findByRole("alert");
    assertLocalError("back-bed.jpg", /Photo provider unavailable/);
    fireEvent.click(screen.getByRole("button", { name: "Retry this photo" }));
    assert.equal(screen.queryByRole("alert"), null);
    assert.equal(document.getElementById("photo-upload-error"), null);
    assert.equal(new URLSearchParams(location.search).get("view"), "scan");
    await act(async () => retryResolve(Response.json({ ...exampleSurvey("07030"), source: "upload", photo: "/real.jpg" })));
    assert.equal(attempts, 2);
    assert.equal(new URLSearchParams(location.search).get("view"), "analysis");
    assert.equal(new URLSearchParams(location.search).has("sample"), false);
  } finally { cleanup(); globalThis.fetch = before; }
});
test("corrupt photo rejection is visible locally without substituting a sample or discarding settings", async () => {
  const before = globalThis.fetch;
  try {
    const input = await start(async () => Response.json({ error: "This photo could not be decoded. Choose another photo." }, { status: 422 }));
    settings();
    choose(input, new File(["corrupt bytes"], "broken.jpg", { type: "image/jpeg" }));
    await screen.findByRole("alert");
    assertLocalError("broken.jpg", /could not be decoded/);
    assert.equal(new URLSearchParams(location.search).has("sample"), false);
    assert.equal((input as HTMLInputElement).disabled, false);
    // Reselecting the same file must remain available after failure.
    choose(input, new File(["corrupt bytes"], "broken.jpg", { type: "image/jpeg" }));
    await screen.findByRole("alert");
    assert.equal(screen.getAllByRole("alert").length, 1);
  } finally { cleanup(); globalThis.fetch = before; }
});
test("error toast has a fixed top viewport position and stays out of the save toast position", () => {
  const css = readFileSync(new URL("../app/save-feedback.css", import.meta.url), "utf8");
  assert.match(css, /\.save-toast\s*\{[^}]*position:\s*fixed/);
  assert.match(css, /\.save-toast-error\s*\{[^}]*top:[^}]*bottom:\s*auto/);
});

test("octet-stream camera files reach the local decoder instead of failing client MIME checks",async()=>{
  const before=globalThis.fetch;let posts=0;
  try{
    const input=await start(async()=>{posts++;return Response.json({error:'Controlled decoder response.'},{status:422});});
    choose(input,new File(['fixture'],'camera.bin',{type:'application/octet-stream'}));
    await screen.findByRole('alert');assert.equal(posts,1);assert.match(screen.getByRole('alert').textContent!,/Controlled decoder response/);
  }finally{cleanup();globalThis.fetch=before;}
});

test("account changes clear retained private upload files and retry feedback",async()=>{
  const before=globalThis.fetch;
  type User=import('@supabase/supabase-js').User;
  let listener:(user:User|null)=>void=()=>{};
  const service=services();
  service.auth.currentUser=async()=>({id:'owner-a',user_metadata:{}} as User);
  service.auth.subscribe=callback=>{listener=callback;return()=>{};};
  service.account={...service.account,loadAccount:async()=>({properties:[],surveys:[],tasks:[]})};
  globalThis.fetch=async input=>String(input).includes('/api/analyze')?Response.json({error:'Controlled upload failure.'},{status:503}):Response.json({vision:true,accounts:true});
  dom.window.history.replaceState(null,'','/?view=scan');
  try{
    render(React.createElement(NativeYardApp,{services:service}));
    const input=await screen.findByLabelText('Upload a plant or yard photo');
    choose(input,new File(['private'],'owner-a.heic',{type:'image/heic'}));
    await screen.findByRole('alert');assert.ok(screen.getByRole('button',{name:'Retry this photo'}));
    await act(async()=>listener({id:'owner-b',user_metadata:{}} as User));
    await act(async()=>{dom.window.history.pushState(null,'','/?view=scan');dom.window.dispatchEvent(new dom.window.PopStateEvent('popstate'));});
    await screen.findByLabelText('Upload a plant or yard photo');
    assert.equal(screen.queryByRole('button',{name:'Retry this photo'}),null);
    assert.equal(screen.queryByText(/owner-a\.heic/),null);assert.equal(screen.queryByRole('alert'),null);
  }finally{cleanup();globalThis.fetch=before;}
});
