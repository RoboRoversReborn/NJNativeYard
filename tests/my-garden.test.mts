import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { JSDOM } from "jsdom";
import type { Property, RoadTask } from "../lib/account/repository";
import type { Survey, ScoreSnapshot } from "../lib/survey";
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost:3100/?view=home",
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
const { MyGarden } = await import("../components/my-garden");
const { exampleSurvey, SCORE_VERSION } = await import("../lib/survey");
const properties: Property[] = [
  {
    id: "p1",
    name: "My home",
    zip: "07645",
    yard_areas: [
      { id: "a1", property_id: "p1", name: "Front bed" },
      { id: "a2", property_id: "p1", name: "Back border" },
    ],
  },
  {
    id: "p2",
    name: "Other home",
    zip: "07960",
    yard_areas: [{ id: "a3", property_id: "p2", name: "Other property area" }],
  },
];
function snapshot(
  score: number,
  recordedAt: string,
  reviewed = true,
): ScoreSnapshot {
  return {
    version: SCORE_VERSION,
    recordedAt,
    score,
    nativeShare: null,
    assessed: reviewed ? 2 : 1,
    total: 2,
    reviewed: reviewed ? 2 : 0,
    coverage: reviewed ? 100 : 50,
    provisional: !reviewed,
    fingerprint: `${score}-${recordedAt}`,
    assessmentScope: reviewed ? "yard" : "photo",
    scopeProvisional: !reviewed,
    scope: {
      yard: reviewed ? 2 : 0,
      background: 0,
      unconfirmed: reviewed ? 0 : 2,
    },
  };
}
function survey(
  id: string,
  areaId: string,
  date: string,
  score: number,
  reviewed = true,
): Survey {
  return {
    ...exampleSurvey(),
    id,
    areaId,
    source: "upload",
    createdAt: date,
    photo: `/test-photos/${id}.jpg`,
    assessmentHistory: [snapshot(score, date, reviewed)],
  };
}
const newest = survey("newest", "a1", "2026-11-04T12:00:00Z", 35, false),
  older = survey("older", "a1", "2025-06-01T12:00:00Z", 79),
  other = survey("other", "a3", "2026-11-05T12:00:00Z", 99);
function harness(
  overrides: Partial<React.ComponentProps<typeof MyGarden>> = {},
) {
  const calls: {
    property: string[];
    area: string[][];
    photo: string[][];
    survey: string[];
    plan: [string, string | undefined][];
    create: number;
    addArea: string[];
  } = {
    property: [],
    area: [],
    photo: [],
    survey: [],
    plan: [],
    create: 0,
    addArea: [],
  };
  const props: React.ComponentProps<typeof MyGarden> = {
    properties,
    propertyId: "p1",
    surveys: [other, newest, older],
    tasks: [],
    onSelectProperty: (id) => calls.property.push(id),
    onOpenArea: (p, a) => calls.area.push([p, a]),
    onOpenSurvey: (s) => calls.survey.push(s.id),
    onAddPhoto: (p, a) => calls.photo.push([p, a]),
    onOpenPlan: (p, a) => calls.plan.push([p, a]),
    onAddProperty: () => calls.create++,
    onAddArea: (p) => calls.addArea.push(p),
    ...overrides,
  };
  render(React.createElement(MyGarden, props));
  return { calls, props };
}
test.afterEach(() => cleanup());

test("newest incomplete record and older fully reviewed snapshot retain separate dates and saved values", () => {
  const { calls } = harness();
  const card = screen
    .getByRole("heading", { name: "Front bed", level: 3 })
    .closest("article")!;
  assert.ok(within(card).getByText(/Newest record · Nov 4, 2026/));
  assert.ok(within(card).getByText("35"));
  assert.ok(within(card).getByText("Previous fully reviewed snapshot"));
  assert.ok(within(card).getByText(/Jun 1, 2025 · 79\/100/));
  assert.ok(within(card).getByText(/Historical record, not the newest result/));
  fireEvent.click(
    within(card).getByRole("button", { name: "Open its photo record" }),
  );
  assert.deepEqual(calls.survey, ["older"]);
  fireEvent.click(screen.getByRole("button", { name: "Review this photo" }));
  assert.deepEqual(calls.survey, ["older", "newest"]);
  assert.ok(screen.getAllByText("Capture date not recorded.").length >= 2);
});

test("property overview never blends other property records or computes an average", () => {
  harness();
  assert.equal(
    screen.queryByRole("heading", { name: "Other property area" }),
    null,
  );
  assert.equal(screen.queryByText("99"), null);
  assert.equal(
    screen.queryByText(/property score|property improved|average score/i),
    null,
  );
  const summary = screen.getByRole("list", { name: "Property record summary" });
  assert.ok(within(summary).getByText("2"));
  assert.ok(within(summary).getAllByText("1").length === 2);
  assert.ok(
    screen.getAllByText(/Photo estimate · yard boundary unconfirmed/).length >=
      1,
  );
});

test("photo and area callbacks carry explicit property and area IDs", () => {
  const { calls } = harness();
  const photo = screen.getByRole("button", { name: "Add a photo" });
  assert.equal((photo as HTMLButtonElement).disabled, true);
  fireEvent.change(screen.getByLabelText("Area for new photo"), {
    target: { value: "a2" },
  });
  fireEvent.click(photo);
  assert.deepEqual(calls.photo, [["p1", "a2"]]);
  fireEvent.click(screen.getByRole("button", { name: "Open area Front bed" }));
  assert.deepEqual(calls.area, [["p1", "a1"]]);
  fireEvent.change(screen.getByLabelText("Property"), {
    target: { value: "p2" },
  });
  assert.deepEqual(calls.property, ["p2"]);
});

test("next steps show at most three open, area-labelled property tasks without task-derived scores", () => {
  const year = new Date().getFullYear();
  const task = (
    id: string,
    title: string,
    area: string | null,
    offset = 0,
  ): RoadTask => ({
    id,
    title,
    property_id: "p1",
    yard_area_id: area,
    notes: "",
    replacement_id: null,
    done: false,
    updated_at: `2026-01-0${offset + 1}T12:00:00Z`,
    plan_year: year,
    season: "Autumn",
  });
  const { calls } = harness({
    tasks: [
      task("t1", "Review the front shrub", "a1"),
      task("t2", "Gather a planting list", null, 1),
      task("t3", "Photograph the back border", "a2", 2),
      task("t4", "Fourth open task", "a1", 3),
      { ...task("foreign", "Another property task", "a3"), property_id: "p2" },
    ],
  });
  const section = screen
    .getByRole("heading", { name: "Your next steps" })
    .closest("section")!;
  assert.equal(within(section).getAllByRole("listitem").length, 3);
  assert.ok(within(section).getByText("Front bed"));
  assert.ok(within(section).getByText("Back border"));
  assert.ok(within(section).getByText("Whole property"));
  assert.equal(within(section).queryByText("Fourth open task"), null);
  assert.equal(screen.queryByText("Another property task"), null);
  fireEvent.click(
    within(section).getByRole("button", { name: "Gather a planting list" }),
  );
  assert.deepEqual(calls.plan, [["p1", undefined]]);
  fireEvent.click(
    within(section).getByRole("button", { name: "Review the front shrub" }),
  );
  assert.deepEqual(calls.plan.at(-1), ["p1", "a1"]);
  assert.ok(
    within(section).getByText(/doesn’t increase an observation’s index/),
  );
});

test("no property, property without areas and area without photos have distinct scoped next actions", () => {
  let h = harness({ properties: [], propertyId: "", surveys: [] });
  fireEvent.click(
    screen.getByRole("button", { name: "Add your first property" }),
  );
  assert.equal(h.calls.create, 1);
  cleanup();
  h = harness({
    properties: [{ ...properties[0], yard_areas: [] }],
    surveys: [],
  });
  fireEvent.click(screen.getByRole("button", { name: "Add your first area" }));
  assert.deepEqual(h.calls.addArea, ["p1"]);
  cleanup();
  h = harness({
    properties: [
      { ...properties[0], yard_areas: [properties[0].yard_areas[0]] },
    ],
    surveys: [],
  });
  fireEvent.click(screen.getByRole("button", { name: "Add a baseline photo" }));
  assert.deepEqual(h.calls.photo, [["p1", "a1"]]);
  assert.ok(screen.getByText(/No photo records yet/));
  assert.equal(screen.queryByText(/\/100/), null);
});

test("samples and background property records do not become personal photo activity; photo errors preserve records", () => {
  harness({
    surveys: [newest, other, { ...older, id: "sample", source: "sample" }],
  });
  const photos = screen.getAllByAltText("Your recorded photo of Front bed");
  fireEvent.error(photos[0]);
  assert.ok(screen.getByText("Photo temporarily unavailable"));
  assert.ok(screen.getAllByText(/Photo record added/).length === 1);
  assert.ok(screen.getByRole("button", { name: "Review this photo" }));
});
