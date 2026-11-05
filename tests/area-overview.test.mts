import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { JSDOM } from "jsdom";
import type { Property, RoadTask } from "../lib/account/repository";
import type { Survey } from "../lib/survey";
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost:3100/?view=properties&property=p1&area=a1",
});
Object.defineProperties(globalThis, {
  window: { value: dom.window, configurable: true },
  document: { value: dom.window.document, configurable: true },
  navigator: { value: dom.window.navigator, configurable: true },
  HTMLElement: { value: dom.window.HTMLElement, configurable: true },
  IS_REACT_ACT_ENVIRONMENT: { value: true, writable: true, configurable: true },
});
const { render, screen, fireEvent, cleanup, within } =
  await import("@testing-library/react");
const { AreaOverview } = await import("../components/area-overview");
const { exampleSurvey, SCORE_VERSION } = await import("../lib/survey");
const property: Property = {
  id: "p1",
  name: "My home",
  zip: "07645",
  yard_areas: [
    { id: "a1", property_id: "p1", name: "Backyard" },
    { id: "a2", property_id: "p1", name: "Pool area" },
  ],
};
function survey(
  id: string,
  areaId = "a1",
  createdAt = "2026-11-04T15:00:00Z",
): Survey {
  return {
    ...exampleSurvey(),
    id,
    areaId,
    source: "upload",
    createdAt,
    photo: `/saved/${id}.jpg`,
    assessmentHistory: [
      {
        version: SCORE_VERSION,
        recordedAt: createdAt,
        score: 37,
        nativeShare: null,
        assessed: 1,
        total: 2,
        reviewed: 0,
        coverage: 50,
        provisional: true,
        fingerprint: id,
        assessmentScope: "photo",
        scopeProvisional: true,
        scope: { yard: 0, background: 0, unconfirmed: 2 },
      },
    ],
  };
}
function task(id: string, values: Partial<RoadTask> = {}): RoadTask {
  return {
    id,
    property_id: "p1",
    yard_area_id: "a1",
    title: id,
    notes: "",
    replacement_id: null,
    done: false,
    updated_at: "2026-11-04T15:00:00Z",
    ...values,
  };
}
function harness(
  overrides: Partial<React.ComponentProps<typeof AreaOverview>> = {},
) {
  const calls = {
    surveys: [] as string[],
    uploads: 0,
    plans: 0,
    backs: 0,
    areas: [] as string[],
  };
  render(
    React.createElement(AreaOverview, {
      property,
      area: property.yard_areas[0],
      surveys: [survey("latest")],
      tasks: [],
      onOpenSurvey: (s: Survey) => calls.surveys.push(s.id),
      onUpload: () => calls.uploads++,
      onOpenPlan: () => calls.plans++,
      onBack: () => calls.backs++,
      onSwitchArea: (id: string) => calls.areas.push(id),
      ...overrides,
    }),
  );
  return calls;
}
test.afterEach(cleanup);
test("selected area shows its latest saved photo and no other area or sample records", () => {
  harness({
    surveys: [
      survey("older", "a1", "2025-01-01T15:00:00Z"),
      survey("foreign", "a3"),
      survey("pool", "a2"),
      { ...survey("sample"), source: "sample" },
      survey("latest"),
    ],
  });
  assert.ok(screen.getByRole("heading", { name: "Backyard", level: 1 }));
  const latest = screen
    .getByRole("heading", { name: "A closer look at Backyard" })
    .closest("section")!;
  assert.equal(
    within(latest).getByAltText("Saved photo of Backyard").getAttribute("src"),
    "/saved/latest.jpg",
  );
  assert.equal(screen.queryByRole("heading", { name: "Pool area" }), null);
  const images = screen
    .getAllByRole("img")
    .map((image) => image.getAttribute("src"));
  assert.equal(
    images.some((src) => /foreign|pool|sample/.test(src || "")),
    false,
  );
  assert.equal(screen.queryByText("Your areas"), null);
});
test("capture dates remain unknown rather than substituting upload dates; baseline has no invented trend", () => {
  harness();
  assert.ok(screen.getAllByText("Capture date not recorded").length >= 1);
  assert.ok(screen.getByText(/One observation establishes a starting record/));
  assert.equal(screen.queryByText(/Saved index difference:/), null);
  assert.ok(screen.getByText("37"));
  cleanup();
  harness({
    surveys: [
      {
        ...survey("captured"),
        capture: {
          capturedAt: "2024-06-02T15:00:00Z",
          capturedAtConfirmed: true,
          capturedAtSource: "user-confirmed",
        },
      },
    ],
  });
  assert.ok(screen.getAllByText("Captured Jun 2, 2024").length >= 1);
  assert.equal(screen.queryByText("Captured Nov 4, 2026"), null);
});
test("unconfirmed comparison never promotes saved score differences into change", () => {
  const older = survey("older", "a1", "2025-01-01T15:00:00Z");
  older.assessmentHistory![0].score = 12;
  older.assessmentHistory![0].version = "species-mix-v1";
  harness({ surveys: [survey("latest"), older] });
  assert.ok(screen.getByText(/do not establish a numeric change/));
  assert.ok(screen.getByText(/saved index formulas differ/));
  assert.equal(screen.queryByText(/Saved index difference:/), null);
});
test("callbacks keep scoped records and area actions while checklist excludes other areas and property tasks", () => {
  const calls = harness({
    tasks: [
      task("pending"),
      task("done", { done: true }),
      task("upcoming", { due_start: "2999-01-01" }),
      task("overdue", { due_end: "2000-01-01" }),
      task("pool", { yard_area_id: "a2" }),
      task("whole", { yard_area_id: null }),
      task("foreign", { property_id: "p2" }),
    ],
  });
  const counts = screen.getByLabelText("Area task counts");
  for (const label of ["Pending", "Completed", "Upcoming", "Overdue"])
    assert.equal(
      within(counts).getByText(label).parentElement!.querySelector("dd")!
        .textContent,
      "1",
    );
  fireEvent.click(screen.getByRole("button", { name: "Open full analysis" }));
  fireEvent.click(screen.getByRole("button", { name: "Upload latest photo" }));
  fireEvent.click(screen.getByRole("button", { name: "Open area plan" }));
  fireEvent.click(screen.getByRole("button", { name: "My garden" }));
  fireEvent.change(screen.getByLabelText("Switch area"), {
    target: { value: "a2" },
  });
  assert.deepEqual(calls, {
    surveys: ["latest"],
    uploads: 1,
    plans: 1,
    backs: 1,
    areas: ["a2"],
  });
});
test("foreign area fails closed and missing saved snapshot does not reconstruct a score", () => {
  harness({
    area: { id: "a3", property_id: "p2", name: "Other property area" },
  });
  assert.ok(screen.getByRole("heading", { name: "Area unavailable" }));
  assert.equal(screen.queryByRole("img"), null);
  cleanup();
  harness({ surveys: [{ ...survey("legacy"), assessmentHistory: undefined }] });
  assert.ok(screen.getByText(/No saved assessment snapshot is available/));
  assert.equal(screen.queryByText("Saved composition index"), null);
});
