import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { JSDOM } from "jsdom";
import type { RoadTask } from "../lib/account/repository";
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost:3100/",
});
Object.defineProperties(globalThis, {
  window: { value: dom.window, configurable: true },
  document: { value: dom.window.document, configurable: true },
  navigator: { value: dom.window.navigator, configurable: true },
  HTMLElement: { value: dom.window.HTMLElement, configurable: true },
  IS_REACT_ACT_ENVIRONMENT: { value: true, writable: true, configurable: true },
});
const { render, screen, within, cleanup, fireEvent, waitFor } =
  await import("@testing-library/react");
const { RoadmapView } = await import("../components/account-views");
const repository = await import("../lib/account/repository");
const year = new Date().getFullYear();
const row = (id: string, overrides: Partial<RoadTask> = {}): RoadTask => ({
  id,
  title: id,
  property_id: "p1",
  yard_area_id: "a1",
  notes: "",
  replacement_id: null,
  done: false,
  updated_at: new Date().toISOString(),
  plan_year: year,
  ...overrides,
});
const props = {
  propertyId: "p1",
  areaId: "a1",
  busy: false,
  onRefresh: async () => {},
  onError: (message: string) => {
    throw Error(message);
  },
};

test("status totals and filters share property, area, year and backlog scope; undated work is pending", () => {
  try {
    render(
      React.createElement(RoadmapView, {
        ...props,
        tasks: [
          row("Ready without date"),
          row("Finished", { done: true }),
          row("Later window", {
            due_start: `${year + 1}-01-01`,
            due_end: `${year + 1}-03-01`,
          }),
          row("Missed window", {
            due_start: `${year - 1}-01-01`,
            due_end: `${year - 1}-03-01`,
          }),
          row("Earlier backlog", { plan_year: year - 1 }),
          row("Foreign property", { property_id: "p2" }),
          row("Foreign area", { yard_area_id: "a2" }),
          row("Future plan", { plan_year: year + 1 }),
          row("Past done", { plan_year: year - 1, done: true }),
        ],
      }),
    );
    const filters = within(
      screen.getByRole("navigation", { name: "Task status filters" }),
    );
    for (const name of [
      "All 5",
      "Done 1",
      "Pending 2",
      "Upcoming 1",
      "Overdue 1",
    ])
      assert.ok(filters.getByRole("button", { name }));
    fireEvent.click(filters.getByRole("button", { name: "Upcoming 1" }));
    assert.ok(screen.getByRole("heading", { name: "Later window" }));
    assert.ok(
      screen.getByText(
        `Suggested window: ${year + 1}-01-01 – ${year + 1}-03-01`,
      ),
    );
    assert.equal(
      screen.queryByRole("heading", { name: "Ready without date" }),
      null,
    );
    fireEvent.click(filters.getByRole("button", { name: "Pending 2" }));
    assert.ok(screen.getByRole("heading", { name: "Ready without date" }));
    assert.ok(screen.getByRole("heading", { name: "Earlier backlog" }));
    assert.equal(
      screen.queryByRole("heading", { name: "Missed window" }),
      null,
    );
    fireEvent.change(screen.getByLabelText("Plan year"), {
      target: { value: String(year + 1) },
    });
    assert.ok(filters.getByRole("button", { name: "All 5" }));
  } finally {
    cleanup();
  }
});

test("completion and reopen save persisted state, preserve automatic metadata and refresh the checklist", async () => {
  let tasks = [
    row("Inspect confirmed plant", {
      auto_key: "auto-key",
      source_details: "Current source guidance",
      due_start: `${year}-01-01`,
      due_end: `${year}-12-31`,
      stage: "Do",
    }),
  ];
  const writes: Parameters<typeof repository.putTask>[0][] = [];
  let view: ReturnType<typeof render>;
  const draw = () =>
    React.createElement(RoadmapView, {
      ...props,
      tasks,
      onRefresh: async () => {
        view.rerender(draw());
      },
      repository: {
        ...repository,
        putTask: async (task) => {
          writes.push(task);
          tasks = [{ ...tasks[0], ...task }];
        },
      },
    });
  try {
    view = render(draw());
    fireEvent.click(
      screen.getByRole("button", { name: "Complete Inspect confirmed plant" }),
    );
    await screen.findByRole("button", {
      name: "Reopen Inspect confirmed plant",
    });
    assert.equal(writes[0].done, true);
    assert.ok(writes[0].completed_at);
    assert.equal(writes[0].auto_key, "auto-key");
    assert.ok(screen.getByRole("button", { name: "Done 1" }));
    await waitFor(() =>
      assert.equal(
        (
          screen.getByRole("button", {
            name: "Reopen Inspect confirmed plant",
          }) as HTMLButtonElement
        ).disabled,
        false,
      ),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Reopen Inspect confirmed plant" }),
    );
    await screen.findByRole("button", {
      name: "Complete Inspect confirmed plant",
    });
    assert.equal(writes[1].done, false);
    assert.equal(writes[1].completed_at, null);
    assert.equal(writes[1].due_end, `${year}-12-31`);
    assert.ok(screen.getByRole("button", { name: "Done 0" }));
    assert.ok(screen.getByText("Current source guidance"));
    assert.ok(screen.getByText(/Task completion tracks your work/));
  } finally {
    cleanup();
  }
});

test("review provenance, no-observation instruction and retry remain explicit", async () => {
  let retried = 0,
    scanned = 0;
  try {
    render(
      React.createElement(RoadmapView, {
        ...props,
        tasks: [
          row("Confirm uncertain match", {
            auto_key: "review",
            stage: "Review",
            source_details: "Identity needs review",
          }),
        ],
        planError: "Automatic plan could not be saved.",
        onRetry: () => {
          retried++;
        },
        onScan: () => {
          scanned++;
        },
      }),
    );
    assert.ok(screen.getByText(/Review needed before action/));
    assert.ok(screen.getByText("Start with a saved photo scan."));
    fireEvent.click(screen.getByRole("button", { name: "Retry yard plan" }));
    fireEvent.click(screen.getByRole("button", { name: "Scan this area" }));
    await waitFor(() => assert.equal(retried, 1));
    assert.equal(scanned, 1);
  } finally {
    cleanup();
  }
});

test("next-year automatic work stays visible after completion and inactive earlier suggestions retain history", () => {
  try {
    const view = render(
      React.createElement(RoadmapView, {
        ...props,
        tasks: [
          row("Next spring action", {
            auto_key: "next-spring",
            plan_year: year + 1,
            due_start: `${year + 1}-03-01`,
            due_end: `${year + 1}-05-31`,
          }),
          row("Next spring completed", {
            auto_key: "next-spring-done",
            plan_year: year + 1,
            done: true,
          }),
        ],
      }),
    );
    assert.ok(screen.getByRole("button", { name: "Upcoming 1" }));
    assert.ok(
      screen.getByRole("button", { name: "Reopen Next spring completed" }),
    );
    assert.equal(
      screen.getAllByText(new RegExp(`Next-year plan · ${year + 1}`)).length,
      2,
    );
    view.rerender(
      React.createElement(RoadmapView, {
        ...props,
        areaId: "",
        property: {
          id: "p1",
          name: "Yard",
          zip: "07001",
          yard_areas: [{ id: "a1", property_id: "p1", name: "Bed" }],
        },
        tasks: [
          row("Superseded suggestion", {
            auto_key: "superseded",
            plan_year: year - 1,
          }),
          row("Historical completed", { auto_key: "historical", done: true }),
          row("Manual note"),
        ],
      }),
    );
    assert.equal(
      screen.queryByRole("heading", { name: "Superseded suggestion" }),
      null,
    );
    assert.ok(screen.getByRole("heading", { name: "Historical completed" }));
    assert.ok(screen.getByRole("heading", { name: "Manual note" }));
    fireEvent.change(screen.getByLabelText("Plan year"), {
      target: { value: String(year - 1) },
    });
    assert.ok(screen.getByRole("heading", { name: "Superseded suggestion" }));
  } finally {
    cleanup();
  }
});

test("a still-applicable prior-year action remains overdue when the seasonal generator advances its year", async () => {
  const { exampleSurvey } = await import("../lib/survey");
  const { generateAutoYardPlan } = await import("../lib/auto-yard-plan");
  const property = {
    id: "p1",
    name: "Yard",
    zip: "07001",
    yard_areas: [{ id: "a1", property_id: "p1", name: "Bed" }],
  };
  const survey = {
    ...exampleSurvey(),
    source: "upload" as const,
    areaId: "a1",
    photoPath: "owner/photo.jpg",
    plants: [
      {
        id: "plant",
        plantId: "cotinus-coggygria",
        suggestion: "Smoketree",
        scientificName: "Cotinus coggygria",
        reviewed: true,
        yardScope: "yard" as const,
        candidates: [],
        box: { x: 0, y: 0, w: 1, h: 1 },
      },
    ],
  };
  const generated = generateAutoYardPlan(property, [survey]);
  assert.ok(generated.length);
  const current = generated[0];
  const priorKey = JSON.parse(current.auto_key!);
  priorKey[priorKey.length - 1] = year - 1;
  try {
    render(
      React.createElement(RoadmapView, {
        ...props,
        property,
        surveys: [survey],
        tasks: [
          row("Still applicable overdue action", {
            auto_key: JSON.stringify(priorKey),
            plan_year: year - 1,
            due_start: `${year - 1}-03-01`,
            due_end: `${year - 1}-05-31`,
          }),
          row("Removed species action", {
            auto_key: JSON.stringify([
              "yard-plan-v1",
              "p1",
              "a1",
              "removed species",
              "removed action",
              "Spring",
              year - 1,
            ]),
            plan_year: year - 1,
            due_end: `${year - 1}-05-31`,
          }),
        ],
      }),
    );
    assert.ok(
      screen.getByRole("heading", { name: "Still applicable overdue action" }),
    );
    assert.ok(screen.getByRole("button", { name: "Overdue 1" }));
    assert.equal(
      screen.queryByRole("heading", { name: "Removed species action" }),
      null,
    );
  } finally {
    cleanup();
  }
});
