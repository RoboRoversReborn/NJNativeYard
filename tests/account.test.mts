import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import React from "react";
import type { User } from "../lib/app-services";
import type { AppServices } from "../lib/app-services";
import type { Property, RoadTask } from "../lib/account/repository";
import type { Survey } from "../lib/survey";
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
dom.window.scrollTo = () => {};
dom.window.HTMLElement.prototype.scrollIntoView = () => {};
const { render, screen, fireEvent, cleanup, waitFor, within } =
  await import("@testing-library/react");
const { NativeYardApp } = await import("../components/native-yard-app");
const { exampleSurvey, SCORE_VERSION } = await import("../lib/survey");
const user: User = {
  id: "user-test",
  aud: "authenticated",
  app_metadata: { provider: "google" },
  user_metadata: { full_name: "Test gardener" },
  created_at: "2024-01-01T00:00:00Z",
  email: "gardener@example.test",
};
function harness() {
  let signedIn: User | null = user;
  let subscription: (user: User | null) => void = () => {};
  const properties: Property[] = [
    {
      id: "p1",
      name: "Home",
      zip: "07645",
      yard_areas: [
        { id: "a1", property_id: "p1", name: "Front garden" },
        { id: "a2", property_id: "p1", name: "Back garden" },
      ],
    },
    {
      id: "p2",
      name: "Other home",
      zip: "07960",
      yard_areas: [{ id: "a3", property_id: "p2", name: "Courtyard" }],
    },
  ];
  let tasks: RoadTask[] = [
    {
      id: "t1",
      property_id: "p1",
      yard_area_id: "a1",
      title: "Remove reviewed ivy",
      notes: "Check roots",
      done: false,
      replacement_id: null,
      updated_at: "2025-01-01T12:00:00Z",
    },
    {
      id: "t2",
      property_id: "p2",
      yard_area_id: "a3",
      title: "Other property task",
      notes: "",
      done: false,
      replacement_id: null,
      updated_at: "2025-01-01T12:00:00Z",
    },
  ];
  let surveys: Survey[] = [2025, 2024].map((year) => {
    const s = exampleSurvey();
    return {
      ...s,
      source: "upload",
      areaId: "a1",
      photoPath: `user-test/${s.id}.jpg`,
      createdAt: `${year}-06-01T12:00:00Z`,
      plants: s.plants.map((p) => ({
        ...p,
        plantId: p.plantId || "acer-palmatum",
        reviewed: true,
      })),
    };
  });
  const calls = { signIn: 0, signOut: 0, profile: "", save: 0 };
  const services: AppServices = {
    auth: {
      async currentUser() {
        return signedIn;
      },
      subscribe(cb) {
        subscription = cb;
        return () => {};
      },
      async signIn() {
        calls.signIn++;
      },
      async signOut() {
        calls.signOut++;
        signedIn = null;
        subscription(null);
      },
    },
    drafts: {
      async keepDraft() {
        return undefined;
      },
      async readDraft() {
        return null;
      },
      async clearDraft() {
        return undefined;
      },
    },
    account: {
      async ensureAutoYardPlan(propertyId) { return tasks.filter(task=>task.property_id===propertyId); },
      async loadAccount() {
        return {
          properties: [...properties],
          surveys: [...surveys],
          tasks: [...tasks],
        };
      },
      async addProperty(name, zip) {
        properties.push({ id: "new-property", name, zip, yard_areas: [] });
        return "new-property";
      },
      async addArea(id, name) {
        properties
          .find((p) => p.id === id)!
          .yard_areas.push({ id: "new-area", property_id: id, name });
        return "new-area";
      },
      async renameProperty(id, name) {
        properties.find((p) => p.id === id)!.name = name;
      },
      async renameArea(id, name) {
        for (const property of properties) {
          const area = property.yard_areas.find((a) => a.id === id);
          if (area) area.name = name;
        }
      },
      async saveSurvey(s, areaId) {
        calls.save++;
        const saved = {
          ...s,
          areaId,
          photoPath: `user-test/${s.id}.jpg`,
          revision: undefined,
        };
        surveys = [saved, ...surveys.filter((p) => p.id !== s.id)];
        return saved;
      },
      async putTask(t) {
        const row = {
          ...t,
          id: t.id || "new-task",
          updated_at: new Date().toISOString(),
        };
        tasks = [...tasks.filter((p) => p.id !== row.id), row];
      },
      async saveProfile(name) {
        calls.profile = name;
      },
    },
  };
  return {
    services,
    calls,
    properties,
    getTasks: () => tasks,
    getSurveys: () => surveys,
  };
}
async function start(view = "properties") {
  dom.window.history.replaceState(null, "", `/?view=${view}`);
  const h = harness();
  render(React.createElement(NativeYardApp, { services: h.services }));
  await screen.findByRole("heading", {
    name:
      view === "roadmap"
        ? "Your yard plan."
        : view === "profile"
          ? "Account settings."
          : "My properties.",
  });
  return h;
}
const originalFetch = globalThis.fetch;
test.beforeEach(() => {
  globalThis.fetch = async () =>
    Response.json({ vision: true, accounts: true });
});
test.afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
});
test("signed-in users can reach the public homepage and return to My garden", async () => {
  const { act } = await import("@testing-library/react");
  await start("profile");
  fireEvent.click(screen.getByRole("button", { name: "NativeYard home" }));
  assert.ok(screen.getByRole("heading", { name: "My garden." }));
  fireEvent.click(screen.getByRole("button", { name: "Home" }));
  assert.ok(screen.getByRole("heading", { name: /Your yard\./ }));
  fireEvent.click(screen.getByRole("button", { name: "My yard" }));
  assert.ok(screen.getByRole("heading", { name: "My garden." }));
  await act(async () => {
    dom.window.history.replaceState(null, "", "/?view=welcome");
    dom.window.dispatchEvent(new dom.window.PopStateEvent("popstate"));
  });
  assert.ok(screen.getByRole("heading", { name: /Your yard\./ }));
});

test("signed-in hub avoids public hero and scopes history/repeat-scan comparisons", async () => {
  await start();
  assert.equal(
    screen.queryByRole("heading", { name: /Your yard.*world/i }),
    null,
  );
  assert.equal(screen.queryByText("Estimate change:", { exact: false }), null);
  fireEvent.change(screen.getByLabelText("Yard area"), {
    target: { value: "a1" },
  });
  assert.ok(screen.getByText(/Numeric change is withheld/));
  assert.equal(
    screen.getAllByRole("button", { name: /Open saved analysis/ }).length,
    2,
  );
  fireEvent.change(screen.getByLabelText("Yard area"), {
    target: { value: "a2" },
  });
  assert.equal(screen.queryByText(/Estimate change:/), null);
  assert.ok(screen.getByText("No saved photo records for this area."));
  fireEvent.change(screen.getByLabelText("Property"), {
    target: { value: "p2" },
  });
  assert.equal(
    (screen.getByLabelText("Yard area") as HTMLSelectElement).value,
    "",
  );
  assert.ok(screen.getByRole("heading", { name: "Courtyard" }));
});
test("property and named area creation persist through account refresh", async () => {
  const h = await start();
  fireEvent.click(screen.getByRole("button", { name: "Add property" }));
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "New house" },
  });
  fireEvent.change(screen.getByLabelText("NJ ZIP code"), {
    target: { value: "07645" },
  });
  fireEvent.click(screen.getByLabelText("Add property only"));
  fireEvent.click(screen.getByRole("button", { name: "Create property" }));
  await waitFor(() =>
    assert.ok(h.properties.some((p) => p.name === "New house")),
  );
  await waitFor(() =>
    assert.equal(
      screen.queryByRole("heading", { name: "Name a property" }),
      null,
    ),
  );
  assert.equal(
    new URLSearchParams(dom.window.location.search).get("property"),
    "new-property",
  );
  fireEvent.change(screen.getByLabelText("Property"), {
    target: { value: "new-property" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Add yard area" }));
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "Pollinator strip" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create area" }));
  await screen.findByRole("heading", { name: "Pollinator strip" });
  assert.equal(h.properties.at(-1)!.yard_areas[0].name, "Pollinator strip");
  assert.equal(
    new URLSearchParams(dom.window.location.search).get("property"),
    "new-property",
  );
  assert.equal(
    new URLSearchParams(dom.window.location.search).get("area"),
    "new-area",
  );
});
test("saved survey opens in original scope, permits review/save, and locks reassignment", async () => {
  const h = await start();
  fireEvent.click(screen.getByRole("button", { name: "Open latest survey →" }));
  await screen.findByRole("heading", {
    name: "Improve your yard’s ecosystem.",
  });
  assert.equal(
    (screen.getByLabelText("Property") as HTMLSelectElement).disabled,
    true,
  );
  assert.equal(
    (screen.getByLabelText("Yard area") as HTMLSelectElement).value,
    "a1",
  );
  fireEvent.click(screen.getByRole("button", { name: "Save survey" }));
  await screen.findByText("Survey saved to Home / Front garden.");
  assert.equal(h.calls.save, 1);
  const savedRoute = new URLSearchParams(dom.window.location.search);
  assert.equal(savedRoute.get("area"), "a1");
  assert.equal(savedRoute.get("property"), "p1");
  assert.equal(savedRoute.get("survey"), h.getSurveys()[0].id);
  assert.equal(h.getSurveys()[0].areaId, "a1");
  assert.equal(h.getSurveys()[0].assessmentHistory?.length, 1);
  assert.equal(h.getSurveys()[0].assessmentHistory?.[0].version, SCORE_VERSION);
});
test("roadmap tasks create, edit, complete, and stay in property/zone scope", async () => {
  const h = await start("roadmap");
  assert.ok(screen.getByRole("heading", { name: "Remove reviewed ivy" }));
  assert.equal(
    screen.queryByRole("heading", { name: "Other property task" }),
    null,
  );
  fireEvent.change(screen.getByLabelText("Yard area"), {
    target: { value: "a1" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Add task" }));
  fireEvent.change(screen.getByLabelText("Task"), {
    target: { value: "Plant native shrubs" },
  });
  fireEvent.change(screen.getByLabelText("Notes"), {
    target: { value: "Plant when soil is ready" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save task" }));
  await screen.findByRole("heading", { name: "Plant native shrubs" });
  assert.equal(
    h.getTasks().find((t) => t.id === "new-task")!.yard_area_id,
    "a1",
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Complete Plant native shrubs" }),
  );
  await screen.findByRole("button", { name: "Reopen Plant native shrubs" });
  assert.equal(h.getTasks().find((t) => t.id === "new-task")!.done, true);
  const card = screen
    .getByRole("heading", { name: "Plant native shrubs" })
    .closest("article")!;
  fireEvent.click(within(card).getByRole("button", { name: "Edit" }));
  fireEvent.change(screen.getByLabelText("Notes"), {
    target: { value: "Revised planting notes" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save task" }));
  await screen.findByText("Revised planting notes");
  fireEvent.change(screen.getByLabelText("Yard area"), {
    target: { value: "a2" },
  });
  assert.equal(
    screen.queryByRole("heading", { name: "Plant native shrubs" }),
    null,
  );
});
test("profile edits, roadmap access, and sign-out work through real action handlers", async () => {
  const h = await start("profile");
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "Updated gardener" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
  await screen.findByText("Profile saved.");
  assert.equal(h.calls.profile, "Updated gardener");
  fireEvent.click(screen.getByRole("button", { name: "Your yard plan" }));
  await screen.findByRole("heading", { name: "Your yard plan." });
  fireEvent.click(screen.getByRole("button", { name: "Open profile menu" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Settings" }));
  await screen.findByRole("heading", { name: "Account settings." });
  fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
  await screen.findByRole("heading", { name: /Your yard.*world/i });
  assert.equal(h.calls.signOut, 1);
  assert.equal(screen.queryByRole("button", { name: "My properties" }), null);
});
test("Google sign-in action is available only when configured and surfaces failures", async () => {
  dom.window.history.replaceState(null, "", "/?view=signin");
  const h = harness();
  h.services.auth.currentUser = async () => null;
  h.services.auth.signIn = async () => {
    throw new Error("Provider is unavailable.");
  };
  render(React.createElement(NativeYardApp, { services: h.services }));
  await screen.findByRole("heading", { name: "Let’s keep it growing." });
  fireEvent.click(screen.getByRole("button", { name: /Continue with Google/ }));
  await screen.findByText("Provider is unavailable.");
  assert.equal(
    (
      screen.getByRole("button", {
        name: /Continue with Google/,
      }) as HTMLButtonElement
    ).disabled,
    false,
  );
});
test("property-wide roadmap tasks stay property-wide when edited", async () => {
  const h = await start("roadmap");
  fireEvent.click(screen.getByRole("button", { name: "Add task" }));
  fireEvent.change(screen.getByLabelText("Task"), {
    target: { value: "Whole property plan" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save task" }));
  await screen.findByRole("heading", { name: "Whole property plan" });
  assert.equal(
    h.getTasks().find((t) => t.id === "new-task")!.yard_area_id,
    null,
  );
  fireEvent.change(screen.getByLabelText("Yard area"), {
    target: { value: "a1" },
  });
  assert.equal(
    screen.queryByRole("heading", { name: "Whole property plan" }),
    null,
  );
});
test("backend failures stay visible and do not show false save success", async () => {
  const h = await start();
  h.services.account.saveSurvey = async () => {
    throw new Error("Storage permission denied.");
  };
  fireEvent.click(screen.getByRole("button", { name: "Open latest survey →" }));
  await screen.findByRole("heading", {
    name: "Improve your yard’s ecosystem.",
  });
  fireEvent.click(screen.getByRole("button", { name: "Save survey" }));
  assert.match((await screen.findByRole("alert")).textContent!, /Storage permission denied/);
  assert.equal(
    screen.queryByText("Survey saved to Home / Front garden."),
    null,
  );
});

test("annual plans persist year/season and completion dates; prior years and undated backlog stay distinct", async () => {
  const h = await start("roadmap");
  assert.ok(screen.getByText(/Undated backlog tasks stay visible/));
  fireEvent.change(screen.getByLabelText("Plan year"), {
    target: { value: "2025" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Add task" }));
  fireEvent.change(screen.getByLabelText("Task"), {
    target: { value: "Autumn pollinator patch" },
  });
  fireEvent.change(screen.getByLabelText("Season"), {
    target: { value: "Autumn" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save task" }));
  await screen.findByRole("heading", { name: "Autumn pollinator patch" });
  assert.equal(h.getTasks().find((t) => t.id === "new-task")!.plan_year, 2025);
  assert.equal(h.getTasks().find((t) => t.id === "new-task")!.season, "Autumn");
  fireEvent.click(
    screen.getByRole("button", { name: "Complete Autumn pollinator patch" }),
  );
  await screen.findByRole("button", { name: "Reopen Autumn pollinator patch" });
  const completed = h.getTasks().find((t) => t.id === "new-task")!.completed_at;
  assert.ok(completed && !Number.isNaN(Date.parse(completed)));
  fireEvent.change(screen.getByLabelText("Plan year"), {
    target: { value: String(new Date().getFullYear()) },
  });
  assert.equal(
    screen.queryByRole("heading", { name: "Autumn pollinator patch" }),
    null,
  );
  assert.ok(screen.getByRole("heading", { name: "Remove reviewed ivy" }));
  fireEvent.change(screen.getByLabelText("Plan year"), {
    target: { value: "2025" },
  });
  const card = screen
    .getByRole("heading", { name: "Autumn pollinator patch" })
    .closest("article")!;
  fireEvent.click(within(card).getByRole("button", { name: "Edit" }));
  fireEvent.change(screen.getByLabelText("Notes"), {
    target: { value: "Return after the winter" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save task" }));
  await screen.findByText("Return after the winter");
  assert.equal(
    h.getTasks().find((t) => t.id === "new-task")!.completed_at,
    completed,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Reopen Autumn pollinator patch" }),
  );
  await screen.findByRole("button", {
    name: "Complete Autumn pollinator patch",
  });
  assert.equal(
    h.getTasks().find((t) => t.id === "new-task")!.completed_at,
    null,
  );
});

test("property and area names can be managed without moving scan history", async () => {
  const h = await start();
  fireEvent.click(screen.getByRole("button", { name: "Rename property" }));
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "Our home" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save name" }));
  await waitFor(() => assert.equal(h.properties[0].name, "Our home"));
  await waitFor(() =>
    assert.equal(
      screen.queryByRole("heading", { name: "Rename property" }),
      null,
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "Rename Front garden" }));
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "Front wildlife bed" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save name" }));
  await screen.findByRole("heading", { name: "Front wildlife bed" });
  assert.equal(h.properties[0].yard_areas[0].id, "a1");
  assert.equal(h.getSurveys().length, 2);
});

test("editing an area task from whole-property view only offers observations from its original area", async () => {
  const { RoadmapView } = await import("../components/account-views");
  const h = harness();
  const first = {
    ...exampleSurvey(),
    source: "upload" as const,
    areaId: "a1",
    createdAt: "2025-05-01T12:00:00Z",
  };
  const other = {
    ...exampleSurvey(),
    source: "upload" as const,
    areaId: "a2",
    createdAt: "2025-06-01T12:00:00Z",
  };
  render(
    React.createElement(RoadmapView, {
      propertyId: "p1",
      areaId: "",
      tasks: h.getTasks(),
      surveys: [first, other],
      busy: false,
      onRefresh: async () => {},
      onError: () => {},
      repository: h.services.account,
    }),
  );
  const card = screen
    .getByRole("heading", { name: "Remove reviewed ivy" })
    .closest("article")!;
  fireEvent.click(within(card).getByRole("button", { name: "Edit" }));
  const options = within(
    screen.getByLabelText("Related observation"),
  ).getAllByRole("option") as HTMLOptionElement[];
  assert.deepEqual(
    options.map((o) => o.value),
    ["", first.id],
  );
});

test("failed annual action save keeps editable input and does not claim completion", async () => {
  const h = await start("roadmap");
  h.services.account.putTask = async () => {
    throw new Error("Task storage unavailable.");
  };
  fireEvent.click(screen.getByRole("button", { name: "Add task" }));
  fireEvent.change(screen.getByLabelText("Task"), {
    target: { value: "Retain my plan" },
  });
  fireEvent.change(screen.getByLabelText("Notes"), {
    target: { value: "Keep this on retry" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save task" }));
  await screen.findByText("Task storage unavailable.");
  assert.equal(
    (screen.getByLabelText("Notes") as HTMLTextAreaElement).value,
    "Keep this on retry",
  );
  assert.equal(
    h.getTasks().some((t) => t.title === "Retain my plan"),
    false,
  );
});

test("saved-photo access failure preserves history and prior-year observations exclude samples", async () => {
  await start();
  const photos = screen.getAllByAltText("Saved survey photo");
  fireEvent.error(photos[0]);
  assert.ok(screen.getByText(/Saved photo is temporarily unavailable/));
  assert.equal(
    screen.getAllByRole("button", { name: "Open survey" }).length,
    2,
  );
  cleanup();
  const { RoadmapView } = await import("../components/account-views");
  const h = harness();
  const observed = {
    ...exampleSurvey(),
    source: "upload" as const,
    areaId: "a1",
    createdAt: "2024-06-01T12:00:00Z",
  };
  const sample = {
    ...exampleSurvey(),
    areaId: "a1",
    createdAt: "2024-06-02T12:00:00Z",
  };
  render(
    React.createElement(RoadmapView, {
      propertyId: "p1",
      areaId: "a1",
      tasks: [],
      surveys: [observed, sample],
      onOpenSurvey: () => {},
      busy: false,
      onRefresh: async () => {},
      onError: () => {},
      repository: h.services.account,
    }),
  );
  fireEvent.change(screen.getByLabelText("Plan year"), {
    target: { value: "2024" },
  });
  assert.equal(
    screen.getAllByRole("button", { name: "Revisit this observation" }).length,
    1,
  );
  assert.ok(screen.getByText(/Revisit saved real-photo scans/));
});

test("repository rejects an account switch before photo fetch, storage upload or survey write", async () => {
  const previousURL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://repository-test.example.test";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-only-anon-key";
  const { createClient } = await import("../lib/account/client.js");
  const { saveSurvey } = await import("../lib/account/repository");
  const client = createClient()!;
  assert.ok(client);
  assert.equal(createClient(), client);
  let reads = 0,
    storage = 0,
    writes = 0;
  const authMock = mock.method(client.auth, "getUser", async () => ({
    data: { user: { ...user, id: "owner-b" } },
    error: null,
  }));
  const storageMock = mock.method(client.storage, "from", () => {
    storage++;
    throw new Error("Unexpected storage access");
  });
  const writeMock = mock.method(client, "from", () => {
    writes++;
    throw new Error("Unexpected database access");
  });
  const savedFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    reads++;
    throw new Error("Unexpected photo fetch");
  };
  try {
    const survey = {
      ...exampleSurvey(),
      source: "upload" as const,
      areaId: undefined,
      photoPath: undefined,
    };
    await assert.rejects(
      saveSurvey(survey, "area-a", "owner-a"),
      /account changed before saving/,
    );
    assert.equal(authMock.mock.callCount(), 1);
    assert.deepEqual(
      { reads, storage, writes },
      { reads: 0, storage: 0, writes: 0 },
    );
  } finally {
    authMock.mock.restore();
    storageMock.mock.restore();
    writeMock.mock.restore();
    await (client.auth as any).dispose?.();
    globalThis.fetch = savedFetch;
    if (previousURL === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousURL;
    if (previousKey === undefined)
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousKey;
  }
});

test("account history labels legacy and unconfirmed scores as photo estimates and samples as illustrative", async () => {
  const { PropertiesView } = await import("../components/account-views");
  const h = harness();
  const legacy: Survey = {
    ...exampleSurvey(),
    source: "upload",
    areaId: "a1",
    createdAt: "2024-06-01T12:00:00Z",
    assessmentHistory: [
      {
        version: "species-mix-v1",
        recordedAt: "2024-06-01T12:00:00Z",
        score: 82,
        nativeShare: 70,
        assessed: 3,
        total: 3,
        reviewed: 3,
        coverage: 100,
        provisional: false,
        fingerprint: "legacy-no-yard-boundary",
      },
    ],
  };
  const sample: Survey = { ...exampleSurvey(), areaId: "a1" };
  render(
    React.createElement(PropertiesView, {
      properties: h.properties,
      propertyId: "p1",
      areaId: "a1",
      surveys: [legacy, sample],
      onOpen: () => {},
      onScan: () => {},
      onRoadmap: () => {},
      onRefresh: async () => {},
      onError: () => {},
      repository: h.services.account,
    }),
  );
  assert.ok(
    screen.getAllByText(/^Photo estimate; yard boundary unconfirmed/).length >=
      3,
  );
  assert.ok(screen.getAllByText(/^Illustrative sample estimate/).length >= 1);
  assert.ok(screen.getByText(/First saved observation:.*82\/100/));
  const updates = screen
    .getByText("Saved score updates (1)")
    .closest("details")!;
  assert.ok(
    within(updates).getByText(/^Photo estimate; yard boundary unconfirmed/),
  );
});

test("history suppresses numeric change when photo and confirmed-yard assessment scopes differ", async () => {
  const { PropertiesView } = await import("../components/account-views");
  const h = harness();
  const photo: Survey = {
    ...exampleSurvey(),
    source: "upload",
    areaId: "a1",
    createdAt: "2024-06-01T12:00:00Z",
  };
  const yard: Survey = {
    ...exampleSurvey(),
    source: "upload",
    areaId: "a1",
    createdAt: "2025-06-01T12:00:00Z",
  };
  yard.plants = yard.plants.map((p) => ({ ...p, yardScope: "yard" }));
  render(
    React.createElement(PropertiesView, {
      properties: h.properties,
      propertyId: "p1",
      areaId: "a1",
      surveys: [yard, photo],
      onOpen: () => {},
      onScan: () => {},
      onRoadmap: () => {},
      onRefresh: async () => {},
      onError: () => {},
      repository: h.services.account,
    }),
  );
  assert.equal(screen.queryByText(/Estimate change:/), null);
  assert.ok(screen.getByText(/Numeric change is withheld/));
  assert.equal(
    screen.getAllByRole("button", { name: /Open (?:saved analysis|survey)/ }).length,
    2,
  );
});
